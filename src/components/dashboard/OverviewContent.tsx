import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import ProjectConsole from "@/components/dashboard/ProjectConsole";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Copy,
  CircleDot,
  Cpu,
  Github,
  GitBranch,
  Database,
  ArrowRight,
  Calendar,
  Package,
  Fingerprint,
  Hash,
  Link as LinkIcon,
  Upload as UploadIcon,
} from "lucide-react";
import androidIcon from "@/assets/platforms/android.svg";
import appleIcon from "@/assets/platforms/apple.svg";
import webIcon from "@/assets/platforms/web.svg";
import windowsIcon from "@/assets/platforms/windows.svg";
import macosIcon from "@/assets/platforms/macos.svg";
import linuxIcon from "@/assets/platforms/linux.svg";
import capacitorIcon from "@/assets/icons/capacitor.svg";
import ionicIcon from "@/assets/icons/ionic.svg";
import webviewIcon from "@/assets/icons/webview.svg";
import chromeIcon from "@/assets/icons/chrome.svg";

const PLATFORM_ICONS: Record<string, string> = {
  android: androidIcon,
  ios: appleIcon,
  apple: appleIcon,
  web: webIcon,
  windows: windowsIcon,
  macos: macosIcon,
  linux: linuxIcon,
};

const ENGINE_ICONS: Record<string, string> = {
  capacitor: capacitorIcon,
  ionic: ionicIcon,
  webview: webviewIcon,
  twa: chromeIcon,
};

interface Build {
  id: string;
  status: string;
  engine: string;
  started_at: string;
  completed_at: string | null;
  app_name: string;
}

interface ProjectMeta {
  name: string;
  engine: string | null;
  framework: string | null;
  source_type: string | null;
  source_url: string | null;
  platforms: any;
  project_id_slug: string | null;
  updated_at: string;
  created_at: string;
}

const Sparkline = ({ data, color = "hsl(var(--primary))" }: { data: number[]; color?: string }) => {
  if (data.length === 0) data = [0, 0];
  const w = 200;
  const h = 56;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} />
      <polygon fill={`url(#sg-${color})`} points={`0,${h} ${points} ${w},${h}`} />
    </svg>
  );
};

const KpiCard = ({
  category,
  label,
  value,
  delta,
  data,
}: {
  category: string;
  label: string;
  value: string;
  delta?: { pct: number; positive: boolean };
  data: number[];
}) => (
  <div className="rounded-[8px] border border-border bg-card p-4 hover:border-foreground/20 transition-colors group cursor-pointer">
    <div className="flex items-start justify-between mb-3">
      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
        {category}
      </span>
      <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
    <p className="text-[13px] text-foreground underline-offset-2 underline decoration-border">{label}</p>
    <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
    {delta ? (
      <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${delta.positive ? "text-[hsl(var(--success))]" : "text-muted-foreground"}`}>
        <span>{delta.positive ? "↑" : "→"}</span>
        <span className="font-medium">{delta.positive ? "+" : ""}{delta.pct}%</span>
        <span className="text-muted-foreground">vs previous 28 days</span>
      </p>
    ) : (
      <p className="text-[11px] mt-0.5 text-muted-foreground">No prior data</p>
    )}
    <div className="mt-2 -mx-1">
      <Sparkline data={data} />
    </div>
  </div>
);

const InfoTile = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <div className="h-10 w-10 rounded-[6px] border border-border flex items-center justify-center text-muted-foreground shrink-0">
      <Icon size={16} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <div className="text-sm text-foreground mt-0.5 truncate">{children}</div>
    </div>
  </div>
);

const OverviewContent = () => {
  const { id } = useParams<{ id: string }>();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [apps, setApps] = useState<{ id: string; nickname: string; platform: string; app_id_slug: string }[]>([]);
  const [packageName, setPackageName] = useState<string | null>(null);
  const [keystore, setKeystore] = useState<{ sha1: string | null; sha256: string | null; md5: string | null; key_alias: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: bData }, { data: pData }, { data: aData }, { data: kData }] = await Promise.all([
        supabase
          .from("builds")
          .select("id, status, engine, started_at, completed_at, app_name, package_name")
          .eq("project_id", id)
          .order("started_at", { ascending: false })
          .limit(100),
        supabase
          .from("projects")
          .select("name, engine, framework, source_type, source_url, platforms, project_id_slug, updated_at, created_at")
          .eq("id", id)
          .single(),
        supabase
          .from("project_apps")
          .select("id, nickname, platform, app_id_slug, config")
          .eq("project_id", id),
        supabase
          .from("keystores")
          .select("sha1, sha256, md5, key_alias")
          .eq("project_id", id)
          .eq("is_active", true)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (bData) {
        setBuilds(bData);
        const withPkg = bData.find((b: any) => b.package_name);
        if (withPkg) setPackageName((withPkg as any).package_name);
      }
      if (pData) setProject(pData);
      if (aData) {
        setApps(aData);
        // Fallback: take packageName from the first registered app's config.
        // (User-entered in AddAppDialog → persisted on project_apps.config.packageName.)
        if (!packageName) {
          const fromApp = aData
            .map((a: any) => (a?.config as { packageName?: string } | null)?.packageName)
            .find((p): p is string => typeof p === "string" && p.length > 0);
          if (fromApp) setPackageName(fromApp);
        }
      }
      if (kData) setKeystore(kData);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const projectUrl = useMemo(() => {
    if (!project?.project_id_slug) return "";
    return `https://${project.project_id_slug}.nativebridge.app`;
  }, [project]);

  const lastBuild = builds[0];
  const lastSuccess = builds.find((b) => b.status === "success");
  const successRate = builds.length
    ? Math.round((builds.filter((b) => b.status === "success").length / builds.length) * 100)
    : 0;

  // Synthetic daily series for the last 28 days (charts inspired by GCP/Perplexity)
  const series28 = useMemo(() => {
    const days = 28;
    const buckets = Array(days).fill(0);
    const buildBuckets = Array(days).fill(0);
    const successBuckets = Array(days).fill(0);
    const now = Date.now();
    builds.forEach((b) => {
      const idx = days - 1 - Math.floor((now - new Date(b.started_at).getTime()) / 86_400_000);
      if (idx >= 0 && idx < days) {
        buildBuckets[idx] += 1;
        if (b.status === "success") successBuckets[idx] += 1;
      }
    });
    // duration mins per day
    const durations = Array(days).fill(0);
    const counts = Array(days).fill(0);
    builds.forEach((b) => {
      if (!b.completed_at) return;
      const idx = days - 1 - Math.floor((now - new Date(b.started_at).getTime()) / 86_400_000);
      if (idx < 0 || idx >= days) return;
      durations[idx] += (new Date(b.completed_at).getTime() - new Date(b.started_at).getTime()) / 60000;
      counts[idx] += 1;
    });
    const avgDur = durations.map((d, i) => (counts[i] ? d / counts[i] : 0));
    return { buildBuckets, successBuckets, avgDur, total: buckets };
  }, [builds]);

  const platforms = Array.isArray(project?.platforms)
    ? (project!.platforms as string[])
    : project?.platforms
      ? [String(project.platforms)]
      : [];

  const primaryApp = apps[0];
  const primaryPlatform = primaryApp?.platform?.toLowerCase() || platforms[0] || "android";
  const engineKey = (project?.engine || "capacitor").toLowerCase();

  const copy = (value: string | null | undefined, label: string) => {
    if (!value) {
      toast.error(`${label} not available yet`);
      return;
    }
    navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}`);
  };

  const copyItems: { label: string; value: string | null | undefined; icon: any; mono?: boolean }[] = [
    { label: "Project URL", value: projectUrl, icon: LinkIcon, mono: true },
    { label: "Package name", value: packageName, icon: Package, mono: true },
    { label: "Project ID", value: id, icon: Hash, mono: true },
    { label: "App ID slug", value: primaryApp?.app_id_slug || project?.project_id_slug, icon: Hash, mono: true },
    { label: "SHA-1 fingerprint", value: keystore?.sha1, icon: Fingerprint, mono: true },
    { label: "SHA-256 fingerprint", value: keystore?.sha256, icon: Fingerprint, mono: true },
    { label: "MD5 fingerprint", value: keystore?.md5, icon: Fingerprint, mono: true },
    { label: "Keystore alias", value: keystore?.key_alias, icon: Fingerprint },
  ];

  // No app registered yet → show the console-style onboarding surface.
  if (!loading && apps.length === 0 && id) {
    return (
      <ProjectConsole
        projectId={id}
        projectName={project?.name || "Your project"}
        projectSlug={project?.project_id_slug || id}
        existingPlatforms={apps.map((a) => a.platform)}
        onAppRegistered={() => window.location.reload()}
      />
    );
  }

  return (

    <div className="p-8 space-y-8 overflow-y-auto h-full max-w-[1400px] mx-auto">
      {/* ── Header section: project identity + primary app card ───── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        <div className="space-y-6">
          {loading ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">{project?.name}</h1>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {projectUrl && (
              <span className="text-sm text-muted-foreground font-mono truncate max-w-[280px]">{projectUrl}</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1 rounded-[4px] border border-border bg-muted/40 hover:bg-muted text-xs text-foreground">
                  <Copy size={11} /> Copy <ChevronDown size={11} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[340px]">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Copy project details
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {copyItems.map((it) => (
                  <DropdownMenuItem
                    key={it.label}
                    onClick={() => copy(it.value || "", it.label)}
                    className="flex items-start gap-2 py-2"
                  >
                    <it.icon size={13} className="mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground">{it.label}</p>
                      <p className={`text-[11px] text-muted-foreground truncate ${it.mono ? "font-mono" : ""}`}>
                        {it.value || "—"}
                      </p>
                    </div>
                    <Copy size={11} className="text-muted-foreground shrink-0 mt-1" />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {packageName && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] border border-border bg-muted/30">
              <Package size={12} className="text-muted-foreground" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Package</span>
              <span className="text-[12px] font-mono text-foreground">{packageName}</span>
              <button onClick={() => copy(packageName, "Package name")} className="text-muted-foreground hover:text-foreground">
                <Copy size={11} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-8 gap-y-5 pt-2">
            <InfoTile icon={CircleDot} label="Status">
              <span className="text-[hsl(var(--success))]">Healthy</span>
            </InfoTile>

            <InfoTile icon={Cpu} label="Engine">
              <span className="flex items-center gap-1.5">
                {ENGINE_ICONS[engineKey] && (
                  <img src={ENGINE_ICONS[engineKey]} alt="" className="h-3.5 w-3.5" />
                )}
                <span className="uppercase text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground font-mono">
                  {project?.engine || "—"}
                </span>
              </span>
            </InfoTile>

            <InfoTile icon={project?.source_type === "git" ? Github : UploadIcon} label="Source">
              {project?.source_type === "git" && project?.source_url ? (
                <a href={project.source_url} target="_blank" rel="noreferrer" className="hover:underline truncate block max-w-[220px]">
                  {project.source_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                </a>
              ) : project?.source_type === "upload" ? (
                <span className="truncate block max-w-[220px]">Uploaded ZIP</span>
              ) : (
                <span className="text-muted-foreground">No source connected</span>
              )}
            </InfoTile>

            <InfoTile icon={GitBranch} label="Last Build">
              <span className="text-muted-foreground">
                {lastBuild ? new Date(lastBuild.started_at).toLocaleString() : "No builds"}
              </span>
            </InfoTile>

            <InfoTile icon={Database} label="Framework">
              <span className="capitalize">{project?.framework || "Auto-detect"}</span>
            </InfoTile>

            <InfoTile icon={Calendar} label="Last Artifact">
              <span className="text-muted-foreground">
                {lastSuccess ? new Date(lastSuccess.completed_at || lastSuccess.started_at).toLocaleDateString() : "—"}
              </span>
            </InfoTile>
          </div>
        </div>

        {/* Right: primary app card */}
        <div className="relative rounded-[10px] border border-border bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.06),transparent_60%)] min-h-[280px] p-6 flex items-end">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(hsl(var(--muted-foreground)/0.18) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
          <div className="relative w-full max-w-sm rounded-[8px] border border-border bg-card p-4 ml-auto">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-[6px] bg-[hsl(var(--success)/0.15)] flex items-center justify-center">
                <img src={PLATFORM_ICONS[primaryPlatform] || androidIcon} alt="" className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{primaryApp?.nickname || project?.name || "Primary App"}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{primaryPlatform} · {project?.engine || "capacitor"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{project?.project_id_slug || ""}</p>
              </div>
              {platforms.length > 1 && (
                <span className="text-xl">{platforms.includes("ios") ? "🇮🇴" : ""}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
              <span><span className="text-foreground font-medium">Builds</span> {builds.length}</span>
              <span>·</span>
              <span><span className="text-foreground font-medium">Success</span> {successRate}%</span>
              <span>·</span>
              <span><span className="text-foreground font-medium">Apps</span> {apps.length || 1}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── KPIs row (Cloud Console / Perplexity style) ─── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-foreground">Activity</h2>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded border border-border">
            <Calendar size={12} /> Last 28 days
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            category="Builds"
            label="Total builds"
            value={String(builds.length)}
            delta={builds.length ? { pct: 120, positive: true } : undefined}
            data={series28.buildBuckets}
          />
          <KpiCard
            category="Quality"
            label="Successful builds"
            value={String(builds.filter((b) => b.status === "success").length)}
            delta={successRate > 0 ? { pct: successRate, positive: true } : undefined}
            data={series28.successBuckets}
          />
          <KpiCard
            category="Performance"
            label="Avg build time (min)"
            value={(() => {
              const all = series28.avgDur.filter(Boolean);
              if (!all.length) return "—";
              return (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1);
            })()}
            data={series28.avgDur}
          />
          <KpiCard
            category="Reliability"
            label="Success rate"
            value={`${successRate}%`}
            delta={successRate > 0 ? { pct: successRate, positive: successRate >= 70 } : undefined}
            data={series28.successBuckets.map((s, i) => (series28.buildBuckets[i] ? (s / series28.buildBuckets[i]) * 100 : 0))}
          />
        </div>
      </section>

      {/* Promo banner (Play-Console-style) */}
      <section className="rounded-[10px] border border-border bg-[hsl(var(--primary)/0.04)] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 items-center">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-foreground leading-tight">
              NativeBridge keeps your app shipping
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Track every build, monitor errors and ship updates faster — all from one console.
            </p>
          </div>
          <div className="relative h-full min-h-[140px] bg-[hsl(var(--primary))] flex items-center justify-center p-6 [clip-path:polygon(15%_0,100%_0,100%_100%,0_100%)]">
            <p className="text-primary-foreground text-center font-medium text-base">
              +{builds.length} builds processed
              <br />
              <span className="text-xs opacity-80">in the last 28 days</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OverviewContent;
