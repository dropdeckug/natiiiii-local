/**
 * TOOL: React Readiness Scan
 *
 * Blank-screen prevention for React (Vite + CRA) projects. Runs *before*
 * project creation, on the raw imported files, and produces a
 * ReactReadinessReport. Three severities:
 *
 *   - hardBlockers:        creation is disabled until user fixes source
 *   - needsUserDecision:   creation allowed after explicit choice
 *   - fixableAutomatically: platform patches these during build (informational)
 *
 * The wizard renders the report; the build pipeline persists it on
 * project_sources.scan_result.readiness so the AI repair loop can reason
 * about the user's decisions ("keep BrowserRouter", "these envs are optional",
 * etc.).
 */

import type { ProjectScanResult } from "./projectScanner";

interface FileEntry {
  path: string;
  type: "file" | "folder";
  content?: string;
  isBinary?: boolean;
}

export type ReadinessSeverity = "info" | "warn" | "block";

export interface ReadinessCheck {
  id: string;
  label: string;
  severity: ReadinessSeverity;
  message: string;
  autoFixable: boolean;
  files?: string[];
}

export interface ReadinessDecision {
  id: "router-mode" | "env-vars" | "app-root";
  label: string;
  message: string;
  options?: { value: string; label: string; recommended?: boolean }[];
  values?: string[]; // e.g. list of missing env var names
}

export interface ReactReadinessReport {
  ok: boolean;
  blankScreenRisk: "low" | "medium" | "high";
  checks: ReadinessCheck[];
  hardBlockers: string[];
  needsUserDecision: ReadinessDecision[];
  fixableAutomatically: string[];
  detectedEnvVars: string[];
  presentEnvVars: string[];
}

const SKIP_DIR = /(^|\/)(node_modules|dist|build|www|out|android|ios|\.git|\.next|\.nuxt|\.output|coverage)(\/|$)/;
const SRC_EXT = /\.(m?[jt]sx?)$/i;
const MAX_TEXT_SIZE = 500_000;

const NODE_BUILTINS = new Set([
  "fs", "path", "os", "http", "https", "url", "crypto", "stream", "buffer",
  "child_process", "events", "util", "zlib", "assert", "querystring", "tty",
  "readline", "net", "dgram", "dns", "cluster", "worker_threads", "process",
]);

function isSourceFile(f: FileEntry): boolean {
  if (f.isBinary) return false;
  if (SKIP_DIR.test(f.path)) return false;
  if (!f.content || f.content.length > MAX_TEXT_SIZE) return false;
  return SRC_EXT.test(f.path);
}

function extractBareImports(content: string): string[] {
  const out = new Set<string>();
  const re = /(?:from|import)\s+['"]([^'"\n]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const spec = m[1];
    if (!spec) continue;
    if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/") || spec.startsWith("~/")) continue;
    if (spec.startsWith("http") || spec.startsWith("node:") || spec.startsWith("data:")) continue;
    // scope/name → keep scope; plain/name → strip subpath
    const parts = spec.split("/");
    const pkg = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    if (pkg) out.add(pkg);
  }
  return [...out];
}

function collectEnvUsage(files: FileEntry[]): string[] {
  const names = new Set<string>();
  for (const f of files) {
    if (!isSourceFile(f) || !f.content) continue;
    const re1 = /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g;
    const re2 = /process\.env\.(REACT_APP_[A-Z0-9_]+|NEXT_PUBLIC_[A-Z0-9_]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(f.content))) names.add(m[1]);
    while ((m = re2.exec(f.content))) names.add(m[1]);
  }
  return [...names];
}

function parseEnvFile(content: string): Set<string> {
  const s = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0) s.add(t.slice(0, eq).trim());
  }
  return s;
}

function collectPresentEnvVars(files: FileEntry[]): Set<string> {
  const s = new Set<string>();
  for (const f of files) {
    if (f.type !== "file" || !f.content) continue;
    const base = f.path.split("/").pop() || "";
    if (base === ".env" || base.startsWith(".env.")) {
      for (const k of parseEnvFile(f.content)) s.add(k);
    }
  }
  return s;
}

/**
 * Deterministic React-focused readiness scan. Consumes the same file list the
 * wizard uses for scanProject().
 */
export function scanReactReadiness(
  files: FileEntry[],
  scan: ProjectScanResult
): ReactReadinessReport {
  const checks: ReadinessCheck[] = [];
  const hardBlockers: string[] = [];
  const needsUserDecision: ReadinessDecision[] = [];
  const fixableAutomatically: string[] = [];

  const src = files.filter(isSourceFile);
  const flat = files.filter((f) => f.type === "file");
  const pkgFile = files.find((f) => f.path === "package.json");
  let pkgJson: any = {};
  try { pkgJson = JSON.parse(pkgFile?.content || "{}"); } catch { /* noop */ }
  const declaredDeps = new Set([
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.devDependencies || {}),
    ...Object.keys(pkgJson.peerDependencies || {}),
    ...Object.keys(pkgJson.optionalDependencies || {}),
  ]);

  // ─── 1. index.html mount div ───────────────────────────────────────────
  const indexHtml = files.find((f) => f.path === "index.html" || f.path === "public/index.html");
  if (indexHtml?.content) {
    const rootIdMatch = /createRoot\s*\(\s*document\.getElementById\(\s*['"]([^'"]+)['"]/.exec(
      src.map((f) => f.content || "").join("\n")
    );
    const wantedId = rootIdMatch?.[1] || "root";
    const hasMount = new RegExp(`id=["']${wantedId}["']`).test(indexHtml.content);
    if (!hasMount) {
      checks.push({
        id: "mount-div",
        label: "Mount element",
        severity: "warn",
        message: `index.html has no <div id="${wantedId}"> — createRoot() will silently fail. Platform will inject it.`,
        autoFixable: true,
        files: [indexHtml.path],
      });
      fixableAutomatically.push(`Inject <div id="${wantedId}"> into ${indexHtml.path}`);
    }
  }

  // ─── 2. Vite base / CRA homepage ───────────────────────────────────────
  const viteConfig = files.find((f) => /^vite\.config\.(t|j|m)s$/.test(f.path));
  if (viteConfig?.content) {
    const baseMatch = /base\s*:\s*['"]([^'"]+)['"]/.exec(viteConfig.content);
    if (!baseMatch || baseMatch[1] === "/") {
      checks.push({
        id: "vite-base",
        label: "Vite base path",
        severity: "info",
        message: "vite.config: base is '/' or unset. Platform will rewrite bundled URLs to './' at build time.",
        autoFixable: true,
        files: [viteConfig.path],
      });
      fixableAutomatically.push("Vite: rewrite base to './' (asset URL fix)");
    }
  }
  if (pkgJson.dependencies?.["react-scripts"]) {
    const home = pkgJson.homepage;
    if (!home || home.startsWith("/") || home.startsWith("http")) {
      checks.push({
        id: "cra-homepage",
        label: "CRA homepage",
        severity: "info",
        message: "package.json 'homepage' should be '.' for Capacitor. Will be patched automatically.",
        autoFixable: true,
      });
      fixableAutomatically.push("CRA: set package.json homepage to '.'");
    }
  }

  // ─── 3. Router mode (BrowserRouter without basename) ───────────────────
  let usesBrowserRouter = false;
  const routerFiles: string[] = [];
  for (const f of src) {
    if (!f.content) continue;
    if (/from\s+['"]react-router-dom['"]/.test(f.content) &&
        /BrowserRouter|createBrowserRouter/.test(f.content) &&
        !/basename\s*=/.test(f.content) &&
        !/basename\s*:/.test(f.content)) {
      usesBrowserRouter = true;
      routerFiles.push(f.path);
    }
  }
  if (usesBrowserRouter) {
    checks.push({
      id: "router-mode",
      label: "Router mode",
      severity: "warn",
      message: "BrowserRouter is used without a basename. Deep-linking under file:// breaks. Choose HashRouter or acknowledge.",
      autoFixable: false,
      files: routerFiles.slice(0, 5),
    });
    needsUserDecision.push({
      id: "router-mode",
      label: "Router mode",
      message: "How should routing behave on device?",
      options: [
        { value: "hash", label: "Switch to HashRouter (safest for native)", recommended: true },
        { value: "keep", label: "Keep BrowserRouter (I've added a SPA fallback)" },
      ],
    });
  }

  // ─── 4. Env var references vs. .env files ──────────────────────────────
  const needed = collectEnvUsage(files);
  const present = collectPresentEnvVars(files);
  const missing = needed.filter((n) => !present.has(n));
  if (missing.length > 0) {
    checks.push({
      id: "env-vars",
      label: "Environment variables",
      severity: "warn",
      message: `Referenced but not defined in any .env file: ${missing.join(", ")}`,
      autoFixable: false,
    });
    needsUserDecision.push({
      id: "env-vars",
      label: "Missing env vars",
      message: "These will be undefined at runtime and may crash the app.",
      values: missing,
    });
  }

  // ─── 5. Hardcoded localhost / cleartext http in src/ ───────────────────
  const localhostHits: string[] = [];
  for (const f of src) {
    if (!f.content) continue;
    if (/https?:\/\/(localhost|127\.0\.0\.1)/.test(f.content) || /ws:\/\/(localhost|127\.0\.0\.1)/.test(f.content)) {
      // Only flag if not guarded by DEV/import.meta.env.DEV/NODE_ENV check nearby
      const dev = /import\.meta\.env\.DEV|process\.env\.NODE_ENV\s*===?\s*['"]development['"]/.test(f.content);
      if (!dev) localhostHits.push(f.path);
    }
  }
  if (localhostHits.length > 0) {
    checks.push({
      id: "localhost",
      label: "Hardcoded localhost URLs",
      severity: "block",
      message: `These files call http://localhost or ws://localhost outside a DEV guard. Cleartext traffic is blocked on Android release builds and the app will hang or crash.`,
      autoFixable: false,
      files: localhostHits.slice(0, 10),
    });
    hardBlockers.push(`${localhostHits.length} file(s) call localhost without a DEV guard`);
  }

  // ─── 6. Unresolved bare imports ────────────────────────────────────────
  const importedByFile = new Map<string, string[]>();
  const allImports = new Set<string>();
  for (const f of src) {
    if (!f.content) continue;
    const imps = extractBareImports(f.content);
    if (imps.length) {
      importedByFile.set(f.path, imps);
      imps.forEach((i) => allImports.add(i));
    }
  }
  const unresolved: string[] = [];
  for (const imp of allImports) {
    if (NODE_BUILTINS.has(imp)) continue;
    if (declaredDeps.has(imp)) continue;
    // Some scoped packages: check base without subpath already handled
    unresolved.push(imp);
  }
  if (unresolved.length > 0 && pkgFile) {
    const filesUsingUnresolved = new Set<string>();
    for (const [path, imps] of importedByFile) {
      if (imps.some((i) => unresolved.includes(i))) filesUsingUnresolved.add(path);
    }
    checks.push({
      id: "unresolved-imports",
      label: "Unresolved bare imports",
      severity: "block",
      message: `These packages are imported but not in package.json dependencies: ${unresolved.slice(0, 8).join(", ")}${unresolved.length > 8 ? ` (+${unresolved.length - 8} more)` : ""}. Install fails → blank APK.`,
      autoFixable: false,
      files: [...filesUsingUnresolved].slice(0, 10),
    });
    hardBlockers.push(`${unresolved.length} unresolved package import(s)`);
  }

  // ─── 7. SSR-only globals at module top-level ───────────────────────────
  const ssrHits: string[] = [];
  for (const f of src) {
    if (!f.content) continue;
    // very rough: a top-level line beginning (ignoring whitespace) with window./document.
    const lines = f.content.split("\n");
    let depth = 0;
    for (const ln of lines) {
      // adjust brace depth ignoring strings — approximate
      for (const ch of ln) {
        if (ch === "{") depth++;
        else if (ch === "}") depth = Math.max(0, depth - 1);
      }
      if (depth === 0 && /^\s*(window|document)\./.test(ln) && !/typeof\s+(window|document)/.test(ln)) {
        ssrHits.push(f.path);
        break;
      }
    }
  }
  if (ssrHits.length > 0) {
    checks.push({
      id: "ssr-globals",
      label: "Top-level browser globals",
      severity: "warn",
      message: `window/document accessed at module top level in ${ssrHits.length} file(s). Wrap in typeof checks or move into effects.`,
      autoFixable: false,
      files: ssrHits.slice(0, 5),
    });
  }

  // ─── 8. Monorepo app-root decision ─────────────────────────────────────
  if (scan.isMonorepo && scan.workspacePackages.length > 1) {
    needsUserDecision.push({
      id: "app-root",
      label: "Monorepo app root",
      message: "Multiple packages found. Which one is the frontend app to build?",
      options: scan.workspacePackages.map((p, i) => ({
        value: p.path,
        label: `${p.name} (${p.path})`,
        recommended: i === 0,
      })),
    });
  }

  // ─── Risk & ok ─────────────────────────────────────────────────────────
  const blockCount = checks.filter((c) => c.severity === "block").length;
  const warnCount = checks.filter((c) => c.severity === "warn").length;
  const blankScreenRisk: ReactReadinessReport["blankScreenRisk"] =
    blockCount > 0 ? "high" : warnCount >= 2 ? "medium" : "low";
  const ok = hardBlockers.length === 0;

  return {
    ok,
    blankScreenRisk,
    checks,
    hardBlockers,
    needsUserDecision,
    fixableAutomatically,
    detectedEnvVars: needed,
    presentEnvVars: [...present],
  };
}
