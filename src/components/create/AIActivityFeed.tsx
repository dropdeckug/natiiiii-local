import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Search,
  Zap,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export type ActionType =
  | "thinking"
  | "reasoning"
  | "tool_call"
  | "tool_result"
  | "question"
  | "success"
  | "error";

export interface ActivityAction {
  id: string;
  type: ActionType;
  title: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
  result?: string;
  elapsed?: number;
  startedAt?: number;
  collapsible?: boolean;
}

interface AIActivityFeedProps {
  actions: ActivityAction[];
  className?: string;
  estimatedTimeRemaining?: number;
  progressPercent?: number;
  elapsedSeconds?: number;
}

const typeConfig: Record<
  ActionType,
  { icon: typeof Sparkles; colorClass: string; label?: string }
> = {
  thinking: { icon: Sparkles, colorClass: "text-primary" },
  reasoning: { icon: Clock, colorClass: "text-muted-foreground" },
  tool_call: { icon: Search, colorClass: "text-[hsl(var(--info))]", label: "Calling tool" },
  tool_result: { icon: Zap, colorClass: "text-[hsl(var(--success))]", label: "Result" },
  question: { icon: MessageCircle, colorClass: "text-[hsl(var(--warning))]" },
  success: { icon: CheckCircle2, colorClass: "text-[hsl(var(--success))]" },
  error: { icon: XCircle, colorClass: "text-destructive" },
};

const AIActivityFeed = ({
  actions,
  className = "",
  estimatedTimeRemaining,
  progressPercent,
  elapsedSeconds,
}: AIActivityFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [actions.length, actions[actions.length - 1]?.status]);

  const hasEta =
    estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0;
  const hasProgress =
    progressPercent !== undefined && progressPercent > 0;

  return (
    <div
      ref={containerRef}
      className={`activity-feed-container overflow-y-auto h-full ${className}`}
    >
      {/* ETA / Progress bar */}
      {(hasEta || hasProgress) && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
            <span className="tabular-nums">
              {elapsedSeconds !== undefined
                ? `${elapsedSeconds.toFixed(0)}s elapsed`
                : ""}
            </span>
            {hasEta && (
              <span className="tabular-nums text-primary font-medium">
                ~{Math.ceil(estimatedTimeRemaining!)}s remaining
              </span>
            )}
          </div>
          {hasProgress && (
            <div className="w-full h-1 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, progressPercent!)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {actions.map((action, idx) => (
        <ActivityItem
          key={action.id}
          action={action}
          isLast={idx === actions.length - 1}
        />
      ))}
    </div>
  );
};

const ActivityItem = ({
  action,
  isLast,
}: {
  action: ActivityAction;
  isLast: boolean;
}) => {
  const [elapsed, setElapsed] = useState(action.elapsed || 0);
  const [collapsed, setCollapsed] = useState(true);
  const cfg = typeConfig[action.type] || typeConfig.thinking;
  const Icon = cfg.icon;

  useEffect(() => {
    if (action.status !== "active" || !action.startedAt) return;
    const interval = setInterval(() => {
      setElapsed((Date.now() - action.startedAt!) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [action.status, action.startedAt]);

  const displayElapsed =
    action.status === "done" || action.status === "error"
      ? action.elapsed || elapsed
      : elapsed;

  const isDone = action.status === "done";
  const isActive = action.status === "active";
  const isError = action.status === "error";

  return (
    <div className="activity-item animate-fade-in relative">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="activity-connector" />
      )}

      <div className="flex items-start gap-3 py-2.5 px-3 relative">
        {/* Icon node */}
        <div
          className={`activity-node shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
            isDone
              ? "bg-[hsl(var(--success))]/15"
              : isError
              ? "bg-destructive/15"
              : isActive
              ? "bg-primary/15 activity-node-pulse"
              : "bg-muted/50"
          }`}
        >
          {isDone ? (
            <CheckCircle2
              size={15}
              className="text-[hsl(var(--success))]"
            />
          ) : isError ? (
            <XCircle size={15} className="text-destructive" />
          ) : (
            <Icon
              size={15}
              className={`${cfg.colorClass} ${
                isActive ? "animate-pulse" : ""
              }`}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {cfg.label && isActive && (
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {cfg.label}
              </span>
            )}
            <span
              className={`text-sm leading-tight transition-all duration-300 ${
                isDone
                  ? "text-muted-foreground/70"
                  : isError
                  ? "text-destructive/80"
                  : isActive
                  ? "ai-action-active font-medium"
                  : "text-muted-foreground/40"
              }`}
            >
              {action.title}
            </span>

            {/* Elapsed */}
            {(isDone || isActive || isError) && displayElapsed > 0 && (
              <span
                className={`text-[10px] tabular-nums shrink-0 ml-auto ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground/40"
                }`}
              >
                {displayElapsed.toFixed(1)}s
              </span>
            )}
          </div>

          {/* Detail text */}
          {action.detail && isDone && (
            <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">
              {action.detail}
            </p>
          )}

          {/* Collapsible result */}
          {action.result && (isDone || isError) && (
            <div className="mt-1.5">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {collapsed ? (
                  <ChevronRight size={10} />
                ) : (
                  <ChevronDown size={10} />
                )}
                {collapsed ? "Show result" : "Hide result"}
              </button>
              {!collapsed && (
                <div className="mt-1 px-2.5 py-2 rounded-lg bg-muted/30 border border-border/50 animate-fade-in">
                  <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
                    {action.result}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIActivityFeed;
