import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  Terminal,
  FileCode,
  Search,
  Zap,
  Package,
  GitBranch,
  Cpu,
  Wrench,
  Rocket,
  Hammer,
  AlertTriangle,
  Server,
  ShieldCheck,
  KeyRound,
  Settings2,
  ExternalLink,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AiMark from "@/components/ai/AiMark";
import DiffViewer from "@/components/dashboard/DiffViewer";
import ModelIcon from "@/components/ai/ModelIcon";
import MaterialWavySpinner from "@/components/ai/MaterialWavySpinner";
import {
  CommandBox,
  EditLine,
  Narration,
  ToolLine,
  TimelineGroup,
} from "@/components/timeline/CopilotTimeline";

import type { PhaseGroupData } from "@/hooks/useOrchestratorFeed";
import type { PendingChange } from "@/stores/projectStore";
import { useBuildStore, type CiStep, type AiTimelineEvent } from "@/stores/buildStore";

export interface TrackerAction {
  id: string;
  title: string;
  description?: string;
  status: "running" | "done" | "error" | "pending";
  startedAt: number;
  completedAt?: number;
  result?: string;
  type: "ai" | "build" | "system";
  children?: TrackerAction[];
}

interface ActionTrackerPanelProps {
  actions?: TrackerAction[];
  phaseGroups?: PhaseGroupData[];
  pendingChanges?: PendingChange[];
  ciSteps?: CiStep[];
  aiTimeline?: AiTimelineEvent[];
  isBuildActive?: boolean;
  canBuild?: boolean;
  onBuild?: (opts: { signingMode: "debug" | "release"; platform: "android" | "ios" }) => void;
  /** Short live caption shown above the timeline (max 50 chars). */
  thinkingCaption?: string | null;
  /** Build button label override (e.g. "Phase 1: Setup"). */
  buildButtonLabel?: string;
  /** Currently selected AI model label, e.g. "Gemini 3 Flash". */
  modelLabel?: string;
  /** Full model ID like "google/gemini-3-flash-preview" — used to render the provider SVG. */
  modelId?: string;
}




const PHASE_ICONS: Record<string, typeof Zap> = {
  setup: Package,
  "ai-wiring": Cpu,
  build: Rocket,
};

const changeTypeLabel: Record<PendingChange["type"], string> = {
  plugin_added: "Plugin enabled",
  plugin_removed: "Plugin removed",
  config_changed: "Config updated",
  source_edited: "Source edited",
  appearance_changed: "Appearance updated",
};

const getIcon = (action: TrackerAction | { title: string }) => {
  const t = action.title.toLowerCase();
  if (t.includes("checkout") || t.includes("clone")) return GitBranch;
  if (t.includes("setup-java") || t.includes("jdk") || t.includes("java")) return Cpu;
  if (t.includes("setup-node") || t.includes("node.js") || t.includes("set up node")) return Cpu;
  if (t.includes("cache")) return Package;
  if (t.includes("upload") || t.includes("artifact")) return Rocket;
  if (t.includes("search") || t.includes("scan")) return Search;
  if (t.includes("read") || t.includes("file") || t.includes("inject") || t.includes("edit")) return FileCode;
  if (t.includes("install") || t.includes("dependenc") || t.includes("plugin") || t.includes("npm")) return Package;
  if (t.includes("build") || t.includes("gradle") || t.includes("compil") || t.includes("assemble") || t.includes("bundle")) return Terminal;
  if (t.includes("git") || t.includes("push") || t.includes("repo") || t.includes("github")) return GitBranch;
  if (t.includes("config") || t.includes("wire") || t.includes("sign") || t.includes("patch") || t.includes("capacitor")) return Wrench;
  return Zap;
};

const formatElapsed = (start: number, end?: number) => {
  const ms = (end || Date.now()) - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

const formatSeconds = (s?: number) => {
  if (!s) return "";
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
};

const getCiStepState = (step: CiStep) => {
  const isDone = step.status === "completed" && step.conclusion === "success";
  const isError = step.status === "completed" && step.conclusion === "failure";
  const isActive = step.status === "in_progress";
  return { isDone, isError, isActive };
};

const PendingChangesPanel = ({ pendingChanges }: { pendingChanges: PendingChange[] }) => {
  const [open, setOpen] = useState(false);
  // When there are no pending changes, render nothing — the empty
  // "No changes staged" tile was visual noise.
  if (pendingChanges.length === 0) return null;

  const sorted = pendingChanges.slice().sort((a, b) => b.timestamp - a.timestamp);

  return (
    <>
      <div className="mx-3 mt-3 flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card hover:bg-muted/60 transition-colors text-[11px] text-foreground"
        >
          <Hammer size={11} className="text-primary" />
          <span className="font-medium">Changes</span>
          <span className="ml-1 text-[10px] tabular-nums px-1.5 py-px rounded-full bg-primary/15 text-primary font-semibold">
            {pendingChanges.length}
          </span>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Hammer size={14} className="text-primary" />
              Pending changes
              <span className="ml-1 text-[11px] text-muted-foreground font-normal">
                {pendingChanges.length} to apply on next build
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {sorted.map((change) => (
              <div key={change.id} className="rounded-lg border border-border bg-card/60 px-3 py-2">
                <p className="text-[13px] text-foreground leading-tight">{change.label}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
                  <span>{changeTypeLabel[change.type]}</span>
                  <span>•</span>
                  <span>
                    {new Date(change.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * GitHub Actions Runner timeline — uses the SAME StepNode design as the AI activity
 * timeline (gradient shimmer on active step, vertical connectors, expandable result
 * with log excerpt). Rendered as a collapsible PhaseGroup-style header.
 */
const RUNNER_META: Record<string, { label: string; runner: string }> = {
  ios: { label: "iOS", runner: "macos-latest" },
  android: { label: "Android", runner: "ubuntu-latest" },
  desktop: { label: "Desktop", runner: "ubuntu-latest" },
  web: { label: "Web", runner: "ubuntu-latest" },
  flutter: { label: "Flutter", runner: "ubuntu-latest" },
};

const GitHubRunnerTimeline = ({ ciSteps }: { ciSteps: CiStep[] }) => {
  const activePlatform = useBuildStore((s) => s.activePlatform);
  const runUrl = useBuildStore((s) => s.activeRunUrl);
  const meta = RUNNER_META[activePlatform] || RUNNER_META.android;
  if (ciSteps.length === 0) return null;

  const anyActive = ciSteps.some((s) => s.status === "in_progress");
  const anyError = ciSteps.some((s) => s.status === "completed" && s.conclusion === "failure");
  const allDone = ciSteps.every((s) => s.status === "completed" && s.conclusion === "success");
  const doneCount = ciSteps.filter((s) => s.status === "completed" && s.conclusion === "success").length;

  const stepActions = ciSteps.map((step) => {
    const { isDone, isError, isActive } = getCiStepState(step);
    const status = isDone ? "done" : isError ? "error" : isActive ? "active" : "pending";
    const startedAt = step.startedAt ? Date.parse(step.startedAt) : Date.now();
    const elapsed =
      step.startedAt && step.completedAt
        ? (Date.parse(step.completedAt) - Date.parse(step.startedAt)) / 1000
        : undefined;
    return {
      id: `ci-${step.number}-${step.name}`,
      title: step.name,
      status,
      startedAt,
      elapsed,
      result: step.logExcerpt,
    };
  });

  const headerStatus: "active" | "done" | "error" | "pending" = anyError
    ? "error"
    : anyActive
    ? "active"
    : allDone
    ? "done"
    : "pending";

  return (
    <div className="px-4 pt-3">
      <TimelineGroup
        strongPrefix={`${meta.label} pipeline`}
        summary={`on ${meta.runner} — ${doneCount}/${ciSteps.length} steps`}
        status={headerStatus}
        defaultOpen
        trailing={
          runUrl ? (
            <a
              href={runUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-primary transition-colors"
            >
              <ExternalLink size={10} />
              Run
            </a>
          ) : undefined
        }
      >
        {stepActions.map((action) => (
          <StepNode key={action.id} action={action} />
        ))}
      </TimelineGroup>
    </div>
  );
};

const PhaseGroup = ({ group }: { group: PhaseGroupData }) => {
  const Icon = PHASE_ICONS[group.id] || Zap;
  const doneCount = group.actions.filter((a) => a.status === "done").length;

  return (
    <div className="px-4 py-1">
      <TimelineGroup
        strongPrefix={group.label}
        summary={
          group.actions.length > 0
            ? `${doneCount}/${group.actions.length} steps${
                group.elapsed != null && group.status === "done" ? ` · ${formatSeconds(group.elapsed)}` : ""
              }`
            : group.status === "pending"
            ? "waiting"
            : ""
        }
        status={group.status === "active" ? "active" : group.status === "error" ? "error" : group.status === "done" ? "done" : "pending"}
        defaultOpen={group.status === "active" || group.status === "error"}
        trailing={<Icon size={11} className="text-muted-foreground/50" />}
      >
        {group.actions.map((action) => (
          <StepNode key={action.id} action={action} />
        ))}
        {group.actions.length === 0 && (
          <p className="text-[11px] text-muted-foreground/40 py-1">Waiting…</p>
        )}
      </TimelineGroup>
    </div>
  );
};

type StepNodeAction = {
  id: string;
  title: string;
  status: string;
  detail?: string;
  elapsed?: number;
  startedAt?: number;
  result?: string;
};

/**
 * One plain timeline row — no cards. Shell/CI "Run …" steps render as a command
 * box; file edits render as pencil rows with a chip; everything else is a
 * single tool line whose result opens inline.
 */
const StepNode = ({ action }: { action: StepNodeAction; isLast?: boolean }) => {
  const [elapsed, setElapsed] = useState(action.elapsed || 0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (action.status !== "active" || !action.startedAt) return;
    const interval = setInterval(() => {
      setElapsed((Date.now() - action.startedAt!) / 1000);
    }, 250);
    return () => clearInterval(interval);
  }, [action.status, action.startedAt]);

  const status = (action.status === "running" ? "active" : action.status) as
    | "active"
    | "done"
    | "error"
    | "pending";
  const displayElapsed =
    status === "done" || status === "error" ? action.elapsed || elapsed : elapsed;

  const title = action.title;
  const isCommand = /^run\s+/i.test(title) || /gradlew|npm |pnpm |yarn |npx |bun /.test(title);

  if (isCommand) {
    return (
      <CommandBox
        command={title.replace(/^run\s+/i, "")}
        output={action.result || action.detail}
        status={status}
      />
    );
  }

  const isEdit = /^(edit|edited|editing|patch|patched|wrote|writing|inject)/i.test(title);
  if (isEdit) {
    const path = title.split(/\s+/).slice(1).join(" ") || title;
    return <EditLine path={path} status={status} />;
  }

  const hasBody = Boolean(action.detail || action.result);
  const fileChips = (action.result || "")
    .split("\n")
    .filter((l) => l.startsWith("### "))
    .slice(0, 5)
    .map((l) => ({ label: l.replace("### ", "").split("/").pop() || l, kind: "file" as const }));

  return (
    <ToolLine
      verb={title}
      status={status}
      chips={fileChips.length > 0 ? fileChips : undefined}
      detail={!expanded ? action.detail : undefined}
      trailing={
        displayElapsed > 0 && (status === "done" || status === "active" || status === "error")
          ? `${displayElapsed.toFixed(1)}s`
          : undefined
      }
      onToggle={hasBody ? () => setExpanded((v) => !v) : undefined}
      expanded={expanded}
    >
      {expanded && hasBody && (
        <pre className="mt-1 mb-1 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words max-h-[260px] overflow-auto">
          {action.detail ? `${action.detail}\n` : ""}
          {action.result?.slice(0, 4000)}
        </pre>
      )}
    </ToolLine>
  );
};

const LegacyActionNode = ({ action, isLast }: { action: TrackerAction; isLast: boolean }) => {
  const [expanded, setExpanded] = useState(action.status === "running");
  const Icon = getIcon(action);

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute left-[11px] top-[28px] bottom-0 w-px" style={{ background: "hsl(var(--border))" }} />
      )}
      <div className="flex gap-3">
        <div className="shrink-0 mt-0.5 z-10">
          {action.status === "running" ? (
            <div className="w-[22px] h-[22px] rounded-full bg-primary/15 flex items-center justify-center">
              <Loader2 size={12} className="animate-spin text-primary" />
            </div>
          ) : action.status === "done" ? (
            <div className="ai-action-tick">
              <Check size={11} className="ai-action-check-draw text-[hsl(var(--success))]" strokeWidth={2.5} />
            </div>
          ) : action.status === "error" ? (
            <div className="w-[22px] h-[22px] rounded-full bg-destructive/15 flex items-center justify-center">
              <X size={11} className="text-destructive" />
            </div>
          ) : (
            <div className="w-[22px] h-[22px] rounded-full bg-muted flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 pb-4">
          <div className="flex items-center gap-2">
            <Icon size={12} className="text-muted-foreground shrink-0" />
            <span className={`text-[13px] font-medium leading-tight ${
              action.status === "running" ? "ai-action-active" :
              action.status === "error" ? "text-destructive" : "text-foreground"
            }`}>
              {action.title}
            </span>
            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5 ml-auto shrink-0">
              <Clock size={9} />
              {formatElapsed(action.startedAt, action.completedAt)}
            </span>
          </div>
          {action.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{action.description}</p>
          )}
          {action.result && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              Result
            </button>
          )}
          {expanded && action.result && (
            <div className="mt-1.5 p-2 rounded-md bg-muted/40 border border-border text-[11px] font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto">
              {action.result}
            </div>
          )}
          {action.children && action.children.length > 0 && (
            <div className="mt-2 space-y-0">
              {action.children.map((child, i) => (
                <LegacyActionNode key={child.id} action={child} isLast={i === action.children!.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Plain AI walkthrough row. "thinking"/"narration" events read as flowing
 * sentences, commands render in a mono box, edits show +/- with an inline diff
 * dropdown, and reads/searches are single chip lines.
 */
const AiTimelineRow = ({ evt }: { evt: AiTimelineEvent; isLast?: boolean }) => {
  const [open, setOpen] = useState(false);
  const isActive = evt.status === "active";
  const hasDiff = evt.op === "edit" && typeof evt.oldContent === "string" && typeof evt.newContent === "string";

  if (evt.op === "thinking" || evt.op === "narration") {
    return <Narration streaming={isActive}>{evt.title}</Narration>;
  }

  if (evt.op === "command") {
    return (
      <CommandBox
        command={evt.command || evt.title}
        output={evt.output || evt.detail}
        status={evt.status}
        exitCode={evt.exitCode}
      />
    );
  }

  if (evt.op === "edit") {
    const path = evt.path || evt.title;
    return (
      <EditLine path={path} added={evt.added} removed={evt.removed} status={evt.status} expandable={hasDiff}>
        {hasDiff && (
          <div className="mt-1.5 rounded-md border border-border overflow-hidden max-h-[320px] overflow-y-auto">
            <DiffViewer oldCode={evt.oldContent!} newCode={evt.newContent!} fileName={evt.path} />
          </div>
        )}
      </EditLine>
    );
  }

  const chips = (evt.refs && evt.refs.length > 0 ? evt.refs : evt.path ? [evt.path] : []).map((r) => ({
    label: r.split("/").pop() || r,
    kind: (r.includes(".") ? "file" : "folder") as "file" | "folder",
  }));

  return (
    <ToolLine
      verb={evt.title}
      status={evt.status}
      chips={chips.length > 0 ? chips : undefined}
      detail={!open ? evt.detail : undefined}
      onToggle={evt.detail ? () => setOpen((v) => !v) : undefined}
      expanded={open}
    >
      {open && evt.detail && (
        <pre className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words max-h-[240px] overflow-auto">
          {evt.detail}
        </pre>
      )}
    </ToolLine>
  );
};

const RunningTimer = ({ active }: { active: boolean }) => {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) { startRef.current = null; setSeconds(0); return; }
    startRef.current = Date.now();
    const i = setInterval(() => {
      if (startRef.current) setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(i);
  }, [active]);
  if (!active) return null;
  return <span className="tabular-nums">{seconds}s</span>;
};

// ─────────── Build-mode selector (Debug / Release) + signing card ───────────
interface ActiveKeystore {
  id: string;
  key_alias: string;
  sha1: string | null;
  sha256: string | null;
  is_active: boolean | null;
}

const BuildModeSelector = ({
  isBuildActive,
  canBuild,
  buttonText,
  onBuild,
}: {
  isBuildActive: boolean;
  canBuild: boolean;
  buttonText: string;
  onBuild?: (opts: { signingMode: "debug" | "release"; platform: "android" | "ios" }) => void;
}) => {
  const [mode, setMode] = useState<"debug" | "release">("debug");
  const storedPlatform = useBuildStore((s) => s.activePlatform);
  // Platform is chosen from the top navigation app switcher, not here.
  const platform: "android" | "ios" = storedPlatform === "ios" ? "ios" : "android";
  const [keystore, setKeystore] = useState<ActiveKeystore | null>(null);
  const [iosCertReady, setIosCertReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id: projectId } = useParams<{ id: string }>();

  useEffect(() => {
    if (mode !== "release" || !projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      if (platform === "android") {
        const { data } = await supabase
          .from("keystores")
          .select("id, key_alias, sha1, sha256, is_active")
          .eq("user_id", session.user.id)
          .eq("project_id", projectId)
          .eq("is_active", true)
          .maybeSingle();
        if (!cancelled) {
          setKeystore((data as ActiveKeystore | null) || null);
          setIosCertReady(null);
          setLoading(false);
        }
      } else {
        // iOS release requires GitHub Actions secrets on the build repo:
        // IOS_CERT_P12_BASE64, IOS_CERT_PASSWORD, IOS_PROVISIONING_PROFILE_BASE64, IOS_TEAM_ID
        // We can't read GH secrets from the client — surface guidance only.
        if (!cancelled) {
          setIosCertReady(false);
          setKeystore(null);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [mode, projectId, platform]);

  const goToSigning = () => navigate(`?section=signing`);

  const platformLabel = platform === "ios" ? "iOS" : "Android";
  const releaseLabel = platform === "ios" ? "App Store" : "Release";
  const debugLabel = platform === "ios" ? "Simulator" : "Debug";

  return (
    <div className="space-y-2">
      {/* Segmented Debug / Release (Simulator / App Store on iOS) toggle */}
      <div className="inline-flex w-full rounded-md border border-border bg-muted/30 p-0.5 text-[11px] font-medium">
        {(["debug", "release"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            disabled={isBuildActive}
            className={`flex-1 px-2 py-1 rounded transition-colors ${
              mode === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-50`}
          >
            {m === "debug" ? debugLabel : releaseLabel}
          </button>
        ))}
      </div>

      {/* Release-only signing card */}
      {mode === "release" && (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 text-[11px] space-y-1.5">
          <div className="flex items-center gap-1.5 text-foreground">
            <ShieldCheck size={12} />
            <span className="font-medium">{platformLabel} release signing</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 size={11} className="animate-spin" /> Checking credentials…
            </div>
          ) : platform === "android" ? (
            keystore ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-foreground/80">
                  <KeyRound size={11} className="text-primary" />
                  <span className="font-mono truncate">{keystore.key_alias}</span>
                </div>
                {keystore.sha1 && (
                  <div className="text-[10px] text-muted-foreground font-mono truncate" title={keystore.sha1}>
                    SHA-1: {keystore.sha1.slice(0, 28)}…
                  </div>
                )}
                <button
                  onClick={goToSigning}
                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  <Settings2 size={10} /> Manage certificates
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={11} />
                  <span>No active keystore for this project.</span>
                </div>
                <button
                  onClick={goToSigning}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors"
                >
                  <Settings2 size={11} /> Configure signing
                </button>
              </div>
            )
          ) : (
            <div className="space-y-1.5">
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                Release .ipa builds need Apple credentials as GitHub Actions secrets on the build repo:
                <code className="block mt-1 text-[9px] font-mono">
                  IOS_CERT_P12_BASE64 · IOS_CERT_PASSWORD<br/>
                  IOS_PROVISIONING_PROFILE_BASE64 · IOS_TEAM_ID
                </code>
              </div>
              <button
                onClick={goToSigning}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors"
              >
                <Settings2 size={11} /> iOS signing guide
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => onBuild?.({ signingMode: mode, platform })}
          disabled={!canBuild || isBuildActive}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-border bg-transparent hover:bg-muted/50 transition-colors text-sm font-medium text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isBuildActive ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
          <span className={isBuildActive ? "ai-action-active" : ""}>
            {platform === "ios"
              ? (mode === "release" ? "Build iOS App (App Store)" : "Build iOS App (Simulator)")
              : `${buttonText}${mode === "release" ? " (Release)" : ""}`}
          </span>
        </button>
        {!canBuild && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <AlertTriangle size={11} />
            Upload source
          </div>
        )}
      </div>
    </div>
  );
};



const ActionTrackerPanel = ({
  actions,
  phaseGroups,
  pendingChanges = [],
  ciSteps = [],
  aiTimeline = [],
  isBuildActive = false,
  canBuild = false,
  onBuild,
  thinkingCaption,
  buildButtonLabel,
  modelLabel,
  modelId,
}: ActionTrackerPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [phaseGroups, actions, ciSteps, aiTimeline, thinkingCaption]);

  const hasGroupedPipeline = useMemo(
    () => Boolean(phaseGroups && phaseGroups.length > 0 && phaseGroups.some((g) => g.actions.length > 0 || g.status !== "pending")),
    [phaseGroups]
  );

  const buttonText = buildButtonLabel || (isBuildActive ? "Build running" : pendingChanges.length > 0 ? `Build ${pendingChanges.length} change${pendingChanges.length === 1 ? "" : "s"}` : "Build project");

  const providerLabel = modelId
    ? modelId.startsWith("openai/")
      ? "OpenAI"
      : modelId.startsWith("google/")
      ? "Google Gemini"
      : modelLabel
    : modelLabel;

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Provider + running timer header */}
      {(providerLabel || isBuildActive) && (
        <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2 text-[12px] text-foreground/85">
          {providerLabel && (
            <>
              {modelId ? <ModelIcon modelId={modelId} size={14} /> : <AiMark size={12} className="text-foreground/70" />}
              <span className="font-medium">{providerLabel}</span>
            </>
          )}

          {isBuildActive && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">Running for</span>
              <RunningTimer active={isBuildActive} />
            </>
          )}
        </div>
      )}

      <div className="shrink-0 border-b border-border px-3 py-3 space-y-2">
        <BuildModeSelector
          isBuildActive={isBuildActive}
          canBuild={canBuild}
          buttonText={buttonText}
          onBuild={onBuild}
        />
        {thinkingCaption && (
          <div className="mt-2 flex items-center gap-2 px-1 py-1">
            <MaterialWavySpinner size="sm"><AiMark size={10} /></MaterialWavySpinner>
            <span className="text-[11px] shimmer-text font-medium truncate">{thinkingCaption}</span>
          </div>
        )}
      </div>

      <ScrollArea className="h-full" ref={containerRef}>
        <PendingChangesPanel pendingChanges={pendingChanges} />
        <GitHubRunnerTimeline ciSteps={ciSteps} />

        {aiTimeline.length > 0 && (
          <div className="px-4 pt-3">
            {aiTimeline.slice(-40).map((evt) => (
              <AiTimelineRow key={evt.id} evt={evt} />
            ))}
          </div>
        )}

        {hasGroupedPipeline ? (
          <div className="py-2">
            {phaseGroups!.map((group) => (
              <PhaseGroup key={group.id} group={group} />
            ))}
          </div>
        ) : actions && actions.length > 0 ? (
          <div className="p-4 space-y-0">
            {actions.map((action, i) => (
              <LegacyActionNode key={action.id} action={action} isLast={i === actions.length - 1} />
            ))}
          </div>
        ) : aiTimeline.length === 0 && (
          <div className="px-4 py-6">
            <Narration muted>
              Nothing running yet. When a build starts, every step the agent takes — files it reads,
              edits it makes and commands it runs — appears here as a live walkthrough.
            </Narration>
          </div>
        )}
      </ScrollArea>

    </div>
  );
};

export default ActionTrackerPanel;
