import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Globe, Upload, GitBranch, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import UrlConfigForm from "./UrlConfigForm";
import EngineSelector, { type EngineType } from "@/components/converter/EngineSelector";
import ProjectUpload from "@/components/converter/ProjectUpload";
import RepoConnect from "@/components/converter/RepoConnect";
import BuildPipeline from "@/components/converter/BuildPipeline";
import CapacitorFiles from "@/components/converter/CapacitorFiles";
import SigningConfig from "@/components/converter/SigningConfig";
import ScanResults from "@/components/converter/ScanResults";
import PluginManager from "@/components/plugins/PluginManager";
import CodeEditor from "@/components/editor/CodeEditor";
import { useProjectStore } from "@/stores/projectStore";

interface MainContentProps {
  activeNav: string;
}

const MainContent = ({ activeNav }: MainContentProps) => {
  const [isBuilding, setIsBuilding] = useState(false);
  const [activeTab, setActiveTab] = useState("url");
  const {
    openFile, scanResult, isBuildMode, setIsBuildMode,
    selectedEngine, setSelectedEngine,
    enabledPlugins, buildAppName, buildPackageName,
  } = useProjectStore();

  const engine = selectedEngine as EngineType;

  const showEngineFiles = activeTab !== "url" && (engine === "capacitor" || engine === "ionic" || engine === "twa");

  // If a file is open, show the code editor
  if (openFile && activeNav === "converter") {
    return (
      <div className="flex-1 bg-background rounded-lg overflow-hidden">
        <CodeEditor />
      </div>
    );
  }

  // If build mode is active, show full-screen build pipeline
  if (isBuildMode) {
    return (
      <div className="flex-1 bg-background rounded-lg overflow-y-auto px-6">
        <div className="max-w-2xl mx-auto py-6">
          <h2 className="text-lg font-medium mb-4">Building Android Project</h2>
          <BuildPipeline
            isBuilding={true}
            engine={engine}
            enabledPlugins={[...enabledPlugins]}
            appName={buildAppName}
            packageName={buildPackageName}
            onBuildComplete={() => {}}
          />
          <Button variant="outline" onClick={() => setIsBuildMode(false)} className="w-full mt-4">
            ← Back to Converter
          </Button>
        </div>
      </div>
    );
  }

  const renderConverter = () => (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      {/* Engine Selection */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground px-1">Runtime Engine</h2>
        <EngineSelector selected={engine} onSelect={(e) => setSelectedEngine(e)} />
      </section>

      {/* Input Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 w-full">
          <TabsTrigger value="url" className="flex-1 gap-1.5 text-xs">
            <Globe size={13} /> URL to App
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1 gap-1.5 text-xs">
            <Upload size={13} /> Upload Project
          </TabsTrigger>
          <TabsTrigger value="repo" className="flex-1 gap-1.5 text-xs">
            <GitBranch size={13} /> From Repo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url">
          <UrlConfigForm />
        </TabsContent>

        <TabsContent value="upload">
          <ProjectUpload />
        </TabsContent>

        <TabsContent value="repo">
          <RepoConnect />
        </TabsContent>
      </Tabs>

      {/* Scan Results (shown after upload) */}
      {scanResult && activeTab === "upload" && <ScanResults />}

      {/* Injected Files Preview (for source code engines) */}
      {showEngineFiles && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground px-1">Native Files</h2>
          <CapacitorFiles engine={engine} />
        </section>
      )}

      {/* Signing Config */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground px-1">Signing</h2>
        <SigningConfig />
      </section>

      {/* Build Pipeline */}
      {isBuilding && (
        <BuildPipeline isBuilding={isBuilding} onBuildComplete={() => setIsBuilding(false)} />
      )}

      {/* Build Button */}
      {!isBuilding && (
        <Button
          onClick={() => {
            setIsBuildMode(true);
          }}
          className="w-full gap-2"
        >
          <Smartphone size={16} /> Build APK
        </Button>
      )}
    </div>
  );

  const renderPlugins = () => (
    <div className="max-w-2xl mx-auto py-6">
      <h1 className="text-lg font-medium mb-4">Native Plugins</h1>
      <PluginManager />
    </div>
  );

  const renderPlaceholder = (title: string) => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground/60">Coming soon</p>
      </div>
    </div>
  );

  const content = () => {
    switch (activeNav) {
      case "converter": return renderConverter();
      case "plugins": return renderPlugins();
      case "builds": return renderPlaceholder("Build History");
      case "assets": return renderPlaceholder("Marketing Assets");
      case "templates": return renderPlaceholder("Splash Templates");
      case "deploy": return renderPlaceholder("Deploy & Sign");
      case "projects": return renderPlaceholder("My Projects");
      default: return renderConverter();
    }
  };

  return (
    <div className="flex-1 bg-background rounded-lg overflow-y-auto px-6">
      {content()}
    </div>
  );
};

export default MainContent;
