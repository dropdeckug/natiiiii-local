import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Smartphone, Package, Layers, Globe, Puzzle,
  Rocket, AlertTriangle, Download, FileArchive,
} from "lucide-react";
import type { EngineType } from "@/components/converter/EngineSelector";
import BuildPipeline from "@/components/converter/BuildPipeline";

interface ReviewStepProps {
  appName: string;
  packageName: string;
  versionName: string;
  versionCode: string;
  engine: EngineType;
  url: string;
  hasUploadedFiles: boolean;
  uploadedFileName: string | null;
  enabledPlugins: string[];
  hasIcon: boolean;
}

const PACKAGE_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

type OutputMode = "apk" | "project";
type SigningMode = "debug" | "release";

const ReviewStep = ({
  appName,
  packageName,
  versionName,
  versionCode,
  engine,
  url,
  hasUploadedFiles,
  uploadedFileName,
  enabledPlugins,
  hasIcon,
}: ReviewStepProps) => {
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildDone, setBuildDone] = useState(false);
  const [outputMode, setOutputMode] = useState<OutputMode>("apk");
  const [signingMode, setSigningMode] = useState<SigningMode>("debug");

  // Validation
  const errors: string[] = [];
  if (!appName.trim()) errors.push("App name is required");
  if (appName.length > 50) errors.push("App name must be under 50 characters");
  if (!PACKAGE_REGEX.test(packageName)) errors.push("Package name must match com.xxx.xxx format");
  const isUrlEngine = engine === "webview" || engine === "twa";
  if (isUrlEngine && !url.startsWith("http")) errors.push("A valid URL is required for " + engine.toUpperCase());
  if (!isUrlEngine && !hasUploadedFiles && !url) errors.push("Upload project files or enter a URL");

  const engineLabels: Record<EngineType, string> = {
    webview: "WebView",
    capacitor: "Capacitor",
    ionic: "Ionic + Capacitor",
    twa: "TWA",
    electron: "Electron",
  };

  const rows = [
    { icon: Smartphone, label: "App Name", value: appName || "—" },
    { icon: Package, label: "Package", value: packageName || "—" },
    { icon: Layers, label: "Version", value: `${versionName} (${versionCode})` },
    { icon: Layers, label: "Engine", value: engineLabels[engine] },
    { icon: Globe, label: "Source", value: url || uploadedFileName || "—" },
    { icon: Puzzle, label: "Plugins", value: enabledPlugins.length > 0 ? `${enabledPlugins.length} enabled` : "None" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Review & Build</h2>
        <p className="text-sm text-muted-foreground">Confirm your configuration and build</p>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border divide-y divide-border">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
              <Icon size={14} className="text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground w-20">{row.label}</span>
              <span className="text-sm text-foreground font-medium truncate">{row.value}</span>
            </div>
          );
        })}
      </div>

      {/* Signing mode toggle */}
      {!isBuilding && !buildDone && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Signing Mode</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSigningMode("debug")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-all ${
                signingMode === "debug"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              <Download size={14} />
              <div>
                <div className="text-xs font-medium">Debug</div>
                <div className="text-[10px] text-muted-foreground">Auto-signed, for testing</div>
              </div>
            </button>
            <button
              onClick={() => setSigningMode("release")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-all ${
                signingMode === "release"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              <FileArchive size={14} />
              <div>
                <div className="text-xs font-medium">Release</div>
                <div className="text-[10px] text-muted-foreground">For Play Store</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Output mode toggle */}
      {!isBuilding && !buildDone && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Output Format</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setOutputMode("apk")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-all ${
                outputMode === "apk"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              <Download size={14} />
              <div>
                <div className="text-xs font-medium">APK + AAB</div>
                <div className="text-[10px] text-muted-foreground">Ready to install</div>
              </div>
            </button>
            <button
              onClick={() => setOutputMode("project")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-all ${
                outputMode === "project"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              <FileArchive size={14} />
              <div>
                <div className="text-xs font-medium">Project ZIP</div>
                <div className="text-[10px] text-muted-foreground">Open in Android Studio</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle size={12} />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Build button or pipeline */}
      {!isBuilding && !buildDone && (
        <Button
          size="lg"
          className="w-full gap-2"
          disabled={errors.length > 0}
          onClick={() => setIsBuilding(true)}
        >
          <Rocket size={16} />
          {outputMode === "apk" ? "Build APK" : "Build Android Project"}
        </Button>
      )}

      {(isBuilding || buildDone) && (
        <BuildPipeline
          isBuilding={isBuilding}
          onBuildComplete={() => {
            setIsBuilding(false);
            setBuildDone(true);
          }}
          engine={engine}
          enabledPlugins={enabledPlugins}
          appName={appName}
          packageName={packageName}
          url={url || undefined}
          outputMode={outputMode}
          signingMode={signingMode}
        />
      )}
    </div>
  );
};

export default ReviewStep;
