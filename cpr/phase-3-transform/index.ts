import type { CprFile, SourceFinding, TransformResult } from "../types/index.ts";
import { sourceFiles } from "../phase-1-detect/index.ts";

/**
 * Phase 3 — normalization and canonical output.
 *
 * Step 5 (blank screen cause elimination) + Step 6 (canonical file generation)
 * + Step 7 (structure assembly) all operate through this module. Everything it
 * produces is expressed as full-file patches so the caller can apply them to a
 * ZIP, a workspace folder, or an in-memory file list identically.
 */

export interface TransformOptions {
  root?: string;
  framework: string;
  /** Production API base URL supplied by the user, used to rewrite localhost. */
  apiBaseUrl?: string;
  /** Env vars the user already configured in platform settings. */
  providedEnv?: Record<string, string>;
}

const HTML_EXT = /\.html?$/i;

function rel(path: string, root: string): string {
  return root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

/* ------------------------------------------------- router mode conversion */

const ROUTER_RULES: { from: RegExp; to: string; label: string }[] = [
  { from: /\bBrowserRouter\b/g, to: "HashRouter", label: "react-router BrowserRouter → HashRouter" },
  { from: /\bcreateBrowserRouter\b/g, to: "createHashRouter", label: "createBrowserRouter → createHashRouter" },
  { from: /\bcreateBrowserHistory\b/g, to: "createHashHistory", label: "createBrowserHistory → createHashHistory" },
  { from: /\bcreateWebHistory\b/g, to: "createWebHashHistory", label: "Vue createWebHistory → createWebHashHistory" },
  { from: /\bPathLocationStrategy\b/g, to: "HashLocationStrategy", label: "Angular path strategy → hash strategy" },
];

/* -------------------------------------------------------- detection regex */

const LOCALHOST_RE = /(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.0\.\d+\.\d+)(:\d+)?/g;
const ENV_RE = /(?:process\.env|import\.meta\.env)\.([A-Z0-9_]+)/g;
const SW_RE = /navigator\.serviceWorker\.register\s*\(/;
const WINDOW_OPEN_RE = /window\.open\s*\(/g;
const CDN_RE = /<(?:script|link)[^>]+(?:src|href)=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
const FONT_RE = /fonts\.(googleapis|gstatic)\.com|\.woff2?(\?|$)/i;
const WEB_ONLY_UI = [
  { kind: "cookie-banner", re: /cookie[-_ ]?(consent|banner|notice)|gdpr/i },
  { kind: "install-prompt", re: /beforeinstallprompt|add[-_ ]?to[-_ ]?home[-_ ]?screen|install[-_ ]?(app|banner)/i },
];

/* ------------------------------------------------------------- transform */

export function transformSource(files: CprFile[], opts: TransformOptions): TransformResult {
  const root = opts.root ?? "";
  const findings: SourceFinding[] = [];
  const patches: TransformResult["patches"] = [];
  const deletions: string[] = [];
  const envReferenced = new Set<string>();
  const notes: string[] = [];
  const patched = new Map<string, string>();

  const edit = (path: string, next: string, reason: string) => {
    patched.set(path, next);
    const existing = patches.find((p) => p.path === path);
    if (existing) {
      existing.content = next;
      existing.reason = `${existing.reason}; ${reason}`;
    } else {
      patches.push({ path, content: next, reason });
    }
  };

  for (const file of sourceFiles(files, root)) {
    let content = file.content ?? "";
    const original = content;

    // --- router mode ---
    for (const rule of ROUTER_RULES) {
      if (!rule.from.test(content)) continue;
      rule.from.lastIndex = 0;
      content = content.replace(rule.from, rule.to);
      findings.push({
        kind: "router-mode",
        file: file.path,
        detail: rule.label,
        autoFixed: true,
        before: rule.from.source,
        after: rule.to,
      });
    }

    // --- localhost references ---
    let m: RegExpExecArray | null;
    LOCALHOST_RE.lastIndex = 0;
    while ((m = LOCALHOST_RE.exec(content))) {
      findings.push({
        kind: "localhost",
        file: file.path,
        line: lineOf(content, m.index),
        detail: m[0],
        autoFixed: !!opts.apiBaseUrl,
      });
    }
    if (opts.apiBaseUrl) {
      content = content.replace(LOCALHOST_RE, opts.apiBaseUrl.replace(/\/$/, ""));
    }

    // --- env audit ---
    ENV_RE.lastIndex = 0;
    while ((m = ENV_RE.exec(content))) envReferenced.add(m[1]);

    // --- service worker suppression ---
    if (SW_RE.test(content) && !content.includes("NATIVEFORGE_NATIVE")) {
      content = content.replace(
        SW_RE,
        "!import.meta.env.VITE_NATIVEFORGE_NATIVE && navigator.serviceWorker.register(",
      );
      findings.push({
        kind: "service-worker",
        file: file.path,
        detail: "Service worker registration gated behind the native flag.",
        autoFixed: true,
      });
    }

    // --- window.open ---
    WINDOW_OPEN_RE.lastIndex = 0;
    while ((m = WINDOW_OPEN_RE.exec(content))) {
      findings.push({
        kind: "window-open",
        file: file.path,
        line: lineOf(content, m.index),
        detail: "window.open leaves the app for the system browser. Use the Capacitor Browser plugin.",
        autoFixed: false,
      });
    }

    // --- web-only UI ---
    for (const rule of WEB_ONLY_UI) {
      if (!rule.re.test(content)) continue;
      findings.push({
        kind: "web-only-ui",
        file: file.path,
        detail: `${rule.kind} detected — hidden in native builds via the NATIVEFORGE_NATIVE flag.`,
        autoFixed: false,
      });
    }

    if (content !== original) edit(file.path, content, "blank-screen elimination");
  }

  /* --- HTML files: target=_blank, CDN deps --- */
  for (const file of files) {
    if (file.isBinary || !HTML_EXT.test(file.path) || !file.content) continue;
    if (file.path.includes("node_modules/")) continue;
    let content = file.content;
    const original = content;

    if (/target\s*=\s*["']_blank["']/i.test(content)) {
      content = content.replace(/\s*target\s*=\s*["']_blank["']/gi, "");
      findings.push({
        kind: "target-blank",
        file: file.path,
        detail: "Removed target=\"_blank\" — it opens the system browser and drops the user out of the app.",
        autoFixed: true,
      });
    }

    let m: RegExpExecArray | null;
    CDN_RE.lastIndex = 0;
    while ((m = CDN_RE.exec(content))) {
      const url = m[1];
      findings.push({
        kind: "cdn",
        file: file.path,
        line: lineOf(content, m.index),
        detail: FONT_RE.test(url)
          ? `Remote font ${url} — bundle it locally so the app works offline.`
          : `External CDN dependency ${url} requires network access on device. Install the npm equivalent instead.`,
        autoFixed: false,
      });
    }

    if (content !== original) edit(file.path, content, "html hardening");
  }

  /* --- large images --- */
  for (const file of files) {
    if (!/\.(png|jpe?g|gif|webp)$/i.test(file.path)) continue;
    if ((file.size ?? 0) > 500 * 1024) {
      findings.push({
        kind: "large-image",
        file: file.path,
        detail: `${Math.round((file.size ?? 0) / 1024)} KB — queued for compression during canonical assembly.`,
        autoFixed: true,
      });
    }
  }

  /* --- env undefined --- */
  const provided = opts.providedEnv ?? {};
  const definedInFiles = new Set<string>();
  for (const f of files) {
    if (!/(^|\/)\.env(\.|$)/.test(f.path) || !f.content) continue;
    for (const line of f.content.split("\n")) {
      const key = line.split("=")[0]?.trim();
      if (key && !key.startsWith("#")) definedInFiles.add(key);
    }
  }
  const envUndefined = [...envReferenced].filter(
    (k) => !definedInFiles.has(k) && provided[k] === undefined && k !== "NATIVEFORGE_NATIVE",
  );
  for (const key of envUndefined) {
    findings.push({
      kind: "env-undefined",
      file: "(project)",
      detail: `${key} is referenced in source but never defined.`,
      autoFixed: false,
    });
  }

  return { patches, deletions, findings, envReferenced: [...envReferenced], envUndefined, notes };
}

/* -------------------------------- absolute path normalization (post-build) */

/**
 * Runs on the BUILD OUTPUT, not the source. Converts every root-absolute
 * reference into a path relative to the file's own depth in the output tree.
 */
export function normalizeAbsolutePaths(
  outputFiles: CprFile[],
): { patches: { path: string; content: string; reason: string }[]; fixed: number } {
  const patches: { path: string; content: string; reason: string }[] = [];
  let fixed = 0;

  for (const file of outputFiles) {
    if (file.isBinary || !file.content) continue;
    if (!/\.(html?|css|js|mjs)$/i.test(file.path)) continue;

    const depth = file.path.split("/").length - 1;
    const up = depth === 0 ? "./" : "../".repeat(depth);
    const before = file.content;

    const next = before
      .replace(/(src|href)=["']\/(?!\/)/g, (_m, attr) => `${attr}="${up}`)
      .replace(/url\(\s*["']?\/(?!\/)/g, () => `url(${up}`)
      .replace(/from\s*["']\/(?!\/)/g, () => `from "${up}`);

    if (next !== before) {
      fixed += (before.match(/(src|href)=["']\/(?!\/)/g) ?? []).length;
      patches.push({ path: file.path, content: next, reason: "absolute → relative path" });
    }
  }

  return { patches, fixed };
}

/* --------------------------------------------- canonical structure assembly */

export const EXCLUDED_FROM_CANONICAL = [
  "node_modules/",
  ".git/",
  ".github/",
  "android/",
  "ios/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  ".nuxt/",
  ".svelte-kit/",
  "coverage/",
];

export function isExcluded(path: string): boolean {
  return EXCLUDED_FROM_CANONICAL.some((p) => path === p.slice(0, -1) || path.startsWith(p) || path.includes(`/${p}`));
}

/** Re-layout a plain-HTML upload into the canonical src/ + public/ structure. */
export function assemblePlainHtml(
  files: CprFile[],
  root = "",
): { moves: { from: string; to: string }[]; pages: string[] } {
  const moves: { from: string; to: string }[] = [];
  const pages: string[] = [];

  for (const f of files) {
    const r = rel(f.path, root);
    if (!r || isExcluded(r)) continue;
    if (HTML_EXT.test(r)) {
      const target = r === "index.html" ? "index.html" : `src/pages/${r.split("/").pop()}`;
      pages.push(target);
      if (target !== r) moves.push({ from: f.path, to: target });
    } else if (/\.css$/i.test(r)) {
      moves.push({ from: f.path, to: `src/styles/${r.split("/").pop()}` });
    } else if (/\.m?js$/i.test(r)) {
      moves.push({ from: f.path, to: `src/scripts/${r.split("/").pop()}` });
    } else if (/\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf)$/i.test(r)) {
      moves.push({ from: f.path, to: `public/${r.split("/").pop()}` });
    }
  }

  return { moves, pages };
}
