/**
 * useOrchestratorFeed
 * Bridges BuildOrchestrator events → PhaseGroup[] for the 3-phase ActionTrackerPanel.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { BuildOrchestrator, OrchestratorEvent, MacroPhaseEvent, BuildPlan, BuildPhase, MacroPhase } from "@/lib/orchestrator";
import type { ActivityAction, ActionType } from "@/components/create/AIActivityFeed";

export interface PhaseGroupData {
  id: MacroPhase;
  label: string;
  status: "pending" | "active" | "done" | "error";
  startedAt?: number;
  elapsed?: number;
  actions: ActivityAction[];
}

interface UseOrchestratorFeedOptions {
  orchestrator: BuildOrchestrator | null;
  buildPlan: BuildPlan | null;
}

interface OrchestratorFeedResult {
  actions: ActivityAction[];
  phaseGroups: PhaseGroupData[];
  estimatedTimeRemaining: number;
  totalEstimatedSeconds: number;
  elapsedSeconds: number;
  progressPercent: number;
  addCustomAction: (title: string, type?: ActionType, detail?: string, macroPhase?: MacroPhase) => string;
  updateAction: (id: string, updates: Partial<ActivityAction>) => void;
  completeAction: (id: string, detail?: string) => void;
  errorAction: (id: string, detail?: string) => void;
  addGitHubStep: (name: string, status: "pending" | "active" | "done" | "error", elapsed?: number) => string;
  updateGitHubStep: (id: string, status: "pending" | "active" | "done" | "error", elapsed?: number) => void;
  reset: () => void;
}

const phaseToActionType: Record<BuildPhase, ActionType> = {
  scan: "tool_call",
  compatibility: "tool_call",
  dependencies: "tool_call",
  plugins: "tool_call",
  config: "tool_call",
  "ai-inject": "reasoning",
  bundle: "tool_call",
  upload: "tool_call",
  build: "tool_call",
};

const MACRO_PHASE_LABELS: Record<MacroPhase, string> = {
  setup: "Setup & Dependencies",
  "ai-wiring": "AI Code Integration",
  build: "Build & Deliver",
};

export function useOrchestratorFeed({
  orchestrator,
  buildPlan,
}: UseOrchestratorFeedOptions): OrchestratorFeedResult {
  const [actions, setActions] = useState<ActivityAction[]>([]);
  const [phaseGroups, setPhaseGroups] = useState<PhaseGroupData[]>([
    { id: "setup", label: MACRO_PHASE_LABELS["setup"], status: "pending", actions: [] },
    { id: "ai-wiring", label: MACRO_PHASE_LABELS["ai-wiring"], status: "pending", actions: [] },
    { id: "build", label: MACRO_PHASE_LABELS["build"], status: "pending", actions: [] },
  ]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const phaseIdMap = useRef<Map<BuildPhase, string>>(new Map());
  const actionMacroMap = useRef<Map<string, MacroPhase>>(new Map());

  // Track total elapsed
  useEffect(() => {
    if (!orchestrator) return;
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds((Date.now() - startTimeRef.current) / 1000);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [orchestrator]);

  // Helper to add action to both flat list and phase group
  const addActionToGroup = useCallback((action: ActivityAction, macroPhase: MacroPhase) => {
    actionMacroMap.current.set(action.id, macroPhase);
    setActions(prev => [...prev, action]);
    setPhaseGroups(prev => prev.map(g =>
      g.id === macroPhase
        ? { ...g, actions: [...g.actions, action] }
        : g
    ));
  }, []);

  const updateActionInGroup = useCallback((id: string, updates: Partial<ActivityAction>) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    const macroPhase = actionMacroMap.current.get(id);
    if (macroPhase) {
      setPhaseGroups(prev => prev.map(g =>
        g.id === macroPhase
          ? { ...g, actions: g.actions.map(a => a.id === id ? { ...a, ...updates } : a) }
          : g
      ));
    }
  }, []);

  // Subscribe to macro-phase events
  useEffect(() => {
    if (!orchestrator) return;

    const unsubMacro = orchestrator.onMacroPhase((event: MacroPhaseEvent) => {
      setPhaseGroups(prev => prev.map(g => {
        if (g.id !== event.macroPhase) return g;
        switch (event.status) {
          case "start":
            return { ...g, status: "active", startedAt: Date.now() };
          case "complete":
            return { ...g, status: "done", elapsed: event.elapsed };
          case "error":
            return { ...g, status: "error", elapsed: event.elapsed };
          default:
            return g;
        }
      }));
    });

    return unsubMacro;
  }, [orchestrator]);

  // Subscribe to orchestrator phase events
  useEffect(() => {
    if (!orchestrator) return;

    const unsubscribe = orchestrator.on((event: OrchestratorEvent) => {
      const actionType = phaseToActionType[event.phase] || "tool_call";
      const macroPhase = event.macroPhase || "setup";

      switch (event.status) {
        case "start": {
          const id = crypto.randomUUID();
          phaseIdMap.current.set(event.phase, id);
          const action: ActivityAction = {
            id,
            type: actionType,
            title: event.label,
            status: "active",
            startedAt: Date.now(),
          };
          addActionToGroup(action, macroPhase);
          break;
        }
        case "complete": {
          const id = phaseIdMap.current.get(event.phase);
          if (id) {
            updateActionInGroup(id, {
              status: "done" as const,
              detail: event.detail,
              elapsed: event.elapsed,
            });
          }
          break;
        }
        case "skip": {
          const id = crypto.randomUUID();
          const action: ActivityAction = {
            id,
            type: actionType,
            title: `${event.label} — skipped`,
            status: "done",
            detail: event.detail,
            elapsed: 0,
          };
          addActionToGroup(action, macroPhase);
          break;
        }
        case "error": {
          const id = phaseIdMap.current.get(event.phase);
          if (id) {
            updateActionInGroup(id, {
              status: "error" as const,
              detail: event.detail,
              elapsed: event.elapsed,
            });
          }
          break;
        }
      }
    });

    return unsubscribe;
  }, [orchestrator, addActionToGroup, updateActionInGroup]);

  // Compute ETA
  const totalEstimatedSeconds = buildPlan?.totalEstimatedSeconds ?? 0;
  const completedPhaseSeconds = actions
    .filter(a => a.status === "done" || a.status === "error")
    .reduce((sum, a) => sum + (a.elapsed || 0), 0);

  const estimatedTimeRemaining = Math.max(0, totalEstimatedSeconds - completedPhaseSeconds);
  const progressPercent = totalEstimatedSeconds > 0
    ? Math.min(100, (completedPhaseSeconds / totalEstimatedSeconds) * 100)
    : 0;

  // Custom action helpers
  const addCustomAction = useCallback(
    (title: string, type: ActionType = "thinking", detail?: string, macroPhase?: MacroPhase): string => {
      const id = crypto.randomUUID();
      const action: ActivityAction = { id, type, title, status: "active", startedAt: Date.now(), detail };
      const mp = macroPhase || "build";
      addActionToGroup(action, mp);
      return id;
    },
    [addActionToGroup]
  );

  const updateAction = useCallback(
    (id: string, updates: Partial<ActivityAction>) => {
      updateActionInGroup(id, updates);
    },
    [updateActionInGroup]
  );

  const completeAction = useCallback((id: string, detail?: string) => {
    updateActionInGroup(id, {
      status: "done" as const,
      detail: detail || undefined,
      elapsed: undefined, // will be calculated by display
    });
  }, [updateActionInGroup]);

  const errorAction = useCallback((id: string, detail?: string) => {
    updateActionInGroup(id, {
      status: "error" as const,
      detail: detail || undefined,
    });
  }, [updateActionInGroup]);

  // GitHub Actions step helpers for Phase 3
  const addGitHubStep = useCallback((name: string, status: "pending" | "active" | "done" | "error", elapsed?: number): string => {
    const id = crypto.randomUUID();
    const action: ActivityAction = { id, type: "tool_call", title: name, status, startedAt: Date.now(), elapsed };
    addActionToGroup(action, "build");
    return id;
  }, [addActionToGroup]);

  const updateGitHubStep = useCallback((id: string, status: "pending" | "active" | "done" | "error", elapsed?: number) => {
    updateActionInGroup(id, { status, elapsed });
  }, [updateActionInGroup]);

  const reset = useCallback(() => {
    setActions([]);
    setPhaseGroups([
      { id: "setup", label: MACRO_PHASE_LABELS["setup"], status: "pending", actions: [] },
      { id: "ai-wiring", label: MACRO_PHASE_LABELS["ai-wiring"], status: "pending", actions: [] },
      { id: "build", label: MACRO_PHASE_LABELS["build"], status: "pending", actions: [] },
    ]);
    setElapsedSeconds(0);
    startTimeRef.current = null;
    phaseIdMap.current.clear();
    actionMacroMap.current.clear();
  }, []);

  return {
    actions,
    phaseGroups,
    estimatedTimeRemaining,
    totalEstimatedSeconds,
    elapsedSeconds,
    progressPercent,
    addCustomAction,
    updateAction,
    completeAction,
    errorAction,
    addGitHubStep,
    updateGitHubStep,
    reset,
  };
}
