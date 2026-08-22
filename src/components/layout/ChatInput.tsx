import { useState, useRef } from "react";
import { Send, Loader2, Paperclip } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";

const ChatInput = () => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { files } = useProjectStore();

  const sourceCount = files.length > 0 ? countAllFiles(files) : 0;

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    // TODO: Connect to ForgeAI
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 py-3 bg-[hsl(220,13%,10%)]">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 bg-card rounded-2xl border border-border/50 px-3 py-2">
          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-0.5">
            <Paperclip size={16} />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask NativeBridge AI..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60 resize-none min-h-[24px] max-h-[120px] py-1"
            style={{ fontFamily: "inherit" }}
          />
          <div className="flex items-center gap-2 shrink-0 mb-0.5">
            {sourceCount > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                {sourceCount} sources
              </span>
            )}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center mt-1.5">
          <span className="text-[10px] text-muted-foreground/40">NativeBridge AI · Powered by Gemini</span>
        </div>
      </div>
    </div>
  );
};

function countAllFiles(files: { type: string; children?: any[] }[]): number {
  let c = 0;
  for (const f of files) {
    if (f.type === "file") c++;
    if (f.children) c += countAllFiles(f.children);
  }
  return c;
}

export default ChatInput;
