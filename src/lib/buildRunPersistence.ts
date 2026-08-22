/**
 * Resumable build tracking — persists the active build run to Supabase so the
 * dashboard can rehydrate progress when the user refreshes or navigates away.
 *
 * Lifecycle:
 *   startRun()  → INSERT row, status='running', phase='validating'
 *   updateRun() → UPDATE phase / repo_name / run_id / commit_sha / diagnostic
 *   endRun()    → UPDATE status='success'|'failed', ended_at=now()
 *
 * Resume:
 *   findActiveRun(projectId) → most-recent 'running' row for the project
 *   resumePolling()          → re-polls GitHub Actions status for that row
 */
import { supabase } from "@/integrations/supabase/client";
import { useBuildStore } from "@/stores/buildStore";

const TABLE = "build_runs" as const;
const STALE_MS = 30 * 60 * 1000; // 30 min

export interface BuildRunRow {
  id: string;
  project_id: string;
  user_id: string;
  phase: string;
  status: string;
  repo_name: string | null;
  run_id: number | null;
  commit_sha: string | null;
  model: string | null;
  diagnostic: string | null;
  started_at: string;
  ended_at: string | null;
}

let activeRunId: string | null = null;

export async function startRun(projectId: string, model?: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .insert({
        project_id: projectId,
        user_id: session.user.id,
        phase: "validating",
        status: "running",
        model: model || null,
      })
      .select("id")
      .single();
    if (error) { console.warn("startRun:", error); return null; }
    activeRunId = data.id;
    return data.id;
  } catch (e) { console.warn("startRun failed:", e); return null; }
}

export async function updateRun(updates: Partial<Pick<BuildRunRow, "phase" | "repo_name" | "run_id" | "commit_sha" | "diagnostic">>) {
  if (!activeRunId) return;
  try {
    await (supabase as any).from(TABLE).update(updates).eq("id", activeRunId);
  } catch (e) { console.warn("updateRun failed:", e); }
}

export async function endRun(status: "success" | "failed", diagnostic?: string) {
  if (!activeRunId) return;
  try {
    await (supabase as any).from(TABLE).update({
      status,
      diagnostic: diagnostic || null,
      ended_at: new Date().toISOString(),
    }).eq("id", activeRunId);
  } catch (e) { console.warn("endRun failed:", e); }
  activeRunId = null;
}

export async function findActiveRun(projectId: string): Promise<BuildRunRow | null> {
  try {
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const age = Date.now() - new Date(data.started_at).getTime();
    if (age > STALE_MS) {
      // Auto-mark as failed so it doesn't keep rehydrating forever.
      await (supabase as any).from(TABLE)
        .update({ status: "failed", diagnostic: "Stale (>30m, no completion signal)", ended_at: new Date().toISOString() })
        .eq("id", data.id);
      return null;
    }
    return data as BuildRunRow;
  } catch (e) { console.warn("findActiveRun:", e); return null; }
}

/** Re-poll GitHub Actions status for a previously-started run. */
export async function resumePolling(row: BuildRunRow) {
  if (!row.repo_name) return;
  activeRunId = row.id;
  const buildStore = useBuildStore.getState();
  buildStore.setIsBuildActive(true);
  buildStore.setPhase1RepoName(row.repo_name);
  // Map persisted phase → buildButtonState
  const phase = row.phase as any;
  if (["validating", "phase1-setup", "ai-wiring", "phase2-build", "ready", "failed"].includes(phase)) {
    buildStore.setBuildButtonState(phase);
  }
  buildStore.setThinkingCaption(`Resumed: ${phase}`);

  const MAX = 240; // ~20 min @ 5s
  for (let i = 0; i < MAX; i++) {
    try {
      const { data } = await supabase.functions.invoke("build-apk", {
        body: { action: "status", repoName: row.repo_name, runId: row.run_id || undefined, commitSha: row.commit_sha || undefined },
      });
      if (Array.isArray(data?.steps)) buildStore.setActiveCiSteps(data.steps);
      if (data?.status === "success") {
        buildStore.setBuildButtonState("ready");
        buildStore.setIsBuildActive(false);
        buildStore.setThinkingCaption(null);
        await endRun("success");
        return;
      }
      if (data?.status === "failure" || data?.status === "cancelled") {
        buildStore.setBuildButtonState("failed");
        buildStore.setIsBuildActive(false);
        buildStore.setThinkingCaption(null);
        await endRun("failed", data?.diagnostic || data?.status);
        return;
      }
    } catch (e) { console.warn("resume poll error:", e); }
    await new Promise((r) => setTimeout(r, 5000));
  }
  buildStore.setBuildButtonState("failed");
  buildStore.setIsBuildActive(false);
  buildStore.setThinkingCaption(null);
  await endRun("failed", "Resume polling timed out");
}
