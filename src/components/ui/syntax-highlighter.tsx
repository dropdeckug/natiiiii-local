import { Highlight, themes } from "prism-react-renderer";
import { useState } from "react";
import { Copy, Check, Pencil } from "lucide-react";
import { toast } from "sonner";

const LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  json: "json", html: "markup", css: "css", scss: "css",
  xml: "markup", svg: "markup", yaml: "yaml", yml: "yaml",
  md: "markdown", py: "python", java: "java", kt: "kotlin",
  swift: "swift", gradle: "groovy", sh: "bash", bash: "bash",
  toml: "toml", env: "bash", gitignore: "bash",
};

function getLang(ext?: string): string {
  if (!ext) return "typescript";
  return LANG_MAP[ext.toLowerCase()] || "typescript";
}

/** Normalize a caller-supplied language name to a Prism-supported grammar. */
function normalizeLang(lang: string): string {
  const l = lang.toLowerCase();
  if (l === "xml" || l === "svg" || l === "html" || l === "htm") return "markup";
  return LANG_MAP[l] || l;
}

interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  extension?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
  editable?: boolean;
  onEdit?: (newCode: string) => void;
  showCopy?: boolean;
}

const SyntaxHighlighter = ({
  code,
  language,
  extension,
  showLineNumbers = false,
  maxHeight = "none",
  editable = false,
  onEdit,
  showCopy = true,
}: SyntaxHighlighterProps) => {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(code);

  const lang = language ? normalizeLang(language) : getLang(extension);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onEdit?.(editValue);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="relative rounded-[4px] overflow-hidden border border-border">
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Edit Mode</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setEditing(false); setEditValue(code); }} className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded">Cancel</button>
            <button onClick={handleSave} className="text-[10px] text-primary-foreground bg-primary hover:bg-primary/90 px-2 py-0.5 rounded">Save</button>
          </div>
        </div>
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full bg-background text-foreground font-mono text-[13px] p-4 leading-relaxed resize-none focus:outline-none"
          style={{ maxHeight: maxHeight !== "none" ? maxHeight : "500px", minHeight: "200px" }}
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className="relative group rounded-[4px] overflow-hidden">
      {(showCopy || editable) && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {editable && onEdit && (
            <button
              onClick={() => { setEditValue(code); setEditing(true); }}
              className="p-1.5 rounded bg-muted/80 backdrop-blur text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil size={12} />
            </button>
          )}
          {showCopy && (
            <button
              onClick={handleCopy}
              className="p-1.5 rounded bg-muted/80 backdrop-blur text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
            </button>
          )}
        </div>
      )}
      <Highlight theme={themes.nightOwl} code={code.trimEnd()} language={lang as any}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} text-[13px] leading-relaxed overflow-auto`}
            style={{ ...style, margin: 0, padding: "1rem", maxHeight, background: "hsl(var(--muted) / 0.3)" }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {showLineNumbers && (
                  <span className="inline-block w-8 text-right mr-4 text-muted-foreground/40 select-none text-[11px]">
                    {i + 1}
                  </span>
                )}
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
};

export default SyntaxHighlighter;
