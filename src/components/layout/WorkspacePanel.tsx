import { useState } from "react";
import {
  Upload,
  Globe,
  FolderOpen,
  X,
  Smartphone,
  Code2,
  Shield,
  Zap,
  ArrowRight,
  ArrowLeft,
  Package,
  Download,
  Check,
  ChevronRight,
  Settings2,
  Cpu,
  FileInput,
  Lock,
  Box,
} from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import EngineSelector, { type EngineType } from "@/components/converter/EngineSelector";
import UrlConfigForm from "./UrlConfigForm";
import ProjectUpload from "@/components/converter/ProjectUpload";
import RepoConnect from "@/components/converter/RepoConnect";
import BuildPipeline from "@/components/converter/BuildPipeline";
import ScanResults from "@/components/converter/ScanResults";
import CapacitorFiles from "@/components/converter/CapacitorFiles";
import SigningConfig from "@/components/converter/SigningConfig";
import CodeEditor from "@/components/editor/CodeEditor";
import PluginManager from "@/components/plugins/PluginManager";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface WorkspacePanelProps {
  activeNav: string;
}

const STEPS = [
  { id: "engine", label: "Engine", icon: Cpu },
  { id: "source", label: "Source", icon: FileInput },
  { id: "signing", label: "Signing", icon: Lock },
  { id: "output", label: "Output", icon: Box },
];

const suggestedPrompts = [
  { icon: Smartphone, label: "Convert my React app to APK" },
  { icon: Code2, label: "Analyze code for mobile issues" },
  { icon: Shield, label: "Configure native plugins" },
  { icon: Zap, label: "Optimize build size" },
];

const WorkspacePanel = ({ activeNav }: WorkspacePanelProps) => {
  const [activeTab, setActiveTab] = useState("url");
  const [showBanner, setShowBanner] = useState(true);
  const [outputMode, setOutputMode] = useState<"apk" | "project">("apk");
  const [currentStep, setCurrentStep] = useState(0);
  const {
    openFile, scanResult, isBuildMode, setIsBuildMode,
    selectedEngine, setSelectedEngine,
    enabledPlugins, buildAppName, buildPackageName,
    files,
  } = useProjectStore();

  const engine = selectedEngine as EngineType;
  const showEngineFiles = activeTab !== "url" && (engine === "capacitor" || engine === "ionic" || engine === "twa");

  // Code editor mode
  if (openFile && activeNav === "converter") {
    return (
      <div className="flex-1 bg-card rounded-xl overflow-hidden">
        <CodeEditor />
      </div>
    );
  }

  // Build mode
  if (isBuildMode) {
    return (
      <div className="flex-1 bg-card rounded-xl overflow-y-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              {outputMode === "apk" ? <Smartphone size={20} className="text-primary" /> : <Package size={20} className="text-primary" />}
            </div>
            <div>
              <h2 className="text-lg font-medium">
                {outputMode === "apk" ? "Building APK" : "Building Android Project"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {outputMode === "apk" ? "Cloud compile → Download .apk" : "Generate → Download .zip for Android Studio"}
              </p>
            </div>
          </div>

          <BuildPipeline
            isBuilding={true}
            engine={engine}
            enabledPlugins={[...enabledPlugins]}
            appName={buildAppName}
            packageName={buildPackageName}
            outputMode={outputMode}
            onBuildComplete={() => {}}
          />

          <Button variant="outline" onClick={() => setIsBuildMode(false)} className="w-full mt-4 rounded-full">
            ← Back to Workspace
          </Button>
        </div>
      </div>
    );
  }

  // Plugins view
  if (activeNav === "plugins") {
    return (
      <div className="flex-1 bg-card rounded-xl overflow-y-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto py-6">
          <h1 className="text-lg font-medium mb-4">Native Plugins</h1>
          <PluginManager />
        </div>
      </div>
    );
  }

  // Placeholder views
  if (activeNav !== "converter") {
    const titles: Record<string, string> = {
      builds: "Build History", assets: "Marketing Assets",
      templates: "Splash Templates", deploy: "Deploy & Sign", projects: "My Projects",
    };
    return (
      <div className="flex-1 bg-card rounded-xl flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-muted-foreground">{titles[activeNav] || "Coming soon"}</p>
          <p className="text-sm text-muted-foreground/60">Coming soon</p>
        </div>
      </div>
    );
  }

  const goNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };
  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // Main converter workspace — step-based flow
  return (
    <div className="flex-1 bg-card rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <Smartphone size={16} className="text-primary" />
        <span className="text-sm font-medium">Android Builder</span>
      </div>

      {/* Step indicator bar */}
      <div className="px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-1">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStep;
            const isDone = idx < currentStep;
            const StepIcon = step.icon;
            return (
              <div key={step.id} className="flex items-center gap-1 flex-1 last:flex-none">
                <button
                  onClick={() => setCurrentStep(idx)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : isDone
                      ? "text-[hsl(var(--success))]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isDone ? (
                    <Check size={12} />
                  ) : (
                    <StepIcon size={12} />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <ChevronRight size={12} className="text-muted-foreground/30 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Dismissable banner */}
        {showBanner && currentStep === 0 && (
          <div className="mx-3 sm:mx-4 mt-4 px-3 sm:px-4 py-3 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Smartphone size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Android App Builder</p>
                <p className="text-xs text-muted-foreground">Upload your web project or enter a URL — NativeBridge builds your APK in the cloud.</p>
              </div>
            </div>
            <button onClick={() => setShowBanner(false)} className="icon-button w-7 h-7 shrink-0">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="max-w-2xl mx-auto py-6 px-3 sm:px-4 space-y-6">
          {/* Step 0: Engine Selection */}
          {currentStep === 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Cpu size={13} /> Runtime Engine
              </h2>
              <EngineSelector selected={engine} onSelect={(e) => setSelectedEngine(e)} />
            </section>
          )}

          {/* Step 1: Source Input */}
          {currentStep === 1 && (
            <section className="space-y-4">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileInput size={13} /> App Source
              </h2>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-muted/30 w-full rounded-full p-1">
                  <TabsTrigger value="url" className="flex-1 gap-1.5 text-xs rounded-full">
                    <Globe size={13} /> URL to App
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1 gap-1.5 text-xs rounded-full">
                    <Upload size={13} /> Upload Project
                  </TabsTrigger>
                  <TabsTrigger value="repo" className="flex-1 gap-1.5 text-xs rounded-full">
                    <FolderOpen size={13} /> From Repo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="url"><UrlConfigForm /></TabsContent>
                <TabsContent value="upload"><ProjectUpload /></TabsContent>
                <TabsContent value="repo"><RepoConnect /></TabsContent>
              </Tabs>

              {scanResult && activeTab === "upload" && <ScanResults />}

              {showEngineFiles && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Native Files</h3>
                  <CapacitorFiles engine={engine} />
                </div>
              )}
            </section>
          )}

          {/* Step 2: Signing */}
          {currentStep === 2 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Lock size={13} /> Signing Configuration
              </h2>
              <SigningConfig />
            </section>
          )}

          {/* Step 3: Output & Build */}
          {currentStep === 3 && (
            <section className="space-y-5">
              <div className="space-y-3">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Box size={13} /> Output Format
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOutputMode("apk")}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                      outputMode === "apk"
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <Download size={16} className={outputMode === "apk" ? "text-primary" : "text-muted-foreground"} />
                    <div>
                      <p className="text-sm font-medium">APK File</p>
                      <p className="text-[10px] text-muted-foreground">Cloud build → ready to install</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setOutputMode("project")}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                      outputMode === "project"
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <Package size={16} className={outputMode === "project" ? "text-primary" : "text-muted-foreground"} />
                    <div>
                      <p className="text-sm font-medium">Project ZIP</p>
                      <p className="text-[10px] text-muted-foreground">Open in Android Studio</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Build Button */}
              <Button onClick={() => setIsBuildMode(true)} className="w-full gap-2 rounded-full h-11 text-sm font-medium">
                {outputMode === "apk" ? (
                  <>
                    <Smartphone size={16} /> Generate APK
                    <ArrowRight size={14} className="ml-auto" />
                  </>
                ) : (
                  <>
                    <Package size={16} /> Build Project
                    <ArrowRight size={14} className="ml-auto" />
                  </>
                )}
              </Button>
            </section>
          )}

          {/* Quick actions — only on first step */}
          {currentStep === 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-3">Quick actions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedPrompts.map((prompt, i) => {
                  const Icon = prompt.icon;
                  return (
                    <button key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/30 transition-all text-left">
                      <Icon size={14} className="shrink-0" />
                      {prompt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step navigation footer */}
      <div className="border-t border-border/30 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            disabled={currentStep === 0}
            className="gap-1 text-xs"
          >
            <ArrowLeft size={14} /> Back
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </span>
          {currentStep < STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={goNext}
              className="gap-1 text-xs"
            >
              Next <ArrowRight size={14} />
            </Button>
          ) : (
            <div className="w-16" />
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspacePanel;
