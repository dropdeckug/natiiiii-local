/**
 * CopilotTimeline — plain, card-less timeline primitives modelled on the
 * VS Code Copilot agent transcript:
 *
 *   • narration paragraphs sit directly on the surface (no bubbles, no cards)
 *   • tool activity is a single line: small icon + verb + a chip for the target
 *   • shell commands render in a bordered mono box with copy / run affordances
 *   • grouped work collapses behind a chevron summary ("Finished with 2 steps +128 -1")
 *
 * These are used by BOTH the chat transcript and the build Action Panel so the
 * two surfaces look identical.
 */

import { useState, type ReactNode } from "react";
import AgentOrb from "@/components/ai/AgentOrb";
import type { RepairTodo } from "@/stores/buildStore";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  FileCode,
  Folder,
  ListTodo,
  Loader2,
  Pencil,
  Play,
  Search,
  Terminal,
  X,
} from "lucide-react";

/* ─────────────────────────── narration ─────────────────────────── */

export const Narration = ({
  children,
  streaming,
  muted,
}: {
  children: ReactNode;
  streaming?: boolean;
  muted?: boolean;
}) => (
  <p
    className={`text-[13px] leading-relaxed py-1.5 ${
      streaming ? "ai-thinking-shimmer" : muted ? "text-muted-foreground" : "text-foreground/90"
    }`}
  >
    {children}
  </p>
);

/* ───────────────────────────── chips ───────────────────────────── */

export const RefChip = ({
  label,
  kind = "file",
  onClick,
  title,
}: {
  label: string;
  kind?: "file" | "folder" | "code";
  onClick?: () => void;
  title?: string;
}) => {
  const Icon = kind === "folder" ? Folder : FileCode;
  return (
    <button
      type="button"
      title={title || label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex items-center gap-1 max-w-full px-1.5 py-[1px] rounded border border-border bg-muted/40 align-middle text-[11px] leading-[16px] transition-colors ${
        onClick ? "hover:border-primary/50 hover:text-primary cursor-pointer" : "cursor-default"
      }`}
    >
      {kind === "code" ? null : <Icon size={10} className="shrink-0 text-muted-foreground/70" />}
      <span className={`truncate ${kind === "code" ? "font-mono text-foreground/80" : "text-foreground/80"}`}>
        {label}
      </span>
    </button>
  );
};

export const DiffStat = ({ added, removed }: { added?: number; removed?: number }) => {
  if (!added && !removed) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums align-middle">
      {added ? <span className="text-[hsl(var(--success))]">+{added}</span> : null}
      {removed ? <span className="text-destructive">-{removed}</span> : null}
    </span>
  );
};

/* ─────────────────────────── tool lines ─────────────────────────── */

export type ToolStatus = "active" | "done" | "error" | "pending";

const StatusGlyph = ({ status, hint }: { status: ToolStatus; hint?: string }) =>
  status === "active" ? (
    <AgentOrb hint={hint} size={20} className="w-[13px] h-[13px]" />
  ) : status === "error" ? (
    <X size={11} className="text-destructive" strokeWidth={2.5} />
  ) : status === "done" ? (
    <Check size={11} className="text-muted-foreground/60" strokeWidth={2.5} />
  ) : (
    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
  );

/**
 * A single tool line — e.g. "Read [java]" or "Searched for regex `foo`, 171 results".
 */
export const ToolLine = ({
  verb,
  icon,
  status = "done",
  chips,
  code,
  trailing,
  children,
  detail,
  onToggle,
  expanded,
}: {
  verb: string;
  icon?: ReactNode;
  status?: ToolStatus;
  chips?: { label: string; kind?: "file" | "folder" | "code"; onClick?: () => void }[];
  code?: string;
  trailing?: ReactNode;
  children?: ReactNode;
  detail?: string;
  onToggle?: () => void;
  expanded?: boolean;
}) => (
  <div className="py-[3px]">
    <div className="flex items-start gap-2 text-[12px]">
      <span className="shrink-0 mt-[3px] w-[13px] h-[13px] flex items-center justify-center text-muted-foreground/70">
        {icon ?? <StatusGlyph status={status} hint={verb} />}
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggle}
          disabled={!onToggle}
          className={`text-left w-full ${onToggle ? "cursor-pointer" : "cursor-default"}`}
        >
          <span
            className={`${
              status === "active"
                ? "ai-thinking-shimmer font-medium"
                : status === "error"
                ? "text-destructive/85"
                : "text-muted-foreground"
            }`}
          >
            {verb}
          </span>
          {code && (
            <code className="ml-1.5 px-1 py-[1px] rounded bg-muted/50 border border-border font-mono text-[11px] text-foreground/80 break-all">
              {code}
            </code>
          )}
          {chips?.map((c, i) => (
            <span key={i} className="ml-1.5 inline-block">
              <RefChip label={c.label} kind={c.kind} onClick={c.onClick} />
            </span>
          ))}
          {trailing && <span className="ml-1.5 text-muted-foreground/60">{trailing}</span>}
          {onToggle &&
            (expanded ? (
              <ChevronDown size={11} className="inline ml-1.5 text-muted-foreground/50 align-middle" />
            ) : (
              <ChevronRight size={11} className="inline ml-1.5 text-muted-foreground/50 align-middle" />
            ))}
        </button>
        {detail && !expanded && (
          <p className="text-[11px] text-muted-foreground/55 leading-snug mt-0.5 truncate">{detail}</p>
        )}
        {children}
      </div>
    </div>
  </div>
);

export const ReadLine = (props: Omit<Parameters<typeof ToolLine>[0], "icon" | "verb"> & { verb?: string }) => (
  <ToolLine {...props} verb={props.verb ?? "Read"} icon={<Search size={11} className="text-muted-foreground/60" />} />
);

export const SearchLine = (props: Omit<Parameters<typeof ToolLine>[0], "icon">) => (
  <ToolLine {...props} icon={<Search size={11} className="text-muted-foreground/60" />} />
);

/* ─────────────────────────── edit lines ─────────────────────────── */

export const EditLine = ({
  path,
  added,
  removed,
  status = "done",
  onOpen,
  children,
  expandable,
  diffAdded,
  diffRemoved,
}: {
  path: string;
  added?: number;
  removed?: number;
  status?: ToolStatus;
  onOpen?: () => void;
  children?: ReactNode;
  expandable?: boolean;
  /** Preview of the actual added / removed lines, rendered as a compact diff box. */
  diffAdded?: string[];
  diffRemoved?: string[];
}) => {
  const [open, setOpen] = useState(false);
  const hasDiff = Boolean(diffAdded?.length || diffRemoved?.length);
  return (
    <div className="py-[3px]">
      <div className="flex items-start gap-2 text-[12px]">
        <span className="shrink-0 mt-[3px] w-[13px] h-[13px] flex items-center justify-center">
          {status === "active" ? (
            <AgentOrb state="composing" size={20} className="w-[13px] h-[13px]" />
          ) : (
            <Pencil size={11} className="text-muted-foreground/60" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => expandable && children && setOpen((v) => !v)}
            className={`text-left ${expandable && children ? "cursor-pointer" : "cursor-default"}`}
          >
            <span className={status === "active" ? "ai-thinking-shimmer" : "text-muted-foreground"}>
              {status === "active" ? "Editing" : "Edited"}
            </span>
            <span className="ml-1.5 inline-block">
              <RefChip label={path.split("/").pop() || path} title={path} onClick={onOpen} />
            </span>
            <span className="ml-1.5">
              <DiffStat added={added} removed={removed} />
            </span>
            {expandable && children &&
              (open ? (
                <ChevronDown size={11} className="inline ml-1.5 text-muted-foreground/50 align-middle" />
              ) : (
                <ChevronRight size={11} className="inline ml-1.5 text-muted-foreground/50 align-middle" />
              ))}
          </button>
          {open && children}
          {hasDiff && (
            <div className="mt-1 rounded-[5px] border border-border bg-muted/20 overflow-hidden">
              <div className="max-h-[190px] overflow-auto py-1">
                {(diffRemoved || []).slice(0, 12).map((l, i) => (
                  <div
                    key={`r${i}`}
                    className="flex gap-1.5 px-2 font-mono text-[10.5px] leading-[1.6] text-destructive/90 bg-destructive/5"
                  >
                    <span className="select-none opacity-70">-</span>
                    <span className="whitespace-pre-wrap break-all">{l.slice(0, 200) || " "}</span>
                  </div>
                ))}
                {(diffAdded || []).slice(0, 12).map((l, i) => (
                  <div
                    key={`a${i}`}
                    className="flex gap-1.5 px-2 font-mono text-[10.5px] leading-[1.6] text-[hsl(var(--success))] bg-[hsl(var(--success))]/5"
                  >
                    <span className="select-none opacity-70">+</span>
                    <span className="whitespace-pre-wrap break-all">{l.slice(0, 200) || " "}</span>
                  </div>
                ))}
              </div>
              {((diffRemoved?.length || 0) > 12 || (diffAdded?.length || 0) > 12) && (
                <div className="px-2 py-1 border-t border-border text-[10px] text-muted-foreground/60">
                  Showing first 12 lines of each side
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────── command boxes ───────────────────────── */

export const CommandBox = ({
  command,
  output,
  status = "done",
  exitCode,
  onRun,
}: {
  command: string;
  output?: string;
  status?: ToolStatus;
  exitCode?: number;
  onRun?: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="my-1.5">
      <div className="flex items-start gap-2 text-[12px] mb-1">
        <span className="shrink-0 mt-[3px] w-[13px] h-[13px] flex items-center justify-center">
          {status === "active" ? (
            <AgentOrb hint={command} kind="command" size={20} className="w-[13px] h-[13px]" />
          ) : status === "error" ? (
            <X size={11} className="text-destructive" strokeWidth={2.5} />
          ) : (
            <Terminal size={11} className="text-muted-foreground/60" />
          )}
        </span>
        <span className={status === "active" ? "ai-thinking-shimmer" : "text-muted-foreground"}>
          {status === "active" ? "Running" : status === "error" ? "Command failed" : "Ran"}
        </span>
        {exitCode != null && (
          <span
            className={`text-[11px] tabular-nums ${
              exitCode === 0 ? "text-[hsl(var(--success))]" : "text-destructive"
            }`}
          >
            exit {exitCode}
          </span>
        )}
      </div>

      <div className="ml-[21px] rounded-md border border-border bg-muted/25 overflow-hidden">
        <div className="flex items-start gap-2 px-2.5 py-2">
          <pre className="flex-1 min-w-0 m-0 font-mono text-[11.5px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-all">
            {command}
          </pre>
          <div className="flex items-center gap-1.5 shrink-0">
            {onRun && (
              <button
                onClick={onRun}
                title="Run command"
                className="text-muted-foreground/60 hover:text-primary transition-colors"
              >
                <Play size={12} />
              </button>
            )}
            <button
              onClick={copy}
              title="Copy command"
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {copied ? <Check size={12} className="text-[hsl(var(--success))]" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {output && (
          <>
            <button
              onClick={() => setShowOutput((v) => !v)}
              className="w-full flex items-center gap-1 px-2.5 py-1 border-t border-border text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              {showOutput ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {showOutput ? "Hide output" : "Show output"}
            </button>
            {showOutput && (
              <pre className="px-2.5 py-2 border-t border-border m-0 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all max-h-[280px] overflow-auto">
                {output}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────── collapsible group ─────────────────────── */

/**
 * Visual card for Runner-Executed AI Repair Loop attempts
 */
export const RepairLoopCard = ({
  attempt,
  maxAttempts = 3,
  status,
  diagnosisType,
  rootCause,
  evidence,
  source,
  model,
  commands,
  todos,
  results,
  notes,
  defaultOpen = true,
}: {
  attempt: number;
  maxAttempts?: number;
  status: "diagnosing" | "executing" | "succeeded" | "failed" | "exhausted";
  diagnosisType?: string;
  rootCause?: string;
  evidence?: string[];
  source?: "deterministic" | "model" | "fallback";
  model?: string | null;
  commands?: { cmd: string; name?: string; critical?: boolean }[];
  todos?: RepairTodo[];
  results?: { cmd: string; exitCode: number; ms?: number; tail?: string }[];
  notes?: string;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const isSuccess = status === "succeeded";
  const isExhausted = status === "exhausted" || status === "failed";
  const isActive = status === "diagnosing" || status === "executing";

  // Normalize or synthesize exactly 5 to-dos to fulfill the user's contract
  const effectiveTodos: RepairTodo[] =
    todos && todos.length === 5
      ? todos
      : [
          {
            id: "todo-1",
            stepNumber: 1,
            totalSteps: 5,
            title: "Inspect previous run logs & trace root cause",
            details: diagnosisType ? `Error: ${diagnosisType}` : "Analyze installer failure logs",
            status: status === "diagnosing" ? "in_progress" : "completed",
          },
          {
            id: "todo-2",
            stepNumber: 2,
            totalSteps: 5,
            title: "Formulate remediation strategy & flags",
            details: rootCause || "Determine minimal surgical repair",
            status: status === "diagnosing" ? "pending" : "completed",
          },
          {
            id: "todo-3",
            stepNumber: 3,
            totalSteps: 5,
            title: commands?.[0]?.name ? `Run: ${commands[0].name}` : "Execute repair commands on runner",
            details: commands?.[0]?.cmd,
            status: isActive ? "in_progress" : isSuccess ? "completed" : isExhausted ? "failed" : "pending",
          },
          {
            id: "todo-4",
            stepNumber: 4,
            totalSteps: 5,
            title: "Verify dependency tree & filesystem health",
            details: "npm ls and module validation",
            status: isSuccess ? "completed" : isExhausted ? "failed" : "pending",
          },
          {
            id: "todo-5",
            stepNumber: 5,
            totalSteps: 5,
            title: "Validate workflow pipeline & resume build",
            details: isSuccess ? "Workflow ready to continue" : "Pipeline resumption check",
            status: isSuccess ? "completed" : isExhausted ? "failed" : "pending",
          },
        ];

  const completedCount = effectiveTodos.filter((t) => t.status === "completed").length;

  return (
    <div className="my-2 rounded-md border border-border bg-card/60 overflow-hidden text-[12px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left bg-muted/20 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isActive ? (
            <AgentOrb state="weaving" size={16} className="shrink-0 w-3.5 h-3.5" />
          ) : isSuccess ? (
            <Check size={13} className="shrink-0 text-[hsl(var(--success))]" strokeWidth={2.5} />
          ) : (
            <X size={13} className="shrink-0 text-destructive" strokeWidth={2.5} />
          )}
          <span className="font-medium text-foreground/90">
            Runner AI Repair · Attempt {attempt}/{maxAttempts}
          </span>
          {diagnosisType && (
            <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-muted text-muted-foreground border border-border">
              {diagnosisType}
            </span>
          )}
          {source && (
            <span className="text-[11px] text-muted-foreground/70">
              via {source}{model ? ` (${model})` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[11px] font-medium ${
              isSuccess
                ? "text-[hsl(var(--success))]"
                : isExhausted
                ? "text-destructive"
                : "text-primary"
            }`}
          >
            {status}
          </span>
          {open ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} />}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-2 border-t border-border">
          {rootCause && (
            <div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-0.5">
                Root Cause
              </span>
              <p className="text-foreground/90 leading-relaxed font-sans">{rootCause}</p>
            </div>
          )}

          {evidence && evidence.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-0.5">
                Evidence
              </span>
              <div className="space-y-1">
                {evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="font-mono text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/50 break-all"
                  >
                    {ev}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Repair To-Dos (Exactly 5 steps) */}
          <div className="rounded-md border border-border/80 bg-background/50 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium text-foreground/90">
                <ListTodo size={14} className="text-primary shrink-0" />
                <span>Repair To-Dos</span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  ({completedCount}/5 completed)
                </span>
              </div>
              <div className="flex items-center gap-1">
                {effectiveTodos.map((t) => (
                  <div
                    key={t.id}
                    title={`${t.stepNumber}/5: ${t.title} (${t.status})`}
                    className={`w-2.5 h-1.5 rounded-full transition-all ${
                      t.status === "completed"
                        ? "bg-[hsl(var(--success))]"
                        : t.status === "in_progress"
                        ? "bg-primary animate-pulse"
                        : t.status === "failed"
                        ? "bg-destructive"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              {effectiveTodos.map((todo) => {
                const isStepCompleted = todo.status === "completed";
                const isStepActive = todo.status === "in_progress";
                const isStepFailed = todo.status === "failed";

                return (
                  <div
                    key={todo.id}
                    className={`flex items-start gap-2 p-1.5 rounded transition-colors ${
                      isStepActive
                        ? "bg-primary/10 border border-primary/20"
                        : isStepCompleted
                        ? "bg-muted/15"
                        : isStepFailed
                        ? "bg-destructive/10 border border-destructive/20"
                        : "opacity-75"
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {isStepCompleted ? (
                        <CheckCircle2
                          size={14}
                          className="text-[hsl(var(--success))]"
                          strokeWidth={2.5}
                        />
                      ) : isStepActive ? (
                        <Loader2
                          size={14}
                          className="text-primary animate-spin"
                          strokeWidth={2.5}
                        />
                      ) : isStepFailed ? (
                        <AlertCircle
                          size={14}
                          className="text-destructive"
                          strokeWidth={2.5}
                        />
                      ) : (
                        <Circle
                          size={14}
                          className="text-muted-foreground/40"
                          strokeWidth={2}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-[11.5px] leading-snug">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] text-muted-foreground font-semibold px-1 py-0.2 rounded bg-muted border border-border/40">
                          {todo.stepNumber}/5
                        </span>
                        <span
                          className={`font-medium ${
                            isStepCompleted
                              ? "text-foreground/80 line-through decoration-muted-foreground/50"
                              : isStepActive
                              ? "text-foreground font-semibold"
                              : isStepFailed
                              ? "text-destructive font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {todo.title}
                        </span>
                        {isStepActive && (
                          <span className="text-[10px] px-1 py-0.2 rounded bg-primary/20 text-primary font-medium">
                            in progress
                          </span>
                        )}
                      </div>
                      {todo.details && (
                        <p className="text-[10.5px] text-muted-foreground/75 mt-0.5 break-words">
                          {todo.details}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {commands && commands.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                Executed Commands
              </span>
              <div className="space-y-1.5">
                {commands.map((cmd, i) => {
                  const res = results?.find((r) => r.cmd === cmd.cmd);
                  return (
                    <CommandBox
                      key={i}
                      command={cmd.cmd}
                      status={res ? (res.exitCode === 0 ? "done" : "error") : isActive ? "active" : "done"}
                      exitCode={res?.exitCode}
                      output={res?.tail}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {notes && (
            <p className="text-[11px] text-muted-foreground/80 italic pt-1 border-t border-border/40">
              {notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────── collapsible group ─────────────────────── */

/**
 * A collapsible summary row with a hairline rule down the left of its children,
 * mirroring "Searched for regex patterns and reviewed multiple files ⌄" and
 * "Finished with 2 steps +128 -1 ⌄" in the Copilot transcript.
 */
export const TimelineGroup = ({
  summary,
  strongPrefix,
  added,
  removed,
  status = "done",
  defaultOpen = false,
  trailing,
  children,
}: {
  summary: string;
  strongPrefix?: string;
  added?: number;
  removed?: number;
  status?: ToolStatus;
  defaultOpen?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center gap-1.5 text-[12px]"
      >
        {status === "active" ? (
          <AgentOrb state="weaving" size={20} className="shrink-0 w-[13px] h-[13px]" />
        ) : status === "error" ? (
          <X size={11} className="shrink-0 text-destructive" strokeWidth={2.5} />
        ) : null}
        <span className={status === "active" ? "ai-thinking-shimmer font-medium" : "text-foreground/85 font-medium"}>
          {strongPrefix}
        </span>
        <span className="text-muted-foreground truncate">{summary}</span>
        <DiffStat added={added} removed={removed} />
        {trailing}
        {open ? (
          <ChevronDown size={12} className="shrink-0 text-muted-foreground/50" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-muted-foreground/50" />
        )}
      </button>
      {open && <div className="tl-branch ml-[6px] mt-0.5">{children}</div>}
    </div>
  );
};

export default TimelineGroup;
