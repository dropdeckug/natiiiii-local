import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp, ChevronDown, Gauge, Loader2, Mic, Paperclip, Square, X, FileText, Image as ImageIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ComposerAttachment {
  id: string;
  name: string;
  mime: string;
  kind: "image" | "text";
  /** data URL for images, raw text for text files */
  content: string;
  size: number;
}

export interface ComposerOption<T extends string> {
  id: T;
  label: string;
  description: string;
  icon?: LucideIcon;
}

const TEXT_EXT = /\.(txt|md|markdown|json|jsonc|ya?ml|toml|csv|tsv|log|xml|html?|css|scss|s?js|[cm]?[jt]sx?|java|kt|kts|gradle|properties|swift|rb|py|go|rs|sh|env|ini|cfg|plist|pro)$/i;
const MAX_FILE_BYTES = 512 * 1024;

/** 16-bit mono WAV encoder — produces a complete, decodable file per recording. */
function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(length);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }

  // Downsample to 16 kHz to keep uploads small.
  const target = 16000;
  const ratio = sampleRate / target;
  const outLen = Math.floor(merged.length / ratio);
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, merged[Math.floor(i * ratio)] || 0));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, target, true);
  view.setUint32(28, target * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}

const WaveBars = ({ level }: { level: number }) => {
  const bars = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);
  return (
    <div className="flex items-end gap-[2px] h-4">
      {bars.map((i) => {
        const phase = Math.sin((Date.now() / 140) + i);
        const h = 3 + Math.abs(phase) * 13 * Math.min(1, 0.25 + level * 3);
        return (
          <span
            key={i}
            className="w-[2px] rounded-full bg-primary/80"
            style={{ height: `${h}px`, transition: "height 90ms linear" }}
          />
        );
      })}
    </div>
  );
};

interface ChatComposerProps<M extends string, S extends string> {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string, attachments: ComposerAttachment[]) => void;
  isLoading?: boolean;
  mode: M;
  modeOptions: ComposerOption<M>[];
  onModeChange: (m: M) => void;
  effort: S;
  effortOptions: ComposerOption<S>[];
  onEffortChange: (s: S) => void;
  showEffort?: boolean;
  /** Model picker rendered on the right of the toolbar. */
  modelSlot?: ReactNode;
  placeholder?: string;
}

function ChatComposer<M extends string, S extends string>({
  value, onChange, onSend, isLoading, mode, modeOptions, onModeChange,
  effort, effortOptions, onEffortChange, showEffort = true, modelSlot,
  placeholder = "What can I help you build?",
}: ChatComposerProps<M, S>) {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const recRef = useRef<{ stop: () => Promise<Blob>; } | null>(null);

  const activeMode = modeOptions.find(o => o.id === mode) || modeOptions[0];
  const activeEffort = effortOptions.find(o => o.id === effort) || effortOptions[0];

  /* ── auto-grow textarea ── */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(240, Math.max(52, el.scrollHeight))}px`;
  }, [value]);

  /* ── attachments ── */
  const addFiles = useCallback(async (fileList: File[]) => {
    const accepted: ComposerAttachment[] = [];
    for (const file of fileList) {
      if (file.type.startsWith("video/")) { toast.error(`Videos aren't supported (${file.name})`); continue; }
      const isImage = file.type.startsWith("image/");
      const isText = file.type.startsWith("text/") || TEXT_EXT.test(file.name) || file.type === "application/json";
      if (!isImage && !isText) { toast.error(`Unsupported file: ${file.name}`); continue; }
      if (file.size > MAX_FILE_BYTES && !isImage) { toast.error(`${file.name} is too large (max 512KB)`); continue; }
      try {
        const content = isImage
          ? await new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(String(r.result));
              r.onerror = rej;
              r.readAsDataURL(file);
            })
          : (await file.text()).slice(0, 200_000);
        accepted.push({
          id: crypto.randomUUID(),
          name: file.name || (isImage ? "pasted-image.png" : "file.txt"),
          mime: file.type || (isImage ? "image/png" : "text/plain"),
          kind: isImage ? "image" : "text",
          content,
          size: file.size,
        });
      } catch { toast.error(`Couldn't read ${file.name}`); }
    }
    if (accepted.length) setAttachments(prev => [...prev, ...accepted].slice(0, 10));
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) addFiles(files);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items.filter(i => i.kind === "file").map(i => i.getAsFile()).filter(Boolean) as File[];
    if (files.length) { e.preventDefault(); addFiles(files); }
  };

  /* ── voice recording ── */
  const startRecording = useCallback(async () => {
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { toast.error("Microphone access is needed to record."); return; }

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const pcm: Float32Array[] = [];
    node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      pcm.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i += 32) sum += Math.abs(data[i]);
      setLevel(Math.min(1, (sum / (data.length / 32)) * 4));
    };
    source.connect(analyser);
    source.connect(node);
    node.connect(ctx.destination);
    setRecording(true);

    recRef.current = {
      stop: async () => {
        stream.getTracks().forEach(t => t.stop());
        node.disconnect();
        source.disconnect();
        const blob = encodeWav(pcm, ctx.sampleRate);
        await ctx.close();
        setRecording(false);
        setLevel(0);
        return blob;
      },
    };
  }, []);

  const stopRecording = useCallback(async (send: boolean) => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    const blob = await rec.stop();
    if (!send) return;
    if (blob.size < 4096) { toast.error("That recording was empty — please try again."); return; }

    setTranscribing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData();
      form.append("file", blob, "recording.wav");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Transcription failed (${res.status})`);
      const text = (json.text || "").trim();
      if (!text) { toast.error("Nothing was transcribed — try again."); return; }
      onChange(value ? `${value} ${text}` : text);
      textareaRef.current?.focus();
    } catch (e: any) {
      toast.error(e?.message || "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }, [onChange, value]);

  const submit = () => {
    if (isLoading) return;
    if (!value.trim() && attachments.length === 0) return;
    onSend(value, attachments);
    setAttachments([]);
  };

  return (
    <div className="shrink-0 p-3 border-t border-border">
      <div
        onDragEnter={(e) => { e.preventDefault(); dragDepth.current++; setDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); }}
        onDrop={onDrop}
        className={`relative bg-muted/30 rounded-xl border transition-colors ${dragging ? "border-primary/60" : "border-border"}`}
      >
        {/* Drop overlay */}
        {dragging && (
          <div className="absolute inset-0 z-20 rounded-xl backdrop-blur-md bg-background/60 border border-dashed border-primary/60 flex flex-col items-center justify-center gap-1 animate-fade-in">
            <Paperclip size={16} className="text-primary" />
            <span className="text-[12px] font-medium text-foreground">Drop them here</span>
            <span className="text-[10.5px] text-muted-foreground">Images, text, markdown & code files</span>
          </div>
        )}

        {/* Attachment strip — horizontally swipeable */}
        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-2.5 pt-2.5 pb-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
            {attachments.map(att => (
              <div
                key={att.id}
                className="group relative shrink-0 flex items-center gap-1.5 pl-1.5 pr-6 py-1 rounded-lg border border-border bg-background/70 max-w-[180px]"
              >
                {att.kind === "image" ? (
                  <img src={att.content} alt={att.name} className="w-6 h-6 rounded object-cover" />
                ) : (
                  <span className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                    <FileText size={12} className="text-muted-foreground" />
                  </span>
                )}
                <span className="truncate text-[11px] text-foreground/85">{att.name}</span>
                <button
                  onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground/70 hover:text-foreground"
                  title="Remove"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={recording ? "Listening…" : placeholder}
          rows={2}
          className="w-full bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60 resize-none min-h-[52px] max-h-[240px] px-3.5 pt-3 pb-1 overflow-y-auto"
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-1 min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,text/*,.md,.txt,.json,.yaml,.yml,.csv,.log,.xml,.html,.css,.js,.jsx,.ts,.tsx,.java,.kt,.gradle,.properties,.swift,.py,.rb,.go,.rs,.sh"
              className="hidden"
              onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.currentTarget.value = ""; }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              title="Attach files"
            >
              <Paperclip size={15} />
            </button>

            {/* Mode dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                {activeMode?.icon ? <activeMode.icon size={13} /> : null}
                <span>{activeMode?.label}</span>
                <ChevronDown size={10} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 rounded-[6px]">
                {modeOptions.map(opt => (
                  <DropdownMenuItem
                    key={opt.id}
                    onClick={() => onModeChange(opt.id)}
                    className={`rounded-[4px] flex items-start gap-2 py-1.5 ${mode === opt.id ? "bg-muted" : ""}`}
                  >
                    {opt.icon ? <opt.icon size={13} className="mt-0.5 shrink-0 text-muted-foreground" /> : null}
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium">{opt.label}</span>
                      <span className="text-[10.5px] text-muted-foreground leading-tight">{opt.description}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {showEffort && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/70 text-[11px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
                  <Gauge size={13} />
                  <span className="capitalize">{activeEffort?.label}</span>
                  <ChevronDown size={10} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60 rounded-[6px]">
                  {effortOptions.map(opt => (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={() => onEffortChange(opt.id)}
                      className={`rounded-[4px] flex flex-col items-start gap-0.5 py-1.5 ${effort === opt.id ? "bg-muted" : ""}`}
                    >
                      <span className="text-xs font-medium">{opt.label}</span>
                      <span className="text-[10.5px] text-muted-foreground leading-tight">{opt.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {recording ? (
              <div className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full bg-primary/10 border border-primary/30">
                <WaveBars level={level} />
                <button onClick={() => stopRecording(false)} title="Cancel" className="p-1 text-muted-foreground hover:text-foreground">
                  <X size={12} />
                </button>
                <button onClick={() => stopRecording(true)} title="Stop & transcribe" className="p-1 rounded-full bg-primary text-primary-foreground">
                  <Square size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={startRecording}
                disabled={transcribing}
                title="Record voice"
                className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                {transcribing ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
              </button>
            )}
            {modelSlot}
            <button
              onClick={submit}
              disabled={isLoading || (!value.trim() && attachments.length === 0)}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/40 text-center mt-1.5">Agent can make mistakes, so double-check its output.</p>
    </div>
  );
}

export default ChatComposer;
export { ImageIcon };
