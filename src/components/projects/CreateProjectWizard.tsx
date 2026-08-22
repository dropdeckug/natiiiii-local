import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Smartphone,
  Globe,
  Monitor,
  Upload,
  Github,
  Zap,
  Crown,
  Star,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
} from "lucide-react";
import GitHubImport from "@/components/create/GitHubImport";
import { useProjectStore } from "@/stores/projectStore";
import { scanProject, type ProjectScanResult } from "@/lib/tools/projectScanner";
import type { ProjectEntryCandidate } from "@/lib/tools/projectIndexer";
import { scanReactReadiness, type ReactReadinessReport } from "@/lib/tools/reactReadinessScan";
import { filesToZip } from "@/lib/projectPersistence";
import reactSvg from "@/assets/frameworks/react.svg";
import vueSvg from "@/assets/frameworks/vue.svg";
import angularSvg from "@/assets/frameworks/angular.svg";
import nextSvg from "@/assets/frameworks/next.svg";
import nuxtSvg from "@/assets/frameworks/nuxt.svg";
import svelteSvg from "@/assets/frameworks/svelte.svg";
import viteSvg from "@/assets/frameworks/vite.svg";
import unknownSvg from "@/assets/frameworks/unknown.svg";
import htmlSvg from "@/assets/frameworks/html.svg";

const STEPS = [
  "Basic Info",
  "Framework",
  "Engine",
  "Platforms",
  "Source",
  "Plan",
] as const;

const frameworks = [
  { id: "react", name: "React", icon: reactSvg, desc: "Component-based UI" },
  { id: "nextjs", name: "Next.js", icon: nextSvg, desc: "Full-stack React" },
  { id: "vue", name: "Vue", icon: vueSvg, desc: "Progressive framework" },
  { id: "angular", name: "Angular", icon: angularSvg, desc: "Enterprise platform" },
  { id: "svelte", name: "Svelte", icon: svelteSvg, desc: "Compiled UI" },
  { id: "nuxt", name: "Nuxt", icon: nuxtSvg, desc: "Vue full-stack" },
  { id: "vite", name: "Vite", icon: viteSvg, desc: "Fast build tooling" },
  { id: "other", name: "Other", icon: unknownSvg, desc: "Custom setup" },
];

const frameworkIconFor = (fw: string): string => {
  switch (fw) {
    case "react": return reactSvg;
    case "vue": return vueSvg;
    case "angular": return angularSvg;
    case "next": case "nextjs": return nextSvg;
    case "nuxt": return nuxtSvg;
    case "svelte": return svelteSvg;
    case "vite": case "vanilla": return viteSvg;
    case "plain html": case "html": return htmlSvg;
    default: return unknownSvg;
  }
};

const engines = [
  { id: "capacitor", name: "Capacitor", desc: "Native runtime for web apps", recommended: true },
  { id: "webview", name: "WebView", desc: "Lightweight wrapper" },
  { id: "ionic", name: "Ionic", desc: "Cross-platform UI toolkit" },
  { id: "twa", name: "TWA", desc: "Trusted Web Activity for PWAs" },
];

const platforms = [
  { id: "android", name: "Android", icon: Smartphone },
  { id: "ios", name: "iOS", icon: Smartphone },
  { id: "web", name: "Web App", icon: Globe },
  { id: "desktop", name: "Desktop", icon: Monitor },
];

const plans = [
  { id: "free", name: "Free", icon: Zap, desc: "1 project, basic builds", price: "$0" },
  { id: "pay-per-project", name: "Pay per Project", icon: Star, desc: "Unlimited builds per project", price: "$9/project" },
  { id: "pro", name: "Pro", icon: Crown, desc: "Unlimited everything", price: "$29/mo" },
];

interface CreateProjectWizardProps {
  open: boolean;
  onClose: () => void;
}

const CreateProjectWizard = ({ open, onClose }: CreateProjectWizardProps) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [framework, setFramework] = useState("react");
  const [engine, setEngine] = useState("capacitor");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["android"]);
  const [sourceMode, setSourceMode] = useState<"github" | "upload">("github");
  const [plan, setPlan] = useState("free");

  // Source results
  const [scan, setScan] = useState<ProjectScanResult | null>(null);
  const [readiness, setReadiness] = useState<ReactReadinessReport | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [envAck, setEnvAck] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [buildCommand, setBuildCommand] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [appRoot, setAppRoot] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<ProjectEntryCandidate | null>(null);
  const [repoMeta, setRepoMeta] = useState<{ url?: string; branch?: string } | null>(null);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const runScan = () => {
    const files = useProjectStore.getState().files;
    if (!files || files.length === 0) {
      setScanError("No files detected after import.");
      return;
    }
    const flat: { path: string; type: "file" | "folder"; content?: string }[] = [];
    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        flat.push({ path: n.path, type: n.type, content: n.content });
        if (n.children) walk(n.children);
      }
    };
    walk(files);

    const result = scanProject(flat);
    setScan(result);
    const initialEntry = result.entryCandidates[0] ?? null;
    setSelectedEntry(initialEntry);
    setScanError(null);

    if (result.isMonorepo && result.workspacePackages.length > 0) {
      const first = result.workspacePackages[0];
      setAppRoot(first.path);
      setBuildCommand(first.buildScript || "npm run build");
      setOutputDir(first.outputDir || "dist");
    } else {
      setAppRoot(initialEntry?.projectRoot || "");
      setBuildCommand(initialEntry?.buildCommand || result.buildScript || "npm run build");
      setOutputDir(initialEntry?.outputDir || result.outputDir || "dist");
    }

    // Auto-select framework based on scan
    if (result.framework !== "unknown") {
      const map: Record<string, string> = {
        react: "react", next: "nextjs", vue: "vue", angular: "angular",
        svelte: "svelte", nuxt: "nuxt", vanilla: "vite",
      };
      setFramework(map[result.framework] || "other");
    }

    if (!result.hasPackageJson && result.framework !== "static") {
      setScanError("This project has no package.json — not compatible.");
    }

    // React-focused readiness scan (blank-screen prevention)
    if (result.framework === "react" || result.framework === "vanilla") {
      try {
        const rep = scanReactReadiness(flat, result);
        setReadiness(rep);
        setDecisions({});
        setEnvAck(false);
      } catch (err) {
        console.warn("readiness scan failed:", err);
        setReadiness(null);
      }
    } else {
      setReadiness(null);
    }
  };

  const handleGitHubImported = () => {
    const { repoUrl, repoBranch } = useProjectStore.getState();
    setRepoMeta({ url: repoUrl, branch: repoBranch });
    runScan();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await useProjectStore.getState().loadFromZip(file);
      setRepoMeta(null);
      runScan();
    } catch (err: any) {
      setScanError(err?.message || "Failed to read zip");
    } finally {
      setLoading(false);
    }
  };

  const readinessSatisfied = () => {
    if (!readiness) return true;
    if (!readiness.ok) return false; // hard blockers
    for (const d of readiness.needsUserDecision) {
      if (d.id === "env-vars") { if (!envAck) return false; }
      else if (!decisions[d.id]) return false;
    }
    return true;
  };

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 3) return selectedPlatforms.length > 0;
    if (step === 4) {
      // Must have a successful scan AND files actually loaded into the store.
      const filesLoaded = useProjectStore.getState().files.length > 0;
      return !!scan && !!selectedEntry && selectedEntry.staticCapable !== false && !scanError && (scan.hasPackageJson || scan.framework === "static") && filesLoaded && !loading && readinessSatisfied();
    }
    return true;
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const files = useProjectStore.getState().files;
      if (!files.length) throw new Error("Source files are required");
      const archive = await filesToZip(files);
      const uploadPath = `${session.user.id}/imports/${crypto.randomUUID()}.zip`;
      const { error: uploadError } = await supabase.storage.from("project-files").upload(uploadPath, archive, {
        contentType: "application/zip",
      });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.functions.invoke("create-project", {
        body: {
          name: name.trim(),
          description: null,
          source: {
            type: sourceMode,
            repoUrl: repoMeta?.url || null,
            branch: repoMeta?.branch || null,
            uploadFilePath: uploadPath,
            buildCommand: buildCommand || scan?.buildScript || null,
            scanResult: scan ? {
              ...scan,
              appRoot,
              outputDir,
              readiness: readiness || null,
              readinessDecisions: decisions,
              envAcknowledged: envAck,
            } : null,
            selectedEntry: selectedEntry ? {
              projectRoot: selectedEntry.projectRoot,
              entryHtml: selectedEntry.entryHtml,
              outputDir,
              buildCommand,
            } : null,
          },
        },
      });
      if (error) {
        let message = error.message;
        try {
          const payload = await (error as any).context?.json?.();
          message = payload?.message || payload?.error || message;
        } catch { /* keep SDK message */ }
        throw new Error(message);
      }
      if (data?.error || data?.sourceError) throw new Error(data.error || data.sourceError);
      const newId = data.project.id as string;
      useProjectStore.getState().setCurrentProject(newId);

      toast.success("Project created!");
      onClose();
      navigate(`/project/${newId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const renderScanResults = () => {
    if (scanError) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
          <div className="text-xs text-destructive">{scanError}</div>
        </div>
      );
    }
    if (!scan) return null;
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground">Compatible project detected</span>
        </div>

        <div className="flex items-center gap-3">
          <img src={frameworkIconFor(scan.framework)} alt={scan.framework} className="w-8 h-8" />
          <div>
            <div className="text-sm font-medium text-foreground capitalize">{scan.framework}</div>
            <div className="text-[11px] text-muted-foreground">
              {scan.packageManager} · {scan.sourceFiles} files
              {scan.hasTypeScript ? " · TypeScript" : ""}
            </div>
          </div>
        </div>

        {selectedEntry && (
          <div className="rounded-md border border-border bg-background/60 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Build tool</span>
              <span className="text-xs font-medium text-foreground">{selectedEntry.buildToolLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Output resolved from</span>
              <span className="text-[11px] font-mono text-muted-foreground truncate">{selectedEntry.outputSource}</span>
            </div>
            {selectedEntry.staticCapable ? (
              <div className="flex items-center gap-1.5 text-[11px] text-primary">
                <CheckCircle2 size={11} /> Static export supported
              </div>
            ) : (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive space-y-1">
                <div className="font-medium">Static export not supported — project cannot be packaged</div>
                {selectedEntry.staticBlockers.map((b) => (
                  <div key={b}>· {b}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {scan.isMonorepo && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
              <FolderTree size={11} /> Monorepo — choose app
            </label>
            <select
              value={appRoot}
              onChange={(e) => {
                const pkg = scan.workspacePackages.find((p) => p.path === e.target.value);
                setAppRoot(e.target.value);
                if (pkg) {
                  setBuildCommand(pkg.buildScript || "npm run build");
                  setOutputDir(pkg.outputDir || "dist");
                }
              }}
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {scan.workspacePackages.map((p) => (
                <option key={p.path} value={p.path}>{p.name} ({p.path})</option>
              ))}
            </select>
          </div>
        )}

        {scan.entryCandidates.length > 1 && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
              <FolderTree size={11} /> Choose app entry
            </label>
            <select
              value={selectedEntry?.entryHtml || ""}
              onChange={(event) => {
                const candidate = scan.entryCandidates.find((item) => item.entryHtml === event.target.value) ?? null;
                setSelectedEntry(candidate);
                if (candidate) {
                  setAppRoot(candidate.projectRoot);
                  setBuildCommand(candidate.buildCommand);
                  setOutputDir(candidate.outputDir);
                }
              }}
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm font-mono"
            >
              {scan.entryCandidates.map((candidate) => (
                <option key={`${candidate.projectRoot}:${candidate.entryHtml}`} value={candidate.entryHtml}>
                  {candidate.entryHtml} — {candidate.framework}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Build command</label>
            <Input
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder="npm run build"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Output dir</label>
            <Input
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="dist"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>

        {scan.warnings.length > 0 && (
          <div className="text-[11px] text-amber-600 space-y-0.5">
            {scan.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}

        {readiness && (
          <div className="rounded-md border border-border bg-background/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Blank-screen readiness</span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                readiness.blankScreenRisk === "low" ? "bg-emerald-500/10 text-emerald-600" :
                readiness.blankScreenRisk === "medium" ? "bg-amber-500/10 text-amber-600" :
                "bg-destructive/10 text-destructive"
              }`}>{readiness.blankScreenRisk} risk</span>
            </div>

            {readiness.checks.length === 0 && (
              <div className="text-[11px] text-muted-foreground">All React readiness checks passed.</div>
            )}

            {readiness.checks.map((c) => (
              <div key={c.id} className={`text-[11px] flex items-start gap-1.5 ${
                c.severity === "block" ? "text-destructive" :
                c.severity === "warn" ? "text-amber-600" : "text-muted-foreground"
              }`}>
                <span>{c.severity === "block" ? "✕" : c.severity === "warn" ? "⚠" : "ℹ"}</span>
                <div className="flex-1">
                  <div className="font-medium">{c.label}</div>
                  <div className="opacity-80">{c.message}</div>
                  {c.files && c.files.length > 0 && (
                    <div className="mt-0.5 font-mono opacity-60 text-[10px]">{c.files.join(", ")}</div>
                  )}
                </div>
              </div>
            ))}

            {readiness.needsUserDecision.map((d) => (
              <div key={d.id} className="pt-1 border-t border-border/50">
                <div className="text-[11px] font-medium mb-1">{d.label}</div>
                <div className="text-[10px] text-muted-foreground mb-1.5">{d.message}</div>
                {d.id === "env-vars" ? (
                  <label className="flex items-start gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={envAck}
                      onChange={(e) => setEnvAck(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>I'll set these before running the app: <span className="font-mono">{d.values?.join(", ")}</span></span>
                  </label>
                ) : d.options ? (
                  <select
                    value={decisions[d.id] || ""}
                    onChange={(e) => setDecisions((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="" disabled>Choose…</option>
                    {d.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}{o.recommended ? " (recommended)" : ""}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ))}

            {readiness.hardBlockers.length > 0 && (
              <div className="text-[11px] text-destructive font-medium border-t border-destructive/20 pt-2">
                Fix these in your source before continuing:
                <ul className="list-disc pl-4 mt-1 font-normal">
                  {readiness.hardBlockers.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Project name
              </label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-awesome-app"
                className="h-10"
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid grid-cols-2 gap-3">
            {frameworks.map((f) => (
              <button
                key={f.id}
                onClick={() => setFramework(f.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                  framework === f.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <img src={f.icon} alt={f.name} className="w-7 h-7 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </button>
            ))}
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            {engines.map((e) => (
              <button
                key={e.id}
                onClick={() => setEngine(e.id)}
                className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all ${
                  engine === e.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{e.name}</p>
                    {e.recommended && (
                      <Badge variant="secondary" className="text-[10px]">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.desc}</p>
                </div>
                {engine === e.id && (
                  <Check size={16} className="text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        );
      case 3:
        return (
          <div className="grid grid-cols-2 gap-3">
            {platforms.map((p) => {
              const selected = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`flex items-center gap-3 rounded-lg border p-4 transition-all ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded border ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {selected && <Check size={12} />}
                  </div>
                  <p.icon size={18} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => { setSourceMode("github"); setScan(null); setScanError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 transition-all ${
                  sourceMode === "github" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <Github size={16} />
                <span className="text-sm font-medium">GitHub</span>
              </button>
              <button
                onClick={() => { setSourceMode("upload"); setScan(null); setScanError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-3 transition-all ${
                  sourceMode === "upload" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <Upload size={16} />
                <span className="text-sm font-medium">Upload ZIP</span>
              </button>
            </div>

            {sourceMode === "github" ? (
              <GitHubImport onImported={handleGitHubImported} />
            ) : (
              <div>
                <label className="flex items-center justify-center w-full h-24 rounded-lg border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:border-primary/50 transition-colors">
                  <input type="file" accept=".zip" onChange={handleUpload} className="hidden" />
                  <div className="text-center">
                    {loading ? (
                      <Loader2 size={18} className="animate-spin mx-auto text-muted-foreground" />
                    ) : (
                      <>
                        <Upload size={18} className="mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Drop a .zip or click to select</p>
                      </>
                    )}
                  </div>
                </label>
              </div>
            )}

            {renderScanResults()}
          </div>
        );
      case 5:
        return (
          <div className="space-y-3">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all ${
                  plan === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <p.icon size={18} className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {p.price}
                </span>
              </button>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[560px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Create a new project
          </DialogTitle>
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </DialogHeader>

        <div className="px-6 pb-2 min-h-[280px] max-h-[60vh] overflow-y-auto">{renderStep()}</div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            disabled={loading}
          >
            <ArrowLeft size={14} className="mr-1" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
            >
              Next
              <ArrowRight size={14} className="ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreate} disabled={loading || !canNext()}>
              {loading ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <Check size={14} className="mr-1" />
              )}
              Create Project
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectWizard;
