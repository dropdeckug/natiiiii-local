import { useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, FileCode, Folder } from "lucide-react";

/** Heuristic: does this inline code token look like a file or folder reference? */
const FILE_RE = /^[\w.\-/@]+$/;
const looksLikePath = (t: string) => {
  if (!FILE_RE.test(t) || t.length > 90 || /\s/.test(t)) return false;
  const base = t.split("/").pop() || t;
  return /\.[a-z0-9]{1,7}$/i.test(base) || (t.includes("/") && !t.startsWith("@"));
};

const openRef = (path: string, line?: number) =>
  window.dispatchEvent(new CustomEvent("grounding-ref-click", { detail: { path, line } }));

/** Small clickable file/folder pill used inside prose. */
const FileChip = ({ raw }: { raw: string }) => {
  const m = raw.match(/^(.+?):(\d+)(?:-\d+)?$/);
  const path = m ? m[1] : raw;
  const line = m ? parseInt(m[2], 10) : undefined;
  const base = path.split("/").pop() || path;
  const isFolder = !/\.[a-z0-9]{1,7}$/i.test(base);
  const Icon = isFolder ? Folder : FileCode;
  return (
    <button
      type="button"
      title={raw}
      onClick={() => openRef(path, line)}
      className="inline-flex items-center gap-1 align-middle mx-[1px] px-1.5 py-[1px] rounded border border-border bg-muted/40 text-[11px] leading-[16px] text-foreground/85 hover:border-primary/50 hover:text-primary transition-colors"
    >
      <Icon size={10} className="shrink-0 text-muted-foreground/70" />
      <span className="truncate max-w-[220px]">{base}{line ? `:${line}` : ""}</span>
    </button>
  );
};

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, "");
  const lang = /language-(\w+)/.exec(className || "")?.[1];

  const isInline = inline ?? !/\n/.test(text);
  if (isInline) {
    if (looksLikePath(text)) return <FileChip raw={text} />;
    return <code className={className} {...props}>{children}</code>;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // Minimal box: no heavy header bar — the language sits inline and the copy
  // affordance only appears on hover, keeping the transcript compact.
  return (
    <div className="relative group my-1.5 rounded-[5px] border border-border bg-muted/25 overflow-hidden">
      <pre className="!m-0 !px-2.5 !py-1.5 overflow-x-auto bg-transparent">
        <code className={`${className || ""} text-[11px] font-mono leading-[1.55] text-foreground/90`}>
          {text}
        </code>
      </pre>
      <div className="absolute top-1 right-1 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {lang && (
          <span className="text-[9.5px] font-mono uppercase tracking-wider text-muted-foreground/70">{lang}</span>
        )}
        <button
          onClick={handleCopy}
          className="p-0.5 rounded bg-background/80 border border-border text-muted-foreground/70 hover:text-foreground transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={10} className="text-[hsl(var(--success))]" /> : <Copy size={10} />}
        </button>
      </div>
    </div>
  );
};

interface ChatMarkdownProps {
  content: string;
  streaming?: boolean;
}

/**
 * Renders chat markdown with per-block reveal animation. The reveal animation
 * is keyed off block index — new blocks appended during streaming animate in
 * with a scale-origin transition (matches landing scroll-reveal).
 */
const ChatMarkdown = memo(({ content, streaming }: ChatMarkdownProps) => {
  return (
    <div className={`ai-chat-prose max-w-none ${streaming ? "ai-chat-streaming" : ""}`}>
      <ReactMarkdown
        components={{
          code: CodeBlock,
          p: ({ children }) => <p className="chat-reveal">{children}</p>,
          h1: ({ children }) => <h1 className="chat-reveal">{children}</h1>,
          h2: ({ children }) => <h2 className="chat-reveal">{children}</h2>,
          h3: ({ children }) => <h3 className="chat-reveal">{children}</h3>,
          ul: ({ children }) => <ul className="chat-reveal">{children}</ul>,
          ol: ({ children }) => <ol className="chat-reveal">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="chat-reveal">{children}</blockquote>,
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

ChatMarkdown.displayName = "ChatMarkdown";

export default ChatMarkdown;