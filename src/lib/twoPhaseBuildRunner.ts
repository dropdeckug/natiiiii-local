/**
 * 2-Phase build runner — triggered from the Action Panel "Build" button.
 *
 * Phase 1 (setup): ZIP source → build-apk action="setup" → poll status.
 * Phase 2 (AI wiring): stream ai-wire-plugins → patch in-memory file tree.
 * Phase 3 (rebuild): re-ZIP modified source → build-apk action="rebuild".
 *
 * Streams progress back through buildStore (thinkingCaption, phaseGroups,
 * ciSteps, isBuildActive, buildButtonState) so the Action Panel updates live.
 */

import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { useProjectStore, type ProjectFile } from "@/stores/projectStore";
import { useBuildStore } from "@/stores/buildStore";
import { getSecretsForBuild, loadPluginSecrets, arePluginSecretsComplete, savePluginSecret } from "@/lib/pluginSecretsService";
import { wireDisplayMode, displayModeWiringToLogs } from "@/lib/plugins/displayMode";
import { DEFAULT_DISPLAY_MODE_CONFIG, readDisplayModeConfig, getDisplayMode } from "@/lib/plugins/displayMode/registry";
import { PLUGIN_NPM_MAP } from "@/lib/generators/pluginMapping";
import { runRepair, isRepairable } from "@/lib/buildRepairRunner";
import { buildFailureFingerprint } from "@/lib/tools/buildFailureFingerprint";
import { parseBuildError } from "@/lib/tools/buildErrorParser";
import { artifactLifecycleStatus } from "@/lib/tools/artifactLifecycle";
import { buildCprVerificationResult } from "@/lib/tools/cprVerification";
import { toast } from "sonner";
import { startRun, updateRun, endRun } from "@/lib/buildRunPersistence";
import { markGeneratedFile } from "@/lib/tools/capacitorNormalizer";
import { resolvePluginDependencies } from "@/lib/plugins/dependencies";
import { PLATFORM_CAPACITOR_MAJOR } from "../../cpr/versions/index";

import { planProjectGrounding } from "@/lib/tools/projectIndexer";
import { setLogContext, logEvent, importCiLogs, flushLogs, fetchErrorContext } from "@/lib/logs/logSink";


export function resetNormalizationGuard() {
  // Kept for API compatibility. Capacitor normalization is owned by CPR.
}

/**
 * Resolve a list of internal plugin IDs (e.g. "geo", "camera") to their
 * actual npm package names (e.g. "@capacitor/geolocation"). IDs without a
 * mapping entry are kept as-is so custom packages still flow through.
 */
function resolvePluginNpmNames(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Expand companion plugins first: edge-to-edge needs @capacitor/status-bar,
  // every OAuth flow needs @capacitor/browser + @capacitor/app. Without this
  // Phase 2 imports a package that was never installed and the build fails.
  const { ids: expanded } = resolvePluginDependencies(ids.filter(Boolean));
  for (const id of expanded) {
    if (!id) continue;
    const entry = PLUGIN_NPM_MAP[id];
    if (!entry && !id.startsWith("@") && !id.includes("/")) {
      throw new Error(`Unsupported Capacitor plugin "${id}". Select a registered plugin or provide its full npm package name.`);
    }
    const npmNames = entry
      ? [entry.npm, ...(entry.companionNpms ?? [])]
      : [id];
    for (const npmName of npmNames) {
      if (seen.has(npmName)) continue;
      seen.add(npmName);
      out.push(npmName);
    }
  }
  return out;
}


const flatten = (files: ProjectFile[]): ProjectFile[] => {
  const out: ProjectFile[] = [];
  const walk = (nodes: ProjectFile[]) => { for (const n of nodes) { out.push(n); if (n.children) walk(n.children); } };
  walk(files);
  return out;
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Incremental CPR re-seal.
 *
 * CPR seals a canonical `package.json` and stores its SHA-256 in the blueprint.
 * Enabling a plugin afterwards mutates the manifest, so the workflow's sealed
 * checksum no longer matches and Phase 1 aborts with
 * "CPR manifest checksum mismatch".
 *
 * Instead of re-running CPR from scratch, we patch the sealed manifest with the
 * enabled plugin packages (aligned to the platform Capacitor major), rewrite it
 * into the project tree, recompute the checksum and persist the updated
 * blueprint. The workflow then receives a manifest that matches its own seal.
 */
async function resealManifestForPlugins(
  projectId: string,
  blueprint: Record<string, unknown> | null,
  npmNames: string[],
): Promise<Record<string, unknown> | null> {
  const hints = (blueprint?.cprProjectBlueprint ?? null) as Record<string, unknown> | null;
  const appRoot = String(hints?.appRoot || "").replace(/^\/+|\/+$/g, "");
  const manifestPath = appRoot ? `${appRoot}/package.json` : "package.json";

  const store = useProjectStore.getState();
  const flat = flatten(store.files);
  const pkgFile = flat.find((f) => f.path === manifestPath)
    || flat.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  if (!pkgFile?.content) return blueprint;

  let pkg: any;
  try { pkg = JSON.parse(pkgFile.content); } catch { return blueprint; }

  const pinned = `^${PLATFORM_CAPACITOR_MAJOR}.0.0`;
  pkg.dependencies = { ...(pkg.dependencies || {}) };
  pkg.devDependencies = { ...(pkg.devDependencies || {}) };
  const added: string[] = [];

  for (const name of npmNames) {
    if (pkg.dependencies[name] || pkg.devDependencies[name]) continue;
    pkg.dependencies[name] = name.startsWith("@capacitor/") ? pinned : "latest";
    added.push(name);
  }
  // Keep every Capacitor package on the platform major so npm cannot resolve a
  // conflicting peer graph on the runner.
  for (const bucket of [pkg.dependencies, pkg.devDependencies]) {
    for (const name of Object.keys(bucket)) {
      if (!name.startsWith("@capacitor/")) continue;
      const major = String(bucket[name]).match(/(\d+)/)?.[1];
      if (major && Number(major) !== PLATFORM_CAPACITOR_MAJOR) bucket[name] = pinned;
    }
  }

  const canonical = JSON.stringify(pkg, null, 2) + "\n";
  const changed = canonical !== pkgFile.content;
  if (changed) {
    store.updateFileContent(pkgFile.path, canonical);
    markGeneratedFile(pkgFile.path);
    console.info(`[cpr] re-sealed manifest — added: ${added.join(", ") || "(alignment only)"}`);
  }

  const manifestChecksum = await sha256Hex(canonical);
  if (!hints) return blueprint;
  if (hints.manifestChecksum === manifestChecksum) return blueprint;

  const next = {
    ...(blueprint as Record<string, unknown>),
    cprProjectBlueprint: {
      ...hints,
      manifestChecksum,
      // The dependency graph moved — the previously sealed lockfile is stale.
      lockfileChecksum: null,
      lockfilePolicy: "regenerate",
    },
  };

  try {
    await supabase.from("project_cpr").update({ blueprint: next as any }).eq("project_id", projectId);
  } catch (e) {
    console.warn("[cpr] could not persist re-sealed blueprint:", e);
  }
  logEvent({
    logType: "build",
    level: "info",
    message: `CPR manifest re-sealed for ${npmNames.length} plugin package(s)`,
    meta: { pathname: pkgFile.path, method: "CPR" },
  });
  return next;
}



async function bundleSourceBlob(files: ProjectFile[]): Promise<Blob> {
  const zip = new JSZip();
  for (const f of flatten(files)) {
    if (f.type !== "file") continue;
    if (f.isBinary && f.binaryContent) zip.file(f.path, f.binaryContent);
    else if (f.content) zip.file(f.path, f.content);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } });
}

async function bundleSourceZip(files: ProjectFile[]): Promise<{ blob: Blob; base64: string }> {
  const blob = await bundleSourceBlob(files);
  const arr = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < arr.byteLength; i += 8192) bin += String.fromCharCode(...arr.subarray(i, i + 8192));
  return { blob, base64: btoa(bin) };
}

/** Upload large build inputs directly to Storage instead of embedding them as
 * Base64 in an Edge Function JSON request. A 10 MB ZIP becomes a ~13.3 MB JSON
 * string and can spend minutes being encoded, parsed, and copied in memory. */
async function uploadBuildSource(
  projectId: string,
  files: ProjectFile[],
  phase: "setup" | "rebuild",
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in again before starting the build");

  const blob = await bundleSourceBlob(files);
  const storagePath = `${session.user.id}/${projectId}/build-input/${phase}.zip`;
  const { error } = await supabase.storage
    .from("project-files")
    .upload(storagePath, blob, { upsert: true, contentType: "application/zip" });
  if (error) throw new Error(`Could not upload build source: ${error.message}`);
  return storagePath;
}

async function persistBuildSource(projectId: string, stage: string): Promise<void> {
  const snapshot = await useProjectStore.getState().persistToCloud(projectId);
  if (!snapshot) throw new Error(`Could not save project source before ${stage}`);
  logEvent({
    logType: "source",
    level: "success",
    message: `Saved source snapshot before ${stage}`,
    meta: { pathname: snapshot.storage_path, method: "SNAPSHOT", fileCount: snapshot.file_count },
  });
}

/**
 * After a successful Phase 3 build, download GitHub artifacts (apk/aab), unzip,
 * upload to Supabase Storage, and create a `builds` row tied to the project.
 * If an artifact is too large (>50MB inline limit), store the GitHub run URL
 * instead so the user can download directly from GitHub.
 */
async function persistBuildArtifacts(args: {
  projectId: string;
  appName: string;
  packageName: string;
  repoName: string;
  runId: number | null;
  signingMode: "debug" | "release";
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const userId = session.user.id;

  // Keep the row non-successful until artifacts have been downloaded, inspected,
  // and stored. A completed GitHub job is not enough to call the build usable.
  const { data: buildRow, error: insertErr } = await supabase
    .from("builds")
    .insert({
      user_id: userId,
      project_id: args.projectId,
      app_name: args.appName,
      package_name: args.packageName,
      engine: "capacitor",
      status: "artifact_pending",
      stage: "Downloading artifacts",
      repo_name: args.repoName,
      repo_url: `https://github.com/${args.repoName}`,
      source_repo_name: args.repoName,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      build_metadata: { runId: args.runId, signingMode: args.signingMode },
    })
    .select("id")
    .single();
  if (insertErr || !buildRow) throw new Error(insertErr?.message || "Failed to record build");
  const jobId = buildRow.id;

  // Ask edge function for artifacts (or runUrl fallback for >50MB)
  const { data: artifactData, error: dlErr } = await supabase.functions.invoke("build-apk", {
    body: { action: "download", repoName: args.repoName, runId: args.runId },
  });
  if (dlErr || !artifactData) {
    const message = dlErr?.message || "Artifact download failed";
    await supabase.from("builds").update({ status: "failed", stage: "Artifact download failed", error: message, completed_at: new Date().toISOString() }).eq("id", jobId);
    throw new Error(message);
  }

  const runUrl: string | undefined = artifactData.runUrl;
  const updates: { apk_url?: string; aab_url?: string; build_metadata?: any } = {
    build_metadata: { runId: args.runId, signingMode: args.signingMode, runUrl },
  };

  const extractAndUpload = async (
    meta: { base64: string | null; tooLarge?: boolean; runUrl?: string; size?: number } | null,
    ext: "apk" | "aab",
    contentType: string,
  ): Promise<string | undefined> => {
    if (!meta) return undefined;
    // Too large → store the GitHub run URL so user can grab it from GitHub UI
    if (meta.tooLarge || !meta.base64) {
      return meta.runUrl || runUrl;
    }
    try {
      const bin = atob(meta.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const zip = await JSZip.loadAsync(bytes);
      const entry = Object.keys(zip.files).find((n) => n.endsWith(`.${ext}`));
      if (!entry) return undefined;
      const blob = await zip.files[entry].async("blob");
      const path = `${userId}/${jobId}/app.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("build-artifacts")
        .upload(path, blob, { upsert: true, contentType });
      if (upErr) {
        console.warn(`[build] ${ext} upload failed, falling back to runUrl:`, upErr.message);
        return meta.runUrl || runUrl;
      }
      return path;
    } catch (e) {
      console.warn(`[build] ${ext} extract failed:`, e);
      return meta.runUrl || runUrl;
    }
  };

  const apkUrl = await extractAndUpload(artifactData.apk, "apk", "application/vnd.android.package-archive");
  const aabUrl = await extractAndUpload(artifactData.aab, "aab", "application/octet-stream");
  if (artifactLifecycleStatus(!!apkUrl, !!aabUrl) === "failed") {
    const message = "No APK or AAB artifact was downloaded or stored";
    await supabase.from("builds").update({ status: "failed", stage: "Artifact validation failed", error: message, completed_at: new Date().toISOString() }).eq("id", jobId);
    throw new Error(message);
  }
  if (apkUrl) updates.apk_url = apkUrl;
  if (aabUrl) updates.aab_url = aabUrl;

  await supabase.from("builds").update({ ...updates, status: "success", stage: "Artifacts ready", completed_at: new Date().toISOString() } as any).eq("id", jobId);
}

async function persistCprVerification(projectId: string, result: ReturnType<typeof buildCprVerificationResult>): Promise<void> {
  const { error } = await supabase
    .from("project_cpr")
    .update({ verify_result: result as any })
    .eq("project_id", projectId);
  if (error) throw new Error(`Could not persist CPR verification: ${error.message}`);
}

function parseRepairLogsToAttempt(logExcerpt: string, attemptNumber = 1) {
  if (!logExcerpt) return null;
  if (!logExcerpt.includes("AI repair") && !logExcerpt.includes("repair-executor") && !logExcerpt.includes("NB_REPAIR_EXHAUSTED")) {
    return null;
  }
  const diagnosisMatch = logExcerpt.match(/diagnosis:\s*([A-Z0-9_]+)\s*\(([^)]+)\)/i);
  const rootCauseMatch = logExcerpt.match(/root cause:\s*([^\n]+)/i);
  const exhaustedMatch = logExcerpt.match(/NB_REPAIR_EXHAUSTED=([A-Z0-9_]+)/i);
  const succeededMatch = logExcerpt.includes("AI repair succeeded");

  const diagnosisType = diagnosisMatch?.[1] || exhaustedMatch?.[1] || "UNKNOWN";
  const source = (diagnosisMatch?.[2] as any) || "deterministic";
  const rootCause = rootCauseMatch?.[1]?.trim() || (exhaustedMatch ? `AI repair exhausted for ${exhaustedMatch[1]}` : undefined);

  const commandMatches = [...logExcerpt.matchAll(/\$\s+([^\n]+)/g)];
  const commands = commandMatches.map((m) => ({ cmd: m[1].trim(), name: m[1].trim(), critical: false }));

  const status: "succeeded" | "exhausted" | "executing" = succeededMatch
    ? "succeeded"
    : exhaustedMatch || logExcerpt.includes("exhausted")
    ? "exhausted"
    : "executing";

  return {
    attempt: attemptNumber,
    maxAttempts: 3,
    status,
    diagnosisType,
    rootCause,
    source,
    commands: commands.length ? commands : undefined,
    timestamp: Date.now(),
  };
}

async function syncRunnerRepairTelemetry(buildId?: string | null, projectId?: string | null, steps?: any[]) {
  const buildStore = useBuildStore.getState();

  if (buildId || projectId) {
    try {
      let query = supabase.from("build_events").select("*").order("created_at", { ascending: true });
      if (buildId) {
        query = query.eq("build_id", buildId);
      } else if (projectId) {
        query = query.eq("project_id", projectId);
      }
      const { data } = await query;
      if (data && data.length) {
        const repairRows = data.filter((row: any) => (row.meta as any)?.kind === "runner-repair");
        for (const row of repairRows) {
          const meta = (row.meta || {}) as any;
          const attemptMatch = row.step.match(/attempt (\d+)/i);
          const attemptNum = attemptMatch ? parseInt(attemptMatch[1], 10) : meta.diagnosis?.attempt || 1;
          const existing = buildStore.repairAttempts.find((a) => a.attempt === attemptNum);
          const isReport = row.step.includes("runner execution");
          const status = isReport
            ? meta.outcome === "repaired"
              ? "succeeded"
              : "exhausted"
            : row.status === "error"
            ? "failed"
            : "executing";

          buildStore.addOrUpdateRepairAttempt({
            attempt: attemptNum,
            maxAttempts: 3,
            status,
            diagnosisType: meta.diagnosis?.type || existing?.diagnosisType || "UNKNOWN",
            rootCause: meta.diagnosis?.rootCause || existing?.rootCause,
            evidence: meta.diagnosis?.evidence || existing?.evidence,
            source: meta.source || existing?.source || "deterministic",
            model: meta.model || existing?.model,
            commands:
              meta.commands?.map((c: any) =>
                typeof c === "string" ? { cmd: c, name: c, critical: false } : c
              ) || existing?.commands,
            results: meta.results || existing?.results,
            notes: row.message || existing?.notes,
            timestamp: new Date(row.created_at).getTime(),
          });
        }
      }
    } catch {
      // Non-critical telemetry sync failure
    }
  }

  if (steps && Array.isArray(steps)) {
    const repairStep = steps.find((s: any) => s.name?.toLowerCase().includes("ai dependency repair loop"));
    if (repairStep && repairStep.logExcerpt) {
      const parsed = parseRepairLogsToAttempt(repairStep.logExcerpt);
      if (parsed) {
        buildStore.addOrUpdateRepairAttempt(parsed);
      }
    }
  }
}

async function pollPhaseStatus(repoName: string, runId: number | null, commitSha?: string | null, phase?: string) {
  const buildStore = useBuildStore.getState();
  const maxPolls = 90;
  let poll = 0;
  let lastStepCount = 0;
  let resolvedRunId: number | null = runId;
  let lastDiagnostic: string | null = null;
  const seenSteps = new Set<string>();
  setLogContext({ repoName, runId: runId ?? null, phase: phase ?? null });

  while (poll < maxPolls) {
    await new Promise((r) => setTimeout(r, poll < 3 ? 4000 : 8000));
    poll++;
    const { data, error } = await supabase.functions.invoke("build-apk", {
      body: { action: "status", repoName, runId: resolvedRunId, commitSha: commitSha || undefined },
    });
    if (error) {
      console.error("[build] status invoke error:", error);
      logEvent({ logType: "api", level: "error", message: `status | 500 | build-apk/status | ${error.message}`, meta: { method: "POST", pathname: "/functions/v1/build-apk?action=status" } });
      continue;
    }
    if (!data) continue;
    if (data.diagnostic && data.diagnostic !== lastDiagnostic) {
      lastDiagnostic = data.diagnostic;
      console.warn("[build] workflow diagnostic:", data.diagnostic);
      logEvent({ logType: "pipeline", level: "warning", message: `Workflow diagnostic: ${data.diagnostic}`, phase, runId: resolvedRunId });
    }
    if (!resolvedRunId && data.runId) {
      resolvedRunId = data.runId;
      setLogContext({ runId: resolvedRunId });
      logEvent({ logType: "pipeline", level: "info", message: `Workflow run #${resolvedRunId} started on ${repoName}`, phase, runId: resolvedRunId, meta: { runUrl: data.runUrl } });
    }
    if (data.runUrl) buildStore.setActiveRunUrl(data.runUrl);
    const steps = Array.isArray(data.allSteps) ? data.allSteps : Array.isArray(data.steps) ? data.steps : null;
    if (steps) {
      buildStore.setActiveCiSteps(steps);
      void syncRunnerRepairTelemetry(buildStore.activeJobId, buildStore.currentProjectId, steps);
      const activeStep = steps.find((s: any) => s.status === "in_progress");
      if (activeStep) buildStore.setThinkingCaption(activeStep.name);
      if (steps.length !== lastStepCount) lastStepCount = steps.length;
      // Stream each step transition into the logs console.
      for (const s of steps) {
        const key = `${s.number}:${s.name}:${s.status}:${s.conclusion ?? ""}`;
        if (seenSteps.has(key)) continue;
        seenSteps.add(key);
        const level = s.conclusion === "failure" ? "error" : s.conclusion === "success" ? "success" : "info";
        logEvent({
          logType: "pipeline",
          level,
          message: `${s.status === "completed" ? s.conclusion ?? "completed" : s.status} · ${s.name}`,
          stepName: s.name,
          jobName: data.jobName ?? "build",
          conclusion: s.conclusion ?? null,
          phase,
          runId: resolvedRunId,
          raw: s.logExcerpt || null,
          meta: { method: "STEP", pathname: s.name, runUrl: data.runUrl },
        });
      }
    }
    if (data.status === "success") {
      logEvent({ logType: "pipeline", level: "success", message: `Workflow run #${resolvedRunId} succeeded`, phase, runId: resolvedRunId, statusCode: 200 });
      if (resolvedRunId) void importCiLogs({ repoName, runId: resolvedRunId, platform: "android", phase });
      return { success: true, runId: data.runId || resolvedRunId, steps: steps ?? [] };
    }
    if (data.status === "failure") {
      const ei = data.errorInfo || {};
      const detail = [
        ei.errorType && `${ei.errorType}: ${ei.errorDetail || ""}`.trim(),
        ei.failedStep && `Failed step: ${ei.failedStep}`,
        ei.suggestedFix && `Fix: ${ei.suggestedFix}`,
        data.buildLogs && `\nLogs:\n${String(data.buildLogs).split("\n").slice(-15).join("\n")}`,
        data.runUrl && `\nRun: ${data.runUrl}`,
      ].filter(Boolean).join("\n");
      console.error("[build] GitHub Actions failed:", { errorInfo: ei, runUrl: data.runUrl, buildLogs: data.buildLogs });
      logEvent({
        logType: "pipeline",
        level: "error",
        statusCode: 500,
        message: `Workflow run #${resolvedRunId} failed — ${ei.errorType || "build error"}${ei.failedStep ? ` at ${ei.failedStep}` : ""}`,
        stepName: ei.failedStep ?? null,
        phase,
        runId: resolvedRunId,
        raw: detail,
        meta: { runUrl: data.runUrl, errorInfo: ei },
      });
      // Pull the complete GitHub Actions logs so the console and the AI can
      // read exactly what broke.
      if (resolvedRunId) await importCiLogs({ repoName, runId: resolvedRunId, platform: "android", phase });
      await syncRunnerRepairTelemetry(buildStore.activeJobId, buildStore.currentProjectId, steps);
      await flushLogs();
      return { success: false, runId: data.runId || resolvedRunId, error: detail || "GitHub Actions failed", steps: steps ?? [] };
    }
  }
  logEvent({ logType: "pipeline", level: "error", message: `Build timed out${lastDiagnostic ? ` — ${lastDiagnostic}` : ""}`, phase, runId: resolvedRunId });
  return { success: false, runId: resolvedRunId, error: `Build timed out${lastDiagnostic ? ` — ${lastDiagnostic}` : ""}`, steps: [] };
}


interface RunBuildOptions {
  projectId: string;
  appName: string;
  packageName: string;
  signingMode?: "debug" | "release";
  platform?: "android" | "ios";
}

export async function runTwoPhaseBuild(opts: RunBuildOptions) {
  if (opts.platform === "ios") {
    return runIosBuild(opts);
  }
  const projectStore = useProjectStore.getState();
  const buildStore = useBuildStore.getState();

  const { files, enabledPlugins } = projectStore;
  const { ids: enabled, added: implicitPlugins } = resolvePluginDependencies(enabledPlugins);
  if (implicitPlugins.length > 0) {
    console.info(`[plugins] auto-enabled required companions: ${implicitPlugins.join(", ")}`);
  }
  const enabledNpm = resolvePluginNpmNames(enabled);


  if (files.length === 0) {
    toast.error("Upload source code before building.");
    return;
  }

  buildStore.setIsBuildActive(true);
  setLogContext({ projectId: opts.projectId, platform: opts.platform || "android", phase: null, runId: null, repoName: null });
  logEvent({ logType: "build", level: "info", message: `Build started · ${opts.appName} (${opts.packageName}) · ${opts.signingMode || "debug"}`, meta: { pathname: "/build/start", method: "BUILD" } });
  buildStore.setBuildButtonState("validating");
  buildStore.setThinkingCaption("Validating plugin configuration");
  await startRun(opts.projectId);

  // ── Fetch persisted Android build config (version + SDK) ──
  let versionCfg: { versionName?: string; versionCode?: number; minSdk?: number; targetSdk?: number } = {};
  try {
    const { data: appRow } = await supabase
      .from("project_apps")
      .select("version_name, version_code, min_sdk, target_sdk")
      .eq("project_id", opts.projectId)
      .eq("platform", "android")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (appRow) {
      versionCfg = {
        versionName: (appRow as any).version_name || undefined,
        versionCode: (appRow as any).version_code ?? undefined,
        minSdk: (appRow as any).min_sdk ?? undefined,
        targetSdk: (appRow as any).target_sdk ?? undefined,
      };
    }
  } catch (e) {
    console.warn("Could not load Android build config:", e);
  }

  // ── Pre-build gate: validate plugin configs ──
  try {
    const savedSecrets = await loadPluginSecrets(opts.projectId);
    const missing: string[] = [];
    for (const pluginId of enabled) {
      if (!arePluginSecretsComplete(pluginId, savedSecrets)) missing.push(pluginId);
    }
    if (missing.length > 0) {
      toast.error(`Plugin config required: ${missing.join(", ")}`, {
        description: "Open the Plugins tab and provide the missing credentials.",
      });
      buildStore.setIsBuildActive(false);
      buildStore.setBuildButtonState("failed");
      buildStore.setThinkingCaption(null);
      endRun("failed", "Plugin config missing");
      return;
    }
  } catch (e) {
    console.warn("Plugin config validation skipped:", e);
  }
  // CPR owns Capacitor cleanup and canonical configuration. Builds consume the
  // persisted blueprint and never normalize the editor tree again.
  let cprBlueprint: Record<string, unknown> | null = null;
  try {
    const { data, error } = await supabase
      .from("project_cpr")
      .select("blueprint, status, blocking")
      .eq("project_id", opts.projectId)
      .maybeSingle();
    if (error) throw error;
    if (data?.blocking || data?.status === "blocked") {
      throw new Error("The project CPR is blocked. Resolve its preflight report before building.");
    }
    cprBlueprint = (data?.blueprint as Record<string, unknown> | null) ?? null;
    if (!cprBlueprint) console.warn("[cpr] no persisted blueprint; workflow will use the current platform release");
  } catch (error) {
    if (error instanceof Error && error.message.includes("CPR is blocked")) throw error;
    console.warn("[cpr] blueprint lookup failed; using platform defaults", error);
  }

  // Enabling plugins after CPR mutates package.json, which invalidates the
  // sealed manifest checksum. Patch + re-seal incrementally instead of failing.
  try {
    buildStore.setThinkingCaption("Re-sealing dependency graph for enabled plugins");
    cprBlueprint = await resealManifestForPlugins(opts.projectId, cprBlueprint, enabledNpm);
  } catch (e) {
    console.warn("[cpr] manifest re-seal skipped:", e);
  }



  // ── Project grounding: synthesize static build files and repair HTML boilerplate ──
  // Detected web output directory (dist / build / www / out / .output/public),
  // fed into the CI workflow so it never has to guess where the build landed.
  let detectedWebDir = "";
  try {
    const state = useProjectStore.getState();
    const grounding = planProjectGrounding(state.files, opts.appName || "App");
    detectedWebDir = grounding.index?.outputDir
      || (grounding.index?.isStaticHtml ? "www" : "dist");
    if (grounding.patches.length > 0) buildStore.setThinkingCaption("Grounding project before build");
    for (const patch of grounding.patches) {
      state.updateFileContent(patch.path, patch.content);
      markGeneratedFile(patch.path);
      console.info(`[grounding] ${patch.path}: ${patch.reason}`);
    }
    for (const line of grounding.logs) console.info(`[grounding] ${line}`);
  } catch (e) {
    console.warn("Project grounding skipped:", e);
  }


  // ── Phase 1: Setup ──
  buildStore.setBuildButtonState("phase1-setup");
  buildStore.setThinkingCaption("Phase 1: Provisioning Ubuntu runner");

  let phase1Repo: string | null = null;
  let phase1Run: number | null = null;
  try {
    // CPR has already sealed plugin dependencies and lockfile policy.
    await persistBuildSource(opts.projectId, "Phase 1");
    const invokeSetup = async (projectStoragePath: string) => {
      const { data, error } = await supabase.functions.invoke("build-apk", {
        body: {
          action: "setup",
          projectName: opts.appName,
          appName: opts.appName,
          packageName: opts.packageName,
          plugins: enabledNpm,
          projectStoragePath,
          webDir: detectedWebDir || undefined,
          cprBlueprint,
          existingRepoName: buildStore.phase1RepoName || undefined,
          ...versionCfg,
        },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Setup failed");
      phase1Repo = data.repoName;
      phase1Run = data.runId || null;
      if (data.diagnostic) console.warn("[build] Phase 1 setup diagnostic:", data.diagnostic);
      buildStore.setPhase1RepoName(phase1Repo);
      updateRun({ phase: "phase1-setup", repo_name: phase1Repo, run_id: phase1Run, commit_sha: data.commitSha || null });
      buildStore.setThinkingCaption("Phase 1: Setting up Node & JDK on runner");
      return await pollPhaseStatus(phase1Repo!, phase1Run, data.commitSha, "phase1");
    };

    let result = await invokeSetup(await uploadBuildSource(opts.projectId, useProjectStore.getState().files, "setup"));

    // ── AI auto-repair loop for code-level Phase 1 failures ──
    const MAX_PHASE1_REPAIRS = 2;
    let p1Attempt = 0;
    const phase1Failures = new Set<string>();
    while (!result.success && p1Attempt < MAX_PHASE1_REPAIRS) {
      const failingStep = useBuildStore.getState().activeCiSteps.find((s: any) => s.conclusion === "failure");
      const failingStepName = (failingStep as any)?.name || "";
      const excerpt = (failingStep as any)?.logExcerpt || "";
      const fullErr = (result.error || "Phase 1 failed") + (excerpt ? `\n\nFailing step: ${failingStepName}\n${excerpt}` : "");

      const isRunnerRepairFailure =
        failingStepName.toLowerCase().includes("ai dependency repair loop") ||
        failingStepName.toLowerCase().includes("install npm dependencies") ||
        failingStepName.toLowerCase().includes("dependency doctor") ||
        fullErr.includes("NB_REPAIR_EXHAUSTED") ||
        fullErr.includes("Runner Repair Exhausted") ||
        fullErr.includes("dependency installation could not be completed");

      if (isRunnerRepairFailure) {
        logEvent({
          logType: "pipeline",
          level: "error",
          phase: "phase1",
          runId: result.runId ?? null,
          message: "Runner AI repair loop exhausted — halting browser repair",
          raw: fullErr,
        });
        throw new Error(fullErr);
      }

      const logEventId = buildStore.pushAiEvent({ op: "search", title: "Retrieving failed run logs", detail: `GitHub run ${result.runId ?? "pending"}`, status: "active", refs: [String(result.runId ?? "unknown")] });
      const ciErrors = await fetchErrorContext({ projectId: opts.projectId, runId: result.runId ?? null, limit: 120 });
      buildStore.updateAiEvent(logEventId, { detail: `${ciErrors.length} run-scoped error and warning entries loaded`, status: "done", completedAt: Date.now() });
      const parsed = parseBuildError([...ciErrors, excerpt, result.error || ""], fullErr);
      if (!isRepairable(parsed)) throw new Error(fullErr);
      const fingerprint = buildFailureFingerprint(parsed, (failingStep as any)?.name || "phase1", fullErr);
      if (phase1Failures.has(fingerprint)) throw new Error(`${fullErr}\n\nAutomatic repair stopped because the same failure recurred.`);
      phase1Failures.add(fingerprint);

      p1Attempt++;
      toast.info(`Phase 1 failed — AI repair attempt ${p1Attempt}/${MAX_PHASE1_REPAIRS}…`, {
        description: parsed?.title?.slice(0, 120),
      });
      buildStore.setBuildButtonState("ai-wiring");
      logEvent({
        logType: "ai-repair", level: "warning", phase: "phase1", runId: result.runId ?? null,
        message: `AI repair attempt ${p1Attempt}/${MAX_PHASE1_REPAIRS} — ${parsed?.title || "setup failure"}`,
        raw: fullErr,
      });
      const repair = await runRepair(fullErr, [...ciErrors, excerpt, result.error || ""], {
        phaseName: `Phase 1 setup (attempt ${p1Attempt})`,
        parsed,
        projectId: opts.projectId,
        runId: result.runId,
      });
      logEvent({
        logType: "ai-repair", level: repair.patched ? "success" : "error", phase: "phase1",
        message: repair.patched
          ? `AI applied ${repair.edits.length} fix(es): ${repair.edits.join("; ").slice(0, 600)}`
          : `AI repair could not patch: ${repair.summary}`,
        raw: repair.edits.join("\n"),
      });
      if (!repair.patched) throw new Error(fullErr);
      buildStore.setBuildButtonState("phase1-setup");
      buildStore.setActiveCiSteps([]);
      // Persist the repaired tree before creating the retry ZIP so the source
      // snapshot and the bytes sent to Phase 1 cannot diverge.
      await persistBuildSource(opts.projectId, `Phase 1 AI repair ${p1Attempt}`);
      buildStore.pushAiEvent({ op: "config", title: "Saved repaired source snapshot", detail: repair.changedFiles.map((file) => file.path).join(", "), status: "done", refs: repair.changedFiles.map((file) => file.path) });
      result = await invokeSetup(await uploadBuildSource(opts.projectId, useProjectStore.getState().files, "setup"));
    }
    if (!result.success) throw new Error(result.error || "Phase 1 failed after AI repair attempts");
    phase1Run = result.runId || phase1Run;

    // ── Sync GitHub-installed files (android/, package-lock.json, manifest) back to platform ──
    buildStore.setThinkingCaption("Syncing installed files into editor");
    try {
      const { data: srcData } = await supabase.functions.invoke("build-apk", {
        body: { action: "download-phase1-source", repoName: phase1Repo, runId: phase1Run },
      });
      if (srcData?.base64) {
        const bin = atob(srcData.base64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        // GitHub artifact downloads as a zip-of-zip; unwrap.
        const outerZip = await JSZip.loadAsync(buf);
        let innerZipFile: JSZip.JSZipObject | null = null;
        outerZip.forEach((_p, entry) => { if (!entry.dir && entry.name.endsWith(".zip")) innerZipFile = entry; });
        const targetZip = innerZipFile
          ? await JSZip.loadAsync(await innerZipFile.async("uint8array"))
          : outerZip;
        const incoming: { path: string; content?: string; binaryContent?: ArrayBuffer; isBinary?: boolean }[] = [];
        const collectPromises: Promise<void>[] = [];
        targetZip.forEach((relPath, entry) => {
          if (entry.dir) return;
          // Skip noise
          if (relPath.includes("node_modules/")) return;
          const ext = relPath.split(".").pop()?.toLowerCase() || "";
          const isText = ["json","ts","tsx","js","jsx","html","css","scss","md","xml","yml","yaml","gradle","properties","kt","java","swift","txt","gitignore","pro","cfg"].includes(ext);
          if (isText) {
            collectPromises.push(entry.async("string").then((c) => { incoming.push({ path: relPath, content: c }); }));
          } else {
            collectPromises.push(entry.async("arraybuffer").then((b) => {
              incoming.push({ path: relPath, content: `[Binary: ${ext}, ${(b.byteLength/1024).toFixed(1)} KB]`, binaryContent: b, isBinary: true });
            }));
          }
        });
        await Promise.all(collectPromises);
        if (incoming.length > 0) {
          projectStore.mergeFiles(incoming);
          const androidCount = incoming.filter(i => i.path.startsWith("android/")).length;
          toast.success(`Synced ${incoming.length} file${incoming.length === 1 ? "" : "s"} from GitHub`, {
            description: androidCount > 0 ? `Includes ${androidCount} android/ files` : undefined,
          });

          // Surface plugin-install outcome from Phase 1 so the user sees
          // exactly which plugins (if any) did not land in package.json.
          try {
            const manifestEntry = incoming.find((i) => i.path === "phase1-manifest.json" || i.path.endsWith("/phase1-manifest.json"));
            if (manifestEntry?.content) {
              const m = JSON.parse(manifestEntry.content);
              const failed: string[] = m.pluginsFailed || [];
              const installed: string[] = m.pluginsInstalled || [];
              if (failed.length > 0) {
                toast.error(`Phase 1: ${failed.length} plugin${failed.length === 1 ? "" : "s"} failed to install`, {
                  description: failed.join(", ") + " — these will be skipped during AI wiring.",
                });
              } else if (installed.length > 0) {
                buildStore.setThinkingCaption(`Phase 1 done — ${installed.length} plugin${installed.length === 1 ? "" : "s"} installed`);
              }
            }
          } catch (e) {
            console.warn("Could not parse phase1-manifest.json:", e);
          }
        }
      }
    } catch (e) {
      console.warn("Phase 1 source sync skipped:", e);
    }
  } catch (err: any) {
    toast.error(`Phase 1 failed: ${err.message || err}`);
    buildStore.setIsBuildActive(false);
    buildStore.setBuildButtonState("failed");
    buildStore.setThinkingCaption(null);
    endRun("failed", String(err?.message || err).slice(0, 240));
    return;
  }

  // ── Phase 1.5: Deterministic plugin wiring (Display Mode etc.) ──
  // Runs BEFORE the AI wiring step so AI sees a base that already builds.
  if (enabled.includes("edge-to-edge")) {
    try {
      // The user picks one of the five display modes in the Plugins panel.
      let cfg = DEFAULT_DISPLAY_MODE_CONFIG;
      try {
        const saved = await loadPluginSecrets(opts.projectId);
        const values: Record<string, string> = {};
        for (const s of saved) {
          if (s.plugin_id === "edge-to-edge") values[s.secret_key] = String(s.secret_value ?? "");
        }
        cfg = readDisplayModeConfig(values);
      } catch { /* fall back to the default configuration */ }

      buildStore.setThinkingCaption(`Wiring Display Mode — ${getDisplayMode(cfg.mode).label}`);
      const wiring = wireDisplayMode(useProjectStore.getState().files, cfg);
      for (const line of displayModeWiringToLogs(wiring)) console.info(`[display-mode] ${line}`);
      logEvent({
        logType: "plugin",
        level: "info",
        phase: "phase1",
        message: `Display Mode (${wiring.spec.label}) wired ${wiring.patches.length} file(s); hook at ${wiring.metadata.display_mode_hook_path}`,
      });
      const store = useProjectStore.getState();
      let applied = 0;
      for (const patch of wiring.patches) {
        const existing = flatten(store.files).find((f) => f.path === patch.path);
        if (existing?.content) store.markAiChanged(patch.path, existing.content);
        store.updateFileContent(patch.path, patch.content);
        applied++;
      }
      // CPR metadata so future rebuilds skip the detection scan.
      try {
        await savePluginSecret(opts.projectId, "edge-to-edge", "DISPLAY_MODE_META", JSON.stringify(wiring.metadata));
      } catch { /* metadata is best-effort */ }
      if (applied > 0) {
        toast.success(`Display Mode (${wiring.spec.label}): wired ${applied} file${applied === 1 ? "" : "s"}`, {
          description: wiring.spec.tagline,
        });
      }
      for (const w of wiring.warnings) console.warn(`[display-mode] ${w}`);
    } catch (e) {
      console.warn("Display Mode wiring failed:", e);
    }

  }


  // ── Phase 2: AI Wiring (in-platform, agentic) ──
  buildStore.setBuildButtonState("ai-wiring");
  buildStore.setActiveCiSteps([]);
  buildStore.clearAiTimeline();
  buildStore.setThinkingCaption("AI wiring plugins into your code");

  try {
    // Use the FRESH file tree (post-Phase-1 sync) so the AI sees plugin files just installed.
    const freshFiles = useProjectStore.getState().files;
    const freshPackage = flatten(freshFiles).find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
    let installedPluginPackages = new Set<string>();
    try {
      const parsedPackage = freshPackage?.content ? JSON.parse(freshPackage.content) : {};
      installedPluginPackages = new Set([
        ...Object.keys(parsedPackage.dependencies || {}),
        ...Object.keys(parsedPackage.devDependencies || {}),
      ]);
    } catch { /* Phase 3 validation will report malformed package.json. */ }
    const enabledForAI = enabled.filter((id) => {
      const npmName = PLUGIN_NPM_MAP[id]?.npm
        || (id.startsWith("@") || id.includes("/") ? id : `@capacitor/${id}`);
      return installedPluginPackages.has(npmName);
    });
    const skippedForAI = enabled.filter((id) => !enabledForAI.includes(id));
    if (skippedForAI.length > 0) {
      logEvent({
        logType: "plugin",
        level: "warning",
        phase: "phase2",
        message: `Skipped AI wiring for plugins absent from package.json: ${skippedForAI.join(", ")}`,
      });
    }
    const sourceForAI = flatten(freshFiles)
      .filter((f) => f.type === "file" && f.content && !f.isBinary)
      .slice(0, 200)
      .map((f) => ({ path: f.path, content: (f.content || "").slice(0, 8000) }));
    const { textSecrets } = await getSecretsForBuild(opts.projectId).catch(() => ({ textSecrets: {} }));

    // Resolve preferred model from project record
    let model = "google/gemini-3.6-flash";
    try {
      const { data: proj } = await supabase
        .from("projects")
        .select("preferred_ai_model" as any)
        .eq("id", opts.projectId)
        .maybeSingle();
      if (proj && (proj as any).preferred_ai_model) model = (proj as any).preferred_ai_model;
    } catch {}

    const AI_WIRING_TIMEOUT_MS = 180_000; // 3-minute hard cap so Phase 3 always runs
    const aiAbort = new AbortController();
    const aiTimer = setTimeout(() => aiAbort.abort(), AI_WIRING_TIMEOUT_MS);

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-wire-plugins`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          manifest: { framework: projectStore.scanResult?.framework, installedPlugins: [...installedPluginPackages] },
          sourceFiles: sourceForAI,
          enabledPlugins: enabledForAI,
          pluginConfigs: textSecrets,
          model,
        }),
        signal: aiAbort.signal,
      }
    );

    if (!resp.ok || !resp.body) throw new Error(`AI wiring failed (${resp.status})`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let appliedCount = 0;
    let sawDone = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!chunk.startsWith("data:")) continue;
          const json = chunk.slice(5).trim();
          try {
            const evt = JSON.parse(json);
            if (evt.type === "caption") {
              buildStore.setThinkingCaption(evt.text);
              const id = buildStore.pushAiEvent({ op: "thinking", title: evt.text, status: "active" });
              setTimeout(() => buildStore.completeAiEvent(id), 600);
            } else if (evt.type === "tool") {
              const op = evt.op as "read" | "search" | "edit";
              const title =
                op === "read" ? `Reading ${evt.path}` :
                op === "search" ? `Searching: "${evt.query}" (${evt.count ?? 0})` :
                op === "edit" ? `Editing ${evt.path}` :
                "Working";
              const id = buildStore.pushAiEvent({ op, title, detail: evt.reason, status: "active" });
              setTimeout(() => buildStore.completeAiEvent(id), 400);
            } else if (evt.type === "patch") {
              buildStore.setThinkingCaption(`Editing ${evt.path}`);
            } else if (evt.type === "done") {
              sawDone = true;
              for (const p of evt.patches || []) {
                const existing = flatten(useProjectStore.getState().files).find((f) => f.path === p.path);
                const oldContent = existing?.content || "";
                projectStore.markAiChanged(p.path, oldContent);
                projectStore.updateFileContent(p.path, p.content);
                appliedCount++;
                const eid = buildStore.pushAiEvent({
                  op: "edit",
                  title: `Edited ${p.path.split("/").pop()}`,
                  detail: p.path,
                  status: "done",
                  path: p.path,
                  oldContent,
                  newContent: p.content,
                });
                buildStore.completeAiEvent(eid, "done");
              }
              if (appliedCount > 0) {
                toast.success(`AI wired ${appliedCount} file${appliedCount === 1 ? "" : "s"}`, {
                  description: "Switched to Code view — modified files are highlighted with a green/red diff.",
                });
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.set("section", "code");
                  url.searchParams.set("item", "source-code");
                  window.history.pushState({}, "", url.toString());
                  window.dispatchEvent(new PopStateEvent("popstate"));
                } catch {}
              }
              buildStore.setThinkingCaption(`Proceeding with Phase 3 — ${appliedCount} file${appliedCount === 1 ? "" : "s"} edited`);
            } else if (evt.type === "error") throw new Error(evt.error);
          } catch {
            // ignore parse errors mid-stream
          }
        }
      }
    } finally {
      clearTimeout(aiTimer);
    }
    if (!sawDone) {
      console.warn("AI wiring stream ended without 'done' event — proceeding to Phase 3 anyway.");
      buildStore.setThinkingCaption("AI wiring finished — proceeding with Phase 3");
    }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      toast.warning("AI wiring timed out — continuing to Phase 3.");
    } else {
      console.error("AI wiring error:", err);
      toast.warning(`AI wiring skipped: ${err.message || err}`);
    }
  }

  // ── Phase 2.6: AI Android Native Configuration ──
  // Patches AndroidManifest.xml, MainActivity, styles.xml, strings.xml,
  // app/build.gradle for the enabled plugins. Hard-capped at 3 minutes;
  // failures fall through to Phase 3 (real Gradle will surface real issues).
  try {
    buildStore.setThinkingCaption("AI is configuring Android native files");
    const freshFiles2 = useProjectStore.getState().files;
    const androidPaths = [
      "android/app/src/main/AndroidManifest.xml",
      "android/app/src/main/res/values/styles.xml",
      "android/app/src/main/res/values/strings.xml",
      "android/app/build.gradle",
    ];
    const flat2 = flatten(freshFiles2);
    const mainActivity = flat2.find(
      (f) => f.type === "file" && !f.isBinary &&
        (f.path.endsWith("MainActivity.java") || f.path.endsWith("MainActivity.kt"))
    );
    const pickedFiles = flat2.filter(
      (f) => f.type === "file" && !f.isBinary && f.content && androidPaths.includes(f.path)
    );
    if (mainActivity) pickedFiles.push(mainActivity);

    if (pickedFiles.length === 0) {
      console.info("[phase2.6] No android/ files present yet — skipping native config.");
    } else {
      const androidFiles = pickedFiles.map((f) => ({ path: f.path, content: f.content || "" }));

      // Resolve preferred model (fast Pro default for Android config)
      let androidModel = "google/gemini-3.1-pro-preview";
      try {
        const { data: proj } = await supabase
          .from("projects")
          .select("preferred_ai_model" as any)
          .eq("id", opts.projectId)
          .maybeSingle();
        if (proj && (proj as any).preferred_ai_model) androidModel = (proj as any).preferred_ai_model;
      } catch {}

      const ANDROID_TIMEOUT_MS = 180_000;
      const aAbort = new AbortController();
      const aTimer = setTimeout(() => aAbort.abort(), ANDROID_TIMEOUT_MS);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-configure-android`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            androidFiles,
            enabledPlugins: enabled,
            appName: opts.appName,
            packageName: opts.packageName,
            model: androidModel,
          }),
          signal: aAbort.signal,
        }
      );

      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let abuf = "";
        let aApplied = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            abuf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = abuf.indexOf("\n\n")) !== -1) {
              const chunk = abuf.slice(0, idx).trim();
              abuf = abuf.slice(idx + 2);
              if (!chunk.startsWith("data:")) continue;
              try {
                const evt = JSON.parse(chunk.slice(5).trim());
                if (evt.type === "caption") {
                  buildStore.setThinkingCaption(evt.text);
                  const id = buildStore.pushAiEvent({ op: "thinking", title: evt.text, status: "active" });
                  setTimeout(() => buildStore.completeAiEvent(id), 600);
                } else if (evt.type === "tool" && evt.op === "edit") {
                  const id = buildStore.pushAiEvent({ op: "edit", title: `Editing ${evt.path}`, detail: evt.reason, status: "active" });
                  setTimeout(() => buildStore.completeAiEvent(id), 400);
                } else if (evt.type === "done") {
                  for (const p of evt.patches || []) {
                    const existing = flatten(useProjectStore.getState().files).find((f) => f.path === p.path);
                    const oldContent = existing?.content || "";
                    projectStore.markAiChanged(p.path, oldContent);
                    projectStore.updateFileContent(p.path, p.content);
                    aApplied++;
                    const eid = buildStore.pushAiEvent({
                      op: "edit",
                      title: `Edited ${p.path.split("/").pop()}`,
                      detail: p.path,
                      status: "done",
                      path: p.path,
                      oldContent,
                      newContent: p.content,
                    });
                    buildStore.completeAiEvent(eid, "done");
                  }
                  if (aApplied > 0) {
                    toast.success(`AI configured ${aApplied} Android file${aApplied === 1 ? "" : "s"}`);
                  }
                } else if (evt.type === "error") {
                  console.warn("[phase2.6] AI Android config error:", evt.error);
                }
              } catch { /* ignore parse */ }
            }
          }
        } finally {
          clearTimeout(aTimer);
        }
      } else {
        console.warn("[phase2.6] ai-configure-android returned non-OK:", resp.status);
      }
    }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      toast.warning("Android config timed out — continuing to Phase 3.");
    } else {
      console.warn("[phase2.6] Android config skipped:", err);
    }
  }



  // ── Phase 3: Rebuild on GitHub Actions (cache reused) ──
  buildStore.setBuildButtonState("phase2-build");
  buildStore.setThinkingCaption("Phase 3: Verifying build prerequisites");
  buildStore.setActiveCiSteps([]);

  try {
    const currentEnabled = resolvePluginDependencies(useProjectStore.getState().enabledPlugins).ids;
    const currentEnabledNpm = resolvePluginNpmNames(currentEnabled);
    // Rebuild consumes the same CPR-sealed dependency graph as Phase 1 — but a
    // plugin may have been toggled during wiring, so re-seal once more.
    try {
      cprBlueprint = await resealManifestForPlugins(opts.projectId, cprBlueprint, currentEnabledNpm);
    } catch (e) {
      console.warn("[cpr] Phase 3 manifest re-seal skipped:", e);
    }
    await persistBuildSource(opts.projectId, "Phase 3");

    const updatedFiles = useProjectStore.getState().files;

    // ── Pre-Phase-3 verification: plugin install + signing-key awareness ──
    const flatList = flatten(updatedFiles);
    const pkgFile = flatList.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
    let pkgJson: any = null;
    try { pkgJson = pkgFile?.content ? JSON.parse(pkgFile.content) : null; } catch { pkgJson = null; }
    const installed = new Set<string>([
      ...Object.keys(pkgJson?.dependencies || {}),
      ...Object.keys(pkgJson?.devDependencies || {}),
    ]);
    const missingPlugins = currentEnabledNpm.filter((npmName) => !installed.has(npmName));
    if (missingPlugins.length > 0) {
      throw new Error(`Plugin dependency reconciliation failed: ${missingPlugins.join(", ")} ${missingPlugins.length === 1 ? "is" : "are"} missing from package.json`);
    }

    // ── Pre-flight: deterministic alias rewrites only (no blocking scan) ──
    // Our regex-based "unresolved import" scan produced too many false positives
    // (Vite aliases, subpath exports, type-only imports, monorepo packages,
    // virtual modules). We now trust GitHub's `npm ci` + `npm run build` as the
    // source of truth and rely on the post-Phase-3 AI repair loop (which has
    // real build logs) to fix real failures. We still auto-rewrite known stale
    // packages here because that transformation is deterministic and safe.
    const NODE_BUILTINS = new Set(["fs","path","os","crypto","http","https","url","util","stream","events","buffer","child_process","zlib","net","tls","querystring","assert"]);
    const importRe = /(?:import\s+(?:[\s\S]*?)from\s*|require\s*\(\s*)["']([^"']+)["']/g;
    const ALIAS_REWRITES: Record<string, { npm: string; namedRewrite?: Array<[RegExp, string]> }> = {
      "@codetrix-studio/capacitor-google-auth": {
        npm: "@capawesome/capacitor-google-sign-in",
        namedRewrite: [
          [/\bGoogleAuth\b/g, "GoogleSignIn"],
          [/GoogleSignIn\.initialize\(\s*\{([^}]*?)scopes\s*:[^,}]+,?/g, "GoogleSignIn.initialize({$1"],
        ],
      },
    };

    const isScannableSource = (p: string) =>
      !p.includes("node_modules/") &&
      !p.startsWith("supabase/functions/") &&
      !p.startsWith("android/") &&
      !p.startsWith("ios/") &&
      !p.startsWith("dist/") &&
      !p.startsWith("build/") &&
      !p.startsWith("www/") &&
      !p.startsWith(".next/") &&
      !p.includes("/assets/public/") &&
      !/\.min\.(js|mjs|cjs)$/.test(p);

    const sourceFiles = flatList.filter((f) =>
      f.type === "file" && !f.isBinary && f.content &&
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f.path) &&
      isScannableSource(f.path)
    );
    let rewriteCount = 0;
    const notInPackageJson = new Set<string>();

    for (const f of sourceFiles) {
      let content = f.content!;
      let changed = false;
      const matches = [...content.matchAll(importRe)];
      for (const m of matches) {
        const spec = m[1];
        if (!spec || spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/") || NODE_BUILTINS.has(spec)) continue;
        const parts = spec.split("/");
        const pkg = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
        if (installed.has(pkg)) continue;
        const alias = ALIAS_REWRITES[pkg];
        if (alias && installed.has(alias.npm)) {
          content = content.split(`"${spec}"`).join(`"${alias.npm}"`).split(`'${spec}'`).join(`'${alias.npm}'`);
          for (const [re, repl] of alias.namedRewrite || []) content = content.replace(re, repl);
          changed = true;
          rewriteCount++;
          console.info(`[phase3] Rewrote ${pkg} → ${alias.npm} in ${f.path}`);
        } else {
          notInPackageJson.add(pkg);
        }
      }
      if (changed) useProjectStore.getState().updateFileContent(f.path, content);
    }

    if (rewriteCount > 0) {
      toast.success(`Auto-fixed ${rewriteCount} stale import${rewriteCount === 1 ? "" : "s"}`, {
        description: "Rewrote unmaintained packages to their stable replacements.",
      });
    }

    if (notInPackageJson.size > 0) {
      // Non-blocking — let GitHub's real build decide. Vite aliases, subpath
      // exports, type-only imports, and monorepo packages frequently look
      // "unresolved" to our regex but resolve fine at build time.
      console.info(
        `[phase3] ${notInPackageJson.size} import(s) not found in package.json — relying on GitHub install / Phase 1 cache:`,
        [...notInPackageJson]
      );
    }


    // Signing-key awareness: if a release build was requested but no keystore exists, fall back to debug.
    let effectiveSigningMode = opts.signingMode || "debug";
    if (effectiveSigningMode === "release") {
      try {
        const { data: keystores } = await supabase
          .from("keystores")
          .select("id")
          .eq("project_id", opts.projectId)
          .limit(1);
        if (!keystores || keystores.length === 0) {
          toast.warning("No release keystore found — building a debug APK instead.", {
            description: "Add a keystore in Project Settings to build a release-signed APK.",
          });
          effectiveSigningMode = "debug";
        }
      } catch (e) {
        console.warn("Keystore lookup failed, defaulting to debug:", e);
        effectiveSigningMode = "debug";
      }
    }

    buildStore.setThinkingCaption("Phase 3: Building APK on GitHub");
    const rebuildStoragePath = await uploadBuildSource(opts.projectId, updatedFiles, "rebuild");

    // Pull plugin file secrets (e.g. google-services.json) and inline them in the rebuild request
    let pluginConfigFiles: { path: string; contentBase64: string }[] = [];
    try {
      const { fileSecrets } = await getSecretsForBuild(opts.projectId);
      for (const fs of fileSecrets) {
        const { data: blob } = await supabase.storage.from("build-artifacts").download(fs.storagePath);
        if (!blob) continue;
        const ab = await blob.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let bin = "";
        for (let i = 0; i < bytes.byteLength; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const targetPath = fs.key === "google-services.json" ? "google-services.json"
          : fs.key === "GoogleService-Info.plist" ? "GoogleService-Info.plist"
          : fs.storagePath.split("/").pop() || fs.key;
        pluginConfigFiles.push({ path: targetPath, contentBase64: btoa(bin) });
      }
    } catch (e) {
      console.warn("Could not attach plugin config files:", e);
    }

    // ── Phase 3 invoke + poll, with one AI-repair retry on code-level failures ──
     const invokeAndPoll = async (projectStoragePath: string) => {
      const { data, error } = await supabase.functions.invoke("build-apk", {
        body: {
          action: "rebuild",
          repoName: phase1Repo,
          projectStoragePath,
          appName: opts.appName,
          packageName: opts.packageName,
          signingMode: effectiveSigningMode,
          plugins: currentEnabledNpm,
          webDir: detectedWebDir || undefined,
          cprBlueprint,
          pluginConfigFiles,
          ...versionCfg,
        },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Rebuild failed");
      if (data.diagnostic) console.warn("[build] Phase 3 rebuild diagnostic:", data.diagnostic);
      const result = await pollPhaseStatus(data.repoName, data.runId || null, data.commitSha, "phase3");
      return result;
    };

    let result = await invokeAndPoll(rebuildStoragePath);
    const MAX_PHASE3_REPAIRS = 3;
    let repairAttempt = 0;
    const phase3Failures = new Set<string>();
    while (!result.success && repairAttempt < MAX_PHASE3_REPAIRS) {
      const failingStep = useBuildStore.getState().activeCiSteps.find((s: any) => s.conclusion === "failure");
      const failingStepName = failingStep?.name || "";
      const excerpt = failingStep?.logExcerpt || "";
      const fullErr = (result.error || "Phase 3 failed") + (excerpt ? `\n\nFailing step: ${failingStepName}\n${excerpt}` : "");

      const isRunnerRepairFailure =
        failingStepName.toLowerCase().includes("ai dependency repair loop") ||
        failingStepName.toLowerCase().includes("install locked dependencies") ||
        failingStepName.toLowerCase().includes("dependency manifest check") ||
        fullErr.includes("NB_REPAIR_EXHAUSTED") ||
        fullErr.includes("Runner Repair Exhausted") ||
        fullErr.includes("dependency installation could not be completed");

      if (isRunnerRepairFailure) {
        logEvent({
          logType: "pipeline",
          level: "error",
          phase: "phase3",
          runId: result.runId ?? null,
          message: "Runner AI repair loop exhausted — halting browser repair",
          raw: fullErr,
        });
        throw new Error(fullErr);
      }

      const logEventId = buildStore.pushAiEvent({ op: "search", title: "Retrieving failed run logs", detail: `GitHub run ${result.runId ?? "pending"}`, status: "active", refs: [String(result.runId ?? "unknown")] });
      const ciErrors = await fetchErrorContext({ projectId: opts.projectId, runId: result.runId ?? null, limit: 120 });
      buildStore.updateAiEvent(logEventId, { detail: `${ciErrors.length} run-scoped error and warning entries loaded`, status: "done", completedAt: Date.now() });
      const parsed = parseBuildError([...ciErrors, excerpt, result.error || ""], fullErr);
      if (!isRepairable(parsed)) {
        // Not auto-fixable — surface the error and stop (do NOT restart from Phase 1).
        throw new Error(fullErr);
      }
      const fingerprint = buildFailureFingerprint(parsed, failingStep?.name || "phase3", fullErr);
      if (phase3Failures.has(fingerprint)) throw new Error(`${fullErr}\n\nAutomatic repair stopped because the same failure recurred.`);
      phase3Failures.add(fingerprint);

      repairAttempt++;
      toast.info(`Phase 3 failed — AI repair attempt ${repairAttempt}/${MAX_PHASE3_REPAIRS}…`, {
        description: parsed?.title?.slice(0, 120),
      });
      buildStore.setBuildButtonState("ai-wiring");
      logEvent({
        logType: "ai-repair",
        level: "warning",
        phase: "phase3",
        runId: result.runId ?? null,
        message: `AI repair attempt ${repairAttempt}/${MAX_PHASE3_REPAIRS} — ${parsed?.title || "build failure"}`,
        raw: fullErr,
      });
      const repair = await runRepair(fullErr, [...ciErrors, excerpt, result.error || ""], {
        phaseName: `Phase 3 rebuild (attempt ${repairAttempt})`,
        parsed,
        projectId: opts.projectId,
        runId: result.runId,
      });
      logEvent({
        logType: "ai-repair",
        level: repair.patched ? "success" : "error",
        phase: "phase3",
        message: repair.patched
          ? `AI applied ${repair.edits.length} fix(es): ${repair.edits.join("; ").slice(0, 600)}`
          : `AI repair could not patch: ${repair.summary}`,
        raw: repair.edits.join("\n"),
      });
      if (!repair.patched) {
        throw new Error(fullErr);
      }
      await persistBuildSource(opts.projectId, `Phase 3 retry ${repairAttempt}`);
      buildStore.pushAiEvent({ op: "config", title: "Saved repaired source snapshot", detail: repair.changedFiles.map((file) => file.path).join(", "), status: "done", refs: repair.changedFiles.map((file) => file.path) });
      buildStore.setBuildButtonState("phase2-build");
      buildStore.setThinkingCaption(`Retrying Phase 3 with AI patches (attempt ${repairAttempt}/${MAX_PHASE3_REPAIRS})…`);
      const refreshed = useProjectStore.getState().files;
      const retryStoragePath = await uploadBuildSource(opts.projectId, refreshed, "rebuild");
      buildStore.setActiveCiSteps([]);
      result = await invokeAndPoll(retryStoragePath);
    }
    if (!result.success) {
      throw new Error(result.error || "Phase 3 failed after maximum AI repair attempts");
    }


    buildStore.setBuildButtonState("phase2-build");
    updateRun({ phase: "artifact-pending" });
    buildStore.setThinkingCaption("Downloading artifacts from GitHub…");

    // ── Post-success: download artifacts, unzip, upload to storage, persist builds row ──
    try {
      await persistBuildArtifacts({
        projectId: opts.projectId,
        appName: opts.appName,
        packageName: opts.packageName,
        repoName: phase1Repo,
        runId: result.runId || null,
        signingMode: effectiveSigningMode,
      });
      await persistCprVerification(opts.projectId, buildCprVerificationResult({
        buildSuccess: true,
        artifactSuccess: true,
        runId: result.runId || null,
        steps: result.steps,
      }));
      buildStore.setBuildButtonState("ready");
      updateRun({ phase: "ready" });
      toast.success("Build finished. Artifacts saved — open the Builds tab to download.");
    } catch (e: any) {
      console.error("[build] artifact persistence failed:", e);
      toast.error("Build artifact validation failed.", {
        description: String(e?.message || e).slice(0, 200),
      });
      throw new Error(`Artifact persistence failed: ${String(e?.message || e)}`);
    }
    buildStore.setThinkingCaption("Build complete");
    endRun("success");
  } catch (err: any) {
    const detail = String(err.message || err);
    try {
      await persistCprVerification(opts.projectId, buildCprVerificationResult({
        buildSuccess: false,
        artifactSuccess: false,
        runId: phase1Run,
        failure: detail.slice(0, 2000),
      }));
    } catch (verificationError) {
      console.warn("[cpr] could not persist failed verification:", verificationError);
    }
    toast.error(`Phase 3 failed: ${detail.slice(0, 240)}`, {
      description: detail.length > 240 ? "See the action panel for the full failing-step log." : undefined,
    });
    buildStore.setBuildButtonState("failed");
    buildStore.setThinkingCaption(null);
    endRun("failed", detail.slice(0, 240));
  } finally {
    buildStore.setIsBuildActive(false);
    setTimeout(() => buildStore.setThinkingCaption(null), 4000);
  }
}

/**
 * iOS build pipeline. Runs on GitHub Actions macOS runners via the `build-ios`
 * edge function. Debug mode builds an unsigned Simulator .app; Release mode
 * expects GH Actions secrets (IOS_CERT_P12_BASE64, IOS_CERT_PASSWORD,
 * IOS_PROVISIONING_PROFILE_BASE64, IOS_TEAM_ID) and produces a signed .ipa.
 */
async function pollIosStatus(repoName: string, initialRunId?: number | null) {
  const buildStore = useBuildStore.getState();
  const maxPolls = 120;
  let resolvedRunId: number | null = initialRunId ?? null;
  const seen = new Set<string>();
  setLogContext({ repoName, platform: "ios", phase: "ios-build" });
  for (let poll = 0; poll < maxPolls; poll++) {
    await new Promise((r) => setTimeout(r, poll < 3 ? 4000 : 8000));
    const { data, error } = await supabase.functions.invoke("build-ios", {
      body: { action: "status", repoName, runId: resolvedRunId || undefined },
    });
    if (error || !data) continue;
    if (data.runId) {
      resolvedRunId = data.runId;
      setLogContext({ runId: resolvedRunId });
    }
    if (data.runUrl) buildStore.setActiveRunUrl(data.runUrl);
    // Structured GitHub Actions steps → same Action Panel timeline as Android.
    if (Array.isArray(data.steps) && data.steps.length > 0) {
      buildStore.setActiveCiSteps(data.steps);
      const active = data.steps.find((s: any) => s.status === "in_progress");
      if (active) buildStore.setThinkingCaption(`iOS: ${active.name}`);
      for (const s of data.steps) {
        const key = `${s.number}:${s.name}:${s.status}:${s.conclusion ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        logEvent({
          logType: "pipeline",
          platform: "ios",
          level: s.conclusion === "failure" ? "error" : s.conclusion === "success" ? "success" : "info",
          message: `${s.status === "completed" ? s.conclusion ?? "completed" : s.status} · ${s.name}`,
          stepName: s.name,
          runId: resolvedRunId,
          raw: s.logExcerpt || null,
          meta: { method: "STEP", pathname: s.name, runUrl: data.runUrl },
        });
      }
    } else if (Array.isArray(data.logs)) {
      const active = data.logs.find((l: string) => l.startsWith("⟳"));
      if (active) buildStore.setThinkingCaption(active.replace(/^⟳\s*/, "").slice(0, 50));
    }
    if (data.status === "success") {
      logEvent({ logType: "pipeline", platform: "ios", level: "success", message: `iOS run #${resolvedRunId} succeeded`, runId: resolvedRunId });
      if (resolvedRunId) void importCiLogs({ repoName, runId: resolvedRunId, platform: "ios", phase: "ios-build" });
      return { success: true, runId: resolvedRunId };
    }
    if (data.status === "failure" || data.status === "cancelled") {
      const detail = [
        data.failedStep && `Failed step: ${data.failedStep}`,
        data.buildLogs && `\nLogs:\n${String(data.buildLogs).split("\n").slice(-20).join("\n")}`,
        data.runUrl && `\nRun: ${data.runUrl}`,
      ].filter(Boolean).join("\n");
      logEvent({
        logType: "pipeline",
        platform: "ios",
        level: "error",
        statusCode: 500,
        message: `iOS run #${resolvedRunId} ${data.status}${data.failedStep ? ` at ${data.failedStep}` : ""}`,
        stepName: data.failedStep ?? null,
        runId: resolvedRunId,
        raw: detail,
        meta: { runUrl: data.runUrl },
      });
      if (resolvedRunId) await importCiLogs({ repoName, runId: resolvedRunId, platform: "ios", phase: "ios-build" });
      await flushLogs();
      return {
        success: false,
        runId: resolvedRunId,
        error: detail || `iOS build ${data.status}`,
      };
    }
  }
  logEvent({ logType: "pipeline", platform: "ios", level: "error", message: "iOS build timed out", runId: resolvedRunId });
  return { success: false, runId: resolvedRunId, error: "iOS build timed out" };
}



async function runIosBuild(opts: RunBuildOptions) {
  const projectStore = useProjectStore.getState();
  const buildStore = useBuildStore.getState();
  const { files, enabledPlugins } = projectStore;
  if (files.length === 0) { toast.error("Upload source code before building."); return; }
  const enabled = resolvePluginDependencies(enabledPlugins).ids;
  const enabledNpm = resolvePluginNpmNames(enabled);

  buildStore.setIsBuildActive(true);
  setLogContext({ projectId: opts.projectId, platform: "ios", phase: "ios-build", runId: null, repoName: null });
  logEvent({ logType: "build", level: "info", platform: "ios", message: `iOS build started · ${opts.appName} (${opts.packageName})`, meta: { method: "BUILD", pathname: "/build/ios/start" } });
  buildStore.setActivePlatform("ios");
  buildStore.setActiveCiSteps([]);
  buildStore.setActiveRunUrl(null);
  buildStore.setBuildButtonState("phase1-setup");
  buildStore.setThinkingCaption("iOS: bundling source");
  await startRun(opts.projectId);

  try {
    const { base64 } = await bundleSourceZip(files);
    buildStore.setThinkingCaption("iOS: dispatching to macOS runner");
    const { data, error } = await supabase.functions.invoke("build-ios", {
      body: {
        action: "start",
        projectName: opts.appName,
        appName: opts.appName,
        packageName: opts.packageName, // iOS bundle identifier
        plugins: enabledNpm,
        projectZip: base64,
        signingMode: opts.signingMode || "debug",
      },
    });
    if (error || data?.error) throw new Error(error?.message || data?.error || "iOS start failed");

    buildStore.setBuildButtonState("phase2-build");
    buildStore.setThinkingCaption("iOS: xcodebuild running on macos-latest");
    const result = await pollIosStatus(data.repoName, data.runId ?? null);
    if (!result.success) throw new Error(result.error || "iOS build failed");

    buildStore.setThinkingCaption("iOS: downloading artifact");
    const { data: dl } = await supabase.functions.invoke("build-ios", {
      body: { action: "download", repoName: data.repoName, runId: result.runId },
    });

    // Persist a minimal build record.
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (userId) {
      const ext = (opts.signingMode === "release") ? "ipa" : "zip";
      let storedPath: string | undefined;
      try {
        if (dl?.artifactBase64) {
          const bin = atob(dl.artifactBase64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const path = `${userId}/${data.repoName}-${result.runId}/app.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("build-artifacts")
            .upload(path, new Blob([bytes]), { upsert: true, contentType: "application/octet-stream" });
          if (!upErr) storedPath = path;
        }
      } catch (e) { console.warn("[ios] artifact upload failed:", e); }

      await supabase.from("builds").insert({
        user_id: userId,
        project_id: opts.projectId,
        app_name: opts.appName,
        package_name: opts.packageName,
        engine: "capacitor",
        status: "success",
        stage: "iOS artifact ready",
        repo_name: data.repoName,
        repo_url: `https://github.com/${data.repoName}`,
        source_repo_name: data.repoName,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        apk_url: storedPath || null, // reuse apk_url column for the iOS artifact path
        build_metadata: {
          runId: result.runId,
          signingMode: opts.signingMode || "debug",
          platform: "ios",
          artifactExt: ext,
        },
      });
    }

    buildStore.setBuildButtonState("ready");
    buildStore.setThinkingCaption("iOS build complete");
    endRun("success");
    toast.success(`iOS ${opts.signingMode === "release" ? ".ipa" : "Simulator .app"} ready — open the Builds tab to download.`);
  } catch (err: any) {
    console.error("[ios] build failed:", err);
    buildStore.setBuildButtonState("failed");
    buildStore.setThinkingCaption(null);
    endRun("failed", String(err?.message || err).slice(0, 500));
    toast.error("iOS build failed", { description: String(err?.message || err).slice(0, 200) });
  } finally {
    buildStore.setIsBuildActive(false);
  }
}
