/**
 * NativeForge Display Mode — plugin registry entry.
 *
 * One plugin, five display modes. The registry entry below is the single
 * source of truth consumed by:
 *   • the Plugins panel UI (mode picker + colour pickers)
 *   • the deterministic wiring step (src/lib/plugins/displayMode/index.ts)
 *   • the AI wiring step (knowledge pack → edge function prompt)
 *
 * Every mode is a complete configuration set. Nothing outside the flags in
 * `DisplayModeSpec` is applied, so the Action Panel can report exactly what
 * the user chose.
 */

export type DisplayModeId =
  | "CLASSIC"
  | "THEMED"
  | "EDGE_TO_EDGE"
  | "GLASSMORPHISM"
  | "PER_PAGE";

/** Mode 5 delegates its default behaviour to one of the first four modes. */
export type BaseDisplayModeId = Exclude<DisplayModeId, "PER_PAGE">;

export type StatusBarIconStyle = "DARK" | "LIGHT";

export const DEFAULT_DISPLAY_MODE: DisplayModeId = "EDGE_TO_EDGE";
export const DEFAULT_BASE_DISPLAY_MODE: BaseDisplayModeId = "THEMED";

/** The four Android resource folders. Never skip any of them. */
export const ANDROID_RESOURCE_FOLDERS = [
  "android/app/src/main/res/values",
  "android/app/src/main/res/values-night",
  "android/app/src/main/res/values-v31",
  "android/app/src/main/res/values-night-v31",
] as const;

export interface DisplayModeSpec {
  id: DisplayModeId;
  label: string;
  tagline: string;
  /** Copy shown in the UI, verbatim from the product spec. */
  description: string;
  bestFor: string;

  /** capacitor.config.json → plugins.StatusBar.overlaysWebView */
  overlaysWebView: boolean;
  /** WebView starts below the status bar (fitsSystemWindows=true). */
  fitsSystemWindows: boolean;
  /** Draw behind the bars natively (WindowCompat.setDecorFitsSystemWindows(false)). */
  drawsBehindBars: boolean;

  requiresViewportFitCover: boolean;
  requiresBodyPaddingInjection: boolean;
  requiresJsColorMatching: boolean;
  requiresGlassElements: boolean;
  requiresPerPageRouteScanning: boolean;
}

export const DISPLAY_MODES: DisplayModeSpec[] = [
  {
    id: "CLASSIC",
    label: "Classic",
    tagline: "Solid bars, content in between",
    description:
      "Status bar and navigation bar have their own solid background. Your app content fills the space between them. No code changes needed. Works for every project automatically.",
    bestFor: "Any project — the safest default.",
    overlaysWebView: false,
    fitsSystemWindows: true,
    drawsBehindBars: false,
    requiresViewportFitCover: false,
    requiresBodyPaddingInjection: false,
    requiresJsColorMatching: false,
    requiresGlassElements: false,
    requiresPerPageRouteScanning: false,
  },
  {
    id: "THEMED",
    label: "Themed",
    tagline: "Bars follow your app colour",
    description:
      "Status bar and navigation bar colors automatically match your app's background color in real time. When your app changes theme or the user changes system theme, the bars update automatically. Professional look with zero effort.",
    bestFor: "Apps with their own light/dark theme switch.",
    overlaysWebView: false,
    fitsSystemWindows: true,
    drawsBehindBars: false,
    requiresViewportFitCover: false,
    requiresBodyPaddingInjection: false,
    requiresJsColorMatching: true,
    requiresGlassElements: false,
    requiresPerPageRouteScanning: false,
  },
  {
    id: "EDGE_TO_EDGE",
    label: "Edge to edge with padding",
    tagline: "Full screen, content stays safe",
    description:
      "Your app fills the entire screen including behind the status bar and navigation bar. Safe area padding is automatically added so your content stays visible. The most modern app appearance with no code changes needed.",
    bestFor: "Modern apps, dashboards, converted websites.",
    overlaysWebView: true,
    fitsSystemWindows: false,
    drawsBehindBars: true,
    requiresViewportFitCover: true,
    requiresBodyPaddingInjection: true,
    requiresJsColorMatching: true,
    requiresGlassElements: false,
    requiresPerPageRouteScanning: false,
  },
  {
    id: "GLASSMORPHISM",
    label: "Glassmorphism",
    tagline: "Frosted glass behind the bars",
    description:
      "A beautiful frosted glass blur effect behind the status bar and navigation bar areas. Your app fills the entire screen and system UI elements appear to float over a blurred version of your content. Modern premium appearance seen on iPhone and high-end Android apps.",
    bestFor: "Premium consumer apps and media-rich UIs.",
    overlaysWebView: true,
    fitsSystemWindows: false,
    drawsBehindBars: true,
    requiresViewportFitCover: true,
    requiresBodyPaddingInjection: true,
    requiresJsColorMatching: true,
    requiresGlassElements: true,
    requiresPerPageRouteScanning: false,
  },
  {
    id: "PER_PAGE",
    label: "Per-page edge to edge",
    tagline: "Immersive only where it matters",
    description:
      "Your app normally uses your chosen default display mode. Specific pages can switch to true full screen where content fills from the very top pixel to the very bottom pixel. Perfect for profile pages with cover images, media viewers, and immersive experiences. Automatically restores the previous mode when leaving those pages.",
    bestFor: "Profile covers, media viewers, onboarding and splash pages.",
    overlaysWebView: true,
    fitsSystemWindows: false,
    drawsBehindBars: true,
    requiresViewportFitCover: true,
    requiresBodyPaddingInjection: true,
    requiresJsColorMatching: true,
    requiresGlassElements: false,
    requiresPerPageRouteScanning: true,
  },
];

export function getDisplayMode(id?: string | null): DisplayModeSpec {
  return (
    DISPLAY_MODES.find((m) => m.id === id) ??
    DISPLAY_MODES.find((m) => m.id === DEFAULT_DISPLAY_MODE)!
  );
}

/**
 * Mode 5 inherits the flags of its base mode, except that it always scans for
 * full-screen pages and always needs the safe-area plumbing.
 */
export function resolveEffectiveSpec(
  mode: DisplayModeId,
  baseMode: BaseDisplayModeId,
): DisplayModeSpec {
  const spec = getDisplayMode(mode);
  if (spec.id !== "PER_PAGE") return spec;
  const base = getDisplayMode(baseMode);
  return {
    ...base,
    id: "PER_PAGE",
    label: spec.label,
    tagline: spec.tagline,
    description: spec.description,
    bestFor: spec.bestFor,
    requiresViewportFitCover: true,
    requiresBodyPaddingInjection: true,
    requiresJsColorMatching: true,
    requiresPerPageRouteScanning: true,
  };
}

/** User-tunable colours, persisted as plugin secrets. */
export interface DisplayModeConfig {
  mode: DisplayModeId;
  baseMode: BaseDisplayModeId;
  lightStatusBarColor: string;
  darkStatusBarColor: string;
  lightNavigationBarColor: string;
  darkNavigationBarColor: string;
  /** Icon style used while the app is in light mode. Dark mode is always LIGHT. */
  lightModeIconStyle: StatusBarIconStyle;
}

export const DEFAULT_DISPLAY_MODE_CONFIG: DisplayModeConfig = {
  mode: DEFAULT_DISPLAY_MODE,
  baseMode: DEFAULT_BASE_DISPLAY_MODE,
  lightStatusBarColor: "#FFFFFF",
  darkStatusBarColor: "#0B0B0F",
  lightNavigationBarColor: "#FFFFFF",
  darkNavigationBarColor: "#0B0B0F",
  lightModeIconStyle: "DARK",
};

/** Secret keys used to persist the configuration for a project. */
export const DISPLAY_MODE_SECRET_KEYS = {
  mode: "DISPLAY_MODE",
  baseMode: "DISPLAY_MODE_BASE",
  lightStatusBarColor: "DISPLAY_MODE_STATUS_LIGHT",
  darkStatusBarColor: "DISPLAY_MODE_STATUS_DARK",
  lightNavigationBarColor: "DISPLAY_MODE_NAV_LIGHT",
  darkNavigationBarColor: "DISPLAY_MODE_NAV_DARK",
  lightModeIconStyle: "DISPLAY_MODE_ICON_LIGHT",
} as const;

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Build a config from persisted key/value pairs, falling back to defaults. */
export function readDisplayModeConfig(
  values: Record<string, string | null | undefined>,
): DisplayModeConfig {
  const hex = (v: string | null | undefined, fallback: string) =>
    v && HEX_RE.test(v.trim()) ? v.trim().toUpperCase() : fallback;
  const mode = getDisplayMode(values[DISPLAY_MODE_SECRET_KEYS.mode]).id;
  const rawBase = values[DISPLAY_MODE_SECRET_KEYS.baseMode];
  const baseMode: BaseDisplayModeId =
    rawBase && rawBase !== "PER_PAGE" && DISPLAY_MODES.some((m) => m.id === rawBase)
      ? (rawBase as BaseDisplayModeId)
      : DEFAULT_BASE_DISPLAY_MODE;
  return {
    mode,
    baseMode,
    lightStatusBarColor: hex(values[DISPLAY_MODE_SECRET_KEYS.lightStatusBarColor], DEFAULT_DISPLAY_MODE_CONFIG.lightStatusBarColor),
    darkStatusBarColor: hex(values[DISPLAY_MODE_SECRET_KEYS.darkStatusBarColor], DEFAULT_DISPLAY_MODE_CONFIG.darkStatusBarColor),
    lightNavigationBarColor: hex(values[DISPLAY_MODE_SECRET_KEYS.lightNavigationBarColor], DEFAULT_DISPLAY_MODE_CONFIG.lightNavigationBarColor),
    darkNavigationBarColor: hex(values[DISPLAY_MODE_SECRET_KEYS.darkNavigationBarColor], DEFAULT_DISPLAY_MODE_CONFIG.darkNavigationBarColor),
    lightModeIconStyle: values[DISPLAY_MODE_SECRET_KEYS.lightModeIconStyle] === "LIGHT" ? "LIGHT" : "DARK",
  };
}

/** The registry entry, in the exact shape the AI wiring step reads. */
export const DISPLAY_MODE_PLUGIN_REGISTRY_ENTRY = {
  pluginName: "NativeForge Display Mode",
  npmPackage: "@capacitor/status-bar",
  companionPackages: ["@capacitor/app"],
  displayModeOptions: DISPLAY_MODES.map((m) => m.id),
  perPageBaseModeOptions: DISPLAY_MODES.filter((m) => m.id !== "PER_PAGE").map((m) => m.id),
  androidResourceFoldersRequired: [...ANDROID_RESOURCE_FOLDERS],
  statusBarIconStyleDarkMode: "LIGHT" as const,
  minimumAndroidSdk: 21,
  iosMinimumDeploymentTarget: 11,
  capabilities: Object.fromEntries(
    DISPLAY_MODES.map((m) => [
      m.id,
      {
        overlaysWebView: m.overlaysWebView,
        fitsSystemWindows: m.fitsSystemWindows,
        requiresViewportFitCover: m.requiresViewportFitCover,
        requiresBodyPaddingInjection: m.requiresBodyPaddingInjection,
        requiresJsColorMatching: m.requiresJsColorMatching,
        requiresGlassElements: m.requiresGlassElements,
        requiresPerPageRouteScanning: m.requiresPerPageRouteScanning,
      },
    ]),
  ),
};
