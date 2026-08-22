/** Structured verification state persisted after a remote Android build. */

export interface CprVerificationStageInput {
  name?: string;
  conclusion?: string | null;
}

export interface CprVerificationResult {
  platform: "android" | "ios";
  status: "verified" | "failed";
  buildSuccess: boolean;
  artifactSuccess: boolean;
  runtimeSmokeSuccess: boolean | null;
  runId: number | null;
  verifiedAt: string;
  failure: string | null;
  stages: {
    webBuild: "passed" | "failed" | "unknown";
    capacitorSync: "passed" | "failed" | "unknown";
    nativeBuild: "passed" | "failed" | "unknown";
    artifacts: "passed" | "failed" | "unknown";
  };
}

function stageStatus(
  steps: CprVerificationStageInput[],
  matcher: RegExp,
  fallback: "passed" | "failed" | "unknown",
): "passed" | "failed" | "unknown" {
  const matching = steps.filter((step) => matcher.test(step.name ?? ""));
  if (matching.length === 0) return fallback;
  return matching.some((step) => step.conclusion === "failure") ? "failed" :
    matching.every((step) => step.conclusion === "success") ? "passed" : "unknown";
}

export function buildCprVerificationResult(input: {
  platform?: "android" | "ios";
  buildSuccess: boolean;
  artifactSuccess: boolean;
  runId?: number | null;
  failure?: string | null;
  steps?: CprVerificationStageInput[];
  verifiedAt?: string;
}): CprVerificationResult {
  const buildSuccess = input.buildSuccess;
  const artifactSuccess = input.artifactSuccess;
  const steps = input.steps ?? [];
  return {
    platform: input.platform ?? "android",
    status: buildSuccess && artifactSuccess ? "verified" : "failed",
    buildSuccess,
    artifactSuccess,
    runtimeSmokeSuccess: null,
    runId: input.runId ?? null,
    verifiedAt: input.verifiedAt ?? new Date().toISOString(),
    failure: input.failure ?? null,
    stages: {
      webBuild: stageStatus(steps, /build web|web project|build frontend/i, buildSuccess ? "passed" : "failed"),
      capacitorSync: stageStatus(steps, /capacitor.*sync|sync capacitor/i, buildSuccess ? "passed" : "failed"),
      nativeBuild: stageStatus(steps, /gradle|assemble|build (debug|release) apk|build (debug|release) aab/i, buildSuccess ? "passed" : "failed"),
      artifacts: stageStatus(steps, /upload (apk|aab)|artifact/i, artifactSuccess ? "passed" : "failed"),
    },
  };
}
