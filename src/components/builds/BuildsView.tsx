import { useBuildStore, type BuildJob, type BuildErrorInfo } from "@/stores/buildStore";
import { useProjectStore, type PendingChange } from "@/stores/projectStore";
import { CheckCircle2, Loader2, XCircle, Clock, Download, Package, Terminal, ExternalLink, Trash2, AlertTriangle, RefreshCw, Smartphone, Monitor, Apple, RotateCcw, StopCircle, Zap, Rocket } from "lucide-react";
import BuildErrorPanel from "@/components/builds/BuildErrorPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

const statusConfigMap: Record<string, { icon: typeof Loader2; color: string; label: string }> = {
  queued: { icon: Clock, color: "text-muted-foreground", label: "Queued" },
  uploading: { icon: Loader2, color: "text-foreground", label: "Uploading" },
  building: { icon: Loader2, color: "text-foreground", label: "Building" },
  success: { icon: CheckCircle2, color: "text-[hsl(var(--success))]", label: "Success" },
  failure: { icon: XCircle, color: "text-destructive", label: "Failed" },
  timeout: { icon: XCircle, color: "text-destructive", label: "Timed Out" },
};

const defaultStatusConfig = { icon: Clock, color: "text-muted-foreground", label: "Unknown" };

const getStatusConfig = (status: string) => statusConfigMap[status] || defaultStatusConfig;

function parseErrorCategory(error?: string, logs?: string[], errorInfo?: BuildErrorInfo): { category: string; message: string; suggestion: string } | null {
  if (errorInfo?.errorType) {
    return { category: errorInfo.errorType, message: errorInfo.errorDetail || "Build failed", suggestion: errorInfo.suggestedFix || "Check the build logs for details." };
  }
  if (!error && (!logs || logs.length === 0)) return null;
  const allText = [error || "", ...(logs || [])].join("\n");
  if (allText.includes("npm ERR!") || allText.includes("ERESOLVE")) return { category: "npm", message: "Dependency installation failed", suggestion: "Check that package.json has valid dependencies and no private registries." };
  if (allText.includes("BUILD FAILED") || allText.includes("FAILURE: Build failed")) return { category: "Gradle", message: "Android build compilation failed", suggestion: "Check SDK versions and Gradle configuration. Try a clean build." };
  if (allText.includes("cap init\" failed") || allText.includes("cap add\" failed") || allText.includes("npx cap sync\" failed")) return { category: "Capacitor", message: "Capacitor initialization failed", suggestion: "Ensure your project has a valid package.json and a build output directory (dist/build/www)." };
  if (allText.includes("Workflow failed before any job could start")) return { category: "Workflow", message: "GitHub Actions workflow failed to start", suggestion: "The workflow YAML may have a syntax error. Check the GitHub Actions run directly." };
  if (allText.includes("xcodebuild") || allText.includes("Xcode")) return { category: "Xcode", message: "iOS build failed", suggestion: "Check signing certificates and provisioning profiles." };
  if (allText.includes("electron-builder")) return { category: "Electron", message: "Desktop build failed", suggestion: "Check electron-builder configuration." };
  if (error) return { category: "Build", message: error, suggestion: "Check the build logs for details." };
  return null;
}

function getEngineIcon(engine: string) {
  switch (engine) {
    case "electron": return Monitor;
    case "ios": return Apple;
    default: return Smartphone;
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

type FilterStatus = "all" | "success" | "failure" | "building";

const BuildsView = () => {
  const { jobs, activeJobId, setActiveJob, updateJob } = useBuildStore();
  const pendingChanges = useProjectStore((s) => s.pendingChanges);
  const clearPendingChanges = useProjectStore((s) => s.clearPendingChanges);
  const activeJob = jobs.find((j) => j.id === activeJobId);
  const logRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterStatus>(() => {
    const routeFilter = searchParams.get("filter") as FilterStatus | null;
    return routeFilter && ["all", "success", "failure", "building"].includes(routeFilter) ? routeFilter : "all";
  });

  // Get current project ID from URL params, falling back to the project store
  // (which is set by ProjectDashboard whenever the user opens a project).
  const storeProjectId = useProjectStore((s) => s.currentProjectId);
  const currentProjectId = searchParams.get("projectId") || storeProjectId || undefined;

  useEffect(() => {
    const routeFilter = searchParams.get("filter") as FilterStatus | null;
    if (routeFilter && ["all", "success", "failure", "building"].includes(routeFilter) && routeFilter !== filter) {
      setFilter(routeFilter);
    }
  }, [searchParams, filter]);

  const updateBuildFilter = (nextFilter: FilterStatus) => {
    setFilter(nextFilter);
    const next = new URLSearchParams(searchParams);
    next.set("filter", nextFilter);
    setSearchParams(next);
  };

  const goToCreate = () => {
    const next = new URLSearchParams(searchParams);
    next.set("section", "overview");
    next.set("item", "project-overview");
    setSearchParams(next);
  };

  // Load builds from DB on mount — filtered by project
  useEffect(() => {
    const loadBuilds = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      let query = supabase
        .from("builds")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (currentProjectId) {
        query = query.eq("project_id", currentProjectId);
      }
      const { data: dbBuilds } = await query;
      if (dbBuilds && dbBuilds.length > 0) {
        const store = useBuildStore.getState();
        for (const b of dbBuilds) {
          const existing = store.getJob(b.id);
          if (!existing) {
            store.addJob({
              id: b.id, appName: b.app_name, packageName: b.package_name, engine: b.engine,
              projectId: b.project_id || undefined,
              status: b.status as BuildJob["status"], stage: b.stage,
              logs: Array.isArray(b.logs) ? b.logs as string[] : [],
              startedAt: new Date(b.started_at).getTime(),
              completedAt: b.completed_at ? new Date(b.completed_at).getTime() : undefined,
              repoName: b.repo_name || undefined, repoUrl: b.repo_url || undefined,
              error: b.error || undefined, errorInfo: b.error_info ? b.error_info as unknown as BuildErrorInfo : undefined,
              apkUrl: b.apk_url || undefined, aabUrl: b.aab_url || undefined, autoDeleteRepo: true,
            });
          }
        }
      }
    };
    loadBuilds();
  }, [currentProjectId]);

  useEffect(() => {
    const refreshStaleJobs = async () => {
      const store = useBuildStore.getState();
      const staleJobs = store.jobs.filter((j) => ["building", "uploading", "queued"].includes(j.status) && j.repoName);
      for (const job of staleJobs) {
        try {
          const { data } = await supabase.functions.invoke("build-apk", { body: { action: "status", repoName: job.repoName, runId: job.runId } });
          if (data) {
            const newStatus = data.status === "success" ? "success" : data.status === "failure" ? "failure" : job.status;
            const updates: Partial<BuildJob> = { status: newStatus as BuildJob["status"] };
            if (data.runId) updates.runId = data.runId;
            if (data.errorInfo) updates.errorInfo = data.errorInfo;
            if (data.logs?.length) updates.logs = [...job.logs, ...data.logs.map((l: string) => "> [refresh] " + l)];
            if (newStatus === "success" || newStatus === "failure") {
              updates.completedAt = Date.now();
              updates.stage = newStatus === "success" ? "Build complete" : "Build failed";
              if (data.buildLogs) updates.error = data.buildLogs.split("\n").slice(-5).join("\n");
            }
            updateJob(job.id, updates);
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await supabase.from("builds").update({
                status: updates.status || job.status, stage: updates.stage || job.stage,
                completed_at: updates.completedAt ? new Date(updates.completedAt).toISOString() : null,
                error: updates.error || null, error_info: data.errorInfo || null,
              } as any).eq("id", job.id);
            }
          }
        } catch (err) { console.error("Auto-refresh failed for job:", job.id, err); }
      }
    };
    const timer = setTimeout(refreshStaleJobs, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [activeJob?.logs.length]);

  const handleDownloadAPK = async (job: BuildJob) => {
    if (job.apkBlob) {
      const a = document.createElement("a"); a.href = URL.createObjectURL(job.apkBlob);
      a.download = `${job.packageName || job.appName.replace(/\s+/g, "_")}.apk`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); return;
    }
    if (job.apkUrl) { const a = document.createElement("a"); a.href = job.apkUrl; a.download = `${job.packageName || job.appName.replace(/\s+/g, "_")}.apk`; a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a); return; }
    try {
      const { data } = await supabase.from("builds").select("apk_url").eq("id", job.id).maybeSingle();
      if (data?.apk_url) { updateJob(job.id, { apkUrl: data.apk_url }); window.open(data.apk_url, "_blank"); }
    } catch {}
  };

  const handleDownloadZip = (job: BuildJob) => {
    if (!job.zipBlob) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(job.zipBlob);
    a.download = `${job.appName.replace(/\s+/g, "_")}_project.zip`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  };

  const handleDeleteRepo = async (job: BuildJob) => {
    if (!job.repoName) return;
    try { await supabase.functions.invoke("build-apk", { body: { action: "delete-repo", repoName: job.repoName } }); updateJob(job.id, { repoName: undefined, repoUrl: undefined }); } catch (err) { console.error("Failed to delete repo:", err); }
  };

  const handleToggleKeepRepo = (job: BuildJob, keep: boolean) => { updateJob(job.id, { autoDeleteRepo: !keep }); };

  const handleRetry = (job: BuildJob) => {
    setSearchParams({
      section: "builds",
      item: "create-build",
      step: "review",
      rebuild: job.id,
      appName: job.appName,
      packageName: job.packageName,
      engine: job.engine,
      autostart: "1",
    });
  };

  const handleQuickRebuild = (job: BuildJob) => {
    setSearchParams({
      section: "builds",
      item: "create-build",
      step: "review",
      rebuild: job.id,
      appName: job.appName,
      packageName: job.packageName,
      engine: job.engine,
      quick: "true",
      autostart: "1",
    });
  };

  const handleFixAndRetry = (job: BuildJob, fix: string) => {
    console.log("Fix suggestion for rebuild:", fix);
    handleRetry(job);
  };

  const [deletingJobs, setDeletingJobs] = useState<Set<string>>(new Set());

  const handleStopAndDelete = async (job: BuildJob) => {
    if (deletingJobs.has(job.id)) return;
    setDeletingJobs((prev) => new Set(prev).add(job.id));
    try {
      if (job.repoName) { try { await supabase.functions.invoke("build-apk", { body: { action: "delete-repo", repoName: job.repoName } }); } catch (err) { console.error("Failed to delete repo:", err); } }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.from("builds").delete().eq("id", job.id);
      const store = useBuildStore.getState();
      const updatedJobs = store.jobs.filter((j) => j.id !== job.id);
      useBuildStore.setState({ jobs: updatedJobs, activeJobId: updatedJobs.length > 0 ? updatedJobs[0].id : null });
    } catch (err) { console.error("Failed to stop/delete build:", err); } finally {
      setDeletingJobs((prev) => { const n = new Set(prev); n.delete(job.id); return n; });
    }
  };

  const [refreshingJobs, setRefreshingJobs] = useState<Set<string>>(new Set());

  const handleRefreshStatus = async (job: BuildJob) => {
    if (!job.repoName) return;
    setRefreshingJobs((prev) => new Set(prev).add(job.id));
    try {
      const { data } = await supabase.functions.invoke("build-apk", { body: { action: "status", repoName: job.repoName, runId: job.runId } });
      if (data) {
        const newStatus = data.status === "success" ? "success" : data.status === "failure" ? "failure" : job.status;
        const updates: Partial<BuildJob> = { status: newStatus as BuildJob["status"] };
        if (data.runId) updates.runId = data.runId;
        if (data.errorInfo) updates.errorInfo = data.errorInfo;
        if (data.logs?.length) updates.logs = [...(job.logs || []), ...data.logs.map((l: string) => "> " + l)];
        if (newStatus === "success" || newStatus === "failure") {
          updates.completedAt = Date.now(); updates.stage = newStatus === "success" ? "Build complete" : "Build failed";
          if (data.buildLogs) updates.error = data.buildLogs.split("\n").slice(-5).join("\n");
        }
        updateJob(job.id, updates);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from("builds").update({ status: updates.status || job.status, stage: updates.stage || job.stage, completed_at: updates.completedAt ? new Date(updates.completedAt).toISOString() : null, error: updates.error || null, error_info: data.errorInfo || null } as any).eq("id", job.id);
        }
      }
    } catch (err) { console.error("Refresh failed:", err); } finally {
      setRefreshingJobs((prev) => { const n = new Set(prev); n.delete(job.id); return n; });
    }
  };

  // Filter by project first, then by status
  const projectJobs = currentProjectId
    ? jobs.filter((j) => j.projectId === currentProjectId)
    : jobs;

  const filteredJobs = projectJobs.filter((job) => {
    if (filter === "all") return true;
    if (filter === "success") return job.status === "success";
    if (filter === "failure") return job.status === "failure" || job.status === "timeout";
    if (filter === "building") return job.status === "building" || job.status === "uploading" || job.status === "queued";
    return true;
  });

  const successCount = projectJobs.filter(j => j.status === "success").length;
  const failedCount = projectJobs.filter(j => j.status === "failure" || j.status === "timeout").length;
  const activeCount = projectJobs.filter(j => ["queued", "uploading", "building"].includes(j.status)).length;

  if (projectJobs.length === 0) {
    return (
      <div className="min-h-screen w-full">
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Build History</h1>
            <Button size="sm" className="gap-1.5" onClick={goToCreate}>
              <Package size={14} /> New Build
            </Button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Terminal size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No builds yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Create an app and start a build to see progress and logs here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      {/* Pending Changes Card */}
      {pendingChanges.length > 0 && (
          <div className="mx-3 sm:mx-5 mt-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">{pendingChanges.length} Pending Change{pendingChanges.length > 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={clearPendingChanges} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
                <Button size="sm" className="gap-1.5 bg-primary" onClick={goToCreate}>
                  <RefreshCw size={13} /> Rebuild Now
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              {pendingChanges.map((c) => (
                <div key={c.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {c.label}
                </div>
              ))}
            </div>
          </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-foreground">Build History</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{projectJobs.length} total</span>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={goToCreate}>
              <RefreshCw size={13} /> Rebuild
            </Button>
          </div>
        </div>
        {/* Filter tabs - scrollable on mobile */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {[
            { key: "all" as FilterStatus, label: "All", count: projectJobs.length },
            { key: "building" as FilterStatus, label: "Active", count: activeCount },
            { key: "success" as FilterStatus, label: "Success", count: successCount },
            { key: "failure" as FilterStatus, label: "Failed", count: failedCount },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => updateBuildFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label} {f.count > 0 && <span className="ml-1 opacity-70">{f.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Active build detail */}
      {activeJob && (
        <div className="mx-3 sm:mx-5 mb-4 rounded-xl bg-card overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {(() => {
                const cfg = getStatusConfig(activeJob.status);
                const Icon = cfg.icon;
                const isSpinning = activeJob.status === "uploading" || activeJob.status === "building";
                return <Icon size={16} className={`${cfg.color} ${isSpinning ? "animate-spin" : ""}`} />;
              })()}
              <span className="font-semibold text-sm text-foreground truncate">{activeJob.appName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono shrink-0">
                {activeJob.packageName}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                {getStatusConfig(activeJob.status).label}
              </span>
            </div>
            {(activeJob.status === "building" || activeJob.status === "uploading") ? (
              <span className="text-xs shimmer-text font-medium">{activeJob.stage}</span>
            ) : (
              <span className="text-xs text-muted-foreground">{activeJob.stage}</span>
            )}
          </div>

          {/* Build Logs & Error Logs tabs */}
          {(() => {
            const isFailed = activeJob.status === "failure" || activeJob.status === "timeout";
            const errorLogs = activeJob.logs.filter(l => 
              l.includes("✗") || l.includes("ERR") || l.includes("error") || l.includes("FAIL") || 
              l.includes("Error") || l.includes("Exception") || l.includes("not found") || l.includes("missing")
            );
            return (
              <div className="mx-3 sm:mx-4 mb-3">
                <div className="flex gap-1 mb-2">
                  <button className="text-xs px-3 py-1.5 rounded-full bg-muted text-foreground font-medium" id="tab-logs">
                    Build Logs ({activeJob.logs.length})
                  </button>
                  {isFailed && (
                    <button className="text-xs px-3 py-1.5 rounded-full bg-destructive/10 text-destructive font-medium" id="tab-errors">
                      Error Report ({errorLogs.length})
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Log terminal */}
          <div ref={logRef} className="h-48 sm:h-64 overflow-y-auto build-log-terminal mx-3 sm:mx-4 mb-3 p-3">
            {activeJob.logs.length === 0 && <div className="text-muted-foreground/50 italic">Waiting for build logs...</div>}
            {activeJob.logs.map((log, i) => (
              <div key={i} className={log.startsWith("> ✓") ? "text-[hsl(var(--success))]" : log.startsWith("> ✗") || log.startsWith("> ⚠") ? "text-destructive" : "text-foreground/70"}>
                {log}
              </div>
            ))}
            {(activeJob.status === "building" || activeJob.status === "uploading") && (
              <span className="inline-block w-1.5 h-3 bg-foreground/60 animate-pulse" />
            )}
          </div>

          {activeJob.status === "failure" && (
            <div className="mx-3 sm:mx-4 mb-3">
              <BuildErrorPanel
                error={activeJob.error}
                errorInfo={activeJob.errorInfo}
                logs={activeJob.logs}
                repoUrl={activeJob.repoUrl}
                onRetry={() => handleRetry(activeJob)}
                onFixAndRetry={(fix) => handleFixAndRetry(activeJob, fix)}
              />
            </div>
          )}

          {/* Repo management */}
          {activeJob.repoName && (
            <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {activeJob.repoUrl && (
                  <a href={activeJob.repoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <ExternalLink size={12} /> View Repository
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={!activeJob.autoDeleteRepo} onCheckedChange={(checked) => handleToggleKeepRepo(activeJob, checked)} />
                  Keep repo
                </label>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive gap-1" onClick={() => handleDeleteRepo(activeJob)}>
                  <Trash2 size={12} /> Delete
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-4 py-3 flex gap-2 flex-wrap">
            {activeJob.status === "success" && (activeJob.apkBlob || activeJob.apkUrl) && (
              <Button size="sm" className="gap-1.5" onClick={() => handleDownloadAPK(activeJob)}><Download size={14} /> Download APK</Button>
            )}
            {activeJob.status === "success" && activeJob.zipBlob && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDownloadZip(activeJob)}><Package size={14} /> Download ZIP</Button>
            )}
            {activeJob.status === "success" && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleQuickRebuild(activeJob)}>
                <Rocket size={14} /> Quick Rebuild
              </Button>
            )}
            {(activeJob.status === "failure" || activeJob.status === "timeout") && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleRetry(activeJob)}><RefreshCw size={14} /> Retry Build</Button>
            )}
            {["queued", "uploading", "building"].includes(activeJob.status) && activeJob.repoName && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleRefreshStatus(activeJob)} disabled={refreshingJobs.has(activeJob.id)}>
                <RotateCcw size={14} className={refreshingJobs.has(activeJob.id) ? "animate-spin" : ""} />
                {refreshingJobs.has(activeJob.id) ? "Checking..." : "Refresh Status"}
              </Button>
            )}
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => handleStopAndDelete(activeJob)} disabled={deletingJobs.has(activeJob.id)}>
              {deletingJobs.has(activeJob.id) ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />}
              {deletingJobs.has(activeJob.id) ? "Deleting..." : "Stop & Delete"}
            </Button>
          </div>

          {activeJob.error && activeJob.status !== "failure" && (
            <div className="px-4 py-2 text-xs text-destructive bg-destructive/5">{activeJob.error}</div>
          )}
        </div>
      )}

      {/* Job list - card style */}
      <div className="px-3 sm:px-5 space-y-2 pb-20">
        {filteredJobs.map((job) => {
          const cfg = getStatusConfig(job.status);
          const Icon = cfg.icon;
          const EngineIcon = getEngineIcon(job.engine);
          const isSpinning = job.status === "uploading" || job.status === "building";
          const isActive = job.id === activeJobId;
          const elapsed = job.completedAt
            ? Math.round((job.completedAt - job.startedAt) / 1000)
            : Math.round((Date.now() - job.startedAt) / 1000);

          return (
            <div
              key={job.id}
              onClick={() => setActiveJob(job.id)}
              role="button"
              tabIndex={0}
              className={`w-full text-left px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer ${isActive ? "bg-primary/5 ring-1 ring-primary/20" : "bg-card"}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <Icon size={18} className={`${cfg.color} ${isSpinning ? "animate-spin" : ""}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{job.appName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0">
                      {job.packageName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1 shrink-0">
                      <EngineIcon size={10} />
                      {job.engine}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {isSpinning ? (
                      <span className="text-xs shimmer-text font-medium">{job.stage}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{cfg.label}</span>
                    )}
                    <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{formatTime(elapsed)}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{formatDate(job.startedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(job.apkBlob || job.apkUrl) && <Download size={14} className="text-[hsl(var(--success))]" />}
                  {job.zipBlob && <Package size={14} className="text-[hsl(var(--success))]" />}
                  {["queued", "uploading", "building"].includes(job.status) && job.repoName && (
                    <button onClick={(e) => { e.stopPropagation(); handleRefreshStatus(job); }} className="p-1 hover:bg-muted rounded-full" disabled={refreshingJobs.has(job.id)}>
                      <RotateCcw size={14} className={`text-muted-foreground ${refreshingJobs.has(job.id) ? "animate-spin" : ""}`} />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleStopAndDelete(job); }} className="p-1 hover:bg-destructive/10 rounded-full" disabled={deletingJobs.has(job.id)}>
                    {deletingJobs.has(job.id) ? <Loader2 size={14} className="text-destructive animate-spin" /> : <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredJobs.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No {filter} builds found</div>
        )}
      </div>
    </div>
  );
};

export default BuildsView;
