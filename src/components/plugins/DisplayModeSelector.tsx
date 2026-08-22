import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Layers, Loader2, Palette, Sparkles, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import {
  DISPLAY_MODES,
  DEFAULT_DISPLAY_MODE_CONFIG,
  DISPLAY_MODE_SECRET_KEYS,
  readDisplayModeConfig,
  resolveEffectiveSpec,
  type BaseDisplayModeId,
  type DisplayModeConfig,
  type DisplayModeId,
} from "@/lib/plugins/displayMode/registry";
import { savePluginSecret, type PluginSecret } from "@/lib/pluginSecretsService";

interface Props {
  projectId: string;
  savedSecrets: PluginSecret[];
  onSaved: () => void;
}

const PLUGIN_ID = "edge-to-edge";

const CAPABILITY_LABELS: { key: keyof ReturnType<typeof resolveEffectiveSpec>; label: string }[] = [
  { key: "overlaysWebView" as never, label: "Overlays WebView" },
  { key: "requiresViewportFitCover" as never, label: "viewport-fit=cover" },
  { key: "requiresBodyPaddingInjection" as never, label: "Safe-area padding" },
  { key: "requiresJsColorMatching" as never, label: "Runtime colour matching" },
  { key: "requiresGlassElements" as never, label: "Glass layers" },
  { key: "requiresPerPageRouteScanning" as never, label: "Full-screen page scan" },
];

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <label className="flex items-center justify-between gap-2 rounded-[4px] border border-border bg-card px-2.5 py-2">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-[11px] text-foreground">{value.toUpperCase()}</span>
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#FFFFFF"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
        aria-label={label}
      />
    </span>
  </label>
);

/** NativeForge Display Mode — five modes, colours, per-page base mode. */
const DisplayModeSelector = ({ projectId, savedSecrets, onSaved }: Props) => {
  const persisted = useMemo(() => {
    const values: Record<string, string> = {};
    for (const s of savedSecrets) {
      if (s.plugin_id === PLUGIN_ID) values[s.secret_key] = s.secret_value as string;
    }
    return readDisplayModeConfig(values);
  }, [savedSecrets]);

  const [cfg, setCfg] = useState<DisplayModeConfig>(persisted);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => setCfg(persisted), [persisted]);

  const effective = resolveEffectiveSpec(cfg.mode, cfg.baseMode);

  const persist = async (key: string, value: string, patch: Partial<DisplayModeConfig>) => {
    setCfg((c) => ({ ...c, ...patch }));
    setSaving(key);
    const ok = await savePluginSecret(projectId, PLUGIN_ID, key, value);
    setSaving(null);
    if (ok) onSaved();
    else toast.error("Could not save the display mode setting");
  };

  const selectMode = async (mode: DisplayModeId) => {
    await persist(DISPLAY_MODE_SECRET_KEYS.mode, mode, { mode });
    toast.success(`Display mode: ${DISPLAY_MODES.find((m) => m.id === mode)?.label}`, {
      description: "Applied on the next build — Android resources, CSS and runtime are regenerated.",
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Layers size={14} /> Display mode
          {saving && <Loader2 size={12} className="animate-spin text-primary" />}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          One plugin, five modes. Only the wiring for the selected mode is applied at build time — Android
          resource folders, capacitor.config, safe-area CSS and the runtime colour matcher.
        </p>
      </div>

      {/* Modes */}
      <div className="grid gap-2 md:grid-cols-2">
        {DISPLAY_MODES.map((m) => {
          const active = m.id === cfg.mode;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => void selectMode(m.id)}
              className={`rounded-[4px] border p-3 text-left transition-colors ${
                active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{m.label}</span>
                {active && <CheckCircle2 size={14} className="shrink-0 text-primary" />}
              </div>
              <span className="mt-0.5 block text-[11px] text-primary">{m.tagline}</span>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{m.description}</p>
              <p className="mt-1.5 text-[10px] italic text-muted-foreground">{m.bestFor}</p>
            </button>
          );
        })}
      </div>

      {/* Per-page base mode */}
      {cfg.mode === "PER_PAGE" && (
        <div className="rounded-[4px] border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium text-foreground">Base mode for all other pages</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DISPLAY_MODES.filter((m) => m.id !== "PER_PAGE").map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  void persist(DISPLAY_MODE_SECRET_KEYS.baseMode, m.id, { baseMode: m.id as BaseDisplayModeId })
                }
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  cfg.baseMode === m.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <ScanSearch size={12} className="mt-0.5 shrink-0" />
            Pages with cover images, hero sections or 100vh containers are detected automatically and switch to
            true full screen on mount, restoring the base mode on unmount.
          </p>
        </div>
      )}

      {/* Colours */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Palette size={13} /> System bar colours
        </h4>
        <div className="grid gap-2 md:grid-cols-2">
          <ColorField
            label="Status bar · light mode"
            value={cfg.lightStatusBarColor}
            onChange={(v) => void persist(DISPLAY_MODE_SECRET_KEYS.lightStatusBarColor, v, { lightStatusBarColor: v })}
          />
          <ColorField
            label="Status bar · dark mode"
            value={cfg.darkStatusBarColor}
            onChange={(v) => void persist(DISPLAY_MODE_SECRET_KEYS.darkStatusBarColor, v, { darkStatusBarColor: v })}
          />
          <ColorField
            label="Navigation bar · light mode"
            value={cfg.lightNavigationBarColor}
            onChange={(v) =>
              void persist(DISPLAY_MODE_SECRET_KEYS.lightNavigationBarColor, v, { lightNavigationBarColor: v })
            }
          />
          <ColorField
            label="Navigation bar · dark mode"
            value={cfg.darkNavigationBarColor}
            onChange={(v) =>
              void persist(DISPLAY_MODE_SECRET_KEYS.darkNavigationBarColor, v, { darkNavigationBarColor: v })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-[4px] border border-border bg-card px-2.5 py-2">
          <span className="text-[11px] text-muted-foreground">Icon style in light mode</span>
          <div className="flex gap-1">
            {(["DARK", "LIGHT"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void persist(DISPLAY_MODE_SECRET_KEYS.lightModeIconStyle, s, { lightModeIconStyle: s })}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                  cfg.lightModeIconStyle === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "DARK" ? "Dark icons" : "Light icons"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Dark mode always uses light icons, per the Android contrast rules.
        </p>
      </div>

      {/* What gets applied */}
      <div className="rounded-[4px] border border-border bg-muted/20 p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Sparkles size={12} className="text-primary" /> Applied for “{effective.label}”
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CAPABILITY_LABELS.map(({ key, label }) => {
            const on = Boolean((effective as unknown as Record<string, boolean>)[key as unknown as string]);
            return (
              <span
                key={String(key)}
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  on ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground/60"
                }`}
              >
                {on ? "✓ " : "· "}
                {label}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          All four Android resource folders (<code className="text-foreground">values</code>,{" "}
          <code className="text-foreground">values-night</code>, <code className="text-foreground">values-v31</code>,{" "}
          <code className="text-foreground">values-night-v31</code>) are generated every build, and{" "}
          <code className="text-foreground">@capacitor/status-bar</code>,{" "}
          <code className="text-foreground">@capacitor/app</code> and{" "}
          <code className="text-foreground">@capacitor/keyboard</code> are enabled automatically.
        </p>
      </div>
    </div>
  );
};

export default DisplayModeSelector;
