/**
 * Build-time helper: load appearance config for a project, render the
 * launcher + splash artwork, and produce the data needed to inject into
 * the build payload sent to the build-apk edge function.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  loadAppearance, getAppearanceAssetUrl, type AppearanceRow,
} from "./appearanceService";
import { renderRole, type AppearanceConfig } from "./iconRenderer";
import { loadPluginSecrets } from "@/lib/pluginSecretsService";
import { getEdgeToEdgeMode } from "@/lib/plugins/edgeToEdge/modes";

export interface AppearanceBuildPayload {
  iconDataUrl: string | null;
  iconForegroundDataUrl: string | null;
  iconBackgroundColor: string | null;
  splashDataUrl: string | null;
  appearanceJson: string | null;
  row: AppearanceRow | null;
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });

const canvasToDataUrl = (c: HTMLCanvasElement) =>
  new Promise<string>((res) => c.toBlob(async (b) => res(await blobToDataUrl(b!))));

export async function buildAppearancePayload(
  projectId: string | undefined
): Promise<AppearanceBuildPayload> {
  const empty: AppearanceBuildPayload = {
    iconDataUrl: null, iconForegroundDataUrl: null, iconBackgroundColor: null,
    splashDataUrl: null, appearanceJson: null, row: null,
  };
  if (!projectId) return empty;
  let row: AppearanceRow | null = null;
  try { row = await loadAppearance(projectId); } catch { return empty; }
  if (!row) return empty;

  // Resolve foreground image into a data URL (so canvas can use it)
  let foregroundDataUrl: string | null = null;
  if (row.icon_foreground_path) {
    try {
      const signed = await getAppearanceAssetUrl(row.icon_foreground_path);
      if (signed) {
        const r = await fetch(signed);
        const b = await r.blob();
        foregroundDataUrl = await blobToDataUrl(b);
      }
    } catch { /* fall through to letter fallback */ }
  }

  const cfg: AppearanceConfig = {
    iconForegroundUrl: foregroundDataUrl,
    iconBackgroundColor: row.icon_background_color,
    iconPaddingPct: Number(row.icon_padding_pct),
    iconCornerRadiusPct: Number(row.icon_corner_radius_pct),
    iconLetterFallback: row.icon_letter_fallback,
    splashBgColor: row.splash_bg_color,
  };

  const iconCanvas = await renderRole(cfg, "launcher", 1024);
  const splashCanvas = await renderRole(cfg, "splash", 1024);
  const iconDataUrl = await canvasToDataUrl(iconCanvas);
  const splashDataUrl = await canvasToDataUrl(splashCanvas);

  let edgeToEdgeMode = getEdgeToEdgeMode().id;
  try {
    const secrets = await loadPluginSecrets(projectId);
    const savedMode = secrets.find(
      (secret) => secret.plugin_id === "edge-to-edge" && secret.secret_key === "EDGE_TO_EDGE_MODE",
    )?.secret_value;
    edgeToEdgeMode = getEdgeToEdgeMode(savedMode).id;
  } catch {
    // Keep the safe default when plugin settings are unavailable.
  }

  // Validate bg color so the build never inherits a transparent legacy launcher.
  const rawBg = (row.icon_background_color || "").trim();
  const iconBackgroundColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(rawBg) ? rawBg : "#FFFFFF";

  const appearanceJson = JSON.stringify({
    statusBar: {
      visible: row.status_bar_visible,
      color: row.status_bar_color,
      colorDark: row.status_bar_color_dark,
      style: row.status_bar_style,
    },
    splash: {
      bg: row.splash_bg_color,
      bgDark: row.splash_bg_color_dark,
      durationMs: row.splash_duration_ms,
      resizeMode: row.splash_resize_mode,
    },
    icon: {
      bg: iconBackgroundColor,
      paddingPct: Number(row.icon_padding_pct),
      cornerRadiusPct: Number(row.icon_corner_radius_pct),
    },
    edgeToEdge: {
      enabled: row.edge_to_edge_enabled,
      mode: edgeToEdgeMode,
      navColor: row.edge_to_edge_nav_color,
    },
    defaultTheme: row.default_theme,
  }, null, 2);

  return {
    iconDataUrl,
    iconForegroundDataUrl: foregroundDataUrl,
    iconBackgroundColor,
    splashDataUrl,
    appearanceJson,
    row,
  };
}

export async function markAppearanceBuilt(projectId: string) {
  try {
    await supabase
      .from("appearance_configs")
      .update({ staged: false })
      .eq("project_id", projectId);
  } catch { /* non-fatal */ }
}
