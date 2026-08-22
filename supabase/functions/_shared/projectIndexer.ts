/**
 * Project Indexer / Grounding (shared)
 *
 * Deterministic pre-build view of an uploaded project. Adds:
 *  - HashRouter rewrite for Capacitor/webview/electron targets
 *  - Vite base:'./' patch
 *  - Capacitor config alignment (webDir + appId)
 *  - React <div id="root"> injection
 *  - Localhost API scan (blocks build)
 *  - HTML5 boilerplate repair
 *  - Static-HTML package.json synthesis
 */

import {
  analyzeNormalization,
  resolveBuildTool,
  type NormalizationReport,
  type StaticSupport,
} from "./buildToolRegistry.ts";

export interface ProjectFile {
  path: string;
  type: "file" | "folder";
  content?: string;
  isBinary?: boolean;
  binaryContent?: Uint8Array;
  size?: number;
  children?: ProjectFile[];
}

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

export type RouterMode = "browser" | "hash" | "unknown";

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
  routerMode: RouterMode;
  hasLocalhostCalls: boolean;
  localhostFiles: string[];
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
}

const STATIC_COPY_SCRIPT =
  "node -e \"const fs=require('fs'),path=require('path');const EX=new Set(['node_modules','www','dist','build','android','ios','.git','package.json','package-lock.json','capacitor.config.ts','capacitor.config.js','capacitor.config.json']);fs.mkdirSync('www',{recursive:true});function cp(s,d){for(const e of fs.readdirSync(s,{withFileTypes:true})){if(EX.has(e.name)||e.name.startsWith('.'))continue;const sp=path.join(s,e.name),dp=path.join(d,e.name);if(e.isDirectory()){fs.mkdirSync(dp,{recursive:true});cp(sp,dp);}else fs.copyFileSync(sp,dp);}}cp('.','www');if(!fs.existsSync('www/index.html'))throw new Error('www/index.html missing after copy');console.log('static copy -> www');\"";

export const STATIC_HTML_MARKER = "nativeforge.static.json";

const LOCALHOST_RE = /\bhttps?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|env|env\.[^.]+)$/i;

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
      deps["@capacitor/core"] ||
      deps.electron ||
      deps.vite ||
      deps.react ||
      deps.vue ||
      deps["@angular/core"] ||
      deps.svelte ||
      deps.next ||
      deps.nuxt ||
      deps["@ionic/react"] ||
      deps["@ionic/vue"] ||
      deps["@ionic/angular"] ||
      pkg.scripts?.build?.includes("vite") ||
      pkg.scripts?.build?.includes("react-scripts") ||
      pkg.scripts?.build?.includes("next") ||
      pkg.scripts?.build?.includes("nuxt") ||
      pkg.scripts?.build?.includes("ng build")
    );
  } catch {
    return false;
  }
}

const DISCOVERY_EXCLUDES = new Set(["node_modules", "dist", "build", "www", "android", "ios", ".git", ".next", ".output"]);

function isSourceHtml(path: string): boolean {
  const normalized = normalizePath(path);
  return /\.html?$/i.test(path)
    && !normalized.split("/").some((part) => DISCOVERY_EXCLUDES.has(part))
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
    const nearestPackage = packageFiles.filter((pkg) => isInsideRoot(html.path, dirname(pkg.path))).sort((a, b) => dirname(b.path).length - dirname(a.path).length)[0];
    return !nearestPackage || /(^|\/)index\.html?$/i.test(html.path);
  });
  return htmlFiles.map((html) => {
    const htmlRoot = dirname(html.path);
    const packageFile = packageFiles.filter((pkg) => {
      const root = dirname(pkg.path);
      return root === htmlRoot || root === "" || htmlRoot.startsWith(`${root}/`);
    }).sort((a, b) => dirname(b.path).length - dirname(a.path).length)[0];
    const projectRoot = packageFile ? dirname(packageFile.path) : staticRoot || htmlRoot;
    const candidateFiles = projectRoot ? flat.filter((f) => isInsideRoot(f.path, projectRoot)) : flat;
    const candidateIndex = indexProject(candidateFiles, { preferredRoot: projectRoot, preferredEntry: html.path });
    const springStaticRoot = /(^|\/)src\/main\/resources\/(static|public)$/.test(projectRoot);
    return {
      projectRoot,
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

  // Critical plain-HTML case: a frontend has index.html at root, while an
  // unrelated backend package.json sits in a nested folder. Do not let that
  // backend package become the app root or its no-op build script will be used.
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

function detectRouterMode(flat: FileEntry[]): RouterMode {
  for (const f of flat) {
    if (!f.content || f.isBinary) continue;
    if (!/\.(tsx?|jsx?)$/.test(f.path)) continue;
    if (/from\s+['"]react-router-dom['"]/.test(f.content)) {
      if (/\bHashRouter\b/.test(f.content)) return "hash";
      if (/\bBrowserRouter\b/.test(f.content)) return "browser";
    }
  }
  return "unknown";
}

function scanLocalhost(flat: FileEntry[]): string[] {
  const hits: string[] = [];
  for (const f of flat) {
    if (!f.content || f.isBinary) continue;
    if (!CODE_EXT.test(f.path) && !/^\.env/.test(f.path.split("/").pop() || "")) continue;
    if (LOCALHOST_RE.test(f.content)) hits.push(f.path);
  }
  return hits;
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
  const markerEntry = markerRoot === null ? null : savedMarkerEntry || paths.find((p) => p === joinRoot(markerRoot, "index.html")) || paths.filter(isSourceHtml).filter((p) => isInsideRoot(p, markerRoot)).sort((a, b) => htmlEntryScore(b, markerRoot) - htmlEntryScore(a, markerRoot))[0] || null;
  const rootPick = markerRoot === null ? detectedRoot : {
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
    } catch { /* warn below */ }
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
    shape = "plain-html"; framework = "plain HTML"; outputDir = "www";
  } else if ((!hasPackageJson || rootPick.forcedStatic || !packageLooksLikeFrontend(packageFile?.content)) && hasIndexHtml) {
    shape = "plain-html"; framework = "plain HTML"; outputDir = "www";
  } else if (deps.electron) {
    shape = "electron"; framework = "Electron"; outputDir = "dist";
  } else if (deps["@ionic/react"] || deps["@ionic/vue"] || deps["@ionic/angular"]) {
    shape = "ionic"; framework = "Ionic"; outputDir = "www";
  } else if (deps["@capacitor/core"]) {
    shape = "capacitor"; framework = "Capacitor"; outputDir = "dist";
  } else if (deps.next) {
    const nextConfig = paths.some((p) => /next\.config\.(js|mjs|ts)$/.test(p));
    shape = nextConfig ? "next-static" : "next-ssr"; framework = "Next.js"; outputDir = "out";
  } else if (deps.nuxt) {
    shape = "nuxt"; framework = "Nuxt"; outputDir = ".output/public";
    buildCommand = pkg?.scripts?.generate ? "npm run generate" : "npm run build";
  } else if (deps["@angular/core"]) {
    shape = "angular"; framework = "Angular"; outputDir = "dist";
  } else if (deps["@sveltejs/kit"] || deps.svelte) {
    shape = "svelte"; framework = "Svelte"; outputDir = "build";
  } else if (deps.vue) {
    shape = "vue"; framework = deps.vite ? "Vue (Vite)" : "Vue"; outputDir = "dist";
  } else if (deps.react) {
    shape = deps["react-scripts"] ? "react-cra" : "vite-spa";
    framework = deps["react-scripts"] ? "React (CRA)" : "React";
    outputDir = deps["react-scripts"] ? "build" : "dist";
  } else if (deps.vite || paths.some((p) => /vite\.config\.(js|ts|mjs|mts)$/.test(p))) {
    shape = "vite-spa"; framework = "Vite"; outputDir = "dist";
  } else if (isMonorepo) {
    shape = "monorepo"; framework = "monorepo";
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

  const routerMode = detectRouterMode(flat);
  const localhostFiles = scanLocalhost(flat);
  const hasLocalhostCalls = localhostFiles.length > 0;
  if (hasLocalhostCalls) warnings.push(`Localhost API calls detected in ${localhostFiles.length} file(s) — build will be blocked for native targets`);
  if (routerMode === "browser") remediations.push("Convert BrowserRouter → HashRouter for native shell");

  // Build-tool registry is authoritative for build command + output directory.
  let isStaticHtml = shape === "plain-html";
  const tool = resolveBuildTool(flat, projectRoot, { isStaticHtml });
  // A package.json may contain Capacitor or unrelated tooling while its actual
  // web application is still plain HTML. The registry's static-html resolution
  // is authoritative, so keep the project shape and grounding pipeline aligned.
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
    shape, framework,
    packageManager: detectPackageManager(paths),
    projectRoot, hasPackageJson,
    hasBuildScript: hasBuildScript || shape === "plain-html",
    buildCommand,
    outputDir: outputDir || (isStaticHtml ? "www" : "dist"),
    entryHtml,
    isStaticHtml,
    isMonorepo, dependencies, devDependencies,
    remediations, warnings,
    routerMode, hasLocalhostCalls, localhostFiles,
    buildTool: tool.id,
    buildToolLabel: tool.label,
    outputSource: tool.outputSource,
    staticSupport: tool.staticSupport,
    staticCapable: tool.staticCapable,
    staticBlockers: tool.blockers,
    nodeVersion: tool.nodeVersion,
    normalization,
  };
}

export function synthesizeStaticPackage(appName = "static-html-app"): string {
  const safeName = appName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "static-html-app";
  return JSON.stringify({
    name: safeName,
    version: "1.0.0",
    private: true,
    nativeforge: { type: "static-html" },
    scripts: { build: STATIC_COPY_SCRIPT },
    devDependencies: { "@capacitor/cli": "^7.0.0" },
    dependencies: { "@capacitor/core": "^7.0.0", "@capacitor/android": "^7.0.0" },
  }, null, 2) + "\n";
}

export function repairHtmlBoilerplate(content: string, title = "App", injectRootDiv = false): string {
  return repairHtmlBoilerplateImpl(content, title, injectRootDiv);
}

/** Synthesizes a capacitor.config.json for projects that have none. */
export function synthesizeCapacitorConfig(appName = "App", webDir = "dist", appId?: string): string {
  const safeId = appId && /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(appId)
    ? appId
    : `com.nativebridge.${(appName.toLowerCase().replace(/[^a-z0-9]/g, "") || "app")}`;
  return JSON.stringify({
    appId: safeId,
    appName,
    webDir,
    bundledWebRuntime: false,
    server: { androidScheme: "https" },
  }, null, 2) + "\n";
}

function repairHtmlBoilerplateImpl(content: string, title = "App", injectRootDiv = false): string {
  let html = content.trim();
  const hasDoctype = /^<!doctype\s+html/i.test(html);
  const hasHtml = /<html[\s>]/i.test(html);
  const hasHead = /<head[\s>]/i.test(html);
  const hasBody = /<body[\s>]/i.test(html);
  const safeTitle = title.replace(/[<>]/g, "");

  if (!hasHtml) {
    html = `${hasDoctype ? "" : "<!doctype html>\n"}<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${safeTitle}</title>\n</head>\n<body>\n${injectRootDiv ? '  <div id="root"></div>\n' : ""}${html}\n</body>\n</html>\n`;
    return html;
  }

  if (!hasDoctype) html = `<!doctype html>\n${html}`;
  if (!hasHead) html = html.replace(/<html([^>]*)>/i, `<html$1>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${safeTitle}</title>\n</head>`);
  if (!/<meta\s+charset=/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>\n  <meta charset="UTF-8">`);
  if (!/<meta\s+name=["']viewport["']/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">`);
  if (!/<title[\s>]/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>\n  <title>${safeTitle}</title>`);
  if (!hasBody) html = html.replace(/<\/head>/i, `</head>\n<body>`).replace(/<\/html>/i, `</body>\n</html>`);
  if (injectRootDiv && !/<div\s+id=["']root["']/i.test(html)) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n  <div id="root"></div>`);
  }
  return html.endsWith("\n") ? html : `${html}\n`;
}

/**
 * Plain-HTML hardening for WebView packaging:
 *  - convert absolute asset paths (src="/x", href="/x") to relative ("./x")
 *  - strip target="_blank" so links stay inside the WebView (Capacitor has no
 *    external chrome to open a new tab into)
 *  - guarantee a viewport meta tag
 *  - remove any <base href="/..."> that breaks file:// / asset:// loads
 * Idempotent — returns original when nothing changed.
 */
export function hardenPlainHtmlForWebview(content: string): string {
  let html = content;
  // Relativize absolute paths on common asset attributes. Skip protocol URLs
 // (http:, https:, data:, //cdn) and hash/query-only refs.
  html = html.replace(
    /(\s(?:src|href|poster|action)\s*=\s*)(["'])\/(?!\/)([^"']*)\2/gi,
    (_m, prefix: string, q: string, rest: string) => `${prefix}${q}./${rest}${q}`,
  );
  // Drop <base href="/..."> — resolves relative URLs to a bad root under file://
  html = html.replace(/<base\s+href=["']\/[^"']*["']\s*\/?>\s*/gi, "");
  // Neutralize target="_blank" (leave rel intact for safety).
  html = html.replace(/\s+target=["']_blank["']/gi, "");
  // Ensure viewport meta.
  if (!/<meta\s+name=["']viewport["']/i.test(html) && /<head[\s>]/i.test(html)) {
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    );
  }
  return html;
}

/** Rewrites BrowserRouter → HashRouter idempotently. */
export function rewriteBrowserRouterToHash(content: string): string {
  if (/\bHashRouter\b/.test(content) && !/\bBrowserRouter\b/.test(content)) return content;
  return content
    .replace(/\bBrowserRouter as Router\b/g, "HashRouter as Router")
    .replace(/\bBrowserRouter\b/g, "HashRouter");
}

/** Ensures Vite config uses base:'./'. Returns null if no change needed. */
export function patchViteBase(content: string): string | null {
  if (/base\s*:\s*['"]\.\/['"]/.test(content)) return null;
  if (/base\s*:\s*['"][^'"]*['"]/.test(content)) {
    return content.replace(/base\s*:\s*['"][^'"]*['"]/, "base: './'");
  }
  // Insert into defineConfig({...})
  if (/defineConfig\s*\(\s*\{/.test(content)) {
    return content.replace(/defineConfig\s*\(\s*\{/, "defineConfig({\n  base: './',");
  }
  return null;
}

/** Aligns Capacitor config webDir + appId. */
export function patchCapacitorConfig(content: string, webDir: string, appId?: string): string | null {
  let out = content;
  let changed = false;
  if (/webDir\s*:\s*['"][^'"]*['"]/.test(out)) {
    const next = out.replace(/webDir\s*:\s*['"][^'"]*['"]/, `webDir: '${webDir}'`);
    if (next !== out) { out = next; changed = true; }
  }
  if (appId && /appId\s*:\s*['"][^'"]*['"]/.test(out)) {
    const next = out.replace(/appId\s*:\s*['"][^'"]*['"]/, `appId: '${appId}'`);
    if (next !== out) { out = next; changed = true; }
  }
  return changed ? out : null;
}

export function planProjectGrounding(
  files: ProjectFile[] | FileEntry[],
  appName = "App",
  opts: { engine?: "capacitor" | "electron" | "twa" | "webview" | "pwa"; appId?: string; preferredRoot?: string; preferredEntry?: string } = {},
): GroundingResult {
  const index = indexProject(files, { preferredRoot: opts.preferredRoot, preferredEntry: opts.preferredEntry });
  const flat = flatten(files).filter((f) => f.type === "file").map((f) => ({ ...f, path: normalizePath(f.path) }));
  const patches: GroundingPatch[] = [];
  const logs = [
    `Indexed project: ${index.shape}`,
    `Project root: ${index.projectRoot || "."}`,
    `Build command: ${index.buildCommand}`,
    `Expected output: ${index.outputDir}`,
    `Router mode: ${index.routerMode}`,
  ];

  const nativeTarget = opts.engine === "capacitor" || opts.engine === "electron" || opts.engine === "webview";
  const isReact = Boolean(index.dependencies.react || index.devDependencies.react);

  if (index.isStaticHtml) {
    // The static pipeline must own this manifest. Keeping an uploaded no-op or
    // backend-only build script would never produce www/index.html in CI.
    patches.push({
      path: joinRoot(index.projectRoot, "package.json"),
      content: synthesizeStaticPackage(appName),
      reason: index.hasPackageJson
        ? "Static HTML: replaced non-bundler package metadata with the www build"
        : "Static HTML project needs package.json for CI build",
    });
    patches.push({
      path: joinRoot(index.projectRoot, STATIC_HTML_MARKER),
      content: JSON.stringify({ type: "static-html", webDir: "www", entry: index.entryHtml, generatedBy: "nativeforge-grounding" }, null, 2) + "\n",
      reason: "Static HTML marker for CI runner",
    });
    patches.push({
      path: joinRoot(index.projectRoot, "nativeforge.js"),
      content: "// Auto-generated by NativeForge. Available to every page inside the Android WebView.\nwindow.NATIVEFORGE_NATIVE = true;\n",
      reason: "NATIVEFORGE_NATIVE flag script",
    });
  }

  if (index.isStaticHtml && !patches.some((p) => p.path.endsWith(STATIC_HTML_MARKER))) {
    patches.push({
      path: joinRoot(index.projectRoot, STATIC_HTML_MARKER),
      content: JSON.stringify({ type: "static-html", webDir: "www", entry: index.entryHtml, generatedBy: "nativeforge-grounding" }, null, 2) + "\n",
      reason: "Static HTML marker for CI runner",
    });
  }

  // Repair boilerplate on the entry HTML …
  const htmlFile = index.entryHtml ? flat.find((f) => f.path === index.entryHtml && !f.isBinary) : null;
  if (htmlFile?.content) {
    let next = repairHtmlBoilerplate(htmlFile.content, appName, isReact);
    if (index.isStaticHtml) next = hardenPlainHtmlForWebview(next);
    if (next !== htmlFile.content) {
      patches.push({
        path: htmlFile.path,
        content: next,
        reason: isReact
          ? "HTML5 boilerplate + <div id=\"root\"> mount"
          : index.isStaticHtml
            ? "HTML5 boilerplate + WebView hardening (relative paths, viewport, no target=_blank)"
            : "Added missing HTML5 boilerplate",
      });
    }
  }

  // For plain-HTML projects, harden every other .html page too so multi-page
  // sites work inside the WebView (no absolute paths, no target=_blank).
  if (index.isStaticHtml) {
    for (const f of flat) {
      if (f.isBinary || !f.content) continue;
      if (!/\.html?$/.test(f.path)) continue;
      if (f.path === index.entryHtml) continue;
      const next = hardenPlainHtmlForWebview(f.content);
      if (next !== f.content) {
        patches.push({ path: f.path, content: next, reason: "WebView hardening (relative paths, viewport, no target=_blank)" });
      }
    }
  }


  if (index.isStaticHtml) {
    const excludedTopLevel = new Set([
      "node_modules", "www", "dist", "build", "android", "ios", ".git",
      "package.json", "package-lock.json", "capacitor.config.ts",
      "capacitor.config.js", "capacitor.config.json", STATIC_HTML_MARKER,
    ]);
    for (const f of flat) {
      if (!isInsideRoot(f.path, index.projectRoot) || f.isBinary) continue;
      const relative = relativeToRoot(f.path, index.projectRoot);
      const top = relative.split("/")[0];
      if (!relative || excludedTopLevel.has(top) || top.startsWith(".")) continue;
      const content = patches.find((p) => p.path === f.path)?.content ?? f.content;
      if (content === undefined) continue;
      patches.push({
        path: joinRoot(index.projectRoot, `www/${relative}`),
        content,
        reason: "Materialized static web output",
      });
    }
    const outputEntry = joinRoot(index.projectRoot, "www/index.html");
    const sourceEntry = index.entryHtml ? flat.find((f) => f.path === index.entryHtml) : null;
    if (!patches.some((p) => p.path === outputEntry) && sourceEntry?.content) {
      const content = patches.find((p) => p.path === index.entryHtml)?.content ?? sourceEntry.content;
      patches.push({ path: outputEntry, content, reason: "Materialized static entry point" });
    }
  }

  // Router rewrite for native shells
  if (nativeTarget && index.routerMode === "browser") {
    for (const f of flat) {
      if (!f.content || f.isBinary) continue;
      if (!/\.(tsx?|jsx?)$/.test(f.path)) continue;
      if (!/\bBrowserRouter\b/.test(f.content)) continue;
      const next = rewriteBrowserRouterToHash(f.content);
      if (next !== f.content) patches.push({ path: f.path, content: next, reason: "BrowserRouter → HashRouter for native shell" });
    }
  }

  // Vite base:'./' for capacitor
  if (opts.engine === "capacitor" && (index.shape === "vite-spa" || index.shape === "vue" || (index.shape === "capacitor" && index.dependencies.vite))) {
    const viteCfg = flat.find((f) => /(^|\/)vite\.config\.(js|ts|mjs|mts)$/.test(f.path) && !f.isBinary);
    if (viteCfg?.content) {
      const next = patchViteBase(viteCfg.content);
      if (next) patches.push({ path: viteCfg.path, content: next, reason: "Vite base:'./' for Capacitor packaging" });
    }
  }

  // Capacitor config alignment
  if (opts.engine === "capacitor") {
    const capCfg = flat.find((f) => /(^|\/)capacitor\.config\.(ts|js|json)$/.test(f.path) && !f.isBinary);
    if (capCfg?.content) {
      const next = patchCapacitorConfig(capCfg.content, index.outputDir, opts.appId);
      if (next) patches.push({ path: capCfg.path, content: next, reason: `Capacitor webDir → ${index.outputDir}${opts.appId ? ` / appId → ${opts.appId}` : ""}` });
    } else if (!capCfg) {
      patches.push({
        path: joinRoot(index.projectRoot, "capacitor.config.json"),
        content: synthesizeCapacitorConfig(appName, index.outputDir, opts.appId),
        reason: "Missing Capacitor config — synthesized with correct webDir/appId",
      });
    }
  }


  if (index.isStaticHtml) {
    for (const outputPatch of patches.filter((p) => p.path.startsWith(joinRoot(index.projectRoot, "www/")))) {
      const relative = relativeToRoot(outputPatch.path, joinRoot(index.projectRoot, "www"));
      const sourcePatch = patches.find((p) => p.path === joinRoot(index.projectRoot, relative));
      if (sourcePatch) outputPatch.content = sourcePatch.content;
    }
  }

  for (const p of patches) logs.push(`Grounding patch: ${p.path} — ${p.reason}`);
  for (const w of index.warnings) logs.push(`Warning: ${w}`);
  if (index.hasLocalhostCalls) logs.push(`Localhost files: ${index.localhostFiles.join(", ")}`);
  return { index, patches, logs };
}

export function projectIndexToLogs(index: ProjectIndex): string[] {
  return [
    `Shape: ${index.shape}`,
    `Framework: ${index.framework}`,
    `Project root: ${index.projectRoot || "."}`,
    `Build: ${index.buildCommand}`,
    `Output: ${index.outputDir}`,
    `Router: ${index.routerMode}`,
    ...(index.hasLocalhostCalls ? [`⛔ Localhost calls in ${index.localhostFiles.length} file(s)`] : []),
    ...index.remediations.map((r) => `Grounding: ${r}`),
    ...index.warnings.map((w) => `⚠ ${w}`),
  ];
}

export { STATIC_COPY_SCRIPT };
