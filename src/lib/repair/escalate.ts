/**
 * Failure escalation — every build failure reaches the AI, not just a toast.
 *
 * Any step that dies (install, build, capacitor sync, gradle, artifact
 * validation, or an unexpected exception) calls escalateBuildFailure with the
 * REAL stderr. The Code Repair Agent investigates the project source, patches
 * it, and the result is resealed so the next dispatch actually carries the
 * repaired bytes (AGENTS.md B.9).
 *
 * This module never runs commands itself: execution stays with the runner.
 */

import { toast } from "sonner";
import { useBuildStore } from "@/stores/buildStore";
import { logEvent } from "@/lib/logs/logSink";
import { runCodeRepairAgent, type RepairAgentResult } from "./codeRepairAgent";
import { resealRepairedSource } from "./persistRepairs";

export interface EscalationInput {
  /** Raw output of the failing step — never a summarized message. */
  errorText: string;
  /** install | build | capacitor_sync | gradle_build | artifact_validation | phase1 | phase3 */
  stepName: string;
  errorType?: string;
  projectId?: string | null;
  buildId?: string | null;
  runId?: string | number | null;
  phase?: string | null;
  /** Checksum the failed build ran against, so an ineffective repair is caught. */
  previousChecksum?: string | null;
  /**
   * Re-runs ONLY the failing step. When the step can only run on the build
   * machine, omit it: the agent then verifies statically and the caller
   * re-dispatches after a successful reseal.
   */
  verifyStep?: (step: string) => Promise<{ ok: boolean; output: string }>;
}

export interface EscalationOutcome {
  /** True when the source changed and a retry is worth dispatching. */
  retryWorthwhile: boolean;
  status: "fixed" | "escalated" | "unavailable";
  /** Plain English, one screen, safe to show the user. */
  userSummary: string;
  changedPaths: string[];
  newChecksum: string | null;
  agent?: RepairAgentResult;
}

/** Static fallback verification when the failing step lives on the runner. */
const staticVerify = async (step: string) => ({
  ok: false,
  output:
    `The "${step}" step runs on the build machine, so it cannot be re-run from here. ` +
    `Make the smallest correct source change you can justify from the error output, ` +
    `then stop — the platform re-runs the step for you.`,
});

export async function escalateBuildFailure(input: EscalationInput): Promise<EscalationOutcome> {
  const buildStore = useBuildStore.getState();

  if (!input.projectId) {
    const msg = "No app is connected, so this failure could not be sent to the AI for repair.";
    toast.error("Build failed", { description: msg });
    return { retryWorthwhile: false, status: "unavailable", userSummary: msg, changedPaths: [], newChecksum: null };
  }

  logEvent({
    logType: "ai-repair",
    level: "error",
    phase: input.phase || "escalation",
    runId: input.runId ?? null,
    projectId: input.projectId,
    stepName: input.stepName,
    message: `"${input.stepName}" failed — handing the real error to the repair agent`,
    meta: { errorType: input.errorType || "unknown", errorTail: input.errorText.slice(-4000) },
  });

  buildStore.setThinkingCaption(`Reading the ${input.stepName} error and investigating your project`);

  let agent: RepairAgentResult;
  try {
    agent = await runCodeRepairAgent({
      errorText: input.errorText,
      stepName: input.stepName,
      errorType: input.errorType,
      projectId: input.projectId,
      buildId: input.buildId,
      runId: input.runId,
      phase: input.phase,
      verifyStep: input.verifyStep ?? staticVerify,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    toast.error("Automatic repair could not run", { description: reason.slice(0, 200) });
    return {
      retryWorthwhile: false,
      status: "unavailable",
      userSummary: `The automatic repair could not run (${reason}). The original failure in "${input.stepName}" is unchanged.`,
      changedPaths: [],
      newChecksum: null,
    };
  }

  const changedPaths = [...new Set(agent.patches.map((p) => p.path))];

  if (changedPaths.length === 0) {
    toast.error("Build failed", { description: agent.userSummary.slice(0, 200) });
    return {
      retryWorthwhile: false,
      status: agent.status,
      userSummary: agent.userSummary,
      changedPaths,
      newChecksum: null,
      agent,
    };
  }

  // The edits exist in the editor; they only count once they are inside a
  // freshly sealed source ZIP with a new checksum.
  const reseal = await resealRepairedSource({
    projectId: input.projectId,
    previousChecksum: input.previousChecksum ?? null,
    changedPaths,
  });

  if (!reseal.ok) {
    const summary = `${agent.userSummary} However, ${reseal.reason}`;
    toast.error("Repair could not be saved", { description: reseal.reason?.slice(0, 200) });
    return { retryWorthwhile: false, status: "escalated", userSummary: summary, changedPaths, newChecksum: reseal.checksum, agent };
  }

  const summary =
    agent.status === "fixed"
      ? `${agent.userSummary} Updated ${changedPaths.join(", ")} and saved the changes, ready to build again.`
      : `${agent.userSummary} It did change ${changedPaths.join(", ")}, which has been saved, so another build attempt is worth trying.`;

  toast.success("AI repaired your project", { description: `Changed ${changedPaths.length} file${changedPaths.length === 1 ? "" : "s"}` });

  return { retryWorthwhile: true, status: agent.status, userSummary: summary, changedPaths, newChecksum: reseal.checksum, agent };
}
