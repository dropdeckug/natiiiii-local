/**
 * On dashboard mount, look for an unfinished build for this project and
 * resume polling its GitHub Actions status. If none, no-op.
 */
import { useEffect } from "react";
import { findActiveRun, resumePolling } from "@/lib/buildRunPersistence";
import { useBuildStore } from "@/stores/buildStore";

export function useResumableBuild(projectId: string | undefined) {
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      // Don't clobber an in-flight build in this same tab.
      if (useBuildStore.getState().isBuildActive) return;
      const row = await findActiveRun(projectId);
      if (cancelled || !row) return;
      resumePolling(row);
    })();
    return () => { cancelled = true; };
  }, [projectId]);
}
