import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import {
  FileCode2,
  CheckCircle2,
  Globe,
  Loader2,
  Sparkles,
  Rocket,
  AlertTriangle,
  Smartphone,
  Apple,
  FileArchive,
  Monitor,
  ArrowLeft,
  ArrowRight,
  Shield,
  Zap,
  Info,
  Github,
  Lock,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { EngineType } from "@/components/converter/EngineSelector";
import { useProjectStore, flattenProjectFiles } from "@/stores/projectStore";
import { useBuildStore } from "@/stores/buildStore";
import BuildPipeline from "@/components/converter/BuildPipeline";
import AIActivityFeed, { type ActivityAction } from "@/components/create/AIActivityFeed";
import GitHubImport from "@/components/create/GitHubImport";
import PluginSecretsForm from "@/components/create/PluginSecretsForm";
import AIRepairStep, { type RepairOutcome } from "@/components/create/AIRepairStep";
import { scanProject, type ProjectScanResult } from "@/lib/tools/projectScanner";
import { scanReactReadiness, type ReactReadinessReport } from "@/lib/tools/reactReadinessScan";
import { collectFindings } from "@/lib/repair/readinessAgent";
import androidIcon from "@/assets/platforms/android.svg";
import appleIcon from "@/assets/platforms/apple.svg";
import windowsIcon from "@/assets/platforms/windows.svg";
import linuxIcon from "@/assets/platforms/linux.svg";
import macosIcon from "@/assets/platforms/macos.svg";

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-with-ai`;

type Phase = "drop" | "analyzing" | "repair" | "confirm" | "review";
type OutputMode = "apk" | "project" | "ios" | "desktop";
type DesktopPlatform = "windows" | "macos" | "linux";

interface AIMetadata {
  appName: string;
  description?: string;
  framework: string;
  packageManager?: string;
  hasFavicon?: boolean;
  faviconPath?: string;
  suggestedEngine: EngineType;
  engineReason?: string;
  suggestedPlugins?: string[];
  issues?: { severity: string; message: string; file?: string }[];
  analysisSteps?: { action: string; finding: string }[];
  assurance: "high" | "medium" | "low";
  assuranceMessage: string;
  buildCommand?: string;
  outputDir?: string;
  entryPoint?: string;
}

const CreateFlow = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: projectId } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("drop");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<AIMetadata | null>(null);
  const [aiChatContent, setAiChatContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  /* Conflict repair — when the readiness scan finds blockers/conflicts the AI
     runs in the Copilot timeline and patches the tree before the project is created. */
  const [repairScan, setRepairScan] = useState<ProjectScanResult | null>(null);
  const [repairReadiness, setRepairReadiness] = useState<ReactReadinessReport | null>(null);
  const [repairOutcome, setRepairOutcome] = useState<RepairOutcome | null>(null);

  const [activityActions, setActivityActions] = useState<ActivityAction[]>([]);

  const [appName, setAppName] = useState("");
  const [packageName, setPackageName] = useState("com.app.myapp");
  const [engine, setEngine] = useState<EngineType>("webview");
  const [outputMode, setOutputMode] = useState<OutputMode>("apk");
  const [desktopPlatforms, setDesktopPlatforms] = useState<Set<DesktopPlatform>>(new Set(["windows"]));
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildDone, setBuildDone] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [showGitHubImport, setShowGitHubImport] = useState(false);
  const [signingMode, setSigningMode] = useState<"debug" | "release">("debug");
  const [keystorePassword, setKeystorePassword] = useState("");
  const [keyAlias, setKeyAlias] = useState("release-key");
  const [keyPassword, setKeyPassword] = useState("");
  const [pluginSecrets, setPluginSecrets] = useState<Record<string, string>>({});
  const [pluginFileSecrets, setPluginFileSecrets] = useState<Record<string, File>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { files, enabledPlugins, loadFromZip, setFiles, setBuildAppName, setBuildPackageName, setSelectedEngine } = useProjectStore();
  const addJob = useBuildStore((s) => s.addJob);

  // Handle rebuild from BuildsView or autostart from action panel
  const rebuildJobId = searchParams.get("rebuild");
  const rebuildAppName = searchParams.get("appName");
  const rebuildPackageName = searchParams.get("packageName");
  const rebuildEngine = searchParams.get("engine") as EngineType | null;
  const autoStart = searchParams.get("autostart") === "1";

  useEffect(() => {
    if (rebuildJobId && rebuildAppName) {
      setAppName(rebuildAppName);
      setPackageName(rebuildPackageName || "com.app.myapp");
      if (rebuildEngine) setEngine(rebuildEngine);
      setPhase("review");
    }
  }, [rebuildJobId, rebuildAppName, rebuildPackageName, rebuildEngine]);

  useEffect(() => {
    if (appName.trim()) setBuildAppName(appName.trim());
  }, [appName, setBuildAppName]);

  useEffect(() => {
    if (packageName.trim()) setBuildPackageName(packageName.trim());
  }, [packageName, setBuildPackageName]);

  useEffect(() => {
    setSelectedEngine(engine);
  }, [engine, setSelectedEngine]);

  useEffect(() => {
    if (!autoStart || files.length === 0 || isBuilding || buildDone || phase !== "review") return;
    handleBuild();
  }, [autoStart, files.length, isBuilding, buildDone, phase]);

  const addActivity = useCallback((type: ActivityAction["type"], title: string, status: ActivityAction["status"] = "active", detail?: string): string => {
    const id = crypto.randomUUID();
    setActivityActions(prev => [...prev, { id, type, title, status, startedAt: status === "active" ? Date.now() : undefined, detail }]);
    return id;
  }, []);

  const updateActivity = useCallback((id: string, updates: Partial<ActivityAction>) => {
    setActivityActions(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const extractFavicon = useCallback((fileList: any[], faviconPath?: string) => {
    if (!faviconPath) return null;
    const file = fileList.find(
      (f: any) => f.path === faviconPath || f.path.endsWith(faviconPath.split("/").pop() || "")
    );
    if (file?.binaryContent) {
      const ext = file.extension || "png";
      const mime = ext === "ico" ? "image/x-icon" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
      const blob = new Blob([file.binaryContent], { type: mime });
      return URL.createObjectURL(blob);
    }
    return null;
  }, []);

  const streamAnalysis = useCallback(async (fileList: string[], indexHtmlContent: string | null, packageJsonContent: string | null, totalFiles: number, totalSize: string) => {
    setIsStreaming(true);
    setAiChatContent("");

    try {
      const resp = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ fileList, indexHtmlContent, packageJsonContent, totalFiles, totalSize, stream: true }),
      });

      if (resp.status === 429) { toast.error("Rate limit exceeded."); setPhase("drop"); setIsStreaming(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted."); setPhase("drop"); setIsStreaming(false); return; }
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) { fullContent += content; setAiChatContent(fullContent); }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) { fullContent += content; setAiChatContent(fullContent); }
          } catch {}
        }
      }
      setIsStreaming(false);
    } catch (e) {
      console.error("Stream error:", e);
      setAiChatContent("⚠️ AI analysis stream failed. Falling back to structured analysis...");
      setIsStreaming(false);
    }
  }, []);

  const runAnalysis = useCallback(async () => {
    setPhase("analyzing");
    setAiChatContent("");
    setActivityActions([]);
    setAnalysisComplete(false);

    try {
      const allFiles = flattenProjectFiles(files);
      const fileList = allFiles.filter((f: any) => f.type === "file").map((f: any) => f.path);
      const indexHtml = allFiles.find((f: any) => f.name === "index.html");
      const packageJson = allFiles.find((f: any) => f.name === "package.json");
      const totalSize = `${(allFiles.reduce((s: number, f: any) => s + (f.size || 0), 0) / 1024).toFixed(0)} KB`;

      const a1 = addActivity("tool_call", "Scanning project files", "active");
      await new Promise(r => setTimeout(r, 300));
      updateActivity(a1, { status: "done", elapsed: 0.3, detail: `Found ${fileList.length} files (${totalSize})` });

      const a2 = addActivity("thinking", "Understanding project architecture", "active");

      const streamPromise = streamAnalysis(fileList, indexHtml?.content || null, packageJson?.content || null, fileList.length, totalSize);

      const metadataPromise = fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          fileList, indexHtmlContent: indexHtml?.content || null, packageJsonContent: packageJson?.content || null, totalFiles: fileList.length, totalSize,
        }),
      }).then(r => r.ok ? r.json() : null).catch(() => null);

      const [, data] = await Promise.all([streamPromise, metadataPromise]);

      updateActivity(a2, { status: "done", elapsed: 2.0, detail: "Analysis complete" });

      if (data && !data.error) {
        setMetadata(data);
        setAppName(data.appName || "MyApp");
        setEngine(data.suggestedEngine || "capacitor");
        const slug = (data.appName || "myapp").toLowerCase().replace(/[^a-z0-9]/g, "");
        setPackageName(`com.app.${slug}`);
        addActivity("tool_result", `Detected: ${data.appName} (${data.framework})`, "done", `Engine: ${data.suggestedEngine} — ${data.engineReason || "Best fit"}`);
        if (data.hasFavicon && data.faviconPath) {
          const iconUrl = extractFavicon(allFiles, data.faviconPath);
          if (iconUrl) setIconDataUrl(iconUrl);
        }
        if (data.suggestedPlugins?.length > 0) {
          addActivity("tool_result", `Suggested plugins: ${data.suggestedPlugins.join(", ")}`, "done");
        }
        addActivity("success", `Build confidence: ${data.assuranceMessage}`, "done");
      } else {
        const scanResult = useProjectStore.getState().scanResult;
        if (scanResult) {
          setMetadata({
            appName: "MyApp", framework: scanResult.framework, suggestedEngine: "capacitor",
            engineReason: "Capacitor provides the best native bridge",
            assurance: scanResult.assurance, assuranceMessage: scanResult.assuranceMessage,
            issues: scanResult.issues,
          });
        }
        setAppName("MyApp");
        setEngine("capacitor");
        addActivity("success", "Analysis complete (fallback mode)", "done");
      }

      addActivity("question", "Review the settings, then click Next to continue →", "done");
      setAnalysisComplete(true);
    } catch (e) {
      console.error("Analysis error:", e);
      toast.error("AI analysis failed. Using local analysis.");
      addActivity("error", "Analysis failed — using defaults", "error");
      setAnalysisComplete(true);
    }
  }, [files, extractFavicon, streamAnalysis, addActivity, updateActivity]);

  useEffect(() => {
    if (files.length > 0 && phase === "drop" && uploadedFileName) {
      runAnalysis();
    }
  }, [files.length]);

  const handleFileUpload = async (file: File) => {
    setUploadedFileName(file.name);
    await loadFromZip(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".zip") || file.name.endsWith(".tar.gz"))) {
        handleFileUpload(file);
      }
    },
    [loadFromZip]
  );

  const handleUrlSubmit = () => {
    if (!url.startsWith("http")) {
      toast.error("Enter a valid URL starting with http");
      return;
    }
    setMetadata({
      appName: new URL(url).hostname.split(".")[0] || "WebApp",
      framework: "Web URL",
      suggestedEngine: "webview",
      engineReason: "WebView is ideal for wrapping existing websites",
      assurance: "high",
      assuranceMessage: "URL-based apps have high build success rates",
    });
    setAppName(new URL(url).hostname.split(".")[0] || "WebApp");
    setEngine("webview");
    const slug = new URL(url).hostname.replace(/[^a-z0-9]/g, "");
    setPackageName(`com.app.${slug}`);
    setPhase("confirm");
  };

  const handleConfirmAndProceed = () => {
    setPhase("review");
  };

  /**
   * Gate between analysis and confirmation: run the deterministic readiness
   * scan and, if it finds conflicts, hand the project to the repair agent
   * instead of carrying a broken tree into the build.
   */
  const handleAnalysisNext = useCallback(() => {
    try {
      const flat = flattenProjectFiles(useProjectStore.getState().files) as any[];
      const scan = scanProject(flat);
      const readiness = scan.framework === "react" || scan.hasPackageJson ? scanReactReadiness(flat, scan) : null;
      const findings = collectFindings(scan, readiness);
      if (findings.length > 0) {
        setRepairScan(scan);
        setRepairReadiness(readiness);
        setRepairOutcome(null);
        setPhase("repair");
        return;
      }
    } catch (e) {
      console.error("Readiness scan failed:", e);
    }
    setPhase("confirm");
  }, []);

  const handleBuild = () => {
    const errors: string[] = [];
    if (!appName.trim()) errors.push("App name is required");
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) errors.push("Invalid package name");
    if (errors.length) {
      errors.forEach((e) => toast.error(e));
      return;
    }

    const jobId = crypto.randomUUID();
    addJob({
      id: jobId, appName, packageName, engine, status: "queued",
      stage: "Starting...", logs: [], startedAt: Date.now(), autoDeleteRepo: true,
      projectId: projectId || undefined,
    });
    setCurrentJobId(jobId);
    setIsBuilding(true);
  };

  const toggleDesktopPlatform = (p: DesktopPlatform) => {
    setDesktopPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const assuranceClass =
    metadata?.assurance === "high" ? "shiny-assurance"
      : metadata?.assurance === "medium" ? "shiny-assurance-medium"
      : "shiny-assurance-low";

  const resetFlow = () => {
    setPhase("drop"); setFiles([]); setUploadedFileName(null); setMetadata(null);
    setIsBuilding(false); setBuildDone(false); setAiChatContent("");
    setActivityActions([]); setAnalysisComplete(false);
  };

  // ─── DROP PHASE ─────────────────────────────────────────
  // Check if files already exist in store (from Source Code page upload)
  const hasExistingSource = files.length > 0 && !uploadedFileName;

  if (phase === "drop") {
    // If source already loaded, skip drop zone and go to analysis
    if (hasExistingSource) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Source Code Ready</h1>
            <p className="text-sm text-muted-foreground">
              Using uploaded source code ({flattenProjectFiles(files).filter(f => f.type === "file").length} files)
            </p>
          </div>

          <div className="w-full max-w-md space-y-4">
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Source code detected</p>
                <p className="text-xs text-muted-foreground">Files from the Source Code page will be used for this build</p>
              </div>
            </div>

            <Button size="lg" className="w-full gap-2 h-12" onClick={() => { setUploadedFileName("existing"); runAnalysis(); }}>
              <Rocket size={18} /> Analyze & Build
            </Button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={() => { setFiles([]); }}>
              <FileCode2 size={14} /> Upload different source
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Drop your project</h1>
          <p className="text-sm text-muted-foreground">Upload a ZIP file or enter a URL — AI will handle the rest</p>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`drop-zone-circle cursor-pointer transition-all duration-300 ${isDragging ? "dragging scale-105" : "hover:scale-[1.02]"}`}
        >
          <div className={`outer-ring transition-all duration-500 ${isDragging ? "animate-[spin_8s_linear_infinite] border-primary/40" : "animate-[spin_20s_linear_infinite]"}`} />
          <div className={`flex flex-col items-center transition-transform duration-300 ${isDragging ? "scale-110" : ""}`}>
            <FileCode2 size={42} className={`mb-3 transition-colors duration-300 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-sm font-semibold text-foreground">Drop ZIP here</span>
            <span className="text-xs text-primary mt-1 hover:underline">or browse files</span>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept=".zip,.tar.gz" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }} className="hidden" />

        <div className="flex items-center gap-4 my-6 sm:my-8 w-full max-w-md">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or enter a URL</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex gap-2 w-full max-w-md">
          <Input type="url" placeholder="https://myapp.com" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 bg-secondary border-border font-mono text-sm" onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()} />
          <Button onClick={handleUrlSubmit} disabled={!url.startsWith("http")}>
            <Globe size={16} className="mr-2" />
            Analyze
          </Button>
        </div>

        <div className="flex items-center gap-4 my-6 w-full max-w-md">
          <div className="flex-1 h-px bg-border" />
          <button
            onClick={() => setShowGitHubImport(!showGitHubImport)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <Github size={14} />
            Import from GitHub
          </button>
          <div className="flex-1 h-px bg-border" />
        </div>

        {showGitHubImport && (
          <div className="w-full max-w-md rounded-xl bg-card p-4">
            <GitHubImport onImported={() => { setUploadedFileName("GitHub Import"); runAnalysis(); }} />
          </div>
        )}
      </div>
    );
  }

  // ─── ANALYZING PHASE (Two-column: AI feed + settings preview) ──────
  if (phase === "analyzing") {
    return (
      <div className="h-screen flex flex-col">
        <div className="shrink-0 px-4 py-3 flex items-center gap-3 bg-background/80 backdrop-blur-md">
          <button onClick={resetFlow} className="p-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft size={16} className="text-muted-foreground" />
          </button>
          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles size={13} className="text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">ForgeAI</span>
          {isStreaming && <span className="ml-auto text-[11px] shimmer-text font-medium">analyzing...</span>}
          {analysisComplete && !isStreaming && (
            <Button size="sm" className="ml-auto gap-1.5 animate-fade-in" onClick={handleAnalysisNext}>
              Next <ArrowRight size={14} />
            </Button>
          )}
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Activity Feed */}
          <div className="flex-1 md:w-[60%] overflow-y-auto p-4">
            <AIActivityFeed actions={activityActions} />
            {aiChatContent && (
              <div className="mt-4 px-1">
                <div className={`ai-chat-prose text-sm ${isStreaming ? "ai-chat-streaming" : ""}`}>
                  {aiChatContent.split("\n").map((line, i) => (
                    <p key={i} className="text-foreground/80 leading-relaxed mb-1">{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Settings Preview */}
          <div className="md:w-[40%] overflow-y-auto p-4 bg-card/50">
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detected Settings</h3>
              {metadata ? (
                <>
                  <div className="space-y-3">
                    <div>
                      <span className="text-muted-foreground text-[10px]">App Name</span>
                      <Input value={appName} onChange={(e) => setAppName(e.target.value)} className="mt-1 bg-secondary border-border text-sm h-9" />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Package Name</span>
                      <Input value={packageName} onChange={(e) => setPackageName(e.target.value)} className="mt-1 bg-secondary border-border font-mono text-xs h-9" />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Framework</span>
                      <div className="mt-1 text-sm text-foreground font-medium">{metadata.framework}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Engine</span>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {(["webview", "capacitor", "twa", "ionic"] as EngineType[]).map((e) => (
                          <button key={e} onClick={() => setEngine(e)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${engine === e ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted/40 text-muted-foreground border border-transparent hover:border-border"}`}>
                            {e.charAt(0).toUpperCase() + e.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Icon</span>
                      <div className="mt-1 flex items-center gap-2">
                        {iconDataUrl ? (
                          <img src={iconDataUrl} alt="App icon" className="w-10 h-10 rounded-xl" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                            <FileCode2 size={16} className="text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-background/80 p-3 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Build Confidence</span>
                    <p className={`text-sm font-bold mt-1 ${assuranceClass}`}>{metadata.assuranceMessage}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── REPAIR PHASE (AI resolves conflicts in the timeline) ──────
  if (phase === "repair" && repairScan) {
    return (
      <div className="h-screen flex flex-col animate-fade-in">
        <div className="shrink-0 px-4 py-3 flex items-center gap-3 bg-background/80 backdrop-blur-md">
          <button onClick={() => setPhase("analyzing")} className="p-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft size={16} className="text-muted-foreground" />
          </button>
          <div>
            <div className="text-sm font-semibold text-foreground">Resolving conflicts</div>
            <p className="text-[11px] text-muted-foreground">
              The agent is patching your project so it compiles on our runners — you don't need to fix anything.
            </p>
          </div>
          <Button
            size="sm"
            className="ml-auto gap-1.5"
            variant={repairOutcome?.clean ? "default" : "outline"}
            onClick={() => setPhase("confirm")}
          >
            {repairOutcome?.clean ? "Continue" : "Continue anyway"} <ArrowRight size={14} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <div className="max-w-3xl mx-auto">
            <AIRepairStep
              scan={repairScan}
              readiness={repairReadiness}
              entry={repairScan.entryCandidates?.[0] ?? null}
              appRoot={repairScan.entryCandidates?.[0]?.projectRoot ?? ""}
              buildCommand={metadata?.buildCommand || repairScan.buildScript || "npm run build"}
              outputDir={metadata?.outputDir || repairScan.outputDir || "dist"}
              engine={engine}
              onOutcome={setRepairOutcome}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── CONFIRM PHASE (approval gate before build config) ──────
  if (phase === "confirm") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 animate-fade-in">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Analysis Complete</h2>
            <p className="text-muted-foreground text-sm">Review the detected settings and proceed to build configuration</p>
          </div>

          {metadata && (
            <div className="rounded-xl bg-card p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">App Name</span>
                  <Input value={appName} onChange={(e) => setAppName(e.target.value)} className="mt-1 bg-secondary border-border text-sm h-9" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Package</span>
                  <Input value={packageName} onChange={(e) => setPackageName(e.target.value)} className="mt-1 bg-secondary border-border font-mono text-xs h-9" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Framework</span>
                  <p className="text-sm font-medium text-foreground">{metadata.framework}</p>
                </div>
                <div className="ml-auto">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Engine</span>
                  <p className="text-sm font-medium text-primary capitalize">{engine}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {iconDataUrl ? (
                  <img src={iconDataUrl} alt="App icon" className="w-10 h-10 rounded-xl" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <FileCode2 size={16} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <div className={`text-sm font-bold ${assuranceClass}`}>{metadata.assuranceMessage}</div>
                  <span className="text-[10px] text-muted-foreground">Build Confidence</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={resetFlow} className="flex-1 gap-2">
              <ArrowLeft size={14} /> Start Over
            </Button>
            <Button onClick={handleConfirmAndProceed} className="flex-1 gap-2">
              Continue to Build <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── REVIEW PHASE ──────────────────────────────────────
  return (
    <div className="min-h-screen w-full pb-32">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <button onClick={() => setPhase("confirm")} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Build Configuration</h1>
        {metadata && (
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles size={12} className="text-primary" /> AI-powered
          </span>
        )}
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-6">
        {/* Assurance banner */}
        {metadata && (
          <div className="rounded-xl bg-card border border-border p-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {metadata.assurance === "high" ? <Shield size={20} className="text-primary" />
                : metadata.assurance === "medium" ? <Info size={20} className="text-[hsl(var(--warning))]" />
                : <AlertTriangle size={20} className="text-destructive" />}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Build Confidence</span>
            </div>
            <p className={`text-lg font-bold ${assuranceClass}`}>{metadata.assuranceMessage}</p>
          </div>
        )}

        {/* AI-detected info */}
        {metadata && (
          <div className="rounded-xl bg-card border border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap size={14} className="text-primary" /> Detected by AI
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">App Name</span>
                <Input value={appName} onChange={(e) => setAppName(e.target.value)} className="mt-1 bg-secondary border-border text-sm h-9" />
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Package Name</span>
                <Input value={packageName} onChange={(e) => setPackageName(e.target.value)} className="mt-1 bg-secondary border-border font-mono text-xs h-9" />
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Framework</span>
                <div className="mt-1 text-foreground font-medium">{metadata.framework}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Icon</span>
                <div className="mt-1 flex items-center gap-2">
                  {iconDataUrl ? (
                    <img src={iconDataUrl} alt="App icon" className="w-8 h-8 rounded-lg" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <FileCode2 size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">{iconDataUrl ? "From project" : "Default icon"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Engine recommendation */}
        {metadata && (
          <div className="rounded-xl bg-card border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-primary" /> Recommended Engine
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-foreground font-bold capitalize">{engine}</span>
              {metadata.engineReason && <span className="text-xs text-muted-foreground">— {metadata.engineReason}</span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["webview", "capacitor", "twa", "ionic", "electron", "tauri"] as EngineType[]).map((e) => (
                <button key={e} onClick={() => setEngine(e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${engine === e ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted/40 text-muted-foreground border border-transparent hover:border-border"}`}>
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Issues */}
        {metadata?.issues && metadata.issues.length > 0 && (
          <div className="rounded-xl bg-card border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-[hsl(var(--warning))]" /> Issues Found ({metadata.issues.length})
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {metadata.issues.slice(0, 15).map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {issue.severity === "error" ? <AlertTriangle size={12} className="text-destructive mt-0.5 shrink-0" />
                    : issue.severity === "warning" ? <AlertTriangle size={12} className="text-[hsl(var(--warning))] mt-0.5 shrink-0" />
                    : <Info size={12} className="text-[hsl(var(--info))] mt-0.5 shrink-0" />}
                  <span className="text-muted-foreground">
                    {issue.file && <span className="text-foreground font-mono">{issue.file}: </span>}
                    {issue.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Output format */}
        {!isBuilding && !buildDone && (
          <div className="rounded-xl bg-card border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Build Target</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { mode: "apk" as OutputMode, icon: <img src={androidIcon} alt="Android" className="w-7 h-7" />, label: "Android", sub: "APK / AAB" },
                { mode: "ios" as OutputMode, icon: <img src={appleIcon} alt="iOS" className="w-7 h-7" />, label: "iOS", sub: "iPhone / iPad" },
                { mode: "desktop" as OutputMode, icon: <Monitor size={24} className={outputMode === "desktop" ? "text-primary" : ""} />, label: "Desktop", sub: "Electron" },
                { mode: "project" as OutputMode, icon: <FileArchive size={24} className={outputMode === "project" ? "text-primary" : ""} />, label: "ZIP", sub: "Project files" },
              ].map((t) => (
                <button key={t.mode} onClick={() => setOutputMode(t.mode)}
                  className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-all ${outputMode === t.mode ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                  {t.icon}
                  <div className="text-center">
                    <div className="text-xs font-medium">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground">{t.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            {outputMode === "desktop" && (
              <div className="mt-4 flex gap-2">
                {([
                  { id: "windows" as DesktopPlatform, label: "Windows", icon: windowsIcon },
                  { id: "macos" as DesktopPlatform, label: "macOS", icon: macosIcon },
                  { id: "linux" as DesktopPlatform, label: "Linux", icon: linuxIcon },
                ] as const).map((p) => (
                  <button key={p.id} onClick={() => toggleDesktopPlatform(p.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${desktopPlatforms.has(p.id) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                    <img src={p.icon} alt={p.label} className="w-4 h-4" /> {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Signing Configuration */}
        {!isBuilding && !buildDone && outputMode === "apk" && (
          <div className="rounded-xl bg-card border border-border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock size={14} className="text-primary" /> Signing Configuration
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setSigningMode("debug")}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${signingMode === "debug" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-border/80"}`}>
                Debug (default)
              </button>
              <button onClick={() => setSigningMode("release")}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${signingMode === "release" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-border/80"}`}>
                Release
              </button>
            </div>
            {signingMode === "release" && (
              <div className="space-y-2 pt-1">
                <div>
                  <span className="text-muted-foreground text-[10px]">Key Alias</span>
                  <Input value={keyAlias} onChange={(e) => setKeyAlias(e.target.value)} className="bg-secondary border-border text-xs h-8 mt-0.5" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Keystore Password</span>
                  <Input type="password" value={keystorePassword} onChange={(e) => setKeystorePassword(e.target.value)} className="bg-secondary border-border text-xs h-8 mt-0.5" placeholder="••••••••" />
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Key Password</span>
                  <Input type="password" value={keyPassword} onChange={(e) => setKeyPassword(e.target.value)} className="bg-secondary border-border text-xs h-8 mt-0.5" placeholder="••••••••" />
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Key size={10} /> A debug keystore will be auto-generated if no release keystore is configured.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Plugin Secrets */}
        {!isBuilding && !buildDone && (
          <PluginSecretsForm
            enabledPlugins={Array.from(enabledPlugins)}
            secrets={pluginSecrets}
            fileSecrets={pluginFileSecrets}
            onSecretChange={(key, val) => setPluginSecrets(prev => ({ ...prev, [key]: val }))}
            onFileSecretChange={(key, file) => setPluginFileSecrets(prev => ({ ...prev, [key]: file }))}
          />
        )}

        {/* Build button */}
        {!isBuilding && !buildDone && (
          <>
            {(metadata?.assurance === "low" || metadata?.issues?.some(i => i.severity === "error")) && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive">
                <p className="font-semibold mb-1">❌ Build Blocked</p>
                <p className="text-xs">Your project has critical issues that must be resolved before building.</p>
              </div>
            )}
            <Button size="lg" className="w-full gap-2 h-12 text-base" onClick={handleBuild}
              disabled={!appName.trim() || metadata?.assurance === "low" || !!metadata?.issues?.some(i => i.severity === "error")}>
              <Rocket size={18} />
              {outputMode === "apk" ? "Build Android APK" : outputMode === "ios" ? "Build iOS App" : outputMode === "desktop" ? "Build Desktop App" : "Generate Project ZIP"}
            </Button>
          </>
        )}

        {/* Build pipeline */}
        {(isBuilding || buildDone) && (
          <div className="rounded-xl border border-border p-4">
            <BuildPipeline
              isBuilding={isBuilding}
              onBuildComplete={() => { setIsBuilding(false); setBuildDone(true); }}
              engine={engine}
              enabledPlugins={Array.from(enabledPlugins)}
              appName={appName}
              packageName={packageName}
              url={url || undefined}
              outputMode={outputMode === "desktop" ? "desktop" : outputMode}
              jobId={currentJobId || undefined}
              desktopPlatforms={outputMode === "desktop" ? Array.from(desktopPlatforms) : undefined}
              signingMode={signingMode}
              keystorePassword={keystorePassword || undefined}
              keyAlias={keyAlias || undefined}
              keyPassword={keyPassword || undefined}
              iconDataUrl={iconDataUrl}
              projectId={projectId || undefined}
            />
          </div>
        )}

        {buildDone && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
            <p className="text-sm text-foreground mb-3">Build queued. Track it in the Builds page.</p>
            <Button variant="outline" onClick={() => setSearchParams({ view: "builds" })} className="gap-2">Go to Builds</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateFlow;
