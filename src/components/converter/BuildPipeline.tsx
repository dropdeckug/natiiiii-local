import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, Loader2, Circle, Download, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import JSZip from "jszip";
import type { EngineType } from "@/components/converter/EngineSelector";
import AIActionFeed, { type AIAction } from "@/components/create/AIActionFeed";
import AIActivityFeed from "@/components/create/AIActivityFeed";
import AIChat from "@/components/create/AIChat";
import { useOrchestratorFeed } from "@/hooks/useOrchestratorFeed";
import type { GeneratedFile } from "@/lib/generators/shared";
import { generateWebviewProject } from "@/lib/generators/webview";
import { generateCapacitorProject } from "@/lib/generators/capacitor";
import { generateIonicProject } from "@/lib/generators/ionic";
import { generateTwaProject } from "@/lib/generators/twa";
import { generateElectronProject, getElectronWorkflowYml } from "@/lib/generators/electron";
import { injectPermissions, injectGradleDeps, injectMainActivityPlugins } from "@/lib/generators/plugins";
import { getPluginNpmPackages, getPluginsNeedingConfig, detectUnusedPlugins } from "@/lib/generators/pluginMapping";
import { useProjectStore, flattenProjectFiles } from "@/stores/projectStore";
import { supabase } from "@/integrations/supabase/client";
import { generateDefaultIcons, generateIconsFromImage } from "@/lib/iconGenerator";
import { useBuildStore } from "@/stores/buildStore";
import {
  scanProject, scanResultToLogs,
  checkCompatibility, compatibilityToLogs,
  resolveDependencies, dependencyResolutionToLogs,
  wirePlugins, pluginWiringToLogs,
  generateBuildConfig, configToLogs,
  parseBuildError, parsedErrorToLogs,
  validateApkArtifact, validationToLogs,
  planPluginInjections, injectionPlanToLogs,
  validateProjectForBuild, projectValidationToLogs,
  planProjectGrounding,
} from "@/lib/tools";
import { applyInjectionPlan } from "@/lib/tools/pluginCodeInjector";
import { transformProjectCode, validateInjection } from "@/lib/ai/codeTransformer";
import { computeBuildPlan, BuildOrchestrator, type BuildPlan } from "@/lib/orchestrator";
import { buildAppearancePayload, markAppearanceBuilt } from "@/lib/appearance/appearanceBuildPayload";
import { persistProject } from "@/lib/projectPersistence";
import { getSecretsForBuild } from "@/lib/pluginSecretsService";

interface BuildStage {
  id: string;
  label: string;
}

const projectStages: BuildStage[] = [
  { id: "scan", label: "Scanning project" },
  { id: "generate", label: "Generating native shell" },
  { id: "inject", label: "Injecting plugins & permissions" },
  { id: "assets", label: "Bundling web assets" },
  { id: "package", label: "Packaging ZIP" },
  { id: "done", label: "Build complete" },
];

const apkStages: BuildStage[] = [
  { id: "scan", label: "Scanning project" },
  { id: "generate", label: "Preparing build package" },
  { id: "inject", label: "Configuring plugins" },
  { id: "assets", label: "Bundling source code" },
  { id: "package", label: "Packaging for cloud" },
  { id: "upload", label: "Uploading to cloud builder" },
  { id: "compile", label: "Building with Capacitor + Gradle" },
  { id: "sign", label: "Signing APK" },
  { id: "done", label: "APK Ready!" },
];

const desktopStages: BuildStage[] = [
  { id: "analyze", label: "Analyzing project" },
  { id: "generate", label: "Generating Electron shell" },
  { id: "assets", label: "Bundling source code" },
  { id: "package", label: "Packaging for cloud" },
  { id: "upload", label: "Uploading to cloud builder" },
  { id: "compile", label: "Building with Electron Builder" },
  { id: "done", label: "Desktop builds ready!" },
];

interface BuildPipelineProps {
  isBuilding: boolean;
  onBuildComplete?: () => void;
  engine?: EngineType;
  enabledPlugins?: string[];
  appName?: string;
  packageName?: string;
  url?: string;
  outputMode?: "apk" | "project" | "desktop" | "ios";
  jobId?: string;
  desktopPlatforms?: string[];
  signingMode?: "debug" | "release";
  keystorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
  keystoreBase64?: string;
  iconDataUrl?: string | null;
  projectId?: string;
}

type BuildMode = "capacitor-source" | "prebuilt-project" | "github-repo" | "electron";

const getBuildMode = (engine: EngineType, hasUploadedFiles: boolean, hasRepoUrl: boolean, hasUrl: boolean): BuildMode => {
  if (engine === "electron") return "electron";
  if (hasRepoUrl) return "github-repo";
  // URL-based engines always use prebuilt (they don't need source code processing)
  if (engine === "webview" || engine === "twa") return "prebuilt-project";
  // For capacitor/ionic: only use capacitor-source if user explicitly uploaded files for THIS build
  if (hasUrl && !hasUploadedFiles) return "prebuilt-project";
  if ((engine === "capacitor" || engine === "ionic") && hasUploadedFiles) return "capacitor-source";
  return "prebuilt-project";
};

const BuildPipeline = ({
  isBuilding,
  onBuildComplete,
  engine = "webview",
  enabledPlugins = [],
  appName = "MyApp",
  packageName = "com.mobileforge.app",
  url,
  outputMode = "project",
  jobId,
  desktopPlatforms = ["windows", "macos", "linux"],
  signingMode = "debug",
  keystorePassword,
  keyAlias,
  keyPassword,
  keystoreBase64,
  iconDataUrl,
  projectId,
}: BuildPipelineProps) => {
  const isDesktop = engine === "electron";
  const stages = isDesktop ? desktopStages : outputMode === "apk" ? apkStages : projectStages;
  const [currentStage, setCurrentStage] = useState(-1);
  const [logs, setLogs] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [generatedZip, setGeneratedZip] = useState<Blob | null>(null);
  const [apkBlob, setApkBlob] = useState<Blob | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [buildActions, setBuildActions] = useState<AIAction[]>([]);
  const [buildChatContent, setBuildChatContent] = useState("");
  const [ciProgressBlock, setCiProgressBlock] = useState("");
  const [isBuildStreaming, setIsBuildStreaming] = useState(false);
  const [ciSteps, setCiSteps] = useState<{ name: string; status: string; conclusion: string | null; startedAt: string | null; completedAt: string | null; number: number }[]>([]);
  const [orchestratorInstance, setOrchestratorInstance] = useState<BuildOrchestrator | null>(null);
  const [buildPlanState, setBuildPlanState] = useState<BuildPlan | null>(null);
  const { files, repoUrl: storeRepoUrl, repoBranch, repoConnected } = useProjectStore();

  // Orchestrator feed hook — bridges orchestrator events → ActivityAction[]
  const orchestratorFeed = useOrchestratorFeed({
    orchestrator: orchestratorInstance,
    buildPlan: buildPlanState,
  });

  useEffect(() => {
    useBuildStore.getState().setActivePhaseGroups(orchestratorFeed.phaseGroups);
  }, [orchestratorFeed.phaseGroups]);

  useEffect(() => {
    useBuildStore.getState().setActiveCiSteps(ciSteps as any);
  }, [ciSteps]);

  useEffect(() => {
    useBuildStore.getState().setIsBuildActive(Boolean(isBuilding));
    if (!isBuilding) {
      useBuildStore.getState().clearBuildProgress();
    }
  }, [isBuilding]);

  // Helper to sync logs to both local state AND the global buildStore
  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg]);
    if (jobId) {
      useBuildStore.getState().appendLog(jobId, msg);
    }
  }, [jobId]);

  // Helper to sync stage to buildStore
  const syncStage = useCallback((stageIdx: number, stageLabel?: string) => {
    setCurrentStage(stageIdx);
    if (jobId) {
      const label = stageLabel || (stageIdx < stages.length ? stages[stageIdx]?.label : "Complete");
      useBuildStore.getState().updateJob(jobId, { stage: label });
    }
  }, [jobId, stages]);

  // Sync status changes to store
  const syncStatus = useCallback((status: "queued" | "uploading" | "building" | "success" | "failure" | "timeout", extra?: Record<string, any>) => {
    if (jobId) {
      useBuildStore.getState().updateJob(jobId, { status, ...extra });
    }
  }, [jobId]);

  // AI Action Feed helpers for build phase
  const addBuildAction = useCallback((title: string, status: AIAction["status"] = "pending", finding?: string): string => {
    const id = crypto.randomUUID();
    setBuildActions((prev) => [...prev, { id, title, status, startedAt: status === "active" ? Date.now() : undefined, finding }]);
    return id;
  }, []);

  const updateBuildAction = useCallback((id: string, updates: Partial<AIAction>) => {
    setBuildActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, []);

  // Append content to the build chat
  const appendBuildChat = useCallback((text: string) => {
    setBuildChatContent(prev => prev + text);
  }, []);

  // Persist build to Supabase
  const persistBuild = useCallback(async (updates: Record<string, any>) => {
    if (!jobId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const store = useBuildStore.getState();
      const job = store.getJob(jobId);
      if (!job) return;

      // Check if build exists in DB
      const { data: existing } = await supabase
        .from("builds")
        .select("id")
        .eq("id", jobId)
        .maybeSingle();

      if (existing) {
        await supabase.from("builds").update({
          status: job.status,
          stage: job.stage,
          logs: job.logs,
          error: job.error || null,
          repo_name: job.repoName || null,
          repo_url: job.repoUrl || null,
          completed_at: updates.completedAt ? new Date(updates.completedAt).toISOString() : null,
          ...updates,
        }).eq("id", jobId);
      } else {
        await supabase.from("builds").insert({
          id: jobId,
          user_id: session.user.id,
          app_name: job.appName,
          package_name: job.packageName,
          engine: job.engine,
          status: job.status,
          stage: job.stage,
          logs: job.logs,
          repo_name: job.repoName || null,
          repo_url: job.repoUrl || null,
          error: job.error || null,
          project_id: projectId || null,
        });
      }
    } catch (e) {
      console.error("Failed to persist build:", e);
    }
  }, [jobId]);

  useEffect(() => {
    if (!isBuilding) return;

    syncStage(0);
    setLogs([]);
    setBuildActions([]);
    setBuildChatContent("");
    setIsBuildStreaming(true);
    setIsComplete(false);
    setGeneratedZip(null);
    setApkBlob(null);
    setBuildError(null);
    setOrchestratorInstance(null);
    setBuildPlanState(null);
    orchestratorFeed.reset();
    syncStatus("building");
    persistBuild({});

    const run = async () => {
      try {
        const hasUploadedFiles = files.length > 0;
        const hasRepoUrl = repoConnected && storeRepoUrl.length > 0;
        const hasUrl = !!(url && url.startsWith("http"));
        const buildMode = getBuildMode(engine, hasUploadedFiles, hasRepoUrl, hasUrl);

        // AI Chat: build progress messages
        appendBuildChat(`## 🔧 Build Configuration\n\n- **Engine:** ${engine}\n- **App:** ${appName} (\`${packageName}\`)\n- **Mode:** ${buildMode}\n\n`);
        
        // AI Action Feed: initial build actions
        const ba1 = addBuildAction("Configuring build environment", "active");
        addLog("> Detecting engine: " + engine);
        addLog("> App: " + appName + " (" + packageName + ")");
        addLog("> Build mode: " + buildMode);
        await delay(400);
        updateBuildAction(ba1, { status: "done", elapsed: 0.4, finding: `→ ${engine} engine, ${buildMode} mode` });

        if (hasUploadedFiles) {
          const grounding = planProjectGrounding(useProjectStore.getState().files, appName);
          if (grounding.patches.length > 0) {
            addLog("> Grounding project before build...");
            for (const patch of grounding.patches) {
              useProjectStore.getState().updateFileContent(patch.path, patch.content);
              addLog(`> ✓ ${patch.path}: ${patch.reason}`);
            }
          }
          for (const line of grounding.logs) addLog("> " + line);
        }

        if (buildMode === "electron") {
          addLog("> Mode: Electron Desktop Build");
          addLog("> Target platforms: " + desktopPlatforms.join(", "));
          if (url) addLog("> Target URL: " + url);
        } else if (buildMode === "github-repo") {
          addLog("> Mode: GitHub Repository → Clone & Build in cloud");
          addLog("> Repository: " + storeRepoUrl);
          addLog("> Branch: " + repoBranch);
        } else if (buildMode === "capacitor-source") {
          addLog("> Mode: Source Code Upload → Capacitor CLI in cloud");
          const allFiles = flattenProjectFiles(files);
          addLog("> Files detected: " + allFiles.filter(f => f.type === "file").length);
        } else {
          if (url) {
            addLog("> Mode: URL-to-App (pre-generated Android project)");
            addLog("> Target URL: " + url);
          } else {
            addLog("> Mode: Pre-built Android project");
          }
        }

        await delay(600);
        syncStage(1);

        // ====== ELECTRON MODE ======
        if (buildMode === "electron") {
          // Step 0: AI Analysis
          addLog("> Running pre-build analysis...");
          try {
            const allFiles = flattenProjectFiles(useProjectStore.getState().files);
            const fileNames = allFiles.filter(f => f.type === "file").map(f => f.path);
            let pkgJson: Record<string, any> | undefined;
            const pkgFile = allFiles.find(f => f.path === "package.json" || f.path.endsWith("/package.json"));
            if (pkgFile?.content) {
              try { pkgJson = JSON.parse(pkgFile.content); } catch {}
            }

            const { data: analysis } = await supabase.functions.invoke("analyze-project", {
              body: {
                fileList: fileNames,
                packageJson: pkgJson,
                engine: "electron",
                platform: "desktop",
                url: url || undefined,
                hasSourceFiles: allFiles.length > 0,
              },
            });

            if (analysis && !analysis.error) {
              addLog("> ✓ Analysis complete — Score: " + analysis.score + "/100");
              addLog("> Strategy: " + analysis.buildStrategy);
              if (analysis.projectShape) {
                addLog("> Shape: " + analysis.projectShape.shape + (analysis.projectShape.expectedWebDir ? " (webDir=" + analysis.projectShape.expectedWebDir + ")" : "") + (analysis.projectShape.isMonorepo ? " [monorepo]" : ""));
              }
              for (const check of (analysis.checks || [])) {
                const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✗";
                addLog(">   " + icon + " " + check.label + ": " + check.detail);
              }
              if (analysis.recommendations?.length > 0) {
                addLog("> Recommendations:");
                for (const rec of analysis.recommendations) addLog(">   → " + rec);
              }
              if (!analysis.compatible) {
                addLog("> ⚠ Project may have compatibility issues (score: " + analysis.score + ")");
              }
            }
          } catch (analyzeErr) {
            addLog("> ⚠ Analysis skipped (service unavailable)");
          }

          await delay(400);
          syncStage(1);
          addLog("> Generating Electron project...");

          const electronFiles = generateElectronProject({
            appName, packageName, url: url || undefined,
            platforms: desktopPlatforms as any[],
          });
          for (const f of electronFiles) addLog("> + " + f.path);

          await delay(400);
          syncStage(2);
          addLog("> Bundling source code...");

          const zip = new JSZip();
          let fileCount = 0;
          const allFiles = flattenProjectFiles(useProjectStore.getState().files);
          for (const f of allFiles) {
            if (f.type !== "file") continue;
            if (f.isBinary && f.binaryContent) zip.file(f.path, f.binaryContent);
            else if (f.content) zip.file(f.path, f.content);
            fileCount++;
          }
          if (fileCount > 0) addLog("> ✓ Bundled " + fileCount + " source files");
          else addLog("> URL-only desktop build — no source ZIP needed");

          await delay(300);
          syncStage(3);

          const blob = await zip.generateAsync({ type: "blob" });
          setGeneratedZip(blob);
          addLog("> ZIP size: " + (blob.size / 1024).toFixed(1) + " KB");

          syncStage(4);
          syncStatus?.("uploading");
          addLog("> Uploading to cloud builder...");

          // Upload to desktop build edge function
          try {
            let base64: string | undefined;
            if (fileCount > 0) {
              const arrayBuf = await blob.arrayBuffer();
              const bytes = new Uint8Array(arrayBuf);
              let binary = "";
              const chunkSize = 8192;
              for (let i = 0; i < bytes.byteLength; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode(...chunk);
              }
              base64 = btoa(binary);
            }

            const { data, error } = await supabase.functions.invoke(`build-desktop-${engine === "electron" ? "electron" : "tauri"}`, {
              body: {
                action: "start",
                projectZip: base64,
                projectName: appName,
                appName,
                packageName,
                platforms: desktopPlatforms,
                url: url || undefined,
              },
            });

            if (error) throw error;
            if (data?.error) {
              addLog("> ✗ " + data.error);
              setBuildError(data.error);
              syncStatus?.("failure", { error: data.error });
            } else {
              const repoName = data.repoName;
              if (jobId) {
                useBuildStore.getState().updateJob(jobId, { repoName, repoUrl: `https://github.com/${data.username}/${repoName}` });
              }
              addLog("> ✓ Build submitted! Repo: " + repoName);
              syncStage(5);
              syncStatus?.("building");
              persistBuild?.({});
              addLog("> Building desktop apps (this may take 5-10 minutes)...");

              // Poll for completion
              let runId = data.runId;
              let buildComplete = false;
              let pollCount = 0;
              const maxPolls = 60;

              while (!buildComplete && pollCount < maxPolls) {
                await delay(pollCount < 5 ? 5000 : 10000);
                pollCount++;

                const { data: statusData } = await supabase.functions.invoke(`build-desktop-${engine === "electron" ? "electron" : "tauri"}`, {
                  body: { action: "status", repoName, runId },
                });
                if (statusData?.runId && !runId) runId = statusData.runId;
                if (statusData?.logs) for (const log of statusData.logs) addLog("> " + log);
                if (pollCount % 5 === 0) persistBuild?.({});

                if (statusData?.status === "success") {
                  addLog("> ✓ Desktop builds complete!");
                  buildComplete = true;

                  // Download artifacts
                  addLog("> Downloading artifacts...");
                  try {
                    const { data: dlData } = await supabase.functions.invoke(`build-desktop-${engine === "electron" ? "electron" : "tauri"}`, {
                      body: { action: "download", repoName, runId },
                    });
                    if (dlData?.artifactBase64) {
                      const artBinary = atob(dlData.artifactBase64);
                      const artBytes = new Uint8Array(artBinary.length);
                      for (let i = 0; i < artBinary.length; i++) artBytes[i] = artBinary.charCodeAt(i);
                      const artBlob = new Blob([artBytes], { type: "application/zip" });
                      setGeneratedZip(artBlob);
                      addLog("> ✓ Artifacts downloaded (" + (artBlob.size / (1024 * 1024)).toFixed(1) + " MB)");
                    }
                  } catch {
                    addLog("> ⚠ Could not download artifacts automatically");
                  }

                  // Cleanup
                  try {
                    await supabase.functions.invoke(`build-desktop-${engine === "electron" ? "electron" : "tauri"}`, { body: { action: "delete-repo", repoName } });
                    addLog("> ✓ Build repository cleaned up");
                  } catch {}

                  syncStatus?.("success", { completedAt: Date.now() });
                  persistBuild?.({ completedAt: Date.now() });
                } else if (statusData?.status === "failure") {
                  addLog("> ✗ Desktop build failed.");
                  if (statusData?.buildLogs) {
                    addLog("> ── Build Error Output ──");
                    for (const line of statusData.buildLogs.split("\n").slice(-40)) addLog(">   " + line);
                    addLog("> ── End of Logs ──");
                  }
                  setBuildError("Desktop build failed. Check logs above.");
                  syncStatus?.("failure", { error: "Build failed", completedAt: Date.now() });
                  persistBuild?.({ completedAt: Date.now() });
                  buildComplete = true;
                } else if (pollCount % 3 === 0) {
                  addLog("> ... building (" + pollCount + "/" + maxPolls + ")");
                }
              }

              if (!buildComplete) {
                addLog("> ⚠ Build timed out.");
                setBuildError("Build timed out.");
                syncStatus?.("timeout", { completedAt: Date.now() });
                persistBuild?.({ completedAt: Date.now() });
              }
            }
          } catch (cloudErr: any) {
            addLog("> ⚠ Cloud build error: " + (cloudErr?.message || "Unknown"));
            setBuildError(cloudErr?.message || "Build failed");
            syncStatus?.("failure", { error: cloudErr?.message, completedAt: Date.now() });
            persistBuild?.({ completedAt: Date.now() });
          }

        // ====== GITHUB-REPO MODE ======
        } else if (buildMode === "github-repo") {
          addLog("> Submitting GitHub repo build to cloud...");
          const pluginPackages = getPluginNpmPackages(enabledPlugins);
          if (pluginPackages.length > 0) {
            addLog("> Plugins to install:");
            for (const pkg of pluginPackages) addLog(">   • " + pkg);
          }
          syncStage(2);
          await delay(300);
          syncStage(3);
          addLog("> No local bundling needed — cloud will clone directly");
          await delay(300);
          syncStage(4);

          if (outputMode === "apk") {
            await runCloudBuildFromRepo(addLog, (n: number) => syncStage(n), setApkBlob, setGeneratedZip, setBuildError, appName, packageName, pluginPackages, storeRepoUrl, repoBranch, jobId, syncStatus, persistBuild, setCiSteps);
          } else {
            addLog("> ⚠ Project ZIP mode not supported for GitHub repo builds.");
            setBuildError("GitHub repo builds only support APK output mode.");
            syncStatus("failure", { error: "GitHub repo builds only support APK output mode." });
          }

        // ====== CAPACITOR-SOURCE MODE ======
        } else if (buildMode === "capacitor-source") {
          // === ORCHESTRATION: Compute build plan ===
          const orchestrator = new BuildOrchestrator();
          setOrchestratorInstance(orchestrator);
          orchestrator.on((evt) => {
            addLog(`> [${evt.status}] ${evt.label}${evt.detail ? ` — ${evt.detail}` : ""}${evt.elapsed ? ` (${evt.elapsed.toFixed(1)}s)` : ""}`);
          });

          let buildPlan: BuildPlan | null = null;
          try {
            buildPlan = await computeBuildPlan(projectId || "", useProjectStore.getState().files, enabledPlugins, engine);
            setBuildPlanState(buildPlan);
            if (buildPlan.isIncremental) {
              appendBuildChat(`### ⚡ Incremental Build\n\nSkipping ${buildPlan.skippedPhases.length} unchanged phase(s): ${buildPlan.skippedPhases.join(", ")}\n\n`);
              addLog(`> ⚡ Incremental build — skipping: ${buildPlan.skippedPhases.join(", ")}`);
            }
          } catch (e) {
            addLog("> ⚠ Orchestrator unavailable, running full build");
          }

          const shouldSkip = (phase: string) => buildPlan?.skippedPhases.includes(phase as any) ?? false;

          // === PRE-BUILD VALIDATION ===
          appendBuildChat("### 🔍 Pre-Build Validation\n\n");
          const baValidate = addBuildAction("Validating project", "active");
          const allAnalysisFiles = flattenProjectFiles(useProjectStore.getState().files);
          const scanInput = allAnalysisFiles.map(f => ({ path: f.path, type: f.type as "file" | "folder", content: f.content, size: f.size, isBinary: f.isBinary, binaryContent: f.binaryContent }));
          const scanResult = scanProject(scanInput);

          const validation = validateProjectForBuild(allAnalysisFiles as any, scanResult);
          const validationLogs = projectValidationToLogs(validation);
          await delay(300);

          if (!validation.canBuild) {
            appendBuildChat(`❌ **Validation Failed**\n\n${validation.errors.map(e => `- ${e}`).join("\n")}\n\nPlease fix these issues and try again.\n\n`);
            updateBuildAction(baValidate, { status: "error", elapsed: 0.3, finding: validationLogs.join("\n") });
            for (const err of validation.errors) {
              addBuildAction(err, "error");
            }
            setBuildError("Project failed pre-build validation. Fix the issues above.");
            syncStatus("failure", { error: "Pre-build validation failed", completedAt: Date.now() });
            persistBuild({ completedAt: Date.now() });
            setIsComplete(true);
            setIsBuildStreaming(false);
            return;
          }
          appendBuildChat(`✅ All pre-build checks passed\n${validation.warnings.length > 0 ? validation.warnings.map(w => `- ⚠️ ${w}`).join("\n") + "\n" : ""}\n`);
          updateBuildAction(baValidate, { status: "done", elapsed: 0.3, finding: validation.warnings.length > 0 ? validationLogs.join("\n") : "→ All checks passed" });

          // === TOOL 1: Project Scanner ===
          if (!shouldSkip("scan")) {
            orchestrator.startPhase("scan");
            appendBuildChat("### 📂 Project Analysis\n\n");
            const baScan = addBuildAction("Scanning project structure", "active");
            for (const log of scanResultToLogs(scanResult)) addLog("> " + log);
            await delay(300);
            appendBuildChat(`- **Framework:** ${scanResult.framework}\n- **Source files:** ${scanResult.sourceFiles}\n\n`);
            updateBuildAction(baScan, { status: "done", elapsed: 0.3, finding: `→ ${scanResult.framework}, ${scanResult.sourceFiles} files` });
            orchestrator.completePhase("scan");
          } else {
            orchestrator.skipPhase("scan", "Source unchanged");
            addBuildAction("Scanning project structure — skipped", "done");
          }

          // === TOOL 2: Compatibility Checker ===
          if (!shouldSkip("compatibility")) {
            orchestrator.startPhase("compatibility");
            const baCompat = addBuildAction("Checking compatibility", "active");
            const compat = checkCompatibility(scanResult, engine, outputMode);
            for (const log of compatibilityToLogs(compat)) addLog("> " + log);
            await delay(200);
            appendBuildChat(compat.compatible ? "✅ Project is compatible with the selected engine\n\n" : `⚠️ Compatibility issues: ${compat.blockers.join(", ")}\n\n`);
            updateBuildAction(baCompat, { status: compat.compatible ? "done" : "error", elapsed: 0.2, finding: compat.compatible ? "→ Compatible" : `→ ${compat.blockers.join(", ")}` });
            orchestrator.completePhase("compatibility");
          } else {
            orchestrator.skipPhase("compatibility", "Already verified");
            addBuildAction("Checking compatibility — skipped", "done");
          }

          // === TOOL 3: Dependency Resolver ===
          if (!shouldSkip("dependencies")) {
            orchestrator.startPhase("dependencies");
            const baDep = addBuildAction("Resolving dependencies", "active");
            const depRes = resolveDependencies(scanResult);
            for (const log of dependencyResolutionToLogs(depRes)) addLog("> " + log);
            await delay(200);
            appendBuildChat(`- **Install command:** \`${depRes.installCommand}\`\n\n`);
            updateBuildAction(baDep, { status: "done", elapsed: 0.2, finding: `→ ${depRes.installCommand}` });
            orchestrator.completePhase("dependencies");
          } else {
            orchestrator.skipPhase("dependencies", "Dependencies unchanged");
            addBuildAction("Resolving dependencies — skipped", "done");
          }

          // === TOOL 5: Config Generator ===
          const baConfig = addBuildAction("Generating build config", "active");
          const buildConfig = generateBuildConfig();
          for (const log of configToLogs(buildConfig)) addLog("> " + log);
          await delay(200);
          updateBuildAction(baConfig, { status: "done", elapsed: 0.2, finding: `→ AGP ${buildConfig.agpVersion}, Gradle ${buildConfig.gradleVersion}` });

          // AI analysis (non-blocking)
          try {
            const fileNames = allAnalysisFiles.filter(f => f.type === "file").map(f => f.path);
            let pkgJson: Record<string, any> | undefined;
            const pkgFile = allAnalysisFiles.find(f => f.path === "package.json" || f.path.endsWith("/package.json"));
            if (pkgFile?.content) { try { pkgJson = JSON.parse(pkgFile.content); } catch {} }
            const { data: analysis } = await supabase.functions.invoke("analyze-project", {
              body: { fileList: fileNames, packageJson: pkgJson, engine, platform: "android", url: url || undefined, hasSourceFiles: true },
            });
            if (analysis && !analysis.error) {
              addLog("> ✓ AI Analysis — Score: " + analysis.score + "/100 | Strategy: " + analysis.buildStrategy);
              if (analysis.projectShape) addLog(">   Shape: " + analysis.projectShape.shape + (analysis.projectShape.isMonorepo ? " [monorepo]" : "") + (analysis.projectShape.routerMode !== "none" ? " router=" + analysis.projectShape.routerMode : ""));
            }
          } catch { addLog("> ⚠ AI analysis skipped"); }

          // === Icons ===
          const baIcons = addBuildAction("Generating app icons", "active");
          let iconEntries: { folder: string; squareBlob: ArrayBuffer; roundBlob: ArrayBuffer }[] = [];
          try {
            iconEntries = iconDataUrl
              ? await generateIconsFromImage(iconDataUrl)
              : await generateDefaultIcons(appName);
            updateBuildAction(baIcons, { status: "done", elapsed: 0.3, finding: `→ ${iconEntries.length} density buckets` });
          } catch (iconErr) {
            updateBuildAction(baIcons, { status: "done", elapsed: 0.1, finding: "→ Skipped (canvas not available)" });
          }

          await delay(300);
          syncStage(2);

          let pluginPackages: string[] = [];

          // === TOOL 4: Plugin Wirer ===
          if (!shouldSkip("plugins")) {
            orchestrator.startPhase("plugins");
            const baPlugins = addBuildAction("Configuring plugins", "active");
            const pluginResult = wirePlugins(enabledPlugins, engine);
            pluginPackages = pluginResult.npmPackages;
            for (const log of pluginWiringToLogs(pluginResult)) addLog("> " + log);
            await delay(200);
            updateBuildAction(baPlugins, { status: "done", elapsed: 0.2, finding: pluginPackages.length > 0 ? `→ ${pluginPackages.length} plugin(s)` : "→ No plugins" });
            orchestrator.completePhase("plugins");

            // === Smart plugin refusal: detect unused plugins ===
            if (enabledPlugins.length > 0) {
              const sourceContents = allAnalysisFiles
                .filter(f => f.type === "file" && f.content && !f.isBinary)
                .map(f => f.content || "");
              const unused = detectUnusedPlugins(enabledPlugins, sourceContents);
              if (unused.length > 0) {
                addBuildAction("Plugin usage check", "done");
                for (const u of unused) {
                  addLog(`> ⚠ Plugin "${u.pluginId}" (${u.npm}) is enabled but no usage found in source code`);
                }
                appendBuildChat(`⚠️ **Plugins enabled but not used in code:**\n${unused.map(u => `- ${u.npm}`).join("\n")}\n\nThese will still be installed but may not be needed.\n\n`);
              }
            }

            // === Plugins needing secrets/config ===
            const configPlugins = getPluginsNeedingConfig(enabledPlugins);
            if (configPlugins.length > 0) {
              for (const cp of configPlugins) {
                if (cp.secretsDescription) addLog(`> ⚠ ${cp.npm}: ${cp.secretsDescription}`);
                if (cp.manualConfigDescription) addLog(`> ⚠ ${cp.npm}: ${cp.manualConfigDescription}`);
              }
              appendBuildChat(`### ⚠️ Plugin Configuration Required\n\n${configPlugins.map(cp => `- **${cp.npm}**: ${cp.secretsDescription || cp.manualConfigDescription || "Needs configuration"}`).join("\n")}\n\n`);
            }
          } else {
            orchestrator.skipPhase("plugins", "Plugins unchanged");
            addBuildAction("Configuring plugins — skipped", "done");
            const pluginResult = wirePlugins(enabledPlugins, engine);
            pluginPackages = pluginResult.npmPackages;
          }

          // === AI CODE INJECTION (Phase 3) ===
          if (!shouldSkip("ai-inject") && pluginPackages.length > 0) {
            orchestrator.startPhase("ai-inject");
            const baInject = addBuildAction("AI code integration", "active");
            appendBuildChat("### 🧠 AI Code Integration\n\n");

            try {
              // Plan and apply plugin injections to in-memory file tree
              const sourceForInjection = flattenProjectFiles(useProjectStore.getState().files)
                .filter(f => f.type === "file" && f.content)
                .map(f => ({ path: f.path, content: f.content }));
              const injectionPlan = planPluginInjections(sourceForInjection, enabledPlugins, engine);

              if (injectionPlan.injections.length > 0) {
                for (const log of injectionPlanToLogs(injectionPlan)) addLog("> " + log);

                // Apply injections to the store's file tree
                const updateFileContent = (path: string, content: string) => {
                  useProjectStore.getState().updateFileContent(path, content);
                };
                const modifiedPaths = applyInjectionPlan(injectionPlan, updateFileContent);

                if (modifiedPaths.length > 0) {
                  appendBuildChat(`- Injected plugin code into: ${modifiedPaths.join(", ")}\n`);
                  addLog(`> ✓ Applied code injections to ${modifiedPaths.length} file(s)`);

                  // Validate the injected code
                  for (const path of modifiedPaths) {
                    const file = flattenProjectFiles(useProjectStore.getState().files).find(f => f.path === path);
                    if (file?.content) {
                      const validation = validateInjection(file.content);
                      if (!validation.valid) {
                        for (const issue of validation.issues) {
                          addLog(`> ⚠ Validation issue in ${path}: ${issue}`);
                        }
                      }
                    }
                  }
                }

                appendBuildChat(`- ${injectionPlan.injections.length} plugin(s) configured\n\n`);
              }

              updateBuildAction(baInject, { status: "done", elapsed: 0.5, finding: `→ ${injectionPlan.injections.length} plugin(s) injected` });
              orchestrator.completePhase("ai-inject");
            } catch (injectErr: any) {
              addLog(`> ⚠ AI injection error (non-blocking): ${injectErr?.message}`);
              updateBuildAction(baInject, { status: "done", elapsed: 0.3, finding: "→ Skipped (error)" });
              orchestrator.errorPhase("ai-inject", injectErr?.message || "Unknown");
            }
          } else if (shouldSkip("ai-inject")) {
            orchestrator.skipPhase("ai-inject", "No injection needed");
            addBuildAction("AI code integration — skipped", "done");
          }

          await delay(300);
          syncStage(3);

          // === Bundling ===
          orchestrator.startPhase("bundle");

          // === Bundling ===
          const baBundle = addBuildAction("Bundling source code", "active");
          // Use freshly injected files from the store
          const allFiles = flattenProjectFiles(useProjectStore.getState().files);

          // Ensure every wired plugin package is present in package.json so the
          // workflow's `npm install` actually pulls them down (e.g. @capacitor/text-zoom).
          if (pluginPackages.length > 0) {
            const pkgIdx = allFiles.findIndex(f => f.path === "package.json" || f.path.endsWith("/package.json"));
            if (pkgIdx !== -1 && allFiles[pkgIdx].content) {
              try {
                const pkg = JSON.parse(allFiles[pkgIdx].content as string);
                pkg.dependencies = pkg.dependencies || {};
                let added = 0;
                for (const name of pluginPackages) {
                  if (!pkg.dependencies[name] && !(pkg.devDependencies && pkg.devDependencies[name])) {
                    pkg.dependencies[name] = "latest";
                    added++;
                  }
                }
                if (added > 0) {
                  const updated = JSON.stringify(pkg, null, 2);
                  allFiles[pkgIdx] = { ...allFiles[pkgIdx], content: updated };
                  useProjectStore.getState().updateFileContent(allFiles[pkgIdx].path, updated);
                  addLog(`> ✓ Added ${added} plugin(s) to package.json dependencies`);
                }
              } catch (e) {
                addLog(`> ⚠ Could not patch package.json: ${(e as Error).message}`);
              }
            }
          }

          const zip = new JSZip();
          let fileCount = 0;
          for (const f of allFiles) {
            if (f.type !== "file") continue;
            if (f.isBinary && f.binaryContent) {
              zip.file(f.path, f.binaryContent);
            } else if (f.content && !f.isBinary) {
              zip.file(f.path, f.content);
            }
            fileCount++;
          }

          const nbConfig = { appName, packageName, engine, plugins: pluginPackages, buildMode: "capacitor-source", buildHash: buildPlan?.currentHash };
          zip.file("nativebridge-config.json", JSON.stringify(nbConfig, null, 2));

          if (iconEntries.length > 0) {
            const iconsZip = new JSZip();
            for (const icon of iconEntries) {
              iconsZip.file(`${icon.folder}/ic_launcher.png`, icon.squareBlob);
              iconsZip.file(`${icon.folder}/ic_launcher_round.png`, icon.roundBlob);
            }
            const iconsBlob = await iconsZip.generateAsync({ type: "arraybuffer" });
            zip.file("icons.zip", iconsBlob);
          }

          await delay(400);
          syncStage(4);
          orchestrator.completePhase("bundle");

          const blob = await zip.generateAsync({ type: "blob" });
          setGeneratedZip(blob);
          appendBuildChat(`### 📦 Bundling\n\n- **Files bundled:** ${fileCount}\n- **Package size:** ${(blob.size / 1024).toFixed(0)} KB\n${buildPlan?.isIncremental ? `- **Mode:** Incremental (${buildPlan.skippedPhases.length} phases skipped)\n` : ""}\n`);
          updateBuildAction(baBundle, { status: "done", elapsed: 0.8, finding: `→ ${fileCount} files, ${(blob.size / 1024).toFixed(0)} KB` });

          // Persist source to Supabase Storage for future rebuilds
          if (projectId && useProjectStore.getState().files.length > 0) {
            try {
              await persistProject(projectId, useProjectStore.getState().files as any, enabledPlugins, { engine, appName, packageName });
              addLog("> ✓ Source code persisted to cloud storage");
            } catch { addLog("> ⚠ Source persistence skipped"); }
          }

          if (outputMode === "apk") {
            orchestrator.startPhase("upload");
            appendBuildChat("### ☁️ Cloud Build\n\nUploading to cloud builder and creating Ubuntu virtual machine with **JDK 21** and **Android SDK 34**...\n\n");
            const baUpload = addBuildAction("Uploading to cloud builder", "active");
            syncStatus("uploading");

            // For incremental builds, try to reuse existing repo
            const lastJob = jobId ? useBuildStore.getState().jobs.find(j => j.id !== jobId && j.status === "success" && j.sourceRepoName) : null;
            const existingRepoName = buildPlan?.isIncremental ? lastJob?.sourceRepoName : undefined;

            // Fetch plugin config files (google-services.json, etc.) from Supabase
            let pluginConfigFiles: { path: string; contentBase64: string }[] = [];
            if (projectId && enabledPlugins.length > 0) {
              try {
                const { fileSecrets } = await getSecretsForBuild(projectId);
                for (const fs of fileSecrets) {
                  const { data: fileData } = await supabase.storage.from("build-artifacts").download(fs.storagePath);
                  if (fileData) {
                    const arrayBuf = await fileData.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuf);
                    let binary = "";
                    for (let i = 0; i < bytes.byteLength; i += 8192) {
                      const chunk = bytes.subarray(i, i + 8192);
                      binary += String.fromCharCode(...chunk);
                    }
                    const b64 = btoa(binary);
                    // Map file key to proper path in repo
                    const repoPath = fs.key === "google-services.json" ? "google-services.json" : fs.key;
                    pluginConfigFiles.push({ path: repoPath, contentBase64: b64 });
                    addLog(`> ✓ Plugin config: ${fs.key}`);
                  }
                }
              } catch { addLog("> ⚠ Plugin config fetch skipped"); }
            }

            // Apply staged appearance config (icon, splash, status bar, edge-to-edge)
            const appearancePayload = await buildAppearancePayload(projectId);
            const effectiveIconDataUrl = appearancePayload.iconDataUrl || iconDataUrl;
            if (appearancePayload.row) addLog("> ✓ Applied staged appearance config");

            await runCloudBuild(blob, addLog, (n: number) => syncStage(n), setApkBlob, setGeneratedZip, setBuildError, appName, packageName, pluginPackages, buildMode, jobId, syncStatus, persistBuild, addBuildAction, updateBuildAction, appendBuildChat, setCiProgressBlock, signingMode, keystorePassword, keyAlias, keyPassword, keystoreBase64, existingRepoName, setCiSteps, effectiveIconDataUrl, pluginConfigFiles, appearancePayload.splashDataUrl, appearancePayload.appearanceJson, projectId, appearancePayload.iconForegroundDataUrl, appearancePayload.iconBackgroundColor);
          }

        } else {
          // ====== PREBUILT-PROJECT MODE ======
          // Run AI analysis first
          addLog("> Running pre-build analysis...");
          try {
            const allAnalysisFiles = flattenProjectFiles(files);
            const fileNames = allAnalysisFiles.filter(f => f.type === "file").map(f => f.path);
            let pkgJson: Record<string, any> | undefined;
            const pkgFile = allAnalysisFiles.find(f => f.path === "package.json" || f.path.endsWith("/package.json"));
            if (pkgFile?.content) {
              try { pkgJson = JSON.parse(pkgFile.content); } catch {}
            }
            const { data: analysis } = await supabase.functions.invoke("analyze-project", {
              body: { fileList: fileNames, packageJson: pkgJson, engine, platform: "android", url: url || undefined, hasSourceFiles: allAnalysisFiles.length > 0 },
            });
            if (analysis && !analysis.error) {
              addLog("> ✓ Analysis — Score: " + analysis.score + "/100 | Strategy: " + analysis.buildStrategy);
              if (analysis.projectShape) addLog(">   Shape: " + analysis.projectShape.shape + (analysis.projectShape.isMonorepo ? " [monorepo]" : "") + (analysis.projectShape.expectedWebDir ? " webDir=" + analysis.projectShape.expectedWebDir : ""));
              for (const check of (analysis.checks || [])) {
                const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✗";
                addLog(">   " + icon + " " + check.label + ": " + check.detail);
              }
              if (analysis.recommendations?.length > 0) {
                for (const rec of analysis.recommendations) addLog(">   → " + rec);
              }
            }
          } catch { addLog("> ⚠ Analysis skipped"); }

          addLog("> Generating " + engineLabel(engine) + " Android project...");

          let icons;
          try {
            addLog("> Generating default app icons...");
            icons = iconDataUrl
              ? await generateIconsFromImage(iconDataUrl)
              : await generateDefaultIcons(appName);
            addLog("> ✓ Generated icons for " + icons.length + " density buckets");
          } catch (iconErr) {
            addLog("> ⚠ Icon generation skipped (canvas not available)");
          }

          const config = { appName, packageName, url: url || undefined, icons };
          let generatedFiles: GeneratedFile[];

          switch (engine) {
            case "capacitor": generatedFiles = generateCapacitorProject(config); break;
            case "ionic": generatedFiles = generateIonicProject(config); break;
            case "twa": generatedFiles = generateTwaProject(config); break;
            default: generatedFiles = generateWebviewProject(config);
          }

          for (const f of generatedFiles) addLog("> + " + f.path);

          await delay(800);
          syncStage(2);

          // Plugin injection for prebuilt mode
          const prebuiltWiring = wirePlugins(enabledPlugins, engine);
          const prebuiltPluginPkgs = prebuiltWiring.npmPackages;
          for (const log of pluginWiringToLogs(prebuiltWiring)) addLog("> " + log);

          if (enabledPlugins.length > 0 && (engine === "capacitor" || engine === "ionic")) {
            addLog("> Injecting " + enabledPlugins.length + " plugin(s)...");
            const manifestIdx = generatedFiles.findIndex(f => f.path.includes("AndroidManifest.xml"));
            if (manifestIdx !== -1) {
              generatedFiles[manifestIdx] = { ...generatedFiles[manifestIdx], content: injectPermissions(generatedFiles[manifestIdx].content as string, enabledPlugins) };
              addLog("> Injected permissions into AndroidManifest.xml");
            }
            const gradleIdx = generatedFiles.findIndex(f => f.path === "app/build.gradle");
            if (gradleIdx !== -1) {
              generatedFiles[gradleIdx] = { ...generatedFiles[gradleIdx], content: injectGradleDeps(generatedFiles[gradleIdx].content as string, enabledPlugins) };
              addLog("> Injected dependencies into build.gradle");
            }
            const mainIdx = generatedFiles.findIndex(f => f.path.includes("MainActivity.java"));
            if (mainIdx !== -1) {
              generatedFiles[mainIdx] = { ...generatedFiles[mainIdx], content: injectMainActivityPlugins(generatedFiles[mainIdx].content as string, enabledPlugins) };
              addLog("> Injected plugin registrations into MainActivity.java");
            }
          } else {
            addLog("> No plugins to inject");
          }

          await delay(500);
          syncStage(3);

          const hasUpFiles = files.length > 0;
          if (hasUpFiles) {
            const allFiles = flattenProjectFiles(files);
            const textFiles = allFiles.filter(f => f.type === "file" && f.content && !f.isBinary);
            const binaryFiles = allFiles.filter(f => f.type === "file" && f.isBinary && f.binaryContent);
            addLog("> Packaging " + (textFiles.length + binaryFiles.length) + " source files...");
            for (const wf of textFiles) generatedFiles.push({ path: "web-source/" + wf.path, content: wf.content || "" });
            for (const bf of binaryFiles) generatedFiles.push({ path: "web-source/" + bf.path, content: bf.binaryContent!, isBinary: true });
            addLog("> ✓ Source files packaged");
          } else {
            addLog("> URL mode — no assets to bundle");
          }

          await delay(400);
          syncStage(4);

          addLog("> Creating ZIP archive...");
          generatedFiles.push({ path: ".github/workflows/build.yml", content: getPrebuiltWorkflowYml() });
          addLog("> + .github/workflows/build.yml");

          const zip = new JSZip();
          for (const f of generatedFiles) {
            if (f.isBinary && f.content instanceof ArrayBuffer) zip.file(f.path, f.content);
            else zip.file(f.path, f.content as string);
          }

          const blob = await zip.generateAsync({ type: "blob" });
          setGeneratedZip(blob);
          addLog("> ZIP size: " + (blob.size / 1024).toFixed(1) + " KB");
          addLog("> Total files: " + generatedFiles.length);

          if (outputMode === "apk") {
            syncStatus("uploading");
            const appearancePayload2 = await buildAppearancePayload(projectId);
            const effectiveIconDataUrl2 = appearancePayload2.iconDataUrl || iconDataUrl;
            await runCloudBuild(blob, addLog, (n: number) => syncStage(n), setApkBlob, setGeneratedZip, setBuildError, appName, packageName, prebuiltPluginPkgs, buildMode, jobId, syncStatus, persistBuild, undefined, undefined, appendBuildChat, setCiProgressBlock, signingMode, keystorePassword, keyAlias, keyPassword, keystoreBase64, undefined, setCiSteps, effectiveIconDataUrl2, undefined, appearancePayload2.splashDataUrl, appearancePayload2.appearanceJson, projectId, appearancePayload2.iconForegroundDataUrl, appearancePayload2.iconBackgroundColor);
          }
        }

        addLog("> ✓ Build pipeline complete!");
        await delay(300);
        syncStage(stages.length, "Complete");
        setIsComplete(true);
        setIsBuildStreaming(false);
        
        // Check buildError from ref-like pattern since setState is async
        // If no error was set by the cloud build helpers, mark as success
        const currentJob = jobId ? useBuildStore.getState().getJob(jobId) : null;
        const hasError = currentJob?.status === "failure" || currentJob?.status === "timeout";
        if (!hasError) {
          syncStatus("success", { completedAt: Date.now() });
          persistBuild({ completedAt: Date.now() });
        }
        onBuildComplete?.();
      } catch (err: any) {
        addLog("> ✗ Build failed: " + (err?.message || "Unknown error"));
        appendBuildChat(`\n### ❌ Build Failed\n\n${err?.message || "Unknown error"}\n`);
        setBuildError(err?.message || "Build failed");
        syncStatus("failure", { error: err?.message || "Build failed", completedAt: Date.now() });
        persistBuild({ completedAt: Date.now() });
        setIsComplete(true);
        setIsBuildStreaming(false);
      }
    };

    run();
  }, [isBuilding]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleDownloadAPK = () => {
    if (!apkBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(apkBlob);
    a.download = `${appName.replace(/\s+/g, "_")}.apk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const handleDownloadProject = () => {
    if (!generatedZip) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(generatedZip);
    a.download = `${appName.replace(/\s+/g, "_")}_${isDesktop ? "desktop" : "android"}_project.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  if (!isBuilding && !isComplete) return null;

  return (
    <div className="space-y-4">
      {/* AI Chat for build progress */}
      {(buildChatContent || ciProgressBlock) ? (
        <AIChat
          content={buildChatContent + ciProgressBlock}
          isStreaming={isBuildStreaming}
          label="ForgeAI Build"
        />
      ) : null}

      {/* Dynamic Orchestrator Activity Feed */}
      {orchestratorFeed.actions.length > 0 && (
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="px-3 pt-2.5 pb-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Build Pipeline</div>
          </div>
          <AIActivityFeed
            actions={orchestratorFeed.actions}
            estimatedTimeRemaining={orchestratorFeed.estimatedTimeRemaining}
            progressPercent={orchestratorFeed.progressPercent}
            elapsedSeconds={orchestratorFeed.elapsedSeconds}
            className="max-h-[300px]"
          />
        </div>
      )}

      {/* Real-time GitHub Actions steps */}
      {ciSteps.length > 0 ? (
        <div className="space-y-0.5 rounded-xl bg-card border border-border p-3">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">GitHub Actions Steps</div>
          {ciSteps.map((step, idx) => {
            const isDone = step.status === "completed" && step.conclusion === "success";
            const isFailed = step.status === "completed" && step.conclusion === "failure";
            const isActive = step.status === "in_progress";
            const isQueued = step.status === "queued";
            
            // Duration badge
            let durationStr = "";
            if (step.startedAt) {
              const start = new Date(step.startedAt).getTime();
              const end = step.completedAt ? new Date(step.completedAt).getTime() : Date.now();
              const secs = Math.round((end - start) / 1000);
              if (secs >= 60) {
                durationStr = `${Math.floor(secs / 60)}m ${secs % 60}s`;
              } else if (secs > 0) {
                durationStr = `${secs}s`;
              }
            }
            
            return (
              <div key={`${step.number}-${step.name}`} className="flex items-center gap-2 py-0.5">
                {isDone ? (
                  <CheckCircle2 size={13} className="text-[hsl(var(--success))] shrink-0" />
                ) : isFailed ? (
                  <Circle size={13} className="text-destructive shrink-0" />
                ) : isActive ? (
                  <Loader2 size={13} className="animate-spin text-primary shrink-0" />
                ) : (
                  <Circle size={13} className="text-muted-foreground/30 shrink-0" />
                )}
                <span className={`text-xs truncate ${
                  isDone ? "text-muted-foreground" : 
                  isFailed ? "text-destructive font-medium" : 
                  isActive ? "shimmer-text font-semibold" : 
                  "text-muted-foreground/40"
                }`}>
                  {step.name}
                </span>
                {durationStr && (step.status === "completed" || isActive) && (
                  <span className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                    <Clock size={9} />
                    {durationStr}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : !buildChatContent && !ciProgressBlock ? (
        <div className="space-y-1">
          {stages.map((stage, idx) => {
            const isDone = idx < currentStage;
            const isActive = idx === currentStage && !isComplete;
            return (
              <div key={stage.id} className="flex items-center gap-2 py-1">
                {isDone || (isComplete && idx === stages.length - 1) ? (
                  <CheckCircle2 size={14} className="text-[hsl(var(--success))]" />
                ) : isActive ? (
                  <Loader2 size={14} className="animate-spin text-foreground" />
                ) : (
                  <Circle size={14} className="text-muted-foreground/40" />
                )}
                <span className={`text-xs ${isDone || isComplete ? "text-[hsl(var(--success))]" : isActive ? "shimmer-text font-medium" : "text-muted-foreground/50"}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {buildError && (
        <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">{buildError}</div>
      )}

      {isComplete && (
        <div className="space-y-2">
          {apkBlob && (
            <Button className="w-full gap-2 h-11" onClick={handleDownloadAPK}>
              <Download size={16} /> Download APK ({(apkBlob.size / (1024 * 1024)).toFixed(1)} MB)
            </Button>
          )}
          {generatedZip && (
            <Button variant={apkBlob ? "outline" : "default"} className="w-full gap-2" size="sm" onClick={handleDownloadProject}>
              <Package size={14} /> {isDesktop ? "Download Desktop Build (.zip)" : "Download Android Studio Project (.zip)"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Cloud build from GitHub repo ──

async function runCloudBuildFromRepo(
  addLog: (msg: string) => void,
  setCurrentStage: (n: number) => void,
  setApkBlob: (b: Blob | null) => void,
  setGeneratedZip: (b: Blob | null) => void,
  setBuildError: (e: string | null) => void,
  appName: string,
  packageName: string,
  pluginPackages: string[],
  sourceRepoUrl: string,
  sourceBranch: string,
  jobId?: string,
  syncStatus?: (status: any, extra?: any) => void,
  persistBuild?: (updates: any) => Promise<void>,
  setCiSteps?: (steps: any[]) => void,
) {
  await delay(300);
  setCurrentStage(5);
  addLog("> Submitting build request to cloud...");
  syncStatus?.("uploading");

  try {
    const { data, error } = await supabase.functions.invoke("build-apk", {
      body: { action: "start", projectName: appName, buildMode: "github-repo", appName, packageName, plugins: pluginPackages, sourceRepoUrl, sourceBranch },
    });

    if (error) throw error;
    if (data?.error) {
      addLog("> ✗ " + data.error);
      setBuildError(data.error);
      syncStatus?.("failure", { error: data.error });
      return;
    }

    const repoName = data.repoName;
    const commitSha = data.commitSha;
    const repoFullName = data.username ? `${data.username}/${repoName}` : repoName;
    if (jobId) {
      useBuildStore.getState().updateJob(jobId, { repoName, repoUrl: `https://github.com/${repoFullName}`, commitSha });
    }
    addLog("> ✓ Build submitted! Repo: " + repoName);
    setCurrentStage(6);
    syncStatus?.("building");
    persistBuild?.({});
    addLog("> Cloning repo & building (this may take 5-8 minutes)...");

    let runId = data.runId;
    let buildComplete = false;
    let pollCount = 0;
    const maxPolls = 60;

    while (!buildComplete && pollCount < maxPolls) {
      await delay(pollCount < 5 ? 5000 : 10000);
      pollCount++;

      const { data: statusData } = await supabase.functions.invoke("build-apk", { body: { action: "status", repoName, runId, commitSha } });
      if (statusData?.runId && !runId) runId = statusData.runId;
      if (statusData?.allSteps && setCiSteps) setCiSteps(statusData.allSteps);
      if (statusData?.logs) for (const log of statusData.logs) addLog("> " + log);

      // Persist periodically
      if (pollCount % 5 === 0) persistBuild?.({});

      if (statusData?.status === "success") {
        setCurrentStage(7);
        addLog("> ✓ Build successful!");
        addLog("> Downloading APK...");
        buildComplete = true;
        await downloadApkArtifact(addLog, setApkBlob, setGeneratedZip, setBuildError, repoName, runId, jobId, syncStatus, persistBuild);
      } else if (statusData?.status === "failure") {
        addLog("> ✗ Cloud build failed.");
        let finalBuildLogs = statusData?.buildLogs;
        if (!finalBuildLogs && repoName) {
          addLog("> Fetching error details...");
          await delay(3000);
          const { data: retryData } = await supabase.functions.invoke("build-apk", { body: { action: "status", repoName, runId } });
          finalBuildLogs = retryData?.buildLogs;
          if (retryData?.logs) {
            for (const log of retryData.logs) addLog("> " + log);
          }
        }
        if (finalBuildLogs) {
          addLog("> ── Build Error Output ──");
          const logLines = finalBuildLogs.split("\n").filter((l: string) => l.trim());
          for (const line of logLines.slice(-60)) addLog(">   " + line);
          addLog("> ── End of Logs ──");
        } else {
          addLog("> No detailed error logs available.");
          addLog("> Check the GitHub Actions run directly for full output.");
          if (jobId) {
            const job = useBuildStore.getState().getJob(jobId);
            if (job?.repoUrl) addLog("> " + job.repoUrl + "/actions");
          }
        }
        setBuildError("Build failed. Check the logs above.");
        syncStatus?.("failure", { error: "Build failed", completedAt: Date.now() });
        persistBuild?.({ completedAt: Date.now() });
        buildComplete = true;
      } else if (statusData?.status === "waiting") {
        if (pollCount % 3 === 0) addLog("> ... waiting for build to start");
      } else {
        if (pollCount % 3 === 0) addLog("> ... compiling (" + pollCount + "/" + maxPolls + ")");
      }
    }

    if (!buildComplete) {
      addLog("> ⚠ Build timed out after 10 minutes.");
      setBuildError("Build timed out.");
      syncStatus?.("timeout", { completedAt: Date.now() });
      persistBuild?.({ completedAt: Date.now() });
    }
  } catch (cloudErr: any) {
    addLog("> ⚠ Cloud build error: " + (cloudErr?.message || "Unknown"));
    setBuildError(cloudErr?.message || "Build failed");
    syncStatus?.("failure", { error: cloudErr?.message, completedAt: Date.now() });
    persistBuild?.({ completedAt: Date.now() });
  }
}

// ── Cloud build with ZIP upload ──

async function runCloudBuild(
  blob: Blob,
  addLog: (msg: string) => void,
  setCurrentStage: (n: number) => void,
  setApkBlob: (b: Blob | null) => void,
  setGeneratedZip: (b: Blob | null) => void,
  setBuildError: (e: string | null) => void,
  appName: string,
  packageName: string,
  pluginPackages: string[],
  buildMode: string,
  jobId?: string,
  syncStatus?: (status: any, extra?: any) => void,
  persistBuild?: (updates: any) => Promise<void>,
  addBuildAction?: (title: string, status?: any) => string,
  updateBuildAction?: (id: string, updates: any) => void,
  appendBuildChat?: (text: string) => void,
  setCiProgressBlock?: (text: string) => void,
  signingMode?: string,
  keystorePassword?: string,
  keyAlias?: string,
  keyPassword?: string,
  keystoreBase64?: string,
  existingRepoName?: string,
  setCiSteps?: (steps: any[]) => void,
  iconDataUrl?: string | null,
  pluginConfigFiles?: { path: string; contentBase64: string }[],
  splashDataUrl?: string | null,
  appearanceJson?: string | null,
  projectIdForAppearance?: string,
  iconForegroundDataUrl?: string | null,
  iconBackgroundColor?: string | null,
) {
  await delay(300);
  setCurrentStage(5);
  addLog("> Uploading project to cloud builder...");

  try {
    const arrayBuf = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    const { data, error } = await supabase.functions.invoke("build-apk", {
      body: { action: "start", projectZip: base64, projectName: appName, buildMode, appName, packageName, plugins: pluginPackages, signingMode: signingMode || "debug", keystorePassword, keyAlias, keyPassword, keystoreBase64, iconDataUrl: iconDataUrl || undefined, iconForegroundDataUrl: iconForegroundDataUrl || undefined, iconBackgroundColor: iconBackgroundColor || undefined, splashDataUrl: splashDataUrl || undefined, appearanceJson: appearanceJson || undefined, existingRepoName: existingRepoName || undefined, pluginConfigFiles: pluginConfigFiles?.length ? pluginConfigFiles : undefined },
    });

    if (error) throw error;
    if (data?.error) {
      addLog("> ✗ " + data.error);
      setBuildError(data.error);
      syncStatus?.("failure", { error: data.error });
      return;
    }

    const repoName = data.repoName;
    const commitSha = data.commitSha;
    const repoFullName = data.username ? `${data.username}/${repoName}` : repoName;
    if (jobId) {
      useBuildStore.getState().updateJob(jobId, { repoName, repoUrl: `https://github.com/${repoFullName}`, commitSha, sourceRepoName: repoName });
    }
    addLog("> ✓ Build submitted! Repo: " + repoName + (data.isReusing ? " (incremental)" : ""));
    if (projectIdForAppearance) markAppearanceBuilt(projectIdForAppearance);
    if (addBuildAction && updateBuildAction) {
      // Find and complete the upload action (last active one)
      updateBuildAction("__upload__", { status: "done", finding: `→ Repo: ${repoName}` });
    }
    setCurrentStage(6);
    syncStatus?.("building");
    persistBuild?.({});
    
    const baCompile = addBuildAction?.("Compiling with Gradle", "active") || "";
    addLog("> Compiling with Gradle (this may take 3-5 minutes)...");

    let runId = data.runId;
    let buildComplete = false;
    let pollCount = 0;
    const maxPolls = 60;

    while (!buildComplete && pollCount < maxPolls) {
      // Wait longer initially to give GitHub time to start the workflow
      await delay(pollCount < 2 ? 12000 : pollCount < 5 ? 6000 : 10000);
      pollCount++;

      const { data: statusData } = await supabase.functions.invoke("build-apk", { body: { action: "status", repoName, runId, commitSha } });
      if (statusData?.runId && !runId) runId = statusData.runId;
      // If we got a newer runId, update it
      if (statusData?.runId && runId && statusData.runId > runId) runId = statusData.runId;
      
      // Dynamic CI step narration: deduplicated via state replacement
      if (statusData?.allSteps && setCiSteps) {
        setCiSteps(statusData.allSteps);
      }
      if (statusData?.logs?.length > 0) {
        const stepLines = statusData.logs.map((log: string) => {
          if (log.startsWith("✓")) return `- ✅ ${log.slice(2)}`;
          if (log.startsWith("✗")) return `- ❌ ${log.slice(2)}`;
          if (log.startsWith("⟳")) return `- ⏳ ${log.slice(2)} (running...)`;
          return null;
        }).filter(Boolean);
        
        if (stepLines.length > 0 && setCiProgressBlock) {
          setCiProgressBlock(`### ☁️ Cloud Build Progress\n\n${stepLines.join("\n")}\n\n`);
        }
        
        for (const log of statusData.logs) addLog("> " + log);
      }
      if (pollCount % 5 === 0) persistBuild?.({});

      if (statusData?.status === "success") {
        setCurrentStage(7);
        addLog("> ✓ Build successful!");
        addLog("> Downloading APK...");
        if (updateBuildAction && baCompile) updateBuildAction(baCompile, { status: "done", finding: "→ Build successful" });
        const baDownload = addBuildAction?.("Downloading APK artifact", "active") || "";
        buildComplete = true;
        await downloadApkArtifact(addLog, setApkBlob, setGeneratedZip, setBuildError, repoName, runId, jobId, syncStatus, persistBuild);
      } else if (statusData?.status === "failure") {
        if (updateBuildAction && baCompile) updateBuildAction(baCompile, { status: "error", finding: "→ Build failed" });
        addLog("> ✗ Cloud build failed.");

        // Store errorInfo if returned by the edge function
        if (statusData?.errorInfo && jobId) {
          useBuildStore.getState().updateJob(jobId, { errorInfo: statusData.errorInfo });
        }

        let finalBuildLogs = statusData?.buildLogs;
        if (!finalBuildLogs && repoName) {
          addLog("> Fetching error details...");
          await delay(3000);
          const { data: retryData } = await supabase.functions.invoke("build-apk", { body: { action: "status", repoName, runId } });
          finalBuildLogs = retryData?.buildLogs;
          if (retryData?.logs) {
            for (const log of retryData.logs) addLog("> " + log);
          }
          if (retryData?.errorInfo && jobId) {
            useBuildStore.getState().updateJob(jobId, { errorInfo: retryData.errorInfo });
          }
        }
        if (finalBuildLogs) {
          addLog("> ── Build Error Output ──");
          const logLines = finalBuildLogs.split("\n").filter((l: string) => l.trim());
          for (const line of logLines.slice(-60)) addLog(">   " + line);
          addLog("> ── End of Logs ──");
        } else {
          addLog("> No detailed error logs available.");
          addLog("> Check the GitHub Actions run directly for full output.");
          if (jobId) {
            const job = useBuildStore.getState().getJob(jobId);
            if (job?.repoUrl) addLog("> " + job.repoUrl + "/actions");
          }
        }
        setBuildError("Build failed. Check the logs above.");
        syncStatus?.("failure", { error: "Build failed", completedAt: Date.now() });
        persistBuild?.({ completedAt: Date.now() });
        buildComplete = true;
      } else if (statusData?.status === "waiting") {
        if (pollCount % 3 === 0) addLog("> ... waiting for build to start");
      } else {
        if (pollCount % 3 === 0) addLog("> ... compiling (" + pollCount + "/" + maxPolls + ")");
      }
    }

    if (!buildComplete) {
      addLog("> ⚠ Build timed out after 10 minutes.");
      setBuildError("Build timed out.");
      syncStatus?.("timeout", { completedAt: Date.now() });
      persistBuild?.({ completedAt: Date.now() });
    }
  } catch (cloudErr: any) {
    addLog("> ⚠ Cloud build error: " + (cloudErr?.message || "Unknown"));
    setBuildError(cloudErr?.message || "Build failed");
    syncStatus?.("failure", { error: cloudErr?.message, completedAt: Date.now() });
    persistBuild?.({ completedAt: Date.now() });
  }
}

// ── Shared APK download helper ──
async function downloadApkArtifact(
  addLog: (msg: string) => void,
  setApkBlob: (b: Blob | null) => void,
  setGeneratedZip: (b: Blob | null) => void,
  setBuildError: (e: string | null) => void,
  repoName: string,
  runId: number | undefined,
  jobId?: string,
  syncStatus?: (status: any, extra?: any) => void,
  persistBuild?: (updates: any) => Promise<void>,
) {
  try {
    await delay(500);
    const { data: { session: dlSession } } = await supabase.auth.getSession();
    const { data: artifactData, error: dlError } = await supabase.functions.invoke("build-apk", {
      body: {
        action: "download",
        repoName,
        runId,
        // Passed so the edge function can upload directly to
        // build-artifacts/{userId}/{jobId}/app.apk via the service role,
        // bypassing the JSON response size limit for large APKs.
        userId: dlSession?.user.id,
        jobId,
      },
    });

    // We now accept the download even when artifactBase64 is null, because the
    // edge function may have uploaded the APK/AAB straight to storage.
    if (dlError || (!artifactData?.artifactBase64 && !artifactData?.apk?.storagePath && !artifactData?.aab?.storagePath)) {
      addLog("> ⚠ Could not download APK automatically.");
      setBuildError("Could not download APK. Check GitHub Actions.");
      return;
    }


    // ── Local blob extraction (only when base64 was inlined for small artifacts) ──
    let apkData: Blob | null = null;
    let aabBlob: Blob | null = null;
    let artifactZip: any = null;

    if (artifactData.artifactBase64) {
      const artifactBinary = atob(artifactData.artifactBase64);
      const artifactBytes = new Uint8Array(artifactBinary.length);
      for (let i = 0; i < artifactBinary.length; i++) artifactBytes[i] = artifactBinary.charCodeAt(i);
      artifactZip = await JSZip.loadAsync(artifactBytes);
      const apkFile = Object.keys(artifactZip.files).find((n: string) => n.endsWith(".apk"));
      if (apkFile) {
        apkData = await artifactZip.files[apkFile].async("blob");
        try {
          addLog("> ── Validating APK ──");
          const validation = await validateApkArtifact(artifactZip);
          for (const log of validationToLogs(validation)) addLog("> " + log);
        } catch { addLog("> ⚠ APK validation skipped"); }
        setApkBlob(apkData);
        if (jobId) useBuildStore.getState().updateJob(jobId, { apkBlob: apkData });
        addLog("> ✓ APK extracted! (" + (apkData.size / (1024 * 1024)).toFixed(1) + " MB)");
      }
      const aabFile = Object.keys(artifactZip.files).find((n: string) => n.endsWith(".aab"));
      if (aabFile) {
        aabBlob = await artifactZip.files[aabFile].async("blob");
        addLog("> ✓ AAB extracted! (" + (aabBlob.size / (1024 * 1024)).toFixed(1) + " MB)");
      }
    }

    // === Persist storage paths to the builds table ===
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && jobId) {
        const updateData: { apk_url?: string; aab_url?: string } = {};

        // Prefer the server-uploaded path (bypasses response size limits entirely).
        let apkPath: string | null = artifactData?.apk?.storagePath || null;
        let aabPath: string | null = artifactData?.aab?.storagePath || null;

        if (apkPath) {
          addLog(`> ✓ APK saved to cloud storage by server (${((artifactData.apk?.size || 0) / 1048576).toFixed(1)} MB)`);
        } else if (apkData) {
          // Fallback: client-side upload when server didn't upload (e.g. small artifact).
          apkPath = `${session.user.id}/${jobId}/app.apk`;
          addLog(`> Uploading APK to cloud storage (${(apkData.size / 1048576).toFixed(1)} MB)...`);
          const { error } = await supabase.storage
            .from("build-artifacts")
            .upload(apkPath, apkData, { upsert: true, contentType: "application/vnd.android.package-archive" });
          if (error) {
            addLog("> ⚠ APK upload failed: " + error.message);
            apkPath = null;
          }
        }

        if (aabPath) {
          addLog(`> ✓ AAB saved to cloud storage by server`);
        } else if (aabBlob) {
          aabPath = `${session.user.id}/${jobId}/app.aab`;
          const { error } = await supabase.storage
            .from("build-artifacts")
            .upload(aabPath, aabBlob, { upsert: true, contentType: "application/octet-stream" });
          if (error) {
            addLog("> ⚠ AAB upload failed: " + error.message);
            aabPath = null;
          }
        }

        if (apkPath) updateData.apk_url = apkPath;
        if (aabPath) updateData.aab_url = aabPath;

        if (Object.keys(updateData).length > 0) {
          await supabase.from("builds").update(updateData).eq("id", jobId);
          useBuildStore.getState().updateJob(jobId, {
            apkUrl: updateData.apk_url || undefined,
            aabUrl: updateData.aab_url || undefined,
          });
          addLog("> ✓ Artifacts recorded on builds table");
        } else {
          addLog("> ⚠ No artifact paths recorded — check GitHub Actions run for the raw files.");
        }


          // === Capture and save keystore from build ===
          if (artifactData?.keystore?.base64) {
            try {
              const ksBinary = atob(artifactData.keystore.base64);
              const ksBytes = new Uint8Array(ksBinary.length);
              for (let i = 0; i < ksBinary.length; i++) ksBytes[i] = ksBinary.charCodeAt(i);
              // This is a zip containing keystore-export.b64 - extract it
              const ksZip = await JSZip.loadAsync(ksBytes);
              const b64File = Object.keys(ksZip.files).find(f => f.endsWith(".b64"));
              if (b64File) {
                const b64Content = await ksZip.files[b64File].async("text");
                const jksBinary = atob(b64Content.trim());
                const jksBytes = new Uint8Array(jksBinary.length);
                for (let i = 0; i < jksBinary.length; i++) jksBytes[i] = jksBinary.charCodeAt(i);
                const jksBlob = new Blob([jksBytes], { type: "application/octet-stream" });

                const { data: buildData } = await supabase.from("builds").select("project_id").eq("id", jobId).maybeSingle();
                const projId = buildData?.project_id;

                const ksStoragePath = `${session.user.id}/${projId || jobId}/${Date.now()}-build.jks`;
                const { error: ksUploadErr } = await supabase.storage
                  .from("build-artifacts")
                  .upload(ksStoragePath, jksBlob, { upsert: true });

                if (!ksUploadErr && projId) {
                  // Save keystore record with default passwords
                  await supabase.from("keystores").upsert({
                    user_id: session.user.id,
                    project_id: projId,
                    key_alias: "auto-generated",
                    signing_mode: "debug",
                    keystore_path: ksStoragePath,
                    is_active: true,
                    store_password_encrypted: "android",
                    key_password_encrypted: "android",
                  } as any, { onConflict: "user_id,project_id,key_alias" });
                  addLog("> ✓ Keystore captured and saved");
                }
              }
            } catch (ksErr) {
              addLog("> ⚠ Keystore capture skipped");
            }
          }

          // === Save signing key fingerprints ===
          if (artifactData?.fingerprints || (artifactData as any)?.errorInfo?.fingerprints) {
            const fp = artifactData?.fingerprints || (artifactData as any)?.errorInfo?.fingerprints;
            if (fp?.sha1 || fp?.sha256) {
              try {
                const { data: buildData } = await supabase.from("builds").select("project_id").eq("id", jobId).maybeSingle();
                const projectId = buildData?.project_id;
                
                // Update existing keystore with fingerprints if exists, or insert new
                // Try to update any existing keystore for this project first
                const { data: existingKs } = await supabase.from("keystores")
                  .select("id")
                  .eq("user_id", session.user.id)
                  .eq("project_id", projectId)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (existingKs) {
                  await supabase.from("keystores").update({
                    sha1: fp.sha1 || null,
                    sha256: fp.sha256 || null,
                    md5: fp.md5 || null,
                  }).eq("id", existingKs.id);
                } else {
                  // Only insert if no keystore exists for this project at all
                  const { error: insertErr } = await supabase.from("keystores").insert({
                    user_id: session.user.id,
                    project_id: projectId,
                    key_alias: "auto-extracted",
                    signing_mode: "debug",
                    sha1: fp.sha1 || null,
                    sha256: fp.sha256 || null,
                    md5: fp.md5 || null,
                    is_active: true,
                    store_password_encrypted: "android",
                    key_password_encrypted: "android",
                  });
                  if (insertErr) {
                    console.warn("Keystore insert conflict, updating instead:", insertErr.message);
                    // Fallback: find any keystore and update it
                    const { data: fallbackKs } = await supabase.from("keystores")
                      .select("id")
                      .eq("user_id", session.user.id)
                      .eq("project_id", projectId)
                      .limit(1)
                      .maybeSingle();
                    if (fallbackKs) {
                      await supabase.from("keystores").update({
                        sha1: fp.sha1 || null,
                        sha256: fp.sha256 || null,
                        md5: fp.md5 || null,
                      }).eq("id", fallbackKs.id);
                    }
                  }
                }
                addLog("> ✓ Signing fingerprints saved to project");
              } catch (ksErr) {
                addLog("> ⚠ Could not save signing fingerprints");
              }
            }
          }
        }
      } catch (storageErr: any) {
        addLog("> ⚠ Storage upload skipped: " + (storageErr?.message || "Unknown"));
      }

      syncStatus?.("success", { completedAt: Date.now() });
      persistBuild?.({ completedAt: Date.now() });

      // Save source_repo_name for incremental rebuilds (do NOT delete repo)
      if (repoName && jobId) {
        addLog("> ✓ Repository preserved for incremental rebuilds");
        useBuildStore.getState().updateJob(jobId, { sourceRepoName: repoName });
        try {
          await supabase.from("builds").update({ source_repo_name: repoName }).eq("id", jobId);
        } catch {}
      }
  } catch (dlErr: any) {

    addLog("> ⚠ Download error: " + (dlErr?.message || "Unknown"));
    setBuildError("Download failed.");
  }
}

// ── Workflow YAML for prebuilt projects ──
function getPrebuiltWorkflowYml(): string {
  return `name: Build APK
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
      - name: Generate Gradle Wrapper
        run: |
          gradle wrapper --gradle-version 8.10.2
          chmod +x gradlew
      - name: Build Debug APK
        run: ./gradlew assembleDebug --no-daemon --stacktrace
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: debug-apk
          path: app/build/outputs/apk/debug/*.apk
          retention-days: 7
          if-no-files-found: error
`;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const engineLabel = (e: EngineType) => {
  switch (e) {
    case "capacitor": return "Capacitor";
    case "ionic": return "Ionic + Capacitor";
    case "twa": return "TWA";
    case "electron": return "Electron";
    default: return "WebView";
  }
};

export default BuildPipeline;
