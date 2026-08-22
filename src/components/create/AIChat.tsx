import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles } from "lucide-react";

interface AIChatProps {
  content: string;
  isStreaming: boolean;
  label?: string;
  className?: string;
}

const AIChat = ({ content, isStreaming, label = "ForgeAI", className = "" }: AIChatProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
          <Sparkles size={13} className="text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {isStreaming && (
          <span className="ml-auto text-[11px] shimmer-text font-medium">analyzing...</span>
        )}
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="px-4 py-3 max-h-[500px] overflow-y-auto"
      >
        <div className={`ai-chat-prose ${isStreaming ? "ai-chat-streaming" : ""}`}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
