/**
 * Project Indexer / Grounding
 *
 * Creates one normalized view of an uploaded project before any builder runs.
 * It is intentionally deterministic: AI can add hints, but this layer decides
 * safe repairs such as static HTML package synthesis and HTML5 boilerplate.
 */

import type { ProjectFile } from "@/stores/projectStore";
import {
  analyzeNormalization,
  resolveBuildTool,
  type NormalizationReport,
  type StaticSupport,
} from "./buildToolRegistry";

export type ProjectShape =
  | "vite-spa"
  | "react-cra"
  | "next-static"
  | "next-ssr"
  | "nuxt"
  | "angular"
  | "svelte"
  | "vue"
  | "ionic"
  | "capacitor"
  | "electron"
  | "plain-html"
  | "monorepo"
  | "unknown";

interface FileEntry {
  path: string;
  type: "file" | "folder";
  content?: string;
  isBinary?: boolean;
}

export interface ProjectIndex {
  shape: ProjectShape;
  framework: string;
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
  projectRoot: string;
  hasPackageJson: boolean;
  hasBuildScript: boolean;
  buildCommand: string;
  outputDir: string;
  entryHtml: string | null;
  isStaticHtml: boolean;
  isMonorepo: boolean;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  remediations: string[];
  warnings: string[];
  /** Build-tool intelligence (registry-resolved, never hardcoded per project). */
  buildTool: string;
  buildToolLabel: string;
  outputSource: string;
  staticSupport: StaticSupport;
  staticCapable: boolean;
  staticBlockers: string[];
  nodeVersion: string | null;
  normalization: NormalizationReport;
}

export interface ProjectEntryCandidate {
  projectRoot: string;
  entryHtml: string;
  packageJson: string | null;
  framework: string;
  buildCommand: string;
  outputDir: string;
  reason: string;
  buildTool: string;
  buildToolLabel: string;
  outputSource: string;
  staticCapable: boolean;
  staticBlockers: string[];
}

export interface GroundingPatch {
  path: string;
  content: string;
  reason: string;
}

export interface GroundingResult {
  index: ProjectIndex;
  patches: GroundingPatch[];
  logs: string[];
  summary?: StaticGroundingSummary;
}

export interface StaticGroundingSummary {
  isStaticHtml: boolean;
  htmlFiles: string[];
  entryHtml: string | null;
  renamedEntry: { from: string; to: string } | null;
  absolutePathsFixed: number;
  targetBlankRemoved: number;
  cssUrlsFixed: number;
  cdnDependencies: string[];   // external http(s) script/link href/src
  localhostRefs: string[];     // js/html files referencing localhost/127.0.0.1
  windowOpenRefs: string[];    // files calling window.open
  phpOrServerFiles: string[];  // .php/.jsp/.asp/.aspx/.rb/.py files
  cookieBanners: string[];     // files where a cookie/consent banner was flagged
  installBanners: string[];    // files with install/pwa install prompts
}

// Static-project build: copy the entire project into www/ (Capacitor default
// webDir) preserving structure. Skip meta files, node_modules, prior native
// output, and www itself. No fallback index.html — grounding is responsible
// for guaranteeing a real entry point.
const STATIC_COPY_SCRIPT =
  "node -e \"const fs=require('fs'),path=require('path');const EX=new Set(['node_modules','www','dist','build','android','ios','.git','package.json','package-lock.json','capacitor.config.ts','capacitor.config.js','capacitor.config.json']);fs.mkdirSync('www',{recursive:true});function cp(s,d){for(const e of fs.readdirSync(s,{withFileTypes:true})){if(EX.has(e.name)||e.name.startsWith('.'))continue;const sp=path.join(s,e.name),dp=path.join(d,e.name);if(e.isDirectory()){fs.mkdirSync(dp,{recursive:true});cp(sp,dp);}else fs.copyFileSync(sp,dp);}}cp('.','www');if(!fs.existsSync('www/index.html'))throw new Error('www/index.html missing after copy');console.log('static copy -> www');\"";

/**
 * Signals to the runner: 'this is a prepared static HTML project — do NOT
 * try to build a web framework, just run cap sync from www/'.
 */
export const STATIC_HTML_MARKER = "nativeforge.static.json";

function flatten(files: ProjectFile[] | FileEntry[]): FileEntry[] {
  const out: FileEntry[] = [];
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(files as any[]);
  return out;
}

function normalizePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/\/+/g, "/");
}

function detectPackageManager(paths: string[]): ProjectIndex["packageManager"] {
  if (paths.some((p) => p.endsWith("bun.lockb") || p.endsWith("bun.lock"))) return "bun";
  if (paths.some((p) => p.endsWith("pnpm-lock.yaml"))) return "pnpm";
  if (paths.some((p) => p.endsWith("yarn.lock"))) return "yarn";
  if (paths.some((p) => p.endsWith("package-lock.json"))) return "npm";
  return "unknown";
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function joinRoot(root: string, path: string): string {
  return root ? `${root}/${path}` : path;
}

function isInsideRoot(path: string, root: string): boolean {
  return root ? path === root || path.startsWith(`${root}/`) : !path.includes("/");
}

function relativeToRoot(path: string, root: string): string {
  return root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function packageLooksLikeFrontend(content?: string): boolean {
  try {
    const pkg = JSON.parse(content || "{}");
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Boolean(
      deps["@capacitor/core"] || deps.electron || deps.vite || deps.react || deps.vue ||
      deps["@angular/core"] || deps.svelte || deps.next || deps.nuxt ||
      deps["@ionic/react"] || deps["@ionic/vue"] || deps["@ionic/angular"] ||
      pkg.scripts?.build?.includes("vite") || pkg.scripts?.build?.includes("react-scripts") ||
      pkg.scripts?.build?.includes("next") || pkg.scripts?.build?.includes("nuxt") ||
      pkg.scripts?.build?.includes("ng build")
    );
  } catch {
    return false;
  }
}

const DISCOVERY_EXCLUDES = new Set(["node_modules", "dist", "build", "www", "android", "ios", ".git", ".next", ".output"]);

function isSourceHtml(path: string): boolean {
  const parts = normalizePath(path).split("/");
  const normalized = normalizePath(path);
  return /\.html?$/i.test(path)
    && !parts.some((part) => DISCOVERY_EXCLUDES.has(part))
    && !/(^|\/)src\/main\/resources\/templates\//.test(normalized);
}

function commonDirectory(paths: string[]): string {
  if (paths.length === 0) return "";
  const directories = paths.map((path) => dirname(path).split("/").filter(Boolean));
  const shared: string[] = [];
  for (let index = 0; index < Math.min(...directories.map((parts) => parts.length)); index++) {
    const part = directories[0][index];
    if (!directories.every((parts) => parts[index] === part)) break;
    shared.push(part);
  }
  return shared.join("/");
}

function htmlEntryScore(path: string, root: string): number {
  const relative = relativeToRoot(path, root);
  const basename = relative.split("/").pop()?.toLowerCase() || "";
  let score = 100 - relative.split("/").length * 5;
  if (basename === "index.html" || basename === "index.htm") score += 1000;
  else if (basename === "home.html" || basename === "home.htm") score += 500;
  else if (basename === "main.html" || basename === "main.htm") score += 400;
  return score;
}

export function discoverProjectEntries(files: ProjectFile[] | FileEntry[]): ProjectEntryCandidate[] {
  const flat = flatten(files).filter((f) => f.type === "file").map((f) => ({ ...f, path: normalizePath(f.path) }));
  const packageFiles = flat.filter((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  const allHtmlFiles = flat.filter((f) => isSourceHtml(f.path));
  const packageRoots = packageFiles.map((file) => dirname(file.path));
  const unownedHtml = allHtmlFiles.filter((html) => !packageRoots.some((root) => root === "" || isInsideRoot(html.path, root)));
  const staticRoot = commonDirectory((unownedHtml.length > 0 ? unownedHtml : allHtmlFiles).map((file) => file.path));
  const htmlFiles = allHtmlFiles.filter((html) => {
    const nearestPackage = packageFiles
      .filter((pkg) => isInsideRoot(html.path, dirname(pkg.path)))
      .sort((a, b) => dirname(b.path).length - dirname(a.path).length)[0];
    return !nearestPackage || /(^|\/)index\.html?$/i.test(html.path);
  });
  return htmlFiles.map((html) => {
    const root = dirname(html.path);
    const ancestors = packageFiles
      .filter((pkg) => {
        const pkgRoot = dirname(pkg.path);
        return pkgRoot === root || (pkgRoot === "" ? true : root.startsWith(`${pkgRoot}/`));
      })
      .sort((a, b) => dirname(b.path).length - dirname(a.path).length);
    const packageFile = ancestors[0];
    const candidateRoot = packageFile ? dirname(packageFile.path) : staticRoot || root;
    const candidateFiles = candidateRoot ? flat.filter((f) => isInsideRoot(f.path, candidateRoot)) : flat;
    const candidateIndex = indexProject(candidateFiles, { preferredRoot: candidateRoot, preferredEntry: html.path });
    const springStaticRoot = /(^|\/)src\/main\/resources\/(static|public)$/.test(candidateRoot);
    return {
      projectRoot: candidateRoot,
      entryHtml: html.path,
      packageJson: packageFile?.path ?? null,
      framework: springStaticRoot ? "Spring Boot static web" : candidateIndex.framework,
      buildCommand: candidateIndex.buildCommand,
      outputDir: candidateIndex.outputDir || (candidateIndex.isStaticHtml ? "www" : "dist"),
      reason: springStaticRoot
        ? `Spring Boot browser entry at ${html.path}`
        : packageFile ? `Matched ${html.path} to ${packageFile.path}` : `Static HTML entry at ${html.path}`,
      buildTool: candidateIndex.buildTool,
      buildToolLabel: candidateIndex.buildToolLabel,
      outputSource: candidateIndex.outputSource,
      staticCapable: candidateIndex.staticCapable,
      staticBlockers: candidateIndex.staticBlockers,
    };
  }).filter((candidate, index, all) => all.findIndex((other) => other.projectRoot === candidate.projectRoot && other.entryHtml === candidate.entryHtml) === index)
    .sort((a, b) => htmlEntryScore(b.entryHtml, b.projectRoot) - htmlEntryScore(a.entryHtml, a.projectRoot) || a.entryHtml.localeCompare(b.entryHtml));
}

function pickFrontendRoot(flat: FileEntry[], packageFiles: FileEntry[], preferredRoot?: string, preferredEntry?: string): { packageFile?: FileEntry; projectRoot: string; entryHtml: string | null; forcedStatic: boolean } {
  const paths = flat.map((f) => f.path);
  const htmlFiles = paths.filter(isSourceHtml);
  if (preferredRoot !== undefined) {
    const normalizedRoot = normalizePath(preferredRoot).replace(/\/$/, "");
    const packageFile = packageFiles.find((f) => dirname(f.path) === normalizedRoot);
    const entryHtml = preferredEntry && htmlFiles.includes(normalizePath(preferredEntry))
      ? normalizePath(preferredEntry)
      : htmlFiles.find((p) => p === joinRoot(normalizedRoot, "index.html")) || htmlFiles.find((p) => isInsideRoot(p, normalizedRoot)) || null;
    return { packageFile, projectRoot: normalizedRoot, entryHtml, forcedStatic: Boolean(entryHtml && !packageFile) };
  }
  const rootHtml = htmlFiles.find((p) => p === "index.html") || null;
  const rootPackage = packageFiles.find((f) => f.path === "package.json");

  if (rootHtml && !rootPackage) {
    return { projectRoot: "", entryHtml: rootHtml, forcedStatic: true };
  }

  const frontendPackages = packageFiles.filter((f) => packageLooksLikeFrontend(f.content));
  const scoredPackages = (frontendPackages.length > 0 ? frontendPackages : packageFiles)
    .map((f) => {
      const root = dirname(f.path);
      const localEntry = htmlFiles.find((p) => p === joinRoot(root, "index.html"));
      const anyLocalHtml = htmlFiles.find((p) => isInsideRoot(p, root));
      let score = scorePackageRoot(f.path, f.content);
      if (localEntry) score += 140;
      else if (anyLocalHtml) score += 60;
      if (root === "") score += 30;
      return { f, root, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = scoredPackages[0];
  const projectRoot = selected ? selected.root : commonDirectory(htmlFiles);
  const localHtml = htmlFiles.filter((path) => isInsideRoot(path, projectRoot));
  const entryHtml = localHtml.sort((a, b) => htmlEntryScore(b, projectRoot) - htmlEntryScore(a, projectRoot) || a.localeCompare(b))[0] || htmlFiles[0] || null;
  return { packageFile: selected?.f, projectRoot, entryHtml, forcedStatic: Boolean(entryHtml && !selected) };
}

function scorePackageRoot(path: string, content?: string): number {
  try {
    const pkg = JSON.parse(content || "{}");
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    let score = 0;
    if (deps["@capacitor/core"]) score += 120;
    if (deps.electron) score += 80;
    if (pkg.scripts?.build) score += 70;
    if (deps.vite || deps.react || deps.vue || deps["@angular/core"] || deps.svelte || deps.next || deps.nuxt) score += 40;
    if (Array.isArray(pkg.workspaces) || pkg.workspaces?.packages) score -= 160;
    score -= path.split("/").length;
    return score;
  } catch {
    return -999;
  }
}

export function indexProject(files: ProjectFile[] | FileEntry[], opts: { preferredRoot?: string; preferredEntry?: string } = {}): ProjectIndex {
  const flat = flatten(files).filter((f) => f.type === "file").map((f) => ({ ...f, path: normalizePath(f.path) }));
  const paths = flat.map((f) => f.path);
  const packageFiles = flat.filter((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  const markerFile = flat.find((f) => f.path === STATIC_HTML_MARKER || f.path.endsWith(`/${STATIC_HTML_MARKER}`));
  const markerRoot = markerFile ? dirname(markerFile.path) : null;
  const detectedRoot = pickFrontendRoot(flat, packageFiles, opts.preferredRoot, opts.preferredEntry);
  let savedMarkerEntry: string | null = null;
  if (markerFile?.content) {
    try {
      const parsed = JSON.parse(markerFile.content);
      if (typeof parsed.entry === "string" && paths.includes(normalizePath(parsed.entry))) savedMarkerEntry = normalizePath(parsed.entry);
    } catch {
      // Invalid marker content falls back to deterministic HTML discovery.
    }
  }
  const markerEntry = markerRoot === null
    ? null
    : savedMarkerEntry || paths.find((p) => p === joinRoot(markerRoot, "index.html")) || paths.filter(isSourceHtml).filter((p) => isInsideRoot(p, markerRoot)).sort((a, b) => htmlEntryScore(b, markerRoot) - htmlEntryScore(a, markerRoot))[0] || null;
  const rootPick = markerRoot === null
    ? detectedRoot
    : {
        packageFile: packageFiles.find((f) => dirname(f.path) === markerRoot),
        projectRoot: markerRoot,
        entryHtml: markerEntry,
        forcedStatic: true,
      };
  const packageFile = rootPick.packageFile;
  const projectRoot = rootPick.projectRoot;

  let pkg: any = null;
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  if (packageFile?.content) {
    try {
      pkg = JSON.parse(packageFile.content);
      dependencies = pkg.dependencies || {};
      devDependencies = pkg.devDependencies || {};
    } catch {
      // handled as warning below
    }
  }

  const deps = { ...dependencies, ...devDependencies };
  const hasPackageJson = Boolean(packageFile && pkg && !rootPick.forcedStatic);
  const hasBuildScript = Boolean(pkg?.scripts?.build || pkg?.scripts?.["build:prod"] || pkg?.scripts?.generate);
  const entryHtml = rootPick.entryHtml;
  const hasIndexHtml = Boolean(entryHtml);
  const isMonorepo = !rootPick.forcedStatic && (paths.some((p) => p.endsWith("pnpm-workspace.yaml") || p.endsWith("turbo.json")) || Boolean(pkg?.workspaces || packageFiles.length > 1));

  let shape: ProjectShape = "unknown";
  let framework = "unknown";
  let outputDir = "dist";
  let buildCommand = "npm run build";

  if (markerFile && hasIndexHtml) {
    shape = "plain-html";
    framework = "plain HTML";
    buildCommand = "npm run build";
    outputDir = "www";
  } else if ((!hasPackageJson || rootPick.forcedStatic || !packageLooksLikeFrontend(packageFile?.content)) && hasIndexHtml) {
    shape = "plain-html";
    framework = "plain HTML";
    buildCommand = "npm run build";
    // Static grounding copies every asset into www/ (Capacitor's default webDir),
    // so the CI output directory must be www — never dist.
    outputDir = "www";
  } else if (deps.electron) {
    shape = "electron";
    framework = "Electron";
    outputDir = "dist";
  } else if (deps["@ionic/react"] || deps["@ionic/vue"] || deps["@ionic/angular"]) {
    shape = "ionic";
    framework = "Ionic";
    outputDir = "www";
  } else if (deps["@capacitor/core"]) {
    shape = "capacitor";
    framework = "Capacitor";
    outputDir = "dist";
  } else if (deps.next) {
    const nextConfig = paths.some((p) => /next\.config\.(js|mjs|ts)$/.test(p));
    shape = nextConfig ? "next-static" : "next-ssr";
    framework = "Next.js";
    outputDir = "out";
  } else if (deps.nuxt) {
    shape = "nuxt";
    framework = "Nuxt";
    outputDir = ".output/public";
    buildCommand = pkg?.scripts?.generate ? "npm run generate" : "npm run build";
  } else if (deps["@angular/core"]) {
    shape = "angular";
    framework = "Angular";
    outputDir = "dist";
  } else if (deps["@sveltejs/kit"] || deps.svelte) {
    shape = "svelte";
    framework = "Svelte";
    outputDir = "build";
  } else if (deps.vue) {
    shape = "vue";
    framework = deps.vite ? "Vue (Vite)" : "Vue";
    outputDir = "dist";
  } else if (deps.react) {
    shape = deps["react-scripts"] ? "react-cra" : "vite-spa";
    framework = deps["react-scripts"] ? "React (CRA)" : "React";
    outputDir = deps["react-scripts"] ? "build" : "dist";
  } else if (deps.vite || paths.some((p) => /vite\.config\.(js|ts|mjs|mts)$/.test(p))) {
    shape = "vite-spa";
    framework = "Vite";
    outputDir = "dist";
  } else if (isMonorepo) {
    shape = "monorepo";
    framework = "monorepo";
  }

  if (pkg?.scripts?.build) buildCommand = "npm run build";
  else if (pkg?.scripts?.["build:prod"]) buildCommand = "npm run build:prod";
  else if (pkg?.scripts?.generate) buildCommand = "npm run generate";

  const warnings: string[] = [];
  const remediations: string[] = [];
  if (packageFile && !pkg) warnings.push("package.json exists but could not be parsed");
  if (rootPick.forcedStatic && packageFiles.length > 0) warnings.push("Nested package.json ignored; root index.html was treated as the frontend app");
  if (shape === "plain-html") remediations.push("Synthesize package.json and copy static assets to www");
  if (shape === "next-ssr") warnings.push("Next.js SSR needs static export for native packaging");
  if (isMonorepo) warnings.push("Monorepo detected; selected the strongest app package root");

  // Build-tool registry is authoritative for build command + output directory.
  let isStaticHtml = shape === "plain-html";
  const tool = resolveBuildTool(flat, projectRoot, { isStaticHtml });
  // Keep discovery and grounding aligned when a package contains native or
  // unrelated dependencies but the registry correctly resolves its web assets
  // as a plain static site.
  if (tool.id === "static-html" && hasIndexHtml) {
    shape = "plain-html";
    framework = "plain HTML";
    isStaticHtml = true;
  }
  const normalization = analyzeNormalization(flat, projectRoot);
  if (!isStaticHtml) {
    outputDir = tool.outputDir || outputDir;
    buildCommand = tool.buildCommand || buildCommand;
  } else {
    // Static grounding always synthesizes its own copy-to-www build script,
    // so never inherit an unrelated (e.g. backend) build command.
    outputDir = "www";
    buildCommand = "npm run build";
  }
  warnings.push(...tool.warnings);
  remediations.push(...normalization.notes);

  return {
    shape,
    framework,
    packageManager: detectPackageManager(paths),
    projectRoot,
    hasPackageJson,
    hasBuildScript: hasBuildScript || shape === "plain-html",
    buildCommand,
    outputDir: outputDir || (shape === "plain-html" ? "www" : "dist"),
    entryHtml,
    isStaticHtml,
    buildTool: tool.id,
    buildToolLabel: tool.label,
    outputSource: tool.outputSource,
    staticSupport: tool.staticSupport,
    staticCapable: tool.staticCapable,
    staticBlockers: tool.blockers,
    nodeVersion: tool.nodeVersion,
    normalization,
    isMonorepo,
    dependencies,
    devDependencies,
    remediations,
    warnings,
  };
}

export function synthesizeStaticPackage(appName = "static-html-app"): string {
  const safeName = appName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "static-html-app";
  return JSON.stringify({
    name: safeName,
    version: "1.0.0",
    private: true,
    // Runner reads this to know it can skip framework build detection.
    nativeforge: { type: "static-html" },
    scripts: { build: STATIC_COPY_SCRIPT },
    devDependencies: {
      "@capacitor/cli": "^7.0.0",
    },
    dependencies: {
      "@capacitor/core": "^7.0.0",
      "@capacitor/android": "^7.0.0",
    },
  }, null, 2) + "\n";
}

/** Injects a first-in-<head> <script src="./nativeforge.js"> if not present. */
function injectNativeforgeScript(html: string): string {
  if (/<script[^>]+src=["'][^"']*nativeforge\.js["']/i.test(html)) return html;
  if (!/<head[\s>]/i.test(html)) return html;
  return html.replace(
    /<head([^>]*)>/i,
    `<head$1>\n  <script src="./nativeforge.js"></script>`,
  );
}

/** Relativize `url("/x")` → `url("x")` inside CSS text (skips protocol/data). */
function relativizeCssUrls(css: string): { out: string; count: number } {
  let count = 0;
  const out = css.replace(
    /url\(\s*(['"]?)\/(?!\/)([^'")]+)\1\s*\)/gi,
    (_m, q: string, rest: string) => { count++; return `url(${q}${rest}${q})`; },
  );
  return { out, count };
}

const CDN_RE = /(?:src|href)=["'](https?:\/\/[^"']+\.(?:js|css|woff2?|ttf|eot))["']/gi;
const LOCALHOST_RE_G = /\b(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^\s"'`)]*)/gi;
const WINDOW_OPEN_RE = /\bwindow\.open\s*\(/;
const COOKIE_BANNER_RE = /\b(cookie[- ]?(?:consent|banner|notice)|gdpr|accept[- ]?cookies)\b/i;
const INSTALL_BANNER_RE = /\b(install[- ]?(?:app|pwa)|add to home ?screen|beforeinstallprompt)\b/i;
const SERVER_EXT_RE = /\.(php|jsp|asp|aspx|erb|rb|py|cfm)$/i;

function countMatches(re: RegExp, str: string): number {
  const m = str.match(re);
  return m ? m.length : 0;
}

export function repairHtmlBoilerplate(content: string, title = "App"): string {
  let html = content.trim();
  const hasDoctype = /^<!doctype\s+html/i.test(html);
  const hasHtml = /<html[\s>]/i.test(html);
  const hasHead = /<head[\s>]/i.test(html);
  const hasBody = /<body[\s>]/i.test(html);
  const safeTitle = title.replace(/[<>]/g, "");

  if (!hasHtml) {
    html = `${hasDoctype ? "" : "<!doctype html>\n"}<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${safeTitle}</title>\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
    return html;
  }

  if (!hasDoctype) html = `<!doctype html>\n${html}`;
  if (!hasHead) html = html.replace(/<html([^>]*)>/i, `<html$1>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${safeTitle}</title>\n</head>`);
  if (!/<meta\s+charset=/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>\n  <meta charset="UTF-8">`);
  if (!/<meta\s+name=["']viewport["']/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">`);
  if (!/<title[\s>]/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>\n  <title>${safeTitle}</title>`);
  if (!hasBody) html = html.replace(/<\/head>/i, `</head>\n<body>`).replace(/<\/html>/i, `</body>\n</html>`);
  return html.endsWith("\n") ? html : `${html}\n`;
}

/**
 * Plain-HTML hardening for WebView packaging:
 *  - convert absolute asset paths ("/x") to relative ("./x")
 *  - strip target="_blank" (Capacitor WebView has no external chrome)
 *  - guarantee a viewport meta tag
 *  - remove <base href="/..."> that breaks file:// / asset:// loads
 */
export function hardenPlainHtmlForWebview(content: string): string {
  let html = content;
  html = html.replace(
    /(\s(?:src|href|poster|action)\s*=\s*)(["'])\/(?!\/)([^"']*)\2/gi,
    (_m, prefix: string, q: string, rest: string) => `${prefix}${q}./${rest}${q}`,
  );
  html = html.replace(/<base\s+href=["']\/[^"']*["']\s*\/?>\s*/gi, "");
  html = html.replace(/\s+target=["']_blank["']/gi, "");
  if (!/<meta\s+name=["']viewport["']/i.test(html) && /<head[\s>]/i.test(html)) {
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    );
  }
  return html;
}

export function planProjectGrounding(
  files: ProjectFile[] | FileEntry[],
  appName = "App",
  opts: { appId?: string; preferredRoot?: string; preferredEntry?: string } = {},
): GroundingResult {
  const index = indexProject(files, { preferredRoot: opts.preferredRoot, preferredEntry: opts.preferredEntry });
  const flat = flatten(files).filter((f) => f.type === "file").map((f) => ({ ...f, path: normalizePath(f.path) }));
  const patches: GroundingPatch[] = [];
  const logs: string[] = [
    `Indexed project: ${index.shape}`,
    `Project root: ${index.projectRoot || "."}`,
    `Build command: ${index.buildCommand}`,
    `Expected output: ${index.outputDir}`,
  ];

  if (!index.isStaticHtml) {
    // Non-static path: keep the existing minimal HTML boilerplate repair.
    const htmlFile = index.entryHtml ? flat.find((f) => f.path === index.entryHtml && !f.isBinary) : null;
    if (htmlFile?.content) {
      const next = repairHtmlBoilerplate(htmlFile.content, appName);
      if (next !== htmlFile.content) {
        patches.push({ path: htmlFile.path, content: next, reason: "Added missing HTML5 boilerplate" });
      }
    }
    for (const p of patches) logs.push(`Grounding patch: ${p.path} — ${p.reason}`);
    for (const w of index.warnings) logs.push(`Warning: ${w}`);
    return { index, patches, logs };
  }

  // ── Plain-HTML preparation pipeline ──
  const summary: StaticGroundingSummary = {
    isStaticHtml: true,
    htmlFiles: [],
    entryHtml: index.entryHtml,
    renamedEntry: null,
    absolutePathsFixed: 0,
    targetBlankRemoved: 0,
    cssUrlsFixed: 0,
    cdnDependencies: [],
    localhostRefs: [],
    windowOpenRefs: [],
    phpOrServerFiles: [],
    cookieBanners: [],
    installBanners: [],
  };

  const root = index.projectRoot;
  const rootHtml = flat.filter((f) => /\.html?$/i.test(f.path) && !f.isBinary);
  summary.htmlFiles = rootHtml.map((f) => f.path);

  // Step 1.6 — If no index.html anywhere, promote the shallowest .html file.
  let entryHtml = index.entryHtml;
  if (!entryHtml && rootHtml.length > 0) {
    const shallowest = [...rootHtml].sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
    const targetPath = joinRoot(dirname(shallowest.path), "index.html");
    if (shallowest.content) {
      patches.push({ path: targetPath, content: shallowest.content, reason: `Promoted ${shallowest.path} → index.html (no index.html found)` });
      summary.renamedEntry = { from: shallowest.path, to: targetPath };
      entryHtml = targetPath;
      summary.entryHtml = targetPath;
    }
  }

  // Steps 5+6 — package.json + capacitor.config.json.
  // The static pipeline must own this manifest. Keeping an uploaded no-op or
  // backend-only build script would never produce www/index.html in CI.
  patches.push({
    path: joinRoot(root, "package.json"),
    content: synthesizeStaticPackage(appName),
    reason: index.hasPackageJson
      ? "Static HTML: replaced non-bundler package metadata with the www build"
      : "Static HTML: package.json + Capacitor deps",
  });
  const capCfg = {
    appId: opts.appId || "com.nativeforge.app",
    appName,
    webDir: "www",
    server: { androidScheme: "https" },
  };
  patches.push({ path: joinRoot(root, "capacitor.config.json"), content: JSON.stringify(capCfg, null, 2) + "\n", reason: "Capacitor config with webDir=www" });

  // Step 12 — runner marker.
  patches.push({
    path: joinRoot(root, STATIC_HTML_MARKER),
    content: JSON.stringify({ type: "static-html", webDir: "www", entry: entryHtml, generatedBy: "nativeforge-grounding" }, null, 2) + "\n",
    reason: "Static-HTML marker (runner skips web build)",
  });

  // Materialize the canonical web output during creation. Capacitor requires a
  // real <webDir>/index.html; storing it in the normalized snapshot also makes
  // output discovery deterministic across fresh CI runners.
  const excludedTopLevel = new Set([
    "node_modules", "www", "dist", "build", "android", "ios", ".git",
    "package.json", "package-lock.json", "capacitor.config.ts",
    "capacitor.config.js", "capacitor.config.json", STATIC_HTML_MARKER,
  ]);
  for (const f of flat) {
    if (!isInsideRoot(f.path, root) || f.isBinary) continue;
    const relative = relativeToRoot(f.path, root);
    const top = relative.split("/")[0];
    if (!relative || excludedTopLevel.has(top) || top.startsWith(".")) continue;
    const patchedContent = patches.find((p) => p.path === f.path)?.content ?? f.content;
    if (patchedContent === undefined) continue;
    patches.push({
      path: joinRoot(root, `www/${relative}`),
      content: patchedContent,
      reason: "Materialized static web output",
    });
  }
  const outputEntry = joinRoot(root, "www/index.html");
  const sourceEntry = entryHtml ? flat.find((f) => f.path === entryHtml) : null;
  if (!patches.some((p) => p.path === outputEntry) && sourceEntry?.content) {
    const hardenedEntry = patches.find((p) => p.path === entryHtml)?.content ?? sourceEntry.content;
    patches.push({ path: outputEntry, content: hardenedEntry, reason: "Materialized static entry point" });
  }

  // Step 9 — nativeforge.js at project root (copied into www by the build script).
  patches.push({
    path: joinRoot(root, "nativeforge.js"),
    content: "// Auto-generated by NativeForge. Available to every page inside the Android WebView.\nwindow.NATIVEFORGE_NATIVE = true;\n",
    reason: "NATIVEFORGE_NATIVE flag script",
  });

  // Steps 3, 9, 10 — harden every HTML file: relativize, strip target=_blank,
  // viewport, inject nativeforge.js, and flag banners.
  const allHtmlPaths = new Set<string>(rootHtml.map((f) => f.path));
  if (summary.renamedEntry) allHtmlPaths.add(summary.renamedEntry.to);

  for (const f of rootHtml) {
    const original = f.content!;
    // Count what we're about to fix before we mutate.
    summary.absolutePathsFixed += countMatches(/\s(?:src|href|poster|action)\s*=\s*["']\/(?!\/)[^"']*["']/gi, original);
    summary.targetBlankRemoved += countMatches(/\s+target=["']_blank["']/gi, original);
    if (COOKIE_BANNER_RE.test(original)) summary.cookieBanners.push(f.path);
    if (INSTALL_BANNER_RE.test(original)) summary.installBanners.push(f.path);
    const cdnMatches = original.match(CDN_RE) || [];
    for (const m of cdnMatches) {
      const url = m.replace(/^(?:src|href)=["']/, "").replace(/["']$/, "");
      if (!summary.cdnDependencies.includes(url)) summary.cdnDependencies.push(url);
    }

    let next = repairHtmlBoilerplate(original, appName);
    next = hardenPlainHtmlForWebview(next);
    next = injectNativeforgeScript(next);
    if (next !== original) {
      patches.push({ path: f.path, content: next, reason: "WebView hardening + nativeforge.js injection" });
    }
  }

  // Step 4 — scan JS files for localhost / window.open.
  for (const f of flat) {
    if (f.isBinary || !f.content) continue;
    if (/\.(m?js|cjs|ts|jsx|tsx|html?)$/i.test(f.path)) {
      const lc = f.content.match(LOCALHOST_RE_G);
      if (lc && lc.length && !summary.localhostRefs.includes(f.path)) summary.localhostRefs.push(f.path);
      if (WINDOW_OPEN_RE.test(f.content) && !summary.windowOpenRefs.includes(f.path)) summary.windowOpenRefs.push(f.path);
    }
    if (SERVER_EXT_RE.test(f.path)) summary.phpOrServerFiles.push(f.path);
  }

  // Edge case — CSS absolute url() → relative.
  for (const f of flat) {
    if (f.isBinary || !f.content) continue;
    if (!/\.css$/i.test(f.path)) continue;
    const { out, count } = relativizeCssUrls(f.content);
    if (count > 0) {
      summary.cssUrlsFixed += count;
      patches.push({ path: f.path, content: out, reason: `Relativized ${count} absolute url() reference(s)` });
    }
  }

  // Source hardening runs after output materialization; keep the canonical
  // output byte-for-byte aligned with the final source patches.
  for (const outputPatch of patches.filter((p) => p.path.startsWith(joinRoot(root, "www/")))) {
    const relative = relativeToRoot(outputPatch.path, joinRoot(root, "www"));
    const sourcePatch = patches.find((p) => p.path === joinRoot(root, relative));
    if (sourcePatch) outputPatch.content = sourcePatch.content;
  }

  // Logs — high-signal, ordered.
  if (summary.renamedEntry) logs.push(`Entry: ${summary.renamedEntry.from} promoted to ${summary.renamedEntry.to}`);
  logs.push(`Static HTML: ${summary.htmlFiles.length} HTML file(s); entry=${summary.entryHtml || "(none)"}`);
  if (summary.absolutePathsFixed) logs.push(`Fixed ${summary.absolutePathsFixed} absolute path(s) in HTML`);
  if (summary.targetBlankRemoved) logs.push(`Removed ${summary.targetBlankRemoved} target="_blank" attribute(s)`);
  if (summary.cssUrlsFixed) logs.push(`Fixed ${summary.cssUrlsFixed} absolute url() reference(s) in CSS`);
  if (summary.cdnDependencies.length) logs.push(`⚠ ${summary.cdnDependencies.length} external CDN dependency/dependencies — will need network access on device`);
  if (summary.localhostRefs.length) logs.push(`⚠ Localhost API calls in ${summary.localhostRefs.length} file(s) — will not resolve on device`);
  if (summary.windowOpenRefs.length) logs.push(`⚠ window.open() in ${summary.windowOpenRefs.length} file(s) — will not open a new tab in WebView`);
  if (summary.phpOrServerFiles.length) logs.push(`⚠ ${summary.phpOrServerFiles.length} server-side file(s) will not run in WebView: ${summary.phpOrServerFiles.slice(0, 3).join(", ")}`);
  if (summary.cookieBanners.length) logs.push(`⚠ Cookie/consent banner detected in: ${summary.cookieBanners.join(", ")} — consider gating with window.NATIVEFORGE_NATIVE`);
  if (summary.installBanners.length) logs.push(`⚠ Install-app banner detected in: ${summary.installBanners.join(", ")} — consider gating with window.NATIVEFORGE_NATIVE`);
  for (const p of patches) logs.push(`Grounding patch: ${p.path} — ${p.reason}`);
  for (const w of index.warnings) logs.push(`Warning: ${w}`);

  return { index, patches, logs, summary };
}

export function projectIndexToLogs(index: ProjectIndex): string[] {
  return [
    `Shape: ${index.shape}`,
    `Framework: ${index.framework}`,
    `Project root: ${index.projectRoot || "."}`,
    `Build: ${index.buildCommand}`,
    `Output: ${index.outputDir}`,
    ...index.remediations.map((r) => `Grounding: ${r}`),
    ...index.warnings.map((w) => `⚠ ${w}`),
  ];
}

export { STATIC_COPY_SCRIPT };