import { useState } from "react";
import { Copy, Check, RefreshCw, Volume2, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

interface MessageActionsProps {
  content: string;
  onRegenerate?: () => void;
}

const MessageActions = ({ content, onRegenerate }: MessageActionsProps) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      toast.error("Speech not supported in this browser");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(content.replace(/```[\s\S]*?```/g, "code block").slice(0, 4000));
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  const Btn = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
    >
      {children}
    </button>
  );

  return (
    <div className="mt-2 ml-2 flex items-center gap-0.5 opacity-70 hover:opacity-100 transition-opacity">
      <Btn onClick={handleCopy} title="Copy">
        {copied ? <Check size={13} className="text-[hsl(var(--success))]" /> : <Copy size={13} />}
      </Btn>
      {onRegenerate && (
        <Btn onClick={onRegenerate} title="Regenerate">
          <RefreshCw size={13} />
        </Btn>
      )}
      <Btn onClick={handleSpeak} title={speaking ? "Stop speaking" : "Read aloud"}>
        <Volume2 size={13} className={speaking ? "text-primary" : ""} />
      </Btn>
      <Btn onClick={() => { setFeedback("up"); toast.success("Thanks for the feedback"); }} title="Good response">
        <ThumbsUp size={13} className={feedback === "up" ? "text-primary" : ""} />
      </Btn>
      <Btn onClick={() => { setFeedback("down"); toast("Feedback noted"); }} title="Bad response">
        <ThumbsDown size={13} className={feedback === "down" ? "text-destructive" : ""} />
      </Btn>
    </div>
  );
};

export default MessageActions;