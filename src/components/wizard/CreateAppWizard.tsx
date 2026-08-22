import { useState } from "react";
import { X, Rocket, AlertTriangle, Download, FileArchive, Monitor, Apple, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EngineType } from "@/components/converter/EngineSelector";
import { useProjectStore } from "@/stores/projectStore";
import { useBuildStore } from "@/stores/buildStore";

import AppIdentityStep from "./steps/AppIdentityStep";
import EngineStep from "./steps/EngineStep";
import SourceStep from "./steps/SourceStep";
import PluginsStep from "./steps/PluginsStep";
import BuildPipeline from "@/components/converter/BuildPipeline";

interface CreateAppWizardProps {
  open: boolean;
  onClose: () => void;
}

const PACKAGE_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

type OutputMode = "apk" | "project" | "desktop" | "ios";

const CreateAppWizard = ({ open, onClose }: CreateAppWizardProps) => {
  // App identity
  const [appName, setAppName] = useState("");
  const [packageName, setPackageName] = useState("com.app.myapp");
  const [versionName, setVersionName] = useState("1.0.0");
  const [versionCode, setVersionCode] = useState("1");
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);

  // Engine
  const [engine, setEngine] = useState<EngineType>("webview");

  // Source
  const [url, setUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Build
  const [outputMode, setOutputMode] = useState<OutputMode>("apk");
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildDone, setBuildDone] = useState(false);

  // Desktop platforms
  const [desktopPlatforms, setDesktopPlatforms] = useState<string[]>(["windows", "macos", "linux"]);

  const { files, enabledPlugins, loadFromZip, setFiles } = useProjectStore();
  const addJob = useBuildStore((s) => s.addJob);
  const currentProjectId = useBuildStore((s) => s.currentProjectId);

  const isDesktop = engine === "electron";

  const handleIdentityChange = (data: Record<string, any>) => {
    if (data.appName !== undefined) setAppName(data.appName);
    if (data.packageName !== undefined) setPackageName(data.packageName);
    if (data.versionName !== undefined) setVersionName(data.versionName);
    if (data.versionCode !== undefined) setVersionCode(data.versionCode);
    if (data.iconDataUrl !== undefined) setIconDataUrl(data.iconDataUrl);
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFileName(file.name);
    await loadFromZip(file);
  };

  const toggleDesktopPlatform = (platform: string) => {
    setDesktopPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  // Auto-set output mode when engine changes
  const handleEngineSelect = (e: EngineType) => {
    setEngine(e);
    if (e === "electron") setOutputMode("desktop");
    else if (outputMode === "desktop") setOutputMode("apk");
  };

  const buildButtonLabel = (() => {
    if (isDesktop) return "Build Desktop Apps";
    if (outputMode === "ios") return "Build iOS App";
    if (outputMode === "apk") return "Build APK";
    return "Build Android Project";
  })();

  // Validation
  const errors: string[] = [];
  if (!appName.trim()) errors.push("App name is required");
  if (!PACKAGE_REGEX.test(packageName)) errors.push("Package name must match com.xxx.xxx format");
  const isUrlEngine = engine === "webview" || engine === "twa";
  if (isUrlEngine && !url.startsWith("http")) errors.push("A valid URL is required for " + engine.toUpperCase());
  if (!isUrlEngine && !isDesktop && files.length === 0 && !url) errors.push("Upload project files or enter a URL");
  if (isDesktop && files.length === 0 && !url.startsWith("http")) errors.push("Upload project files or enter a URL for desktop build");
  if (isDesktop && desktopPlatforms.length === 0) errors.push("Select at least one desktop platform");

  const handleBuild = () => {
    // Clear stale uploaded files for URL-based engines to prevent wrong build mode
    if (isUrlEngine && !uploadedFileName) {
      setFiles([]);
    }
    const jobId = crypto.randomUUID();
    addJob({
      id: jobId,
      appName,
      packageName,
      engine,
      status: "queued",
      stage: "Starting...",
      logs: [],
      startedAt: Date.now(),
      projectId: currentProjectId || undefined,
    });
    setIsBuilding(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">+</span>
          </div>
          <span className="text-lg font-semibold text-foreground">Build Configuration</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Single-page content */}
      <div className="flex-1 overflow-y-auto bg-muted/30">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* Section 1: App Identity */}
          <section className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <AppIdentityStep
              data={{ appName, packageName, versionName, versionCode, iconDataUrl }}
              onChange={handleIdentityChange}
            />
          </section>

          {/* Section 2: Engine */}
          <section className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <EngineStep
              selected={engine}
              onSelect={handleEngineSelect}
              hasUrl={url.startsWith("http")}
            />
          </section>

          {/* Section 3: Source */}
          <section className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <SourceStep
              engine={engine}
              url={url}
              onUrlChange={setUrl}
              uploadedFileName={uploadedFileName}
              onFileUpload={handleFileUpload}
              fileCount={files.length}
            />
          </section>

          {/* Section 4: Plugins (collapsible) */}
          <section className="bg-white rounded-xl border border-border p-6 shadow-sm">
            <PluginsStep
              engine={engine}
              enabledCount={enabledPlugins.size}
            />
          </section>

          {/* Section 5: Output Format */}
          {!isBuilding && !buildDone && (
            <section className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-foreground mb-1">Output Format</h2>
              <p className="text-sm text-muted-foreground mb-4">Choose your build output</p>
              {isDesktop ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 px-4 py-3">
                    <Monitor size={18} className="text-primary" />
                    <div>
                      <div className="text-sm font-medium text-foreground">Desktop Apps</div>
                      <div className="text-xs text-muted-foreground">Build for Windows, macOS, and Linux</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "windows", label: "Windows (.exe)" },
                      { id: "macos", label: "macOS (.dmg)" },
                      { id: "linux", label: "Linux (.AppImage)" },
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => toggleDesktopPlatform(p.id)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                          desktopPlatforms.includes(p.id)
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-muted-foreground/40"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setOutputMode("apk")}
                    className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-center transition-all ${
                      outputMode === "apk"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <Smartphone size={20} />
                    <div>
                      <div className="text-sm font-medium">APK</div>
                      <div className="text-[10px] text-muted-foreground">Android</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setOutputMode("ios")}
                    className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-center transition-all ${
                      outputMode === "ios"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <Apple size={20} />
                    <div>
                      <div className="text-sm font-medium">iOS</div>
                      <div className="text-[10px] text-muted-foreground">iPhone/iPad</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setOutputMode("project")}
                    className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-center transition-all ${
                      outputMode === "project"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <FileArchive size={20} />
                    <div>
                      <div className="text-sm font-medium">ZIP</div>
                      <div className="text-[10px] text-muted-foreground">Project files</div>
                    </div>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Validation errors */}
          {errors.length > 0 && !isBuilding && !buildDone && (
            <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle size={14} />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {/* Build pipeline */}
          {(isBuilding || buildDone) && (
            <section className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <BuildPipeline
                isBuilding={isBuilding}
                onBuildComplete={() => {
                  setIsBuilding(false);
                  setBuildDone(true);
                }}
                engine={engine}
                enabledPlugins={Array.from(enabledPlugins)}
                appName={appName}
                packageName={packageName}
                url={url || undefined}
                outputMode={isDesktop ? "desktop" : outputMode}
                desktopPlatforms={desktopPlatforms}
                projectId={undefined}
              />
            </section>
          )}
        </div>
      </div>

      {/* Sticky bottom build button */}
      {!isBuilding && !buildDone && (
        <div className="border-t border-border px-6 py-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <Button
              size="lg"
              className="w-full gap-2 h-12 text-base"
              disabled={errors.length > 0}
              onClick={handleBuild}
            >
              <Rocket size={18} />
              {buildButtonLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateAppWizard;
