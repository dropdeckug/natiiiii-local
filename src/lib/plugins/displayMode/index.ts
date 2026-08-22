/**
 * NativeForge Display Mode — deterministic wiring step.
 *
 * Reads the registry entry for the selected mode and produces every file
 * change needed, in the exact order the spec requires:
 *   1. Android resource folders (all four, always).
 *   2. capacitor.config.json StatusBar/Keyboard settings.
 *   3. viewport-fit=cover in index.html (modes 3/4/5).
 *   4. Global safe-area CSS (modes 3/4/5).
 *   5. Glass layers (mode 4).
 *   6. Colour-matching module at the detected/created hook path + entry import.
 *   7. Full-screen page scan + per-page injection (mode 5).
 *   8. Bottom-bar safe-area validation.
 *
 * Nothing else in the user's source is touched.
 */

import type { ProjectFile } from "@/stores/projectStore";
import {
  type DisplayModeConfig,
  type DisplayModeSpec,
  ANDROID_RESOURCE_FOLDERS,
  resolveEffectiveSpec,
} from "./registry";
import {
  androidStyleFiles,
  androidColorFiles,
  colorMatchingModule,
  GLASS_CSS,
  GLASS_MODULE_TS,
  PER_PAGE_API_TS,
  SAFE_AREA_PADDING_CSS,
  SAFE_AREA_VARS_CSS,
} from "./templates";
import { detectDisplayModeHook, flattenFiles, relativeImport, type HookDetection } from "./hookDetection";
import { mergeCapacitorConfig } from "@/lib/tools/nativeAndroidPatcher";

export interface DisplayModePatch {
  path: string;
  op: "create" | "patch";
  content: string;
  reason: string;
}

export interface DisplayModeMetadata {
  display_mode_selected: string;
  display_mode_base: string;
  display_mode_hook_path: string;
  display_mode_hook_existed: boolean;
  display_mode_entry_point: string | null;
  display_mode_full_screen_pages: string[];
  display_mode_android_folders_created: string[];
}

export interface DisplayModeWiring {
  mode: string;
  spec: DisplayModeSpec;
  npmDeps: string[];
  patches: DisplayModePatch[];
  warnings: string[];
  metadata: DisplayModeMetadata;
  detection: HookDetection;
}

/** Canonical runtime module — every other generated file imports from here. */
export const RUNTIME_MODULE_PATH = "src/capacitor/display-mode.ts";
const GLASS_MODULE_PATH = "src/capacitor/display-mode-glass.ts";
const GLASS_CSS_PATH = "src/capacitor/display-mode-glass.css";
const CSS_PATH = "src/capacitor/display-mode.css";
const PER_PAGE_PATH = "src/capacitor/display-mode-per-page.ts";

const ENTRY_CANDIDATES = [
  "src/main.tsx",
  "src/main.ts",
  "src/main.jsx",
  "src/main.js",
  "src/index.tsx",
  "src/index.ts",
  "src/index.jsx",
  "src/index.js",
];

function findEntry(flat: ProjectFile[]): ProjectFile | null {
  for (const c of ENTRY_CANDIDATES) {
    const hit = flat.find((f) => f.type === "file" && (f.path === c || f.path.endsWith(`/${c}`)));
    if (hit) return hit;
  }
  return null;
}

function addImport(content: string, spec: string): string {
  if (content.includes(`"${spec}"`) || content.includes(`'${spec}'`)) return content;
  const lines = content.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImport = i;
    else if (lastImport >= 0 && lines[i].trim() !== "") break;
  }
  lines.splice(lastImport + 1, 0, `import "${spec}";`);
  return lines.join("\n");
}

function patchIndexHtml(content: string): string {
  let out = content;
  if (!/viewport-fit\s*=\s*cover/.test(out)) {
    if (/<meta\s+name=["']viewport["']/i.test(out)) {
      out = out.replace(
        /<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']\s*\/?\s*>/i,
        (_m, attr: string) => `<meta name="viewport" content="${attr.trim().replace(/,\s*$/, "")}, viewport-fit=cover" />`,
      );
    } else {
      out = out.replace(
        /<\/head>/i,
        `  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />\n</head>`,
      );
    }
  }
  return out;
}

const MAIN_ACTIVITY_PATHS = (flat: ProjectFile[]) =>
  flat.filter((f) => f.type === "file" && /MainActivity\.java$/.test(f.path));

function patchMainActivity(content: string, drawBehind: boolean): string {
  let out = content;
  // Always normalise: strip any previous NativeForge injection.
  out = out.replace(/\n\s*\/\/ NativeForge Display Mode[\s\S]*?WindowCompat\.setDecorFitsSystemWindows\(getWindow\(\),\s*(?:true|false)\);/g, "");

  const call = `WindowCompat.setDecorFitsSystemWindows(getWindow(), ${drawBehind ? "false" : "true"});`;
  const snippet = `\n\n        // NativeForge Display Mode — system bar handling.\n        ${call}`;

  for (const imp of ["import android.os.Bundle;", "import androidx.core.view.WindowCompat;"]) {
    if (!out.includes(imp)) {
      const pkg = out.match(/(package\s+[^;]+;\s*)/);
      out = pkg ? out.replace(pkg[1], `${pkg[1]}\n${imp}\n`) : `${imp}\n${out}`;
    }
  }

  if (/super\.onCreate\(savedInstanceState\);/.test(out)) {
    out = out.replace(/(super\.onCreate\(savedInstanceState\);)/, `$1${snippet}`);
  } else {
    out = out.replace(
      /\n}\s*$/,
      `\n\n    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);${snippet}\n    }\n}\n`,
    );
  }
  return out;
}

/** Mode 5 — detect pages designed for a true full-screen presentation. */
export function detectFullScreenPages(flat: ProjectFile[]): string[] {
  const hits: string[] = [];
  const pathHint = /(profile|cover|media|viewer|gallery|splash|hero|onboarding)/i;
  const classHint = /class(Name)?=["'`][^"'`]*(cover|hero|banner|profile-header|splash|fullscreen|immersive)/i;
  const styleHint = /(height:\s*100(v|s)h|min-h-screen|h-screen|background-image:|object-cover)/i;

  for (const f of flat) {
    if (f.type !== "file" || !f.content) continue;
    if (!/^src\/.*\.(tsx|jsx|vue|svelte)$/.test(f.path)) continue;
    if (/Auto-generated by NativeForge/.test(f.content)) continue;
    const strong = classHint.test(f.content);
    const weak = pathHint.test(f.path) && styleHint.test(f.content);
    if (strong || weak) hits.push(f.path);
  }
  return hits.slice(0, 12);
}

/** Inject the per-page hook into a React component without rewriting it. */
function injectPerPageReact(content: string, importSpec: string): string | null {
  if (content.includes("display-mode-per-page")) return null;
  const bodyMatch =
    content.match(/(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{)/) ||
    content.match(/(const\s+\w+\s*(?::\s*[\w<>.,\s]+)?=\s*\([^)]*\)\s*(?::\s*[^=]+)?=>\s*\{)/) ||
    content.match(/(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{0,400}?return\s*\()/);
  if (!bodyMatch) return null;

  const hookCall = `\n  // NativeForge Display Mode — this page renders edge to edge.\n  useEffect(() => {\n    void enterFullScreen("LIGHT");\n    return () => { void exitFullScreen(); };\n  }, []);\n`;

  let out = content.replace(bodyMatch[1], `${bodyMatch[1]}${hookCall}`);

  if (!/from\s+["']react["']/.test(out)) {
    out = `import { useEffect } from "react";\n${out}`;
  } else if (!/\buseEffect\b/.test(out.split("\n").filter((l) => /from\s+["']react["']/.test(l)).join("\n"))) {
    out = out.replace(/import\s+(\{[^}]*\})\s+from\s+["']react["']/, (m, g1: string) =>
      m.replace(g1, g1.replace(/\}\s*$/, ", useEffect }")),
    );
    if (!/useEffect/.test(out)) out = `import { useEffect } from "react";\n${out}`;
  }
  out = `import { enterFullScreen, exitFullScreen } from "${importSpec}";\n${out}`;
  return out;
}

export function wireDisplayMode(files: ProjectFile[], cfg: DisplayModeConfig): DisplayModeWiring {
  const spec = resolveEffectiveSpec(cfg.mode, cfg.baseMode);
  const flat = flattenFiles(files);
  const detection = detectDisplayModeHook(files);
  const patches: DisplayModePatch[] = [];
  const warnings: string[] = [];
  const fullScreenPages: string[] = [];

  const push = (path: string, content: string, reason: string) => {
    const existing = flat.find((f) => f.path === path && f.type === "file");
    if (existing?.content === content) return;
    patches.push({ path, op: existing ? "patch" : "create", content, reason });
  };

  /* 1 — Android resource folders (all four, always). */
  for (const file of androidStyleFiles(spec, cfg)) push(file.path, file.content, file.reason);
  for (const file of androidColorFiles(cfg)) push(file.path, file.content, file.reason);

  for (const ma of MAIN_ACTIVITY_PATHS(flat)) {
    if (!ma.content) continue;
    const next = patchMainActivity(ma.content, spec.drawsBehindBars);
    if (next !== ma.content) {
      push(ma.path, next, `MainActivity — ${spec.drawsBehindBars ? "draw behind the system bars" : "fit system windows"}`);
    }
  }

  /* 2 — capacitor.config.json */
  const capCfg = flat.find(
    (f) => f.type === "file" && /(^|\/)capacitor\.config\.json$/.test(f.path),
  );
  const statusBarPlugin = {
    overlaysWebView: spec.overlaysWebView,
    style: cfg.lightModeIconStyle === "DARK" ? "DARK" : "LIGHT",
    backgroundColor: spec.overlaysWebView ? "#00000000" : cfg.lightStatusBarColor,
  };
  const keyboardPlugin = { resize: "body" as const };
  if (capCfg?.content) {
    const { content, merged } = mergeCapacitorConfig(capCfg.content, {
      StatusBar: statusBarPlugin,
      Keyboard: keyboardPlugin,
    });
    if (merged.length > 0) push(capCfg.path, content, `capacitor.config.json — ${merged.join(", ")} settings for ${spec.label}`);
  } else {
    warnings.push("capacitor.config.json not found — StatusBar settings will be applied by the runner during sync.");
  }

  /* 3 — viewport-fit=cover */
  const indexHtml = flat.find((f) => f.type === "file" && (f.path === "index.html" || f.path.endsWith("/index.html")));
  if (spec.requiresViewportFitCover) {
    if (indexHtml?.content) {
      const next = patchIndexHtml(indexHtml.content);
      if (next !== indexHtml.content) push(indexHtml.path, next, "viewport-fit=cover so env(safe-area-inset-*) resolves");
    } else {
      warnings.push("index.html not found — add viewport-fit=cover manually for safe-area insets to work.");
    }
  }

  /* 4 — global CSS */
  push(
    CSS_PATH,
    spec.requiresBodyPaddingInjection ? SAFE_AREA_PADDING_CSS : SAFE_AREA_VARS_CSS,
    spec.requiresBodyPaddingInjection ? "Safe-area body padding + bottom-bar clearance" : "Safe-area CSS variables",
  );

  /* 5 — glass layers */
  if (spec.requiresGlassElements) {
    push(GLASS_CSS_PATH, GLASS_CSS, "Frosted glass layers behind the system bars");
    push(GLASS_MODULE_PATH, GLASS_MODULE_TS, "Glass layer injection + theme syncing");
  }

  /* 6 — runtime module + hook file + entry point */
  push(RUNTIME_MODULE_PATH, colorMatchingModule(cfg, spec), `Display mode runtime (${spec.label})`);

  const hookPath = detection.hookPath;
  const hookFile = flat.find((f) => f.path === hookPath && f.type === "file");
  if (detection.hookExisted && hookFile?.content) {
    // Extend, never rewrite.
    const spec2 = relativeImport(hookPath, RUNTIME_MODULE_PATH);
    if (!hookFile.content.includes("display-mode")) {
      const next = `${addImport(hookFile.content, spec2)}`;
      push(hookPath, next, "Extended your existing status-bar handler with the NativeForge display-mode runtime");
    }
    for (const c of detection.conflicts) {
      warnings.push(`Existing status-bar logic found in ${c} — it was left untouched; verify it does not fight the selected display mode.`);
    }
  } else if (hookPath !== RUNTIME_MODULE_PATH) {
    const rel = relativeImport(hookPath, RUNTIME_MODULE_PATH);
    const reexport = `// Auto-generated by NativeForge Display Mode — ${spec.label}.
// The runtime lives in ${RUNTIME_MODULE_PATH}; this file is the project-local entry.
export { initDisplayMode, syncDisplayMode } from "${rel}";
export { default } from "${rel}";
`;
    const plain = `// Auto-generated by NativeForge Display Mode — ${spec.label}.
import "${rel}";
`;
    push(hookPath, detection.framework === "plain" ? plain : reexport.replace(/export \{ default \}.*\n/, ""), `Display mode hook (${detection.reason})`);
  }

  const entry = findEntry(flat);
  if (entry?.content) {
    let next = entry.content;
    next = addImport(next, relativeImport(entry.path, CSS_PATH).replace(/\.css$/, "") + ".css");
    next = addImport(next, relativeImport(entry.path, RUNTIME_MODULE_PATH));
    if (spec.requiresGlassElements) next = addImport(next, relativeImport(entry.path, GLASS_MODULE_PATH));
    if (next !== entry.content) push(entry.path, next, "Import the display-mode runtime at app startup");
  } else {
    warnings.push("No web entry file (src/main.tsx …) found — the display-mode runtime may not auto-init.");
  }

  /* 7 — per-page scanning */
  if (spec.requiresPerPageRouteScanning) {
    push(PER_PAGE_PATH, PER_PAGE_API_TS, "Per-page full-screen API (enterFullScreen / exitFullScreen)");
    for (const path of detectFullScreenPages(flat)) {
      const file = flat.find((f) => f.path === path);
      if (!file?.content) continue;
      if (!/\.(tsx|jsx)$/.test(path)) {
        warnings.push(`${path} looks like a full-screen page — add enterFullScreen/exitFullScreen manually (non-React file).`);
        continue;
      }
      const next = injectPerPageReact(file.content, relativeImport(path, PER_PAGE_PATH));
      if (next) {
        push(path, next, "Per-page edge-to-edge switching on mount/unmount");
        fullScreenPages.push(path);
      }
    }
    if (fullScreenPages.length === 0) {
      warnings.push("No full-screen pages detected — the base mode applies everywhere until you mark a page.");
    }
  }

  /* 8 — bottom bar validation */
  if (spec.requiresBodyPaddingInjection) {
    const hasBottomBar = flat.some(
      (f) =>
        f.type === "file" &&
        /^src\//.test(f.path) &&
        f.content &&
        /(bottom-nav|tab-bar|BottomNav|TabBar|fixed\s+bottom-0)/.test(f.content),
    );
    if (hasBottomBar) {
      warnings.push(
        "Bottom navigation detected — safe-area clearance is applied via .bottom-nav/.tab-bar/[data-nf-bottom-bar]; add data-nf-bottom-bar to yours if it uses a custom class.",
      );
    }
  }

  return {
    mode: cfg.mode,
    spec,
    npmDeps: ["@capacitor/status-bar", "@capacitor/app", "@capacitor/keyboard"],
    patches,
    warnings,
    detection,
    metadata: {
      display_mode_selected: cfg.mode,
      display_mode_base: cfg.mode === "PER_PAGE" ? cfg.baseMode : cfg.mode,
      display_mode_hook_path: hookPath,
      display_mode_hook_existed: detection.hookExisted,
      display_mode_entry_point: entry?.path ?? null,
      display_mode_full_screen_pages: fullScreenPages,
      display_mode_android_folders_created: [...ANDROID_RESOURCE_FOLDERS],
    },
  };
}

export function displayModeWiringToLogs(w: DisplayModeWiring): string[] {
  const logs = [
    `Display mode: ${w.spec.label} (${w.mode})`,
    `Hook: ${w.metadata.display_mode_hook_path}${w.metadata.display_mode_hook_existed ? " (extended existing)" : " (created)"}`,
    `Files patched: ${w.patches.length}`,
  ];
  for (const p of w.patches) logs.push(`  • ${p.op === "create" ? "+" : "~"} ${p.path} — ${p.reason}`);
  if (w.metadata.display_mode_full_screen_pages.length > 0) {
    logs.push(`Full-screen pages: ${w.metadata.display_mode_full_screen_pages.join(", ")}`);
  }
  for (const warn of w.warnings) logs.push(`⚠ ${warn}`);
  return logs;
}
