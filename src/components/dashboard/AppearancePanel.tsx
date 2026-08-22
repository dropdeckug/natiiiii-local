import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import JSZip from "jszip";
import {
  Palette, Smartphone, Image as ImageIcon, Sun, Moon, Upload, RotateCcw,
  Sparkles, Save, CheckCircle2, Layers, Hammer, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AppearanceRow, defaultAppearance, loadAppearance, upsertAppearance,
  uploadAppearanceAsset, getAppearanceAssetUrl,
} from "@/lib/appearance/appearanceService";
import { analyzeIcon, CAPACITOR_SAFE_ZONE_PADDING_PCT } from "@/lib/appearance/iconIntelligence";
import {
  renderRole, renderRoleToBlob, ANDROID_DENSITIES, AppearanceConfig, IconRole,
} from "@/lib/appearance/iconRenderer";
import { useProjectStore, type ProjectFile } from "@/stores/projectStore";

const ROLES: { role: IconRole; label: string; note: string }[] = [
  { role: "launcher", label: "Launcher (square)", note: "ic_launcher.png" },
  { role: "launcherRound", label: "Launcher (round)", note: "ic_launcher_round.png" },
  { role: "adaptiveForeground", label: "Adaptive foreground", note: "66/108 safe zone" },
  { role: "adaptiveBackground", label: "Adaptive background", note: "solid color" },
  { role: "splash", label: "Splash", note: "centered logo at 40%" },
];

const DENSITY_SPECS = [
  { name: "mdpi", launcher: 48, adaptive: 108 },
  { name: "hdpi", launcher: 72, adaptive: 162 },
  { name: "xhdpi", launcher: 96, adaptive: 216 },
  { name: "xxhdpi", launcher: 144, adaptive: 324 },
  { name: "xxxhdpi", launcher: 192, adaptive: 432 },
];

const flattenProjectFiles = (nodes: ProjectFile[]): ProjectFile[] =>
  nodes.flatMap((node) => [node, ...(node.children ? flattenProjectFiles(node.children) : [])]);

const basename = (path: string) => path.split("/").pop()?.toLowerCase() || "";
const parentFolder = (path: string) => path.split("/").slice(0, -1).join("/");

function relLuminance(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const ch = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

const AppearancePanel = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const addPendingChange = useProjectStore((s) => s.addPendingChange);
  const mergeFiles = useProjectStore((s) => s.mergeFiles);
  const files = useProjectStore((s) => s.files);

  // Capacitor Android is "installed" once the native Android resource tree exists.
  const androidInstalled = useMemo(() => {
    const flat = flattenProjectFiles(files).map((file) => file.path);
    return flat.some((p) =>
      p === "android/app/src/main/AndroidManifest.xml" ||
      p.startsWith("android/app/src/main/res/mipmap-") ||
      p.startsWith("android/app/src/main/res/drawable")
    );
  }, [files]);

  const [patching, setPatching] = useState(false);
  const [punchedAt, setPunchedAt] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [row, setRow] = useState<AppearanceRow | null>(null);
  const [foregroundDataUrl, setForegroundDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [activeRole, setActiveRole] = useState<IconRole>("launcher");
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);

  // Load
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const existing = await loadAppearance(projectId);
        const initial = existing ?? defaultAppearance(projectId);
        setRow(initial);
        if (initial.icon_foreground_path) {
          const url = await getAppearanceAssetUrl(initial.icon_foreground_path);
          if (url) {
            // Convert to data URL for canvas reuse without CORS surprises
            try {
              const r = await fetch(url);
              const b = await r.blob();
              setForegroundDataUrl(await new Promise<string>((res) => {
                const fr = new FileReader();
                fr.onload = () => res(fr.result as string);
                fr.readAsDataURL(b);
              }));
            } catch { setForegroundDataUrl(url); }
          }
        }
      } catch (e: any) {
        toast.error(`Failed to load appearance: ${e.message}`);
      }
    })();
  }, [projectId]);

  const cfg: AppearanceConfig | null = useMemo(() => {
    if (!row) return null;
    return {
      iconForegroundUrl: foregroundDataUrl,
      iconBackgroundColor: row.icon_background_color,
      iconPaddingPct: Number(row.icon_padding_pct),
      iconCornerRadiusPct: Number(row.icon_corner_radius_pct),
      iconLetterFallback: row.icon_letter_fallback,
      splashBgColor: row.splash_bg_color,
    };
  }, [row, foregroundDataUrl]);

  const punchAndroidAssets = useCallback(async () => {
    if (!cfg) return;
    if (!androidInstalled) {
      toast.error("Android Capacitor is not installed yet — run the Android setup/build first.");
      return;
    }
    setPatching(true);
    try {
      const incoming: { path: string; binaryContent: ArrayBuffer; isBinary: true }[] = [];
      const pushPng = async (path: string, role: IconRole, size: number) => {
        const blob = await renderRoleToBlob(cfg, role, size);
        incoming.push({ path, binaryContent: await blob.arrayBuffer(), isBinary: true });
      };

      for (const density of DENSITY_SPECS) {
        const base = `android/app/src/main/res/mipmap-${density.name}`;
        await pushPng(`${base}/ic_launcher.png`, "launcher", density.launcher);
        await pushPng(`${base}/ic_launcher_round.png`, "launcherRound", density.launcher);
        await pushPng(`${base}/ic_launcher_foreground.png`, "adaptiveForeground", density.adaptive);
        await pushPng(`${base}/ic_launcher_background.png`, "adaptiveBackground", density.adaptive);
      }

      const existingFiles = flattenProjectFiles(files);
      const drawableFolders = new Set(
        existingFiles
          .filter((file) => file.path.startsWith("android/app/src/main/res/drawable"))
          .map((file) => file.type === "folder" ? file.path : parentFolder(file.path))
          .filter(Boolean)
      );

      for (const folder of drawableFolders) {
        const density = DENSITY_SPECS.find((d) => folder.endsWith(`-${d.name}`));
        const launcherSize = density?.launcher ?? 192;
        const adaptiveSize = density?.adaptive ?? 432;
        await pushPng(`${folder}/ic_launcher.png`, "launcher", launcherSize);
        await pushPng(`${folder}/ic_launcher_round.png`, "launcherRound", launcherSize);
        await pushPng(`${folder}/ic_launcher_foreground.png`, "adaptiveForeground", adaptiveSize);
        await pushPng(`${folder}/ic_launcher_background.png`, "adaptiveBackground", adaptiveSize);
      }

      const existingDrawablePngs = existingFiles.filter((file) =>
        file.type === "file" &&
        file.path.startsWith("android/app/src/main/res/drawable") &&
        basename(file.path).endsWith(".png")
      );

      for (const file of existingDrawablePngs) {
        const name = basename(file.path);
        const folder = parentFolder(file.path);
        const role: IconRole = name.includes("splash")
          ? "splash"
          : name.includes("foreground")
            ? "adaptiveForeground"
            : name.includes("background")
              ? "adaptiveBackground"
              : name.includes("round")
                ? "launcherRound"
                : "launcher";
        const density = DENSITY_SPECS.find((d) => folder.endsWith(`-${d.name}`));
        const size = role === "launcher" || role === "launcherRound"
          ? density?.launcher ?? 192
          : density?.adaptive ?? 432;
        await pushPng(file.path, role, size);
      }

      if (!existingDrawablePngs.some((file) => basename(file.path) === "ic_launcher_foreground.png")) {
        await pushPng("android/app/src/main/res/drawable/ic_launcher_foreground.png", "adaptiveForeground", 432);
      }

      mergeFiles(incoming);
      addPendingChange({ type: "appearance_changed", label: `Punched ${incoming.length} Android icon assets` });
      setPunchedAt(Date.now());
      toast.success(`Punch complete — replaced ${incoming.length} drawable/mipmap icon assets`);
    } catch (e: any) {
      toast.error(`Punch failed: ${e.message}`);
    } finally {
      setPatching(false);
    }
  }, [cfg, androidInstalled, files, mergeFiles, addPendingChange]);

  const downloadResFolder = useCallback(async () => {
    setDownloading(true);
    try {
      const flat = flattenProjectFiles(files);
      const resFiles = flat.filter(
        (f) => f.type === "file" && f.path.startsWith("android/app/src/main/res/")
      );
      if (resFiles.length === 0) {
        toast.error("No res/ files found. Run Punch first.");
        return;
      }
      const zip = new JSZip();
      const root = zip.folder("res")!;
      for (const f of resFiles) {
        const rel = f.path.replace("android/app/src/main/res/", "");
        if (f.binaryContent) {
          root.file(rel, f.binaryContent);
        } else {
          root.file(rel, f.content ?? "");
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `res-patched-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded res/ (${resFiles.length} files)`);
    } catch (e: any) {
      toast.error(`Download failed: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  }, [files]);

  // Live preview
  const drawPreview = useCallback(async () => {
    if (!cfg || !previewCanvasRef.current) return;
    await renderRole(cfg, activeRole, 256, previewCanvasRef.current);
  }, [cfg, activeRole]);

  useEffect(() => { drawPreview(); }, [drawPreview]);

  // Density gallery
  useEffect(() => {
    if (!cfg || !galleryRef.current) return;
    const root = galleryRef.current;
    root.querySelectorAll("canvas[data-density]").forEach(async (el) => {
      const c = el as HTMLCanvasElement;
      const size = parseInt(c.dataset.size || "48", 10);
      const role = (c.dataset.role || "launcher") as IconRole;
      await renderRole(cfg, role, size, c);
    });
  }, [cfg]);

  // Debounced auto-save
  const queueSave = useCallback((next: AppearanceRow) => {
    setRow(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        setSaving(true);
        const saved = await upsertAppearance(next);
        setRow(saved);
        setSavedAt(Date.now());
        addPendingChange({ type: "appearance_changed", label: "Appearance updated" });
      } catch (e: any) {
        toast.error(`Save failed: ${e.message}`);
      } finally {
        setSaving(false);
      }
    }, 600);
  }, [addPendingChange]);

  const update = (patch: Partial<AppearanceRow>) => {
    if (!row) return;
    queueSave({ ...row, ...patch });
  };

  const runIconAnalysis = useCallback(async (dataUrl: string, silent = false) => {
    try {
      const a = await analyzeIcon(dataUrl);
      if (!row) return;
      const patch: Partial<AppearanceRow> = {
        icon_padding_pct: a.suggestedPaddingPct,
      };
      // If the image is fully opaque (no alpha), the edges define the icon's
      // background — match Capacitor's default behavior of using that color.
      if (!a.hasAlpha && a.dominantEdgeColor) {
        patch.icon_background_color = a.dominantEdgeColor;
      }
      queueSave({ ...row, ...patch });
      if (!silent) {
        toast.success(
          `AI matched Capacitor specs: content padding ${a.contentPaddingPct}% detected → applying ${a.suggestedPaddingPct}% (safe zone ${CAPACITOR_SAFE_ZONE_PADDING_PCT}%)`
        );
      }
    } catch (e: any) {
      if (!silent) toast.error(`AI analyze failed: ${e.message}`);
    }
  }, [row, queueSave]);

  const handleForegroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId || !row) return;
    try {
      const ext = file.name.toLowerCase().endsWith(".svg") ? "svg" : "png";
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      setForegroundDataUrl(dataUrl);
      const path = await uploadAppearanceAsset(projectId, file, `foreground.${ext}`);
      update({ icon_foreground_path: path });
      toast.success("Icon uploaded — analyzing to match Capacitor defaults…");
      // Auto-run AI analysis to mirror Capacitor's default sizing/padding
      if (ext !== "svg") {
        setTimeout(async () => {
          await runIconAnalysis(dataUrl, false);
        }, 50);
      }
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    }
  };

  const handleResetForeground = () => {
    setForegroundDataUrl(null);
    update({ icon_foreground_path: null });
  };

  const aiSuggestStatusBar = () => {
    if (!row) return;
    const lightLum = relLuminance(row.status_bar_color);
    const darkLum = relLuminance(row.status_bar_color_dark);
    // If background is light, content should be dark (= 'dark' icons)
    const style = lightLum > 0.5 ? "dark" : "light";
    update({ status_bar_style: style as any });
    toast.success(`Status bar style set to '${style}' based on background luminance`);
  };

  const aiSuggestSplash = () => {
    if (!row) return;
    update({
      splash_bg_color: row.icon_background_color,
      splash_bg_color_dark: row.icon_background_color,
    });
    toast.success("Splash colors matched to your icon background");
  };

  if (!row || !cfg) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading appearance…</div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Configure icons, status bar, splash, edge-to-edge. Changes are staged and applied on next build.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving ? (
              <Badge variant="outline" className="gap-1.5"><Save size={11} className="animate-pulse" /> Saving…</Badge>
            ) : savedAt ? (
              <Badge variant="outline" className="gap-1.5 text-green-600"><CheckCircle2 size={11} /> Saved</Badge>
            ) : null}
            {row.staged && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Staged</Badge>}
          </div>
        </div>

        {/* Icon Designer */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Palette size={15} /> App Icon Designer
          </h3>
          <div className="rounded-[4px] border border-border bg-card p-4">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Live preview */}
              <div className="flex flex-col items-center gap-3 min-w-[256px]">
                <canvas
                  ref={previewCanvasRef}
                  width={256}
                  height={256}
                  className="border border-border rounded-2xl bg-muted/20"
                />
                <div className="flex flex-wrap gap-1 justify-center max-w-[256px]">
                  {ROLES.map((r) => (
                    <button
                      key={r.role}
                      onClick={() => setActiveRole(r.role)}
                      className={`text-[10px] px-2 py-1 rounded-[3px] transition-colors ${
                        activeRole === r.role
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">{ROLES.find(r => r.role === activeRole)?.note}</span>
              </div>

              {/* Controls */}
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Foreground Image (PNG or SVG)</label>
                    {androidInstalled ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        {patching ? (
                          <><Sparkles size={9} className="animate-pulse" /> Punching assets…</>
                        ) : (
                          <><Layers size={9} /> Android linked · ready to punch</>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Android Capacitor not installed
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={handleForegroundUpload} className="hidden" />
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                        <span><Upload size={12} /> Upload</span>
                      </Button>
                    </label>
                    {foregroundDataUrl && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => foregroundDataUrl && runIconAnalysis(foregroundDataUrl, false)}
                        >
                          <Sparkles size={11} /> AI analyze & match
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={punchAndroidAssets}
                          disabled={patching || !androidInstalled}
                        >
                          <Hammer size={11} /> {patching ? "Punching…" : "Punch"}
                        </Button>
                        {punchedAt && androidInstalled && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={downloadResFolder}
                            disabled={downloading}
                            title="Download the patched android/app/src/main/res folder as a zip"
                          >
                            <Download size={11} /> {downloading ? "Zipping…" : "Download res/"}
                          </Button>
                        )}
                        <button onClick={handleResetForeground} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <RotateCcw size={11} /> Reset
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Background</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={row.icon_background_color} onChange={(e) => update({ icon_background_color: e.target.value })} className="h-8 w-8 rounded cursor-pointer" />
                      <Input value={row.icon_background_color} onChange={(e) => update({ icon_background_color: e.target.value })} className="h-8 text-xs font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Letter fallback</label>
                    <Input value={row.icon_letter_fallback || ""} onChange={(e) => update({ icon_letter_fallback: e.target.value.slice(0, 1) })} className="h-8 text-xs mt-1" maxLength={1} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Padding ({row.icon_padding_pct}%) — applied to ALL densities identically</label>
                  <Slider value={[Number(row.icon_padding_pct)]} onValueChange={([v]) => update({ icon_padding_pct: v })} min={0} max={40} step={1} className="mt-2" />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Corner Radius ({row.icon_corner_radius_pct}%)</label>
                  <Slider value={[Number(row.icon_corner_radius_pct)]} onValueChange={([v]) => update({ icon_corner_radius_pct: v })} min={0} max={50} step={1} className="mt-2" />
                </div>
              </div>
            </div>

            {/* Density gallery */}
            <div className="mt-4 pt-4 border-t border-border" ref={galleryRef}>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layers size={11} /> Generated for every Android density
              </p>
              <div className="grid grid-cols-5 gap-3">
                {ANDROID_DENSITIES.map((d) => (
                  <div key={d.name} className="text-center">
                    <canvas
                      data-density={d.name}
                      data-size={d.size}
                      data-role="launcher"
                      width={d.size}
                      height={d.size}
                      className="mx-auto border border-border rounded-md bg-muted/20"
                      style={{ width: d.size, height: d.size }}
                    />
                    <span className="text-[9px] text-muted-foreground block mt-1">{d.name}<br/>{d.size}px</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Status Bar */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Smartphone size={15} /> Status Bar</h3>
          <div className="rounded-[4px] border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Visible</span>
              <Switch checked={row.status_bar_visible} onCheckedChange={(v) => update({ status_bar_visible: v })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Sun size={11} /> Light theme color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={row.status_bar_color} onChange={(e) => update({ status_bar_color: e.target.value })} className="h-8 w-8 rounded cursor-pointer" />
                  <Input value={row.status_bar_color} onChange={(e) => update({ status_bar_color: e.target.value })} className="h-8 text-xs font-mono flex-1" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Moon size={11} /> Dark theme color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={row.status_bar_color_dark} onChange={(e) => update({ status_bar_color_dark: e.target.value })} className="h-8 w-8 rounded cursor-pointer" />
                  <Input value={row.status_bar_color_dark} onChange={(e) => update({ status_bar_color_dark: e.target.value })} className="h-8 text-xs font-mono flex-1" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Content style</label>
              <div className="flex gap-2 mt-1">
                {(["light", "dark", "auto"] as const).map((s) => (
                  <button key={s} onClick={() => update({ status_bar_style: s })}
                    className={`px-3 py-1.5 rounded-[3px] text-xs font-medium transition-colors ${
                      row.status_bar_style === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                    {s}
                  </button>
                ))}
                <Button size="sm" variant="outline" className="gap-1.5 text-xs ml-auto" onClick={aiSuggestStatusBar}>
                  <Sparkles size={11} /> AI suggest
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Splash */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><ImageIcon size={15} /> Splash Screen</h3>
          <div className="rounded-[4px] border border-border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Sun size={11} /> Light bg</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={row.splash_bg_color} onChange={(e) => update({ splash_bg_color: e.target.value })} className="h-8 w-8 rounded cursor-pointer" />
                  <Input value={row.splash_bg_color} onChange={(e) => update({ splash_bg_color: e.target.value })} className="h-8 text-xs font-mono flex-1" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Moon size={11} /> Dark bg</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={row.splash_bg_color_dark} onChange={(e) => update({ splash_bg_color_dark: e.target.value })} className="h-8 w-8 rounded cursor-pointer" />
                  <Input value={row.splash_bg_color_dark} onChange={(e) => update({ splash_bg_color_dark: e.target.value })} className="h-8 text-xs font-mono flex-1" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Duration ({row.splash_duration_ms}ms)</label>
              <Slider value={[row.splash_duration_ms]} onValueChange={([v]) => update({ splash_duration_ms: v })} min={500} max={8000} step={250} className="mt-2" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Resize mode</label>
              <div className="flex gap-2 mt-1">
                {(["contain", "cover", "fill"] as const).map((m) => (
                  <button key={m} onClick={() => update({ splash_resize_mode: m })}
                    className={`px-3 py-1.5 rounded-[3px] text-xs font-medium ${
                      row.splash_resize_mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                    {m}
                  </button>
                ))}
                <Button size="sm" variant="outline" className="gap-1.5 text-xs ml-auto" onClick={aiSuggestSplash}>
                  <Sparkles size={11} /> Match icon bg
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Edge to edge */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Layers size={15} /> Edge-to-Edge</h3>
          <div className="rounded-[4px] border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Draw under system bars</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Adds <code>WindowCompat.setDecorFitsSystemWindows(window, false)</code> to MainActivity and translucent system bars.
                </p>
              </div>
              <Switch checked={row.edge_to_edge_enabled} onCheckedChange={(v) => update({ edge_to_edge_enabled: v })} />
            </div>
            {row.edge_to_edge_enabled && (
              <div>
                <label className="text-xs text-muted-foreground">Navigation bar color (ARGB)</label>
                <Input value={row.edge_to_edge_nav_color} onChange={(e) => update({ edge_to_edge_nav_color: e.target.value })} className="h-8 text-xs font-mono mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Use <code>#00000000</code> for fully transparent.</p>
              </div>
            )}
          </div>
        </section>

        {/* Default Theme */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Sun size={15} /> Default Theme</h3>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button key={t} onClick={() => update({ default_theme: t })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-[4px] border transition-all ${
                  row.default_theme === t ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                }`}>
                {t === "light" ? <Sun size={14} /> : t === "dark" ? <Moon size={14} /> : <Layers size={14} />}
                <span className="text-sm text-foreground capitalize">{t}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
};

export default AppearancePanel;
