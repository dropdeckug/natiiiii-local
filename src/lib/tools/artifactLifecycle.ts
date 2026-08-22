/** Build artifact publication policy shared by build orchestration and tests. */

export type BuildArtifactLifecycleStatus = "artifact_pending" | "success" | "failed";

/** A build is publishable only after at least one required artifact is usable. */
export function artifactLifecycleStatus(hasApk: boolean, hasAab: boolean): BuildArtifactLifecycleStatus {
  return hasApk || hasAab ? "success" : "failed";
}
