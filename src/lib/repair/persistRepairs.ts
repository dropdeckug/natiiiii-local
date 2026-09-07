/**
 * Repair persistence bridge.
 *
 * AGENTS.md B.9: an edit is not done until it is in projectStore, persisted,
 * and inside the resealed source ZIP under a NEW source_checksum. Retrying a
 * build with an unchanged checksum means the runner would install and build the
 * exact bytes that already failed — that is a bug, and this module reports it
 * instead of silently burning another attempt.
 */

import { useProjectStore } from "@/stores/projectStore";

import { logEvent } from "@/lib/logs/logSink";

export interface ResealResult {
  ok: boolean;
  /** Checksum of the resealed source ZIP, when the reseal succeeded. */
  checksum: string | null;
  previousChecksum: string | null;
  /** Plain-English reason when ok is false. */
  reason?: string;
}

/**
 * Reseal the current project source after repair edits.
 *
 * `previousChecksum` is the checksum the failing build ran against. When the
 * reseal produces the same checksum, the repair never actually changed the
 * bytes the runner sees, so the caller must abort rather than retry.
 */
export async function resealRepairedSource(opts: {
  projectId?: string | null;
  previousChecksum?: string | null;
  /** Paths the repair agent claims to have changed — used for the log only. */
  changedPaths?: string[];
}): Promise<ResealResult> {
  const { projectId, previousChecksum = null, changedPaths = [] } = opts;

  if (!projectId) {
    return { ok: false, checksum: null, previousChecksum, reason: "No project is connected, so the repaired files cannot be sent to the build machine." };
  }

  const store = useProjectStore.getState();
  const files = store.files ?? [];
  if (files.length === 0) {
    return { ok: false, checksum: null, previousChecksum, reason: "The project has no source files loaded to reseal." };
  }

  let snapshot: Awaited<ReturnType<typeof store.persistToCloud>> | null = null;
  try {
    // Go through the store's own save path so the repaired source is sealed
    // exactly the way a normal save seals it (same plugins, engine, config).
    snapshot = await store.persistToCloud(projectId);
  } catch (e) {

    const reason = e instanceof Error ? e.message : String(e);
    logEvent({ logType: "ai-repair", level: "error", phase: "reseal", projectId, message: `Reseal failed: ${reason}` });
    return { ok: false, checksum: null, previousChecksum, reason: `The repaired files could not be saved (${reason}).` };
  }

  const checksum = (snapshot as { source_checksum?: string | null } | null)?.source_checksum ?? null;

  if (!snapshot || !checksum) {
    return { ok: false, checksum: null, previousChecksum, reason: "The repaired files were not saved, so the build machine would receive the old code." };
  }

  if (previousChecksum && checksum === previousChecksum) {
    logEvent({
      logType: "ai-repair",
      level: "error",
      phase: "reseal",
      projectId,
      message: "Reseal produced an unchanged source checksum — the repair did not modify the built source",
      meta: { checksum, changedPaths },
    });
    return {
      ok: false,
      checksum,
      previousChecksum,
      reason: "The repair did not actually change the code that gets built, so retrying would fail in exactly the same way.",
    };
  }

  logEvent({
    logType: "ai-repair",
    level: "success",
    phase: "reseal",
    projectId,
    message: `Repaired source resealed (${changedPaths.length} file(s) changed)`,
    meta: { checksum, previousChecksum, changedPaths },
  });

  return { ok: true, checksum, previousChecksum };
}
