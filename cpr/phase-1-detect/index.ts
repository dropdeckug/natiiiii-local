import type {
  BuildToolId,
  CprFile,
  FrameworkId,
  MonorepoInfo,
  PackageManager,
  QuickScanResult,
  ServerSideFlag,
  TypeScriptScan,
} from "../types/index.ts";
import { PLATFORM_NODE_VERSION, resolveCprVersion } from "../versions/index.ts";
import { ensureTypescriptConfig, usesTypeScript } from "../phase-3-transform/tsconfig.ts";

/* --------------------------------------------------------- typescript row */

/** Non-destructive TypeScript readiness probe surfaced in the quick scan. */
export function scanTypeScript(files: CprFile[], root: string, framework: FrameworkId): TypeScriptScan {
  const pkg = readJson(files, join(root, "package.json")) ?? {};
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  const detected = usesTypeScript(files, pkg, root);
  if (!detected) {
    return {
      detected: false,
      tsconfigPresent: false,
      status: "none",
      indicator: "green",
      message: "JavaScript project — no TypeScript configuration needed.",
      issues: [],
    };
  }
  const tsconfigPresent = files.some((f) => f.path === `${prefix}tsconfig.json`);
  const probe = ensureTypescriptConfig(files, pkg, {
    root,
    react: framework === "react" || framework === "next" || framework === "preact" || framework === "remix",
    declaredPackages: { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) },
  });
  if (!tsconfigPresent) {
    return {
      detected: true,
      tsconfigPresent: false,
      status: "missing",
      indicator: "amber",
      message: "TypeScript configuration will be generated automatically during project creation.",
      issues: [],
    };
  }
  if (probe.fixed || probe.generated || probe.nodeConfigGenerated) {
    return {
      detected: true,
      tsconfigPresent: true,
      status: "issues",
      indicator: "amber",
      message: "TypeScript configuration issues found and will be corrected automatically during project creation.",
      issues: probe.issues,
    };
  }
  return {
    detected: true,
    tsconfigPresent: true,
    status: "valid",
    indicator: "green",
    message: "TypeScript configuration found and valid.",
    issues: [],
  };
}

/* ------------------------------------------------------------------ utils */

export function readJson(files: CprFile[], path: string): any | null {
  const f = files.find((x) => x.path === path);
  if (!f?.content) return null;
  try {
    return JSON.parse(f.content);
  } catch {
    return null;
  }
}

export function has(files: CprFile[], predicate: (p: string) => boolean): boolean {
  return files.some((f) => predicate(f.path));
}

function join(root: string, rel: string): string {
  return root ? `${root.replace(/\/$/, "")}/${rel}` : rel;
}

const SOURCE_EXT = /\.(m?[jt]sx?|vue|svelte|astro)$/i;

export function sourceFiles(files: CprFile[], root = ""): CprFile[] {
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  return files.filter(
    (f) =>
      !f.isBinary &&
      f.content !== undefined &&
      f.path.startsWith(prefix) &&
      SOURCE_EXT.test(f.path) &&
      !f.path.includes("node_modules/") &&
      !/\/(dist|build|out|www)\//.test(f.path),
  );
}

/* ------------------------------------------------------- package manager */

export function detectPackageManager(
  files: CprFile[],
  root = "",
): { packageManager: PackageManager; evidence: string } {
  const order: [string, PackageManager][] = [
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"],
  ];
  for (const [lock, pm] of order) {
    if (has(files, (p) => p === join(root, lock) || p === lock)) {
      return { packageManager: pm, evidence: `${lock} present` };
    }
  }
  const pkg = readJson(files, join(root, "package.json"));
  const declared: string | undefined = pkg?.packageManager;
  if (declared) {
    const name = declared.split("@")[0] as PackageManager;
    if (["npm", "yarn", "pnpm", "bun"].includes(name)) {
      return { packageManager: name, evidence: `package.json → packageManager: ${declared}` };
    }
  }
  return { packageManager: "npm", evidence: "no lock file found — defaulting to npm" };
}

/* ------------------------------------------------------------- framework */

const FRAMEWORK_LABELS: Record<FrameworkId, string> = {
  react: "React",
  vue: "Vue",
  svelte: "Svelte",
  solid: "Solid",
  angular: "Angular",
  next: "Next.js",
  nuxt: "Nuxt",
  astro: "Astro",
  sveltekit: "SvelteKit",
  remix: "Remix",
  preact: "Preact",
  "plain-html": "Plain HTML",
  unknown: "Unknown",
};

export function detectFramework(files: CprFile[], root = ""): FrameworkId {
  const pkg = readJson(files, join(root, "package.json"));
  const deps: Record<string, string> = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const d = (n: string) => Object.prototype.hasOwnProperty.call(deps, n);

  if (d("next")) return "next";
  if (d("nuxt") || d("nuxt3")) return "nuxt";
  if (d("astro")) return "astro";
  if (d("@sveltejs/kit")) return "sveltekit";
  if (d("@remix-run/react") || d("@remix-run/node")) return "remix";
  if (d("@angular/core")) return "angular";
  if (d("solid-js")) return "solid";
  if (d("svelte")) return "svelte";
  if (d("vue")) return "vue";
  if (d("react") && d("react-dom")) return "react";
  if (d("preact")) return "preact";

  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  if (has(files, (p) => p.startsWith(prefix) && /(^|\/)[^/]+\.html?$/i.test(p) && !p.includes("node_modules/"))) {
    return "plain-html";
  }
  return "unknown";
}

export function frameworkLabel(f: FrameworkId): string {
  return FRAMEWORK_LABELS[f];
}

/* ------------------------------------------------------------ build tool */

const BUILD_TOOL_LABELS: Record<BuildToolId, string> = {
  vite: "Vite",
  cra: "Create React App",
  "angular-cli": "Angular CLI",
  next: "Next.js",
  nuxt: "Nuxt",
  astro: "Astro",
  sveltekit: "SvelteKit",
  webpack: "Webpack",
  rollup: "Rollup",
  parcel: "Parcel",
  "static-html": "Static HTML",
  unknown: "Unknown",
};

export function detectBuildTool(files: CprFile[], framework: FrameworkId, root = ""): BuildToolId {
  const pkg = readJson(files, join(root, "package.json"));
  const deps: Record<string, string> = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const d = (n: string) => Object.prototype.hasOwnProperty.call(deps, n);
  const file = (name: RegExp) =>
    has(files, (p) => {
      const rel = root ? p.slice(root.length + 1) : p;
      return !p.includes("node_modules/") && p.startsWith(root) && name.test(rel);
    });

  if (file(/^vite\.config\.(m|c)?[jt]s$/) || d("vite")) return "vite";
  if (d("react-scripts")) return "cra";
  if (file(/^angular\.json$/)) return "angular-cli";
  if (file(/^nuxt\.config\.(m|c)?[jt]s$/)) return "nuxt";
  if (file(/^astro\.config\.(m|c)?[jt]s$/)) return "astro";
  if (file(/^svelte\.config\.(m|c)?[jt]s$/) && framework === "sveltekit") return "sveltekit";
  if (file(/^next\.config\.(m|c)?[jt]s$/) || framework === "next") return "next";
  if (file(/^webpack\.config\.(m|c)?[jt]s$/)) return "webpack";
  if (file(/^rollup\.config\.(m|c)?[jt]s$/)) return "rollup";
  if (d("parcel") || d("parcel-bundler")) return "parcel";
  if (framework === "plain-html") return "static-html";
  return "unknown";
}

export function buildToolLabel(b: BuildToolId): string {
  return BUILD_TOOL_LABELS[b];
}

export interface OutputResolution {
  outputDir: string;
  outputSource: string;
  buildCommand: string;
  /** Ordered probe list for the runner — first directory that exists wins. */
  outputCandidates: string[];
  outputConfidence: "high" | "medium" | "low";
}

const CLEAN = (p: string) => p.replace(/^\.\//, "").replace(/\/+$/, "");

function uniq(list: string[]): string[] {
  return [...new Set(list.filter(Boolean).map(CLEAN))];
}

/** Every Vite config variant a project may ship (base, mode-specific, prod). */
function viteConfigs(files: CprFile[], root: string): CprFile[] {
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  return files.filter((f) => {
    if (!f.content || f.path.includes("node_modules/")) return false;
    const rel = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : null;
    return rel !== null && /^vite\.config(\.[\w.-]+)?\.(m|c)?[jt]s$/.test(rel);
  });
}

/**
 * Output directory + provenance for a build tool.
 *
 * Configs are frequently dynamic (`outDir: process.env.OUT ?? 'build/public'`,
 * mode-specific config files, variables). We therefore return an ordered
 * candidate list plus a confidence rating rather than a single guess, so the
 * runner can probe rather than blindly wrap a folder that may not exist.
 */
export function resolveOutput(
  files: CprFile[],
  buildTool: BuildToolId,
  root = "",
): OutputResolution {
  const pkg = readJson(files, join(root, "package.json"));
  const scripts: Record<string, string> = pkg?.scripts ?? {};
  const scripted = scripts.build ? "build" : scripts["build:prod"] ? "build:prod" : null;
  const runBuild = scripted ? `run ${scripted}` : "run build";
  const buildScript = scripted ? scripts[scripted] ?? "" : "";

  // A CLI flag in the build script always beats a config file.
  const flag = buildScript.match(/--out-?dir[= ]+["']?([^\s"']+)/i)?.[1]
    ?? buildScript.match(/--output-path[= ]+["']?([^\s"']+)/i)?.[1];

  switch (buildTool) {
    case "vite": {
      const configs = viteConfigs(files, root);
      const literals: { value: string; from: string }[] = [];
      let dynamic = false;
      for (const cfg of configs) {
        const src = cfg.content ?? "";
        const literal = src.match(/outDir\s*:\s*["'`]([^"'`$]+)["'`]/);
        if (literal) literals.push({ value: literal[1], from: cfg.path });
        else if (/outDir\s*:/.test(src)) dynamic = true;
      }
      if (flag) {
        return {
          outputDir: CLEAN(flag),
          outputSource: "build script → --outDir flag",
          buildCommand: runBuild,
          outputCandidates: uniq([flag, ...literals.map((l) => l.value), "dist"]),
          outputConfidence: "high",
        };
      }
      if (literals.length) {
        const primary = literals[0];
        return {
          outputDir: CLEAN(primary.value),
          outputSource: `${primary.from} → build.outDir`,
          buildCommand: runBuild,
          outputCandidates: uniq([...literals.map((l) => l.value), "dist", "build"]),
          outputConfidence: literals.length > 1 ? "medium" : "high",
        };
      }
      return {
        outputDir: "dist",
        outputSource: dynamic
          ? "Vite outDir is computed at runtime — runner probes candidates"
          : "Vite default (dist)",
        buildCommand: runBuild,
        outputCandidates: uniq(["dist", "build", "build/public", "public/build", "www"]),
        outputConfidence: dynamic ? "low" : "high",
      };
    }
    case "cra":
      return {
        outputDir: flag ? CLEAN(flag) : "build",
        outputSource: flag ? "build script flag" : "Create React App default",
        buildCommand: runBuild,
        outputCandidates: uniq([flag ?? "", "build", "dist"]),
        outputConfidence: "high",
      };
    case "angular-cli": {
      const ng = readJson(files, join(root, "angular.json"));
      const projects: Record<string, any> = ng?.projects ?? {};
      const defaultProject: string | undefined = ng?.defaultProject;
      const entries = Object.entries(projects);
      const chosen =
        (defaultProject && projects[defaultProject] ? [defaultProject, projects[defaultProject]] : null) ??
        entries.find(([, p]) => p?.projectType !== "library") ??
        entries[0];
      const proj: any = chosen?.[1];
      const target = proj?.architect?.build ?? proj?.targets?.build;
      const outputPath = target?.options?.outputPath;
      const builder: string = target?.builder ?? "";
      // Angular 17+ `@angular-devkit/build-angular:application` nests browser
      // assets in <outputPath>/browser; the legacy browser builder does not.
      const nested = /:application|browser-esbuild/.test(builder);
      const base = CLEAN(
        typeof outputPath === "string"
          ? outputPath
          : outputPath?.base ?? `dist/${chosen?.[0] ?? "app"}`,
      );
      const explicitBrowser = typeof outputPath === "object" && outputPath?.browser;
      const primary = explicitBrowser
        ? CLEAN(`${base}/${outputPath.browser}`)
        : nested
          ? `${base}/browser`
          : base;
      return {
        outputDir: flag ? CLEAN(flag) : primary,
        outputSource: `angular.json → ${chosen?.[0] ?? "project"}.outputPath${nested ? " + /browser (application builder)" : ""}`,
        buildCommand: runBuild,
        outputCandidates: uniq([flag ?? "", primary, `${base}/browser`, base, "dist"]),
        outputConfidence: outputPath ? "high" : "medium",
      };
    }
    case "nuxt":
      return {
        outputDir: ".output/public",
        outputSource: "Nuxt static generate output",
        buildCommand: scripts.generate ? "run generate" : runBuild,
        outputCandidates: uniq([".output/public", "dist", ".nuxt/dist/client"]),
        outputConfidence: "medium",
      };
    case "astro": {
      const cfg = files.find((f) => f.path.startsWith(root) && /astro\.config\.(m|c)?[jt]s$/.test(f.path));
      const m = cfg?.content?.match(/outDir\s*:\s*["'`]([^"'`$]+)["'`]/);
      return {
        outputDir: m ? CLEAN(m[1]) : "dist",
        outputSource: m ? "astro.config → outDir" : "Astro default (dist)",
        buildCommand: runBuild,
        outputCandidates: uniq([m?.[1] ?? "", "dist"]),
        outputConfidence: "high",
      };
    }
    case "sveltekit": {
      const cfg = files.find((f) => f.path.startsWith(root) && /svelte\.config\.(m|c)?[jt]s$/.test(f.path));
      const m = cfg?.content?.match(/pages\s*:\s*["'`]([^"'`$]+)["'`]/);
      return {
        outputDir: m ? CLEAN(m[1]) : "build",
        outputSource: m ? "svelte.config → adapter-static pages" : "adapter-static default (build)",
        buildCommand: runBuild,
        outputCandidates: uniq([m?.[1] ?? "", "build", ".svelte-kit/output/client"]),
        outputConfidence: m ? "high" : "medium",
      };
    }
    case "next": {
      const cfg = files.find((f) => f.path.startsWith(root) && /next\.config\.(m|c)?[jt]s$/.test(f.path));
      const m = cfg?.content?.match(/distDir\s*:\s*["'`]([^"'`$]+)["'`]/);
      return {
        outputDir: "out",
        outputSource: "next export output (out)",
        buildCommand: runBuild,
        outputCandidates: uniq(["out", m?.[1] ?? "", "dist"]),
        outputConfidence: "medium",
      };
    }
    case "webpack":
    case "rollup":
    case "parcel": {
      const cfg = files.find(
        (f) => f.path.startsWith(root) && /(webpack|rollup)\.config\.(m|c)?[jt]s$/.test(f.path),
      );
      const m = cfg?.content?.match(/(?:path|dir|file)\s*:\s*[^,\n]*["'`]([^"'`$]+)["'`]/);
      const guess = m ? CLEAN(m[1].replace(/^dist\/.*\.js$/, "dist")) : "dist";
      return {
        outputDir: flag ? CLEAN(flag) : guess,
        outputSource: m ? `${cfg?.path} → output path` : `${BUILD_TOOL_LABELS[buildTool]} default (dist)`,
        buildCommand: runBuild,
        outputCandidates: uniq([flag ?? "", guess, "dist", "build", "public"]),
        outputConfidence: m ? "medium" : "low",
      };
    }
    case "static-html":
      return {
        outputDir: "www",
        outputSource: "CPR static materialization (www)",
        buildCommand: runBuild,
        outputCandidates: uniq(["www", "dist", "public", "."]),
        outputConfidence: "high",
      };
    default:
      return {
        outputDir: flag ? CLEAN(flag) : "dist",
        outputSource: flag ? "build script flag" : "fallback default (dist)",
        buildCommand: runBuild,
        outputCandidates: uniq([flag ?? "", "dist", "build", "out", "public", "www"]),
        outputConfidence: "low",
      };
  }
}


/* ---------------------------------------------------------------- node */

export function detectNodeVersion(files: CprFile[], root = ""): string | null {
  const pkg = readJson(files, join(root, "package.json"));
  if (pkg?.engines?.node) return String(pkg.engines.node);
  for (const name of [".nvmrc", ".node-version"]) {
    const f = files.find((x) => x.path === join(root, name) || x.path === name);
    if (f?.content) return f.content.trim().replace(/^v/, "");
  }
  return null;
}

/* ------------------------------------------------------------- monorepo */

/**
 * Frontend-vs-backend package classification.
 *
 * Many real repositories are full-stack: an Express / Nest / Fastify API in
 * `server/` (or at the repo root) next to the actual web app in `client/`,
 * `frontend/`, `web/` or `apps/web`. Everything CPR does — dependency install,
 * normalization, build, `npx cap sync`, webDir resolution — must happen inside
 * the FRONTEND package. Picking the backend (or the repo root that only holds
 * the API) is what makes installs land in the wrong place and configs such as
 * `vite.config.ts` fail to load. So the app root is resolved by scoring every
 * package.json for frontend evidence and explicitly penalising server-only
 * packages, instead of taking the shallowest package.json.
 */
const FRONTEND_DEP_HINTS = [
  "@capacitor/core", "react", "react-dom", "vue", "svelte", "solid-js", "preact",
  "@angular/core", "next", "nuxt", "astro", "vite", "react-scripts", "@ionic/react",
  "@ionic/vue", "@ionic/angular", "electron", "parcel", "@sveltejs/kit",
];

/** Packages that only ever run on a server — never a mobile app root. */
const BACKEND_DEP_HINTS = [
  "express", "fastify", "koa", "hapi", "@hapi/hapi", "@nestjs/core", "apollo-server",
  "apollo-server-express", "body-parser", "cors", "morgan", "mongoose", "sequelize",
  "typeorm", "socket.io", "nodemon", "ts-node-dev", "pg", "mysql2", "jsonwebtoken",
  "bcrypt", "bcryptjs", "multer", "passport",
];

const FRONTEND_DIR_RE = /(^|\/)(client|frontend|front-end|web|webapp|www|ui|app|apps\/web|apps\/app|packages\/web|packages\/app|site)$/i;
export const BACKEND_DIR_RE = /(^|\/)(server|backend|back-end|api|functions|service|services|worker|lambda)$/i;

const FRONTEND_BUILD_RE = /\b(vite|react-scripts|ng build|next build|nuxt|astro|svelte-kit|parcel|webpack|rollup)\b/;
const BACKEND_START_RE = /\b(nodemon|ts-node|node\s+(server|index|app)|nest start)\b/;

/**
 * Directories that can contain a `package.json` which is never the app root:
 * build output, native shells, vendored copies, fixtures and examples. Without
 * this filter a `dist/package.json` or `android/…/package.json` can outscore
 * the real frontend and every later phase then operates on the wrong folder.
 */
const NON_ROOT_DIR_RE =
  /(^|\/)(node_modules|dist|build|out|\.next|\.nuxt|\.output|\.svelte-kit|\.vercel|\.netlify|\.cache|\.turbo|\.yarn|coverage|android|ios|electron-out|release|vendor|third_party|tmp|temp|fixtures?|__fixtures__|examples?|samples?|templates?|__tests__|e2e|cypress|storybook-static)(\/|$)/i;

/** True when this package.json path lives somewhere that can never be an app root. */
export function isIgnorablePackagePath(path: string): boolean {
  return NON_ROOT_DIR_RE.test(path.slice(0, Math.max(0, path.length - "package.json".length)));
}


interface ScoredPackage {
  path: string;
  name: string | null;
  mobileScore: number;
  isFrontend: boolean;
  isBackend: boolean;
  reason: string;
}

function classifyPackage(files: CprFile[], dir: string, json: any): ScoredPackage {
  const deps: Record<string, string> = { ...(json?.dependencies ?? {}), ...(json?.devDependencies ?? {}) };
  const scripts: Record<string, string> = json?.scripts ?? {};
  const buildScript = String(scripts.build ?? "");
  const reasons: string[] = [];
  let score = 0;

  const frontendDeps = FRONTEND_DEP_HINTS.filter((h) => deps[h]);
  const backendDeps = BACKEND_DEP_HINTS.filter((h) => deps[h]);
  if (frontendDeps.length) {
    score += frontendDeps.length * 6;
    reasons.push(`frontend deps: ${frontendDeps.slice(0, 4).join(", ")}`);
  }
  if (FRONTEND_BUILD_RE.test(buildScript)) {
    score += 12;
    reasons.push(`build script runs a web bundler`);
  }
  if (backendDeps.length) {
    score -= backendDeps.length * 5;
    reasons.push(`server deps: ${backendDeps.slice(0, 4).join(", ")}`);
  }
  if (!frontendDeps.length && BACKEND_START_RE.test(String(scripts.start ?? scripts.dev ?? ""))) {
    score -= 10;
    reasons.push("start script boots a Node server");
  }

  const prefix = dir ? `${dir}/` : "";
  const hasLocalIndexHtml = has(files, (p) => p === `${prefix}index.html`);
  const hasAnyHtml = has(
    files,
    (p) => p.startsWith(prefix) && /\.html?$/i.test(p) && !p.includes("node_modules/"),
  );
  const hasWebConfig = has(
    files,
    (p) =>
      p.startsWith(prefix) &&
      /(^|\/)(vite|next|nuxt|astro|svelte|webpack|rollup|angular)\.config\.[cm]?[jt]s$/.test(p.slice(prefix.length)) ||
      p === `${prefix}angular.json`,
  );
  if (hasLocalIndexHtml) (score += 18), reasons.push("index.html in this package");
  else if (hasAnyHtml) (score += 6), reasons.push("HTML files in this package");
  if (hasWebConfig) (score += 10), reasons.push("web build config in this package");
  if (has(files, (p) => p.startsWith(`${prefix}src/`))) score += 2;

  // An existing Capacitor config is the strongest possible signal: this package
  // has already been shipped as a native app shell.
  const hasCapacitorConfig = has(
    files,
    (p) => p.startsWith(prefix) && /^capacitor\.config\.(json|ts|js)$/.test(p.slice(prefix.length)),
  );
  if (hasCapacitorConfig) (score += 20), reasons.push("capacitor.config in this package");

  // Nesting penalty — a shallower frontend beats an equally-scored deep one.
  const depth = dir ? dir.split("/").length : 0;
  score -= Math.min(depth, 4);

  if (FRONTEND_DIR_RE.test(dir)) (score += 8), reasons.push(`"${dir}" is a frontend directory`);
  if (BACKEND_DIR_RE.test(dir)) (score -= 14), reasons.push(`"${dir}" is a backend directory`);

  const frontendEvidence =
    frontendDeps.length > 0 || FRONTEND_BUILD_RE.test(buildScript) || hasLocalIndexHtml || hasWebConfig || hasCapacitorConfig;
  // Evidence alone is not enough: a server package that happens to bundle its
  // admin UI with webpack must not win. Require the score to stay positive.
  const isFrontend = frontendEvidence && score > 0;
  const isBackend = !isFrontend && (backendDeps.length > 0 || BACKEND_DIR_RE.test(dir));


  return {
    path: dir,
    name: json?.name ?? null,
    mobileScore: score,
    isFrontend,
    isBackend,
    reason: reasons.join("; ") || "no strong signal",
  };
}

export function detectMonorepo(files: CprFile[]): MonorepoInfo {
  const evidence: string[] = [];
  let tool: string | null = null;
  if (has(files, (p) => p === "pnpm-workspace.yaml")) (tool = "pnpm-workspaces"), evidence.push("pnpm-workspace.yaml");
  else if (has(files, (p) => p === "turbo.json")) (tool = "turborepo"), evidence.push("turbo.json");
  else if (has(files, (p) => p === "nx.json")) (tool = "nx"), evidence.push("nx.json");
  else if (has(files, (p) => p === "lerna.json")) (tool = "lerna"), evidence.push("lerna.json");
  else {
    const root = readJson(files, "package.json");
    if (root?.workspaces) (tool = "npm-workspaces"), evidence.push("package.json → workspaces");
  }

  const manifests = files.filter(
    (f) => /(^|\/)package\.json$/.test(f.path) && !isIgnorablePackagePath(f.path),
  );
  const skipped = files.filter(
    (f) => /(^|\/)package\.json$/.test(f.path) && isIgnorablePackagePath(f.path) && !f.path.includes("node_modules/"),
  );
  if (skipped.length) {
    evidence.push(
      `Ignored ${skipped.length} package.json file(s) inside build output, native shells or fixtures (${skipped
        .slice(0, 3)
        .map((f) => f.path)
        .join(", ")}${skipped.length > 3 ? ", …" : ""}).`,
    );
  }

  const packages: ScoredPackage[] = manifests
    .map((f) => {
      const dir = f.path.slice(0, Math.max(0, f.path.length - "package.json".length - 1)).replace(/\/$/, "");
      let json: any = null;
      try {
        json = f.content ? JSON.parse(f.content) : null;
      } catch {
        json = null;
      }
      return classifyPackage(files, dir, json);
    })
    .sort((a, b) => b.mobileScore - a.mobileScore || a.path.length - b.path.length);

  const isMonorepo = !!tool || packages.length > 1;

  // The frontend always wins — even when it is nested and the backend sits at
  // the repo root. Only if nothing looks like a frontend do we fall back.
  const frontend = packages.filter((p) => p.isFrontend);
  const chosen = frontend[0] ?? packages.find((p) => !p.isBackend) ?? packages[0] ?? null;
  let appRoot = chosen?.path ?? "";

  if (chosen) {
    evidence.push(
      `App root "${appRoot || "."}" selected as the frontend package (${chosen.reason}).`,
    );
    const runnerUp = frontend[1];
    if (runnerUp && chosen.mobileScore - runnerUp.mobileScore <= 4) {
      evidence.push(
        `Close call: "${runnerUp.path || "."}" scored ${runnerUp.mobileScore} vs ${chosen.mobileScore} — the shallower package with stronger web evidence was kept.`,
      );
    }
    const ignored = packages.filter((p) => p !== chosen && p.isBackend);
    if (ignored.length) {
      evidence.push(
        `Ignoring server package(s): ${ignored.map((p) => p.path || ".").join(", ")} — installs, build and cap sync run only in the frontend.`,
      );
    }
  }

  // Plain HTML, or a manifest-only repo where no package looked like a web app:
  // the shallowest real index.html decides the root.
  if (!packages.length || (!frontend.length && chosen && chosen.mobileScore <= 0)) {
    const html = files
      .filter(
        (f) =>
          /(^|\/)index\.html?$/i.test(f.path) &&
          !isIgnorablePackagePath(f.path.replace(/index\.html?$/i, "package.json")),
      )
      .sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
    if (html) {
      appRoot = html.path.split("/").slice(0, -1).join("/");
      evidence.push(`No web package detected — app root resolved from "${html.path}".`);
    }
  }


  return { isMonorepo, tool, appRoot, packages, evidence };
}


/* --------------------------------------------------------- server flags */

export function detectServerSide(
  files: CprFile[],
  framework: FrameworkId,
  root = "",
): ServerSideFlag[] {
  const flags: ServerSideFlag[] = [];
  const cfgOf = (re: RegExp) => files.find((f) => f.path.startsWith(root) && re.test(f.path));

  if (framework === "next") {
    const cfg = cfgOf(/next\.config\.(m|c)?[jt]s$/);
    if (!cfg?.content || !/output\s*:\s*["'`]export["'`]/.test(cfg.content)) {
      flags.push({
        reason: "Next.js is configured for a server runtime.",
        remedy: "Add `output: 'export'` to next.config and remove server-only features (API routes, middleware, ISR).",
        file: cfg?.path,
      });
    }
  }
  if (framework === "remix") {
    flags.push({
      reason: "Remix requires a server for loaders and actions.",
      remedy: "Migrate to a static framework, or pre-render the app and upload the static export instead.",
    });
  }
  if (framework === "sveltekit") {
    const cfg = cfgOf(/svelte\.config\.(m|c)?[jt]s$/);
    if (!cfg?.content || !/adapter-static/.test(cfg.content)) {
      flags.push({
        reason: "SvelteKit is not using adapter-static.",
        remedy: "Install @sveltejs/adapter-static and set it in svelte.config, with prerender enabled.",
        file: cfg?.path,
      });
    }
  }
  if (framework === "nuxt") {
    const cfg = cfgOf(/nuxt\.config\.(m|c)?[jt]s$/);
    if (!cfg?.content || !/ssr\s*:\s*false/.test(cfg.content)) {
      flags.push({
        reason: "Nuxt is running in SSR mode.",
        remedy: "Set `ssr: false` in nuxt.config and build with `nuxt generate`.",
        file: cfg?.path,
      });
    }
  }

  const serverFile = files.find((f) => /\.(php|asp|aspx|jsp|erb|cshtml)$/i.test(f.path));
  if (serverFile) {
    flags.push({
      reason: `Server template files found (${serverFile.path}).`,
      remedy: "Native apps cannot execute server templates. Upload the rendered static output instead.",
      file: serverFile.path,
    });
  }
  return flags;
}

/* -------------------------------------------------------------- estimate */

function estimateSeconds(buildTool: BuildToolId, fileCount: number, hasConflicts: boolean): number {
  let base = 60;
  if (buildTool === "static-html") base = 110;
  if (buildTool === "cra") base = 130;
  if (hasConflicts) base += 60;
  if (fileCount > 1500) base += 90;
  return base;
}

/* -------------------------------------------------------------- entry */

export function quickScan(files: CprFile[]): QuickScanResult {
  const monorepo = detectMonorepo(files);
  const root = monorepo.appRoot;

  const { packageManager, evidence } = detectPackageManager(files, root);
  const framework = detectFramework(files, root);
  const buildTool = detectBuildTool(files, framework, root);
  const { outputDir, outputSource, buildCommand, outputCandidates, outputConfidence } =
    resolveOutput(files, buildTool, root);

  const nodeVersionRequested = detectNodeVersion(files, root);
  const serverSideFlags = detectServerSide(files, framework, root);
  const verdict = resolveCprVersion(framework, buildTool);
  const typescript = scanTypeScript(files, root, framework);

  const notes: string[] = [];
  let nodeVersionNote: string | null = null;
  if (nodeVersionRequested) {
    const major = parseInt(nodeVersionRequested.replace(/[^\d]*(\d+).*/, "$1"), 10);
    if (!Number.isNaN(major) && major > Number(PLATFORM_NODE_VERSION)) {
      nodeVersionNote = `Project requests Node ${nodeVersionRequested}; the platform builds on Node ${PLATFORM_NODE_VERSION}. CPR will pin engines to the platform version.`;
    }
  }
  if (monorepo.isMonorepo) {
    notes.push(
      `Monorepo detected (${monorepo.tool ?? "multiple packages"}). App root resolved to "${root || "."}".`,
    );
  }
  const backendPackages = monorepo.packages.filter((p) => p.isBackend);
  if (backendPackages.length) {
    notes.push(
      `Server/backend package(s) detected (${backendPackages.map((p) => p.path || ".").join(", ")}). Dependency install, normalization, build and cap sync all run inside the frontend at "${root || "."}" — the backend is ignored.`,
    );
  }

  if (outputConfidence !== "high") {
    notes.push(
      `Output directory "${outputDir}" is ${outputConfidence}-confidence (${outputSource}). The build runner will probe: ${outputCandidates.join(", ")}.`,
    );
  }



  return {
    cprVersion: verdict.cprVersion,
    compatibility: verdict.compatibility,
    compatibilityMessage: verdict.message,
    estimatedAvailability: verdict.estimatedAvailability,
    packageManager,
    packageManagerEvidence: evidence,
    framework,
    frameworkLabel: frameworkLabel(framework),
    buildTool,
    buildToolLabel: buildToolLabel(buildTool),
    buildCommand,
    outputDir,
    outputSource,
    outputCandidates,
    outputConfidence,

    nodeVersionRequested,
    nodeVersionPlatform: PLATFORM_NODE_VERSION,
    nodeVersionNote,
    monorepo,
    serverSideFlags,
    typescript,
    fixRequired: verdict.compatibility !== "supported" || serverSideFlags.length > 0,
    estimatedSeconds: estimateSeconds(buildTool, files.length, false),
    notes,
    scannedAt: new Date().toISOString(),
  };
}
