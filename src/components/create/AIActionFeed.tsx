import { useState, useEffect, useRef } from "react";
import { Check, Circle, Loader2 } from "lucide-react";

export interface AIAction {
  id: string;
  title: string; // max 7 words
  status: "pending" | "active" | "done" | "error";
  finding?: string; // markdown-style finding shown below
  elapsed?: number; // seconds
  startedAt?: number;
}

interface AIActionFeedProps {
  actions: AIAction[];
  className?: string;
}

const AIActionFeed = ({ actions, className = "" }: AIActionFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new actions appear
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [actions.length, actions[actions.length - 1]?.status]);

  return (
    <div
      ref={containerRef}
      className={`space-y-1 overflow-y-auto max-h-[400px] ${className}`}
    >
      {actions.map((action) => (
        <ActionItem key={action.id} action={action} />
      ))}
    </div>
  );
};

const ActionItem = ({ action }: { action: AIAction }) => {
  const [elapsed, setElapsed] = useState(action.elapsed || 0);

  // Live timer for active actions
  useEffect(() => {
    if (action.status !== "active" || !action.startedAt) return;
    const interval = setInterval(() => {
      setElapsed(((Date.now() - action.startedAt!) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [action.status, action.startedAt]);

  // Use final elapsed if done
  const displayElapsed = action.status === "done" || action.status === "error"
    ? action.elapsed || elapsed
    : elapsed;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2.5 py-1.5 px-1">
        {/* Status icon */}
        {action.status === "done" ? (
          <div className="ai-action-tick shrink-0">
            <Check size={14} strokeWidth={3} className="text-[hsl(var(--success))]" />
          </div>
        ) : action.status === "error" ? (
          <div className="shrink-0 w-5 h-5 rounded-full bg-destructive/15 flex items-center justify-center">
            <span className="text-destructive text-[10px] font-bold">✗</span>
          </div>
        ) : action.status === "active" ? (
          <Loader2 size={16} className="shrink-0 text-primary animate-spin" />
        ) : (
          <Circle size={16} className="shrink-0 text-muted-foreground/30" />
        )}

        {/* Title */}
        <span
          className={`text-sm leading-tight flex-1 transition-all duration-300 ${
            action.status === "done"
              ? "line-through text-muted-foreground/60"
              : action.status === "error"
              ? "line-through text-destructive/70"
              : action.status === "active"
              ? "ai-action-active font-medium"
              : "text-muted-foreground/40"
          }`}
        >
          {action.title}
        </span>

        {/* Elapsed time */}
        {(action.status === "done" || action.status === "active" || action.status === "error") && displayElapsed > 0 && (
          <span className={`text-[11px] tabular-nums shrink-0 ${
            action.status === "active" ? "text-primary" : "text-muted-foreground/50"
          }`}>
            {displayElapsed.toFixed(1)}s
          </span>
        )}
      </div>

      {/* Finding / AI insight */}
      {action.finding && action.status === "done" && (
        <div className="ml-8 pb-1.5 animate-fade-in">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {action.finding.split("\n").map((line, i) => (
              <span key={i} className="block">
                {line.startsWith("→") || line.startsWith("•") || line.startsWith("-") ? (
                  <span className="text-foreground/70">{line}</span>
                ) : (
                  line
                )}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* Error finding */}
      {action.finding && action.status === "error" && (
        <div className="ml-8 pb-1.5 animate-fade-in">
          <p className="text-xs text-destructive/80 leading-relaxed">{action.finding}</p>
        </div>
      )}
    </div>
  );
};

export default AIActionFeed;
