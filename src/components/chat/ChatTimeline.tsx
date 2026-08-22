import { useState, useEffect } from "react";
import AiMark from "@/components/ai/AiMark";
import MaterialWavySpinner from "@/components/ai/MaterialWavySpinner";
import {
  CommandBox,
  EditLine,
  Narration,
  ToolLine,
  TimelineGroup,
} from "@/components/timeline/CopilotTimeline";

export interface ChatTimelineStep {
  id: string;
  /** Short verb-led title shown on the row, e.g. "Reading source code" */
  title: string;
  /** Tool name backing this step — used to pick an icon and group related steps */
  tool?: string;
  /** Files touched (paths) — rendered as small inline chips */
  files?: string[];
  /** Inline detail/result preview text */
  detail?: string;
  /** Long result text — collapsible */
  result?: string;
  status: "active" | "done" | "error";
  startedAt: number;
  completedAt?: number;
  /** Shell command executed by this step — rendered as a command box */
  command?: string;
  /** Captured command output */
  output?: string;
  /** Process exit code for command steps */
  exitCode?: number;
  /** Diff stats for edit steps */
  added?: number;
  removed?: number;
  /** Actual changed lines, previewed in a compact red/green diff box */
  diffAdded?: string[];
  diffRemoved?: string[];
  /** Plain narration paragraph — rendered as flowing text, no card */
  narration?: string;
}

const EDIT_HINTS = ["write", "edit", "create", "delete", "insert", "replaceline", "patch", "inject"];
const CMD_HINTS = ["run", "shell", "exec", "command", "gradle", "build", "install"];

type Kind = "narration" | "command" | "edit" | "read" | "search" | "generic";

const classify = (step: ChatTimelineStep): Kind => {
  if (step.narration) return "narration";
  if (step.command) return "command";
  const t = `${step.tool || ""} ${step.title}`.toLowerCase();
  if (EDIT_HINTS.some((h) => t.includes(h))) return "edit";
  if (t.includes("search") || t.includes("regex") || t.includes("grep") || t.includes("find")) return "search";
  if (t.includes("read") || t.includes("file") || t.includes("outline") || t.includes("map")) return "read";
  if (CMD_HINTS.some((h) => t.includes(h))) return "command";
  return "generic";
};

const openRef = (path: string, line?: number) =>
  window.dispatchEvent(new CustomEvent("grounding-ref-click", { detail: { path, line } }));

const parseRef = (raw: string) => {
  const m = raw.match(/^(.+?):(\d+)(?:-(\d+))?$/);
  return { path: m ? m[1] : raw, line: m ? parseInt(m[2], 10) : undefined };
};

const StepRow = ({ step }: { step: ChatTimelineStep }) => {
  const [expanded, setExpanded] = useState(false);
  const [, force] = useState(0);
  const kind = classify(step);
  const isActive = step.status === "active";

  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => force((n) => n + 1), 400);
    return () => clearInterval(t);
  }, [isActive]);

  if (kind === "narration") {
    return <Narration streaming={isActive}>{step.narration}</Narration>;
  }

  if (kind === "command") {
    return (
      <CommandBox
        command={step.command || step.title}
        output={step.output || step.result}
        status={step.status}
        exitCode={step.exitCode}
      />
    );
  }

  if (kind === "edit") {
    const path = step.files?.[0] || step.title;
    return (
      <EditLine
        path={parseRef(path).path}
        added={step.added}
        removed={step.removed}
        status={step.status}
        diffAdded={step.diffAdded}
        diffRemoved={step.diffRemoved}
        onOpen={() => openRef(parseRef(path).path)}
      />
    );
  }

  const chips = (step.files || []).slice(0, 6).map((f) => {
    const { path, line } = parseRef(f);
    const isFolder = !path.split("/").pop()?.includes(".");
    return {
      label: (path.split("/").pop() || path) + (line ? `:${line}` : ""),
      kind: (isFolder ? "folder" : "file") as "folder" | "file",
      onClick: () => openRef(path, line),
    };
  });

  const verb =
    kind === "search"
      ? step.title.replace(/^searching/i, "Searched").replace(/^search/i, "Searched")
      : kind === "read"
      ? step.title.replace(/^reading/i, "Read").replace(/^read\b/i, "Read")
      : step.title;

  const hasBody = Boolean(step.result || step.detail);

  return (
    <ToolLine
      verb={verb}
      status={step.status}
      chips={chips}
      detail={step.detail}
      trailing={
        step.files && step.files.length > 6 ? `+${step.files.length - 6} more` : undefined
      }
      onToggle={hasBody ? () => setExpanded((v) => !v) : undefined}
      expanded={expanded}
    >
      {expanded && hasBody && (
        <pre className="mt-1 mb-1 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words max-h-[260px] overflow-auto">
          {(step.result || step.detail || "").slice(0, 4000)}
        </pre>
      )}
    </ToolLine>
  );
};

interface ChatTimelineProps {
  steps: ChatTimelineStep[];
  caption?: string | null;
}

const ChatTimeline = ({ steps, caption }: ChatTimelineProps) => {
  if (steps.length === 0 && !caption) return null;

  // Completed lookups/reads collapse behind a single summary row (Copilot style);
  // narration, commands, edits and the in-flight step always stay visible.
  const lastActive = steps.findIndex((s) => s.status === "active");
  const collapsible: ChatTimelineStep[] = [];
  const visible: ChatTimelineStep[] = [];
  steps.forEach((s, i) => {
    const kind = classify(s);
    const isTail = i >= steps.length - 3 || i === lastActive;
    if (!isTail && s.status === "done" && (kind === "read" || kind === "search" || kind === "generic")) {
      collapsible.push(s);
    } else {
      visible.push(s);
    }
  });

  return (
    <div className="my-1">
      {caption && (
        <div className="flex items-center gap-2 py-1">
          <MaterialWavySpinner size="sm">
            <AiMark size={10} />
          </MaterialWavySpinner>
          <span className="ai-thinking-shimmer text-[12.5px] font-medium">{caption}</span>
        </div>
      )}

      {collapsible.length > 1 && (
        <TimelineGroup
          strongPrefix={`Reviewed ${collapsible.length} files`}
          summary=""
        >
          {collapsible.map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </TimelineGroup>
      )}
      {collapsible.length === 1 && <StepRow key={collapsible[0].id} step={collapsible[0]} />}

      {visible.map((s) => (
        <StepRow key={s.id} step={s} />
      ))}
    </div>
  );
};

export default ChatTimeline;
