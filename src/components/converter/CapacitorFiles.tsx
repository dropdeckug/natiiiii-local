import { useState, useMemo } from "react";
import {
  FileCode2, FileJson, FolderOpen, ChevronRight, ChevronDown,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import JSZip from "jszip";
import type { EngineType } from "./EngineSelector";
import type { GeneratedFile } from "@/lib/generators/shared";
import { generateWebviewProject } from "@/lib/generators/webview";
import { generateCapacitorProject } from "@/lib/generators/capacitor";
import { generateIonicProject } from "@/lib/generators/ionic";
import { generateTwaProject } from "@/lib/generators/twa";
import { useProjectStore } from "@/stores/projectStore";

interface CapacitorFilesProps {
  engine: string;
}

const CapacitorFiles = ({ engine }: CapacitorFilesProps) => {
  const [expanded, setExpanded] = useState(true);
  const { buildAppName, buildPackageName } = useProjectStore();

  const files = useMemo(() => {
    const config = { appName: buildAppName, packageName: buildPackageName };
    let generated: GeneratedFile[];
    switch (engine as EngineType) {
      case "capacitor": generated = generateCapacitorProject(config); break;
      case "ionic": generated = generateIonicProject(config); break;
      case "twa": generated = generateTwaProject(config); break;
      default: generated = generateWebviewProject(config); break;
    }
    return generated.map(f => ({ path: f.path, description: describeFile(f.path) }));
  }, [engine, buildAppName, buildPackageName]);

  const label = engine === "capacitor" ? "Capacitor" : engine === "ionic" ? "Ionic + Capacitor" : engine === "twa" ? "TWA" : "WebView";

  const handleExport = async () => {
    const config = { appName: buildAppName, packageName: buildPackageName };
    let generated: GeneratedFile[];
    switch (engine as EngineType) {
      case "capacitor": generated = generateCapacitorProject(config); break;
      case "ionic": generated = generateIonicProject(config); break;
      case "twa": generated = generateTwaProject(config); break;
      default: generated = generateWebviewProject(config); break;
    }
    const zip = new JSZip();
    const root = buildAppName.replace(/\s+/g, "_") + "_android";
    for (const f of generated) {
      zip.file(root + "/" + f.path, f.content as string);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${root}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <FolderOpen size={14} className="text-primary" />
        <span className="text-xs font-medium text-foreground flex-1 text-left">
          {label} Files ({files.length})
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-border max-h-60 overflow-y-auto">
          {files.map((file) => (
            <div key={file.path} className="flex items-start gap-2 px-3 py-1.5">
              <div className="mt-0.5">
                {file.path.endsWith(".gradle") || file.path.endsWith(".json") ? (
                  <FileJson size={12} className="text-[hsl(var(--warning))]" />
                ) : (
                  <FileCode2 size={12} className="text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-foreground truncate">{file.path}</p>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                NEW
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-3 py-2 border-t border-border bg-muted/20">
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8" onClick={handleExport}>
          <Download size={12} /> Export Android Studio Project
        </Button>
      </div>
    </div>
  );
};

const describeFile = (path: string): string => {
  if (path.includes("AndroidManifest")) return "App manifest with permissions and activities";
  if (path.includes("MainActivity")) return "Main activity entry point";
  if (path.includes("build.gradle")) return "Gradle build configuration";
  if (path.includes("settings.gradle")) return "Project module settings";
  if (path.includes("variables.gradle")) return "SDK and dependency versions";
  if (path.includes("strings.xml")) return "String resources";
  if (path.includes("styles.xml")) return "Theme configuration";
  if (path.includes("file_paths.xml")) return "FileProvider paths";
  if (path.includes("capacitor.config")) return "Capacitor configuration";
  if (path.includes("gradlew")) return "Gradle wrapper script";
  if (path.includes("gradle-wrapper")) return "Gradle wrapper properties";
  if (path.includes("proguard")) return "ProGuard rules";
  return "";
};

export default CapacitorFiles;
