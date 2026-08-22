/**
 * Build Orchestration Engine
 * 3-Phase Build Model:
 *   Phase 1: "setup"     — Install deps, add Capacitor, add plugins, push to GitHub, cache
 *   Phase 2: "ai-wiring" — AI scans code, injects plugin code, modifies files (local)
 *   Phase 3: "build"     — Push modified code to GitHub Actions, Gradle build, sign, deliver
 */

import { computeFileHash, getLatestSnapshot, type ProjectSnapshot } from "./projectPersistence";
import type { ProjectFile } from "@/stores/projectStore";

export type MacroPhase = "setup" | "ai-wiring" | "build";

export type BuildPhase =
  | "scan"
  | "compatibility"
  | "dependencies"
  | "plugins"
  | "config"
  | "ai-inject"
  | "bundle"
  | "upload"
  | "build";

export interface BuildStep {
  phase: BuildPhase;
  macroPhase: MacroPhase;
  label: string;
  required: boolean;
  reason: string;
  estimatedSeconds: number;
}

export interface BuildPlan {
  steps: BuildStep[];
  isIncremental: boolean;
  previousSnapshot: ProjectSnapshot | null;
  currentHash: string;
  skippedPhases: BuildPhase[];
  totalEstimatedSeconds: number;
  macroPhases: MacroPhaseInfo[];
}

export interface MacroPhaseInfo {
  id: MacroPhase;
  label: string;
  description: string;
  steps: BuildStep[];
  estimatedSeconds: number;
}

export interface OrchestratorEvent {
  phase: BuildPhase;
  macroPhase?: MacroPhase;
  status: "start" | "complete" | "skip" | "error";
  label: string;
  detail?: string;
  elapsed?: number;
}

export interface MacroPhaseEvent {
  macroPhase: MacroPhase;
  status: "start" | "complete" | "error";
  label: string;
  detail?: string;
  elapsed?: number;
}

type EventListener = (event: OrchestratorEvent) => void;
type MacroPhaseListener = (event: MacroPhaseEvent) => void;

const MACRO_PHASE_META: Record<MacroPhase, { label: string; description: string }> = {
  setup: { label: "Establishing infrastructure", description: "Provision Ubuntu runners, install Node & JDK, prepare workspace" },
  "ai-wiring": { label: "AI Code Integration", description: "AI scans code, injects plugin code, modifies files" },
  build: { label: "Build & Deliver", description: "Compile with Gradle, sign and deliver the installer" },
};

const PHASE_META: Record<BuildPhase, { label: string; estimatedSeconds: number; macroPhase: MacroPhase }> = {
  scan: { label: "Scanning project structure", estimatedSeconds: 2, macroPhase: "setup" },
  compatibility: { label: "Checking compatibility", estimatedSeconds: 1, macroPhase: "setup" },
  dependencies: { label: "Installing dependencies", estimatedSeconds: 18, macroPhase: "setup" },
  plugins: { label: "Installing plugins", estimatedSeconds: 12, macroPhase: "setup" },
  config: { label: "Generating configuration", estimatedSeconds: 1, macroPhase: "setup" },
  "ai-inject": { label: "AI code integration", estimatedSeconds: 5, macroPhase: "ai-wiring" },
  bundle: { label: "Bundling source code", estimatedSeconds: 3, macroPhase: "build" },
  upload: { label: "Dispatching to build runners", estimatedSeconds: 5, macroPhase: "build" },
  build: { label: "Building with Gradle", estimatedSeconds: 120, macroPhase: "build" },
};

/**
 * Compute a build plan by comparing current state to the last snapshot.
 */
export async function computeBuildPlan(
  projectId: string,
  files: ProjectFile[],
  plugins: string[],
  engine: string,
  options: { forceFullBuild?: boolean } = {}
): Promise<BuildPlan> {
  const currentHash = computeFileHash(files);
  const previousSnapshot = await getLatestSnapshot(projectId);

  const allPhases: BuildPhase[] = [
    "scan", "compatibility", "dependencies", "plugins",
    "config", "ai-inject", "bundle", "upload", "build"
  ];

  const buildSteps = (required: boolean, reason: string): BuildStep[] =>
    allPhases.map(phase => ({
      phase,
      macroPhase: PHASE_META[phase].macroPhase,
      label: PHASE_META[phase].label,
      required,
      reason: required ? (previousSnapshot ? "Force full build requested" : "First build for this project") : reason,
      estimatedSeconds: required ? PHASE_META[phase].estimatedSeconds : 0,
    }));

  if (options.forceFullBuild || !previousSnapshot) {
    const steps = buildSteps(true, "");
    return {
      steps,
      isIncremental: false,
      previousSnapshot,
      currentHash,
      skippedPhases: [],
      totalEstimatedSeconds: steps.reduce((sum, s) => sum + s.estimatedSeconds, 0),
      macroPhases: groupByMacroPhase(steps),
    };
  }

  // Diff against last snapshot
  const hashChanged = currentHash !== previousSnapshot.file_hash;
  const prevPlugins = (previousSnapshot.plugin_state as unknown as string[]) || [];
  const pluginsChanged = JSON.stringify([...plugins].sort()) !== JSON.stringify([...prevPlugins].sort());
  const prevEngine = (previousSnapshot.config_state as Record<string, unknown>)?.engine as string;
  const engineChanged = prevEngine !== engine;

  const steps: BuildStep[] = [];
  const skippedPhases: BuildPhase[] = [];

  for (const phase of allPhases) {
    let required = true;
    let reason = "Required for build";
    const macroPhase = PHASE_META[phase].macroPhase;

    switch (phase) {
      case "scan":
        required = hashChanged || engineChanged;
        reason = required ? "Source code changed" : "Source unchanged — skipping";
        break;
      case "compatibility":
        required = hashChanged || engineChanged;
        reason = required ? "Verifying compatibility" : "Already verified";
        break;
      case "dependencies":
        required = hashChanged;
        reason = required ? "Dependencies may have changed" : "Dependencies unchanged";
        break;
      case "plugins":
        required = pluginsChanged;
        reason = required ? "Plugin configuration changed" : "Plugins unchanged";
        break;
      case "config":
        required = pluginsChanged || engineChanged;
        reason = required ? "Config needs regeneration" : "Config unchanged";
        break;
      case "ai-inject":
        required = pluginsChanged || hashChanged;
        reason = required ? "Code injection needed for changes" : "No injection needed";
        break;
      case "bundle":
      case "upload":
      case "build":
        reason = "Required for every build";
        break;
    }

    if (required) {
      steps.push({ phase, macroPhase, label: PHASE_META[phase].label, required: true, reason, estimatedSeconds: PHASE_META[phase].estimatedSeconds });
    } else {
      skippedPhases.push(phase);
      steps.push({ phase, macroPhase, label: PHASE_META[phase].label, required: false, reason, estimatedSeconds: 0 });
    }
  }

  return {
    steps,
    isIncremental: skippedPhases.length > 0,
    previousSnapshot,
    currentHash,
    skippedPhases,
    totalEstimatedSeconds: steps.filter(s => s.required).reduce((sum, s) => sum + s.estimatedSeconds, 0),
    macroPhases: groupByMacroPhase(steps),
  };
}

function groupByMacroPhase(steps: BuildStep[]): MacroPhaseInfo[] {
  const phases: MacroPhase[] = ["setup", "ai-wiring", "build"];
  return phases.map(mp => {
    const phaseSteps = steps.filter(s => s.macroPhase === mp);
    return {
      id: mp,
      label: MACRO_PHASE_META[mp].label,
      description: MACRO_PHASE_META[mp].description,
      steps: phaseSteps,
      estimatedSeconds: phaseSteps.reduce((sum, s) => sum + s.estimatedSeconds, 0),
    };
  });
}

/**
 * Orchestrator event emitter for real-time UI updates.
 */
export class BuildOrchestrator {
  private listeners: EventListener[] = [];
  private macroListeners: MacroPhaseListener[] = [];
  private phaseTimers = new Map<BuildPhase, number>();
  private macroTimers = new Map<MacroPhase, number>();
  private _activeMacroPhase: MacroPhase | null = null;

  get activeMacroPhase() { return this._activeMacroPhase; }

  on(listener: EventListener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  onMacroPhase(listener: MacroPhaseListener) {
    this.macroListeners.push(listener);
    return () => { this.macroListeners = this.macroListeners.filter(l => l !== listener); };
  }

  private emit(event: OrchestratorEvent) {
    for (const listener of this.listeners) {
      try { listener(event); } catch (err) { console.error("Orchestrator listener error:", err); }
    }
  }

  private emitMacro(event: MacroPhaseEvent) {
    for (const listener of this.macroListeners) {
      try { listener(event); } catch (err) { console.error("Orchestrator macro listener error:", err); }
    }
  }

  startMacroPhase(macroPhase: MacroPhase) {
    this._activeMacroPhase = macroPhase;
    this.macroTimers.set(macroPhase, Date.now());
    this.emitMacro({
      macroPhase,
      status: "start",
      label: MACRO_PHASE_META[macroPhase].label,
    });
  }

  completeMacroPhase(macroPhase: MacroPhase, detail?: string) {
    const started = this.macroTimers.get(macroPhase);
    const elapsed = started ? (Date.now() - started) / 1000 : 0;
    this.emitMacro({
      macroPhase,
      status: "complete",
      label: MACRO_PHASE_META[macroPhase].label,
      detail,
      elapsed,
    });
    if (this._activeMacroPhase === macroPhase) this._activeMacroPhase = null;
  }

  errorMacroPhase(macroPhase: MacroPhase, detail: string) {
    const started = this.macroTimers.get(macroPhase);
    const elapsed = started ? (Date.now() - started) / 1000 : 0;
    this.emitMacro({
      macroPhase,
      status: "error",
      label: MACRO_PHASE_META[macroPhase].label,
      detail,
      elapsed,
    });
    if (this._activeMacroPhase === macroPhase) this._activeMacroPhase = null;
  }

  startPhase(phase: BuildPhase, label?: string) {
    this.phaseTimers.set(phase, Date.now());
    this.emit({
      phase,
      macroPhase: PHASE_META[phase].macroPhase,
      status: "start",
      label: label || PHASE_META[phase].label,
    });
  }

  completePhase(phase: BuildPhase, detail?: string) {
    const started = this.phaseTimers.get(phase);
    const elapsed = started ? (Date.now() - started) / 1000 : 0;
    this.emit({
      phase,
      macroPhase: PHASE_META[phase].macroPhase,
      status: "complete",
      label: PHASE_META[phase].label,
      detail,
      elapsed,
    });
  }

  skipPhase(phase: BuildPhase, reason: string) {
    this.emit({
      phase,
      macroPhase: PHASE_META[phase].macroPhase,
      status: "skip",
      label: PHASE_META[phase].label,
      detail: reason,
    });
  }

  errorPhase(phase: BuildPhase, detail: string) {
    const started = this.phaseTimers.get(phase);
    const elapsed = started ? (Date.now() - started) / 1000 : 0;
    this.emit({
      phase,
      macroPhase: PHASE_META[phase].macroPhase,
      status: "error",
      label: PHASE_META[phase].label,
      detail,
      elapsed,
    });
  }
}
