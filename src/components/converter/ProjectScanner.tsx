import { useState, useEffect } from "react";
import {
  FileCode2, FileJson, FileType, AlertTriangle, CheckCircle2,
  XCircle, Loader2, ArrowRight, Link2, Shield, Zap,
  FolderTree, Package, Terminal, Eye,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ScannedFile {
  path: string;
  extension: string;
  size: number;
  status: "ok" | "warning" | "error";
  issues: string[];
  connections: string[]; // files this file imports/references
}

interface ScanResult {
  framework: string;
  packageManager: string;
  buildCommand: string;
  outputDir: string;
  entryPoint: string;
  totalSize: string;
  fileCount: number;
  files: ScannedFile[];
  warnings: string[];
  recommendations: string[];
  overallHealth: number; // 0-100
}

const mockScanResult: ScanResult = {
  framework: "React (Vite)",
  packageManager: "npm",
  buildCommand: "npm run build",
  outputDir: "dist/",
  entryPoint: "dist/index.html",
  totalSize: "12.4 MB",
  fileCount: 47,
  overallHealth: 87,
  files: [
    {
      path: "src/App.tsx",
      extension: "tsx",
      size: 3420,
      status: "ok",
      issues: [],
      connections: ["src/components/Header.tsx", "src/components/Footer.tsx", "src/pages/Home.tsx", "src/styles/global.css"],
    },
    {
      path: "src/components/Header.tsx",
      extension: "tsx",
      size: 1890,
      status: "ok",
      issues: [],
      connections: ["src/components/NavLink.tsx", "src/hooks/useAuth.ts"],
    },
    {
      path: "src/components/Footer.tsx",
      extension: "tsx",
      size: 980,
      status: "ok",
      issues: [],
      connections: ["src/components/NavLink.tsx"],
    },
    {
      path: "src/pages/Home.tsx",
      extension: "tsx",
      size: 4210,
      status: "warning",
      issues: ["Large component (4.2 KB) — consider splitting into smaller components"],
      connections: ["src/components/Card.tsx", "src/hooks/useApi.ts", "src/utils/format.ts"],
    },
    {
      path: "src/hooks/useApi.ts",
      extension: "ts",
      size: 1560,
      status: "warning",
      issues: ["Uses fetch without error boundary — may cause silent failures in WebView"],
      connections: ["src/utils/config.ts"],
    },
    {
      path: "src/utils/config.ts",
      extension: "ts",
      size: 420,
      status: "error",
      issues: ["References process.env.VITE_API_URL — environment variable must be set before build"],
      connections: [],
    },
    {
      path: "src/styles/global.css",
      extension: "css",
      size: 2100,
      status: "ok",
      issues: [],
      connections: [],
    },
    {
      path: "package.json",
      extension: "json",
      size: 1240,
      status: "ok",
      issues: [],
      connections: [],
    },
    {
      path: "vite.config.ts",
      extension: "ts",
      size: 680,
      status: "ok",
      issues: [],
      connections: [],
    },
    {
      path: "index.html",
      extension: "html",
      size: 540,
      status: "ok",
      issues: [],
      connections: ["src/main.tsx"],
    },
  ],
  warnings: [
    "Environment variable VITE_API_URL is used but not defined in .env",
    "External API calls to api.example.com detected — CORS may need configuration in WebView",
    "No service worker found — PWA features unavailable for TWA engine",
  ],
  recommendations: [
    "Capacitor engine recommended — project uses native-compatible API patterns",
    "Add error boundaries around fetch calls for better WebView stability",
    "Consider code-splitting large components for faster mobile load times",
  ],
};

const getFileIcon = (ext: string) => {
  switch (ext) {
    case "tsx": case "ts": case "jsx": case "js": return <FileCode2 size={14} className="text-primary" />;
    case "json": return <FileJson size={14} className="text-[hsl(var(--warning))]" />;
    case "css": case "html": return <FileType size={14} className="text-[hsl(var(--info))]" />;
    default: return <FileCode2 size={14} className="text-muted-foreground" />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "ok": return <CheckCircle2 size={13} className="text-[hsl(var(--success))]" />;
    case "warning": return <AlertTriangle size={13} className="text-[hsl(var(--warning))]" />;
    case "error": return <XCircle size={13} className="text-destructive" />;
    default: return null;
  }
};

interface ProjectScannerProps {
  isScanning: boolean;
  onScanComplete?: (result: ScanResult) => void;
}

const ProjectScanner = ({ isScanning, onScanComplete }: ProjectScannerProps) => {
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPhase, setScanPhase] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [showAllFiles, setShowAllFiles] = useState(false);

  useEffect(() => {
    if (!isScanning) return;
    setResult(null);
    setScanProgress(0);

    const phases = [
      { label: "Reading project structure...", progress: 15 },
      { label: "Detecting framework & dependencies...", progress: 30 },
      { label: "Analyzing file connectivity...", progress: 50 },
      { label: "Scanning code quality...", progress: 70 },
      { label: "Checking API patterns...", progress: 85 },
      { label: "Generating report...", progress: 100 },
    ];

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < phases.length) {
        setScanPhase(phases[idx].label);
        setScanProgress(phases[idx].progress);
        idx++;
      } else {
        clearInterval(interval);
        setResult(mockScanResult);
        onScanComplete?.(mockScanResult);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [isScanning]);

  if (!isScanning && !result) return null;

  if (!result) {
    return (
      <div className="space-y-3 p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin text-primary" />
          <span className="text-sm font-medium text-foreground">Scanning Project</span>
        </div>
        <p className="text-xs text-muted-foreground">{scanPhase}</p>
        <Progress value={scanProgress} className="h-1.5" />
      </div>
    );
  }

  const healthColor =
    result.overallHealth >= 80 ? "text-[hsl(var(--success))]" :
    result.overallHealth >= 60 ? "text-[hsl(var(--warning))]" :
    "text-destructive";

  const filesWithIssues = result.files.filter((f) => f.status !== "ok");
  const filesOk = result.files.filter((f) => f.status === "ok");
  const displayedFiles = showAllFiles ? result.files : result.files.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Health Score */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border">
        <div className="relative w-14 h-14 flex items-center justify-center">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="24" fill="none"
              stroke={result.overallHealth >= 80 ? "hsl(var(--success))" : result.overallHealth >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))"}
              strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${(result.overallHealth / 100) * 150.8} 150.8`}
            />
          </svg>
          <span className={`absolute text-sm font-bold ${healthColor}`}>{result.overallHealth}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-foreground">Code Health Score</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {result.fileCount} files scanned · {filesWithIssues.length} issue{filesWithIssues.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Shield size={18} className={healthColor} />
      </div>

      {/* Detection Summary */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Zap, label: "Framework", value: result.framework },
          { icon: Package, label: "Package Mgr", value: result.packageManager },
          { icon: Terminal, label: "Build Cmd", value: result.buildCommand },
          { icon: FolderTree, label: "Output", value: result.outputDir },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border">
            <item.icon size={14} className="text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className="text-xs font-medium text-foreground truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* File Analysis */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Eye size={13} /> File Analysis
          </span>
          <span className="text-[10px] text-muted-foreground">
            {filesOk.length} OK · {filesWithIssues.length} issues
          </span>
        </div>
        <div className="divide-y divide-border">
          {displayedFiles.map((file) => (
            <div key={file.path}>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
                onClick={() => setExpandedFile(expandedFile === file.path ? null : file.path)}
              >
                {getFileIcon(file.extension)}
                <span className="text-xs text-foreground flex-1 truncate font-mono">{file.path}</span>
                {getStatusIcon(file.status)}
                {file.connections.length > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Link2 size={10} /> {file.connections.length}
                  </span>
                )}
              </button>
              {expandedFile === file.path && (
                <div className="px-3 pb-2 space-y-1.5">
                  {file.connections.length > 0 && (
                    <div className="pl-5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Connects to:</p>
                      {file.connections.map((conn) => (
                        <p key={conn} className="text-[11px] text-primary/80 font-mono flex items-center gap-1">
                          <ArrowRight size={10} /> {conn}
                        </p>
                      ))}
                    </div>
                  )}
                  {file.issues.length > 0 && (
                    <div className="pl-5 space-y-0.5">
                      {file.issues.map((issue, i) => (
                        <p key={i} className="text-[11px] text-[hsl(var(--warning))]">⚠ {issue}</p>
                      ))}
                    </div>
                  )}
                  {file.status === "ok" && (
                    <p className="pl-5 text-[11px] text-[hsl(var(--success))] flex items-center gap-1">
                      <CheckCircle2 size={11} /> Code verified — no issues detected
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {result.files.length > 6 && (
          <button
            className="w-full px-3 py-2 text-xs text-primary hover:bg-muted/30 transition-colors border-t border-border"
            onClick={() => setShowAllFiles(!showAllFiles)}
          >
            {showAllFiles ? "Show less" : `Show all ${result.files.length} files`}
          </button>
        )}
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-[hsl(var(--warning))] flex items-center gap-1.5">
            <AlertTriangle size={13} /> Warnings
          </h4>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-muted-foreground pl-5">• {w}</p>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-[hsl(var(--success))] flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Recommendations
          </h4>
          {result.recommendations.map((r, i) => (
            <p key={i} className="text-[11px] text-muted-foreground pl-5">• {r}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectScanner;
