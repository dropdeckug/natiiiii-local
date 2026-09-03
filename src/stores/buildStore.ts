import { create } from "zustand";
import type { PhaseGroupData } from "@/hooks/useOrchestratorFeed";

export interface BuildErrorInfo {
  errorType?: string;
  errorDetail?: string;
  suggestedFix?: string;
  failedStep?: string;
}

export interface BuildJob {
  id: string;
  appName: string;
  packageName: string;
  engine: string;
  projectId?: string;
  repoName?: string;
  repoUrl?: string;
  runId?: number;
  commitSha?: string;
  status: "queued" | "uploading" | "building" | "success" | "failure" | "timeout";
  stage: string;
  logs: string[];
  startedAt: number;
  completedAt?: number;
  apkUrl?: string;
  aabUrl?: string;
  apkBlob?: Blob;
  zipBlob?: Blob;
  error?: string;
  errorInfo?: BuildErrorInfo;
  autoDeleteRepo?: boolean;
  sha1?: string;
  sha256?: string;
  signingMode?: "debug" | "release";
  platform?: "android" | "ios";
  ipaUrl?: string;
  appZipUrl?: string;
  sourceRepoName?: string;
}

export type TargetPlatform = "android" | "ios" | "web" | "desktop" | "flutter";

export interface CiStep {
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  number: number;
  /** Last lines of log output for this step, shown in the expandable panel. */
  logExcerpt?: string;
}

export interface RepairCommandResult {
  cmd: string;
  exitCode: number;
  ms?: number;
  tail?: string;
}

export interface RepairTodo {
  id: string;
  stepNumber: number; // 1 to 5
  totalSteps: 5;
  title: string;
  details?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  command?: string;
  completedAt?: number;
}

export interface RepairAttemptInfo {
  attempt: number;
  maxAttempts: number;
  status: "diagnosing" | "executing" | "succeeded" | "failed" | "exhausted";
  diagnosisType?: string;
  rootCause?: string;
  evidence?: string[];
  source?: "deterministic" | "model" | "fallback";
  model?: string | null;
  commands?: { cmd: string; name: string; critical: boolean }[];
  results?: RepairCommandResult[];
  todos?: RepairTodo[];
  notes?: string;
  timestamp: number;
}

export interface AiTimelineEvent {
  id: string;
  op: "read" | "search" | "edit" | "thinking" | "config" | "command" | "narration";
  title: string;
  detail?: string;
  status: "active" | "done" | "error";
  startedAt: number;
  completedAt?: number;
  /** File path for edit events (used to key the diff view). */
  path?: string;
  /** Pre-edit content — enables inline diff in the AI timeline dropdown. */
  oldContent?: string;
  /** Post-edit content — enables inline diff in the AI timeline dropdown. */
  newContent?: string;
  /** Shell command executed (op: "command") — rendered in a mono command box. */
  command?: string;
  /** Captured stdout/stderr for a command event. */
  output?: string;
  /** Process exit code for a command event. */
  exitCode?: number;
  /** Lines added / removed, shown as +N -N next to edits. */
  added?: number;
  removed?: number;
  /** Reference chips (file paths, folders) shown inline on the row. */
  refs?: string[];
}

interface BuildStore {
  /** Currently active project id (mirrors projectStore.currentProjectId). Used to scope active build progress to one project. */
  currentProjectId: string | null;
  jobs: BuildJob[];
  activeJobId: string | null;
  // Shared build progress for the action panel
  activePhaseGroups: PhaseGroupData[];
  activeCiSteps: CiStep[];
  /** GitHub Actions run URL for the in-flight build (Android or iOS). */
  activeRunUrl: string | null;
  isBuildActive: boolean;
  /** Short live caption shown in the Action Panel above the timeline (max ~50 chars). */
  thinkingCaption: string | null;
  /** Phase 1 GitHub repo name — reused by Phase 2 so caches match. */
  phase1RepoName: string | null;
  /** Live timeline events from the AI wiring agent (reads, searches, edits) */
  aiTimeline: AiTimelineEvent[];
  /** Repair attempts executed on the runner or received via live telemetry. */
  repairAttempts: RepairAttemptInfo[];
  /** Current macro-phase the platform is executing. */
  buildButtonState:
    | "idle"
    | "validating"
    | "phase1-setup"
    | "ai-wiring"
    | "phase2-build"
    | "ready"
    | "failed";
  /** Which target platform ('android' | 'ios') the Action Panel is currently building for. */
  activePlatform: TargetPlatform;
  setActivePlatform: (p: TargetPlatform) => void;

  /** Switch the active project. Clears in-flight build progress so it doesn't leak across projects. */
  setCurrentProject: (projectId: string | null) => void;

  addJob: (job: BuildJob) => void;
  updateJob: (id: string, updates: Partial<BuildJob>) => void;
  appendLog: (id: string, log: string) => void;
  appendLogs: (id: string, logs: string[]) => void;
  setActiveJob: (id: string | null) => void;
  getActiveJob: () => BuildJob | undefined;
  getJob: (id: string) => BuildJob | undefined;
  getJobsByProject: (projectId: string) => BuildJob[];
  // Phase group setters for cross-component state
  setActivePhaseGroups: (groups: PhaseGroupData[]) => void;
  setActiveCiSteps: (steps: CiStep[]) => void;
  setActiveRunUrl: (url: string | null) => void;
  setIsBuildActive: (active: boolean) => void;
  setThinkingCaption: (caption: string | null) => void;
  setPhase1RepoName: (name: string | null) => void;
  setBuildButtonState: (state: BuildStore["buildButtonState"]) => void;
  pushAiEvent: (evt: Omit<AiTimelineEvent, "id" | "startedAt">) => string;
  completeAiEvent: (id: string, status?: "done" | "error") => void;
  updateAiEvent: (id: string, updates: Partial<AiTimelineEvent>) => void;
  clearAiTimeline: () => void;
  setRepairAttempts: (attempts: RepairAttemptInfo[]) => void;
  addOrUpdateRepairAttempt: (attempt: RepairAttemptInfo) => void;
  updateRepairTodo: (attemptNumber: number, stepNumber: number, updates: Partial<RepairTodo>) => void;
  clearRepairAttempts: () => void;
  clearBuildProgress: () => void;
}

export const useBuildStore = create<BuildStore>((set, get) => ({
  currentProjectId: null,
  jobs: [],
  activeJobId: null,
  activePhaseGroups: [],
  activeCiSteps: [],
  activeRunUrl: null,
  isBuildActive: false,
  thinkingCaption: null,
  phase1RepoName: null,
  aiTimeline: [],
  repairAttempts: [],
  buildButtonState: "idle",
  activePlatform: "android",
  setActivePlatform: (p) => set({ activePlatform: p }),

  setCurrentProject: (projectId) => {
    if (get().currentProjectId === projectId) return;
    set({
      currentProjectId: projectId,
      activeJobId: null,
      activePhaseGroups: [],
      activeCiSteps: [],
      activeRunUrl: null,
      isBuildActive: false,
      thinkingCaption: null,
      phase1RepoName: null,
      aiTimeline: [],
      repairAttempts: [],
      buildButtonState: "idle",
    });
  },

  addJob: (job) =>
    set((s) => ({ jobs: [job, ...s.jobs], activeJobId: job.id })),

  updateJob: (id, updates) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    })),

  appendLog: (id, log) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id ? { ...j, logs: [...j.logs, log] } : j
      ),
    })),

  appendLogs: (id, logs) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id ? { ...j, logs: [...j.logs, ...logs] } : j
      ),
    })),

  setActiveJob: (id) => set({ activeJobId: id }),

  getActiveJob: () => {
    const s = get();
    return s.jobs.find((j) => j.id === s.activeJobId);
  },

  getJob: (id) => get().jobs.find((j) => j.id === id),

  getJobsByProject: (projectId) =>
    get().jobs.filter((j) => j.projectId === projectId),

  setActivePhaseGroups: (groups) => set({ activePhaseGroups: groups }),
  setActiveCiSteps: (steps) => set({ activeCiSteps: steps }),
  setActiveRunUrl: (url) => set({ activeRunUrl: url }),
  setIsBuildActive: (active) => set({ isBuildActive: active }),
  setThinkingCaption: (caption) =>
    set({ thinkingCaption: caption ? caption.slice(0, 50) : null }),
  setPhase1RepoName: (name) => set({ phase1RepoName: name }),
  setBuildButtonState: (state) => set({ buildButtonState: state }),
  pushAiEvent: (evt) => {
    const id = crypto.randomUUID();
    const newEvent: AiTimelineEvent = { ...evt, id, startedAt: Date.now() };
    set((s) => ({ aiTimeline: [...s.aiTimeline, newEvent] }));
    return id;
  },
  completeAiEvent: (id, status = "done") =>
    set((s) => ({
      aiTimeline: s.aiTimeline.map((e) =>
        e.id === id ? { ...e, status, completedAt: Date.now() } : e
      ),
    })),
  updateAiEvent: (id, updates) =>
    set((s) => ({
      aiTimeline: s.aiTimeline.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
  clearAiTimeline: () => set({ aiTimeline: [] }),
  setRepairAttempts: (attempts) => set({ repairAttempts: attempts }),
  addOrUpdateRepairAttempt: (attempt) =>
    set((s) => {
      const idx = s.repairAttempts.findIndex((a) => a.attempt === attempt.attempt);
      if (idx === -1) {
        return { repairAttempts: [...s.repairAttempts, attempt] };
      }
      const next = [...s.repairAttempts];
      next[idx] = { ...next[idx], ...attempt };
      return { repairAttempts: next };
    }),
  updateRepairTodo: (attemptNumber, stepNumber, updates) =>
    set((s) => {
      const idx = s.repairAttempts.findIndex((a) => a.attempt === attemptNumber);
      if (idx === -1) return {};
      const targetAttempt = s.repairAttempts[idx];
      const todos = targetAttempt.todos ? [...targetAttempt.todos] : [];
      const todoIdx = todos.findIndex((t) => t.stepNumber === stepNumber);
      if (todoIdx === -1) return {};
      todos[todoIdx] = { ...todos[todoIdx], ...updates };
      const next = [...s.repairAttempts];
      next[idx] = { ...targetAttempt, todos };
      return { repairAttempts: next };
    }),
  clearRepairAttempts: () => set({ repairAttempts: [] }),
  clearBuildProgress: () =>
    set({
      activePhaseGroups: [],
      activeCiSteps: [],
      activeRunUrl: null,
      isBuildActive: false,
      thinkingCaption: null,
      aiTimeline: [],
      repairAttempts: [],
      buildButtonState: "idle",
    }),
}));
