import { useEffect, useState } from "react";
import { Check, X, Loader2, Smartphone, Monitor, Apple } from "lucide-react";
import type { CprProgressState } from "@/lib/cpr/runner";

interface CprProgressScreenProps {
  state: CprProgressState;
  projectName: string;
  /** Target platforms this canonical project will be packaged for. */
  targets?: string[];
  onRetry?: () => void;
  onCancel?: () => void;
}

const TARGET_ICONS: Record<string, typeof Smartphone> = {
  android: Smartphone,
  ios: Apple,
  desktop: Monitor,
};

/** Determinate progress ring with a soft trailing glow. */
const ProgressRing = ({ percent, failed }: { percent: number; failed: boolean }) => {
  const size = 172;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="stroke-muted/40"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className={failed ? "stroke-destructive" : "stroke-primary"}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground">
          {Math.round(percent)}
          <span className="text-xl text-muted-foreground">%</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
          {failed ? "Halted" : percent >= 100 ? "Sealed" : "Canonicalising"}
        </span>
      </div>
    </div>
  );
};

const CprProgressScreen = ({
  state,
  projectName,
  targets = ["android"],
  onRetry,
  onCancel,
}: CprProgressScreenProps) => {
  const failed = !!state.error;
  const [shownAssurance, setShownAssurance] = useState(state.assurance);

  // Cross-fade the assurance copy rather than swapping it abruptly.
  useEffect(() => {
    const t = setTimeout(() => setShownAssurance(state.assurance), 120);
    return () => clearTimeout(t);
  }, [state.assurance]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground overflow-auto">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl grid gap-10 lg:grid-cols-[auto_1fr] lg:items-start">
          {/* Ring + assurance */}
          <div className="flex flex-col items-center lg:items-start gap-6">
            <ProgressRing percent={state.percent} failed={failed} />
            <div className="max-w-xs text-center lg:text-left">
              <h1 className="text-lg font-semibold tracking-tight">
                Preparing {projectName || "your project"}
              </h1>
              <p
                key={shownAssurance}
                className="text-sm text-muted-foreground mt-2 leading-relaxed animate-fade-in"
              >
                {failed ? state.error : shownAssurance}
              </p>
            </div>

            {targets.length > 0 && (
              <div className="flex items-center gap-2">
                {targets.map((t) => {
                  const Icon = TARGET_ICONS[t] ?? Smartphone;
                  return (
                    <span
                      key={t}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] capitalize text-muted-foreground"
                    >
                      <Icon size={12} />
                      {t}
                    </span>
                  );
                })}
              </div>
            )}

            {failed && (
              <div className="flex gap-2">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Run CPR again
                  </button>
                )}
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="h-9 rounded-full border border-border px-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back to setup
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Timeline — mirrors the action-panel treatment */}
          <div className="rounded-2xl border border-border bg-card/60 p-2">
            {state.steps.map((step, idx) => {
              const isActive = step.status === "active";
              const isDone = step.status === "done";
              const isError = step.status === "error";
              return (
                <div key={step.id} className="relative flex items-start gap-3 px-3 py-2.5">
                  {idx < state.steps.length - 1 && (
                    <span className="absolute left-[26px] top-9 bottom-0 w-px bg-border/60" />
                  )}
                  <span
                    className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isDone
                        ? "bg-primary/15 text-primary"
                        : isError
                        ? "bg-destructive/15 text-destructive"
                        : isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-muted/50 text-muted-foreground/50"
                    }`}
                  >
                    {isDone ? (
                      <Check size={13} />
                    ) : isError ? (
                      <X size={13} />
                    ) : isActive ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm leading-tight transition-colors ${
                        isActive
                          ? "font-medium text-foreground"
                          : isDone
                          ? "text-muted-foreground"
                          : isError
                          ? "text-destructive"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      {step.label}
                    </p>
                    {step.detail && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/60">
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CprProgressScreen;
