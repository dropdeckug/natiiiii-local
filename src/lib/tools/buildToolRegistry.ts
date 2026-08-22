/**
 * BUILD TOOL REGISTRY
 *
 * Single source of truth for "which build tool is this project, how is it
 * invoked, where does it emit its web bundle, and can it emit a *static*
 * bundle at all".
 *
 * Nothing here is hardcoded per-project: every resolver reads the user's own
 * config files (angular.json, vite.config.*, next.config.*, svelte.config.*,
 * webpack.config.*, quasar.conf.*, package.json scripts, …) and falls back to
 * the documented default of that tool only when the config is silent.
 *
 * The same file is mirrored to supabase/functions/_shared/buildToolRegistry.ts
 * so the edge runtime, the workflow generator and the UI all agree.
 */

export type StaticSupport = "static" | "conditional" | "server-only";

export interface BuildToolFile {
  path: string;
  content?: string;
  type?: "file" | "folder";
  isBinary?: boolean;
}

export interface BuildToolResolution {
  id: string;
  label: string;
  /** Command executed in CI, relative to the project root. */
  buildCommand: string;
  /** Web bundle directory relative to the project root (may be nested/deep). */
  outputDir: string;
  /** Human readable provenance of outputDir, e.g. "angular.json → outputPath". */
  outputSource: string;
  staticSupport: StaticSupport;
  /** false ⇒ project creation is refused. */
  staticCapable: boolean;
  /** Reasons the project cannot ship a static bundle. */
  blockers: string[];
  warnings: string[];
  evidence: string[];
  /** Node major/range the project asked for (engines / .nvmrc / volta). */
  nodeVersion: string | null;
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
}

export interface NormalizationReport {
  /** Files with cookie banners / install prompts / update toasts we can hide. */
  noiseComponents: { path: string; kind: string }[];
  /** Existing native config discovered in the source. */
  nativeConfig: { path: string; kind: "capacitor" | "cordova" | "electron" | "android" | "ios" }[];
  /** Version migrations applied to match the platform toolchain. */
  versionMigrations: { field: string; from: string; to: string }[];
  /** Absolute asset/base hrefs in index.html that must become relative. */
  absoluteAssetRefs: string[];
  notes: string[];
}

interface Ctx {
  paths: string[];
  read: (relativePath: string) => string | undefined;
  pkg: any;
  deps: Record<string, string>;
  scripts: Record<string, string>;
}

function isSpringProject(c: Ctx): boolean {
  const pom = c.read("pom.xml") ?? "";
  const gradle = c.read("build.gradle") ?? c.read("build.gradle.kts") ?? "";
  return /org\.springframework(?:\.boot)?|spring-boot/i.test(pom)
    || /org\.springframework\.boot|spring-boot/i.test(gradle)
    || c.paths.some((path) => /(^|\/)src\/main\/(java|kotlin)\//.test(path));
}

const clean = (dir?: string | null): string =>
  String(dir ?? "")
    .trim()
    .replace(/^['"`]|['"`]$/g, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

function firstExisting(ctx: Ctx, names: string[]): { path: string; content: string } | null {
  for (const n of names) {
    const content = ctx.read(n);
    if (content !== undefined) return { path: n, content: content ?? "" };
  }
  return null;
}

/** Reads `--out-dir x`, `--outDir x`, `--dist-dir x`, `-d x` from a script. */
function outDirFromScript(script?: string): string | null {
  if (!script) return null;
  const m =
    script.match(/--(?:out-dir|outDir|outdir|dist-dir|output-path|output_path)[= ]+([^\s"']+)/) ||
    script.match(/\s-d[= ]+([^\s"']+)/);
  return m ? clean(m[1]) : null;
}

function matchConfigValue(content: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(`['"\`]?${key}['"\`]?\\s*[:=]\\s*['"\`]([^'"\`]+)['"\`]`);
    const m = content.match(re);
    if (m) return clean(m[1]);
  }
  return null;
}

/** webpack: output: { path: path.resolve(__dirname, 'public/build') } */
function webpackOutputPath(content: string): string | null {
  const m =
    content.match(/path\s*:\s*(?:path\.(?:resolve|join)\s*\(\s*__dirname\s*,\s*)?['"`]([^'"`]+)['"`]/) ||
    content.match(/output\s*:\s*\{[^}]*?['"`]?path['"`]?\s*:\s*['"`]([^'"`]+)['"`]/s);
  return m ? clean(m[1]) : null;
}

// ── Angular: the deepest of them all ──────────────────────────────────────────
/**
 * Angular emits into `outputPath` which may be:
 *   - a string ("dist/my-app")
 *   - an object ({ base: "dist/my-app", browser: "" })
 * and, with the Angular 17+ `application` builder, the browser bundle lands in
 * `<outputPath>/browser`. `browser`/`browser-esbuild` builders do not nest.
 */
export function resolveAngularOutput(angularJson: string): {
  outputDir: string;
  source: string;
  ssr: boolean;
  project: string | null;
} {
  let parsed: any = null;
  try {
    parsed = JSON.parse(angularJson);
  } catch {
    return { outputDir: "dist", source: "angular.json (unparsable) → default", ssr: false, project: null };
  }
  const projects = parsed?.projects ?? {};
  const names = Object.keys(projects);
  const preferred =
    parsed?.defaultProject && projects[parsed.defaultProject]
      ? parsed.defaultProject
      : names.find((n) => projects[n]?.projectType !== "library") || names[0];
  const project = preferred ? projects[preferred] : null;
  const build = project?.architect?.build ?? project?.targets?.build;
  const builder: string = build?.builder ?? "";
  const options = build?.options ?? {};
  const prod = build?.configurations?.production ?? {};

  const raw = prod.outputPath ?? options.outputPath;
  let base = "";
  let browserSub: string | null = null;
  if (typeof raw === "string") base = clean(raw);
  else if (raw && typeof raw === "object") {
    base = clean(raw.base);
    if (typeof raw.browser === "string") browserSub = clean(raw.browser);
  }
  if (!base) base = preferred ? `dist/${preferred}` : "dist";

  const isApplicationBuilder = /:application$/.test(builder) || builder.includes("build-angular:application");
  let outputDir = base;
  if (browserSub !== null) outputDir = browserSub ? `${base}/${browserSub}` : base;
  else if (isApplicationBuilder) outputDir = `${base}/browser`;

  const ssr = Boolean(
    options.ssr || prod.ssr || options.server || prod.server || options.prerender === false && options.ssr,
  );
  return {
    outputDir,
    source: `angular.json → projects.${preferred}.architect.build.outputPath${
      browserSub !== null ? " (.browser)" : isApplicationBuilder ? " + /browser (application builder)" : ""
    }`,
    ssr,
    project: preferred ?? null,
  };
}

interface ToolDef {
  id: string;
  label: string;
  detect: (c: Ctx) => boolean;
  resolve: (c: Ctx) => {
    outputDir: string;
    outputSource: string;
    buildCommand?: string;
    staticSupport?: StaticSupport;
    blockers?: string[];
    warnings?: string[];
  };
  staticSupport: StaticSupport;
  defaultBuild?: string;
}

const hasCfg = (c: Ctx, base: string) =>
  ["js", "cjs", "mjs", "ts", "mts", "json"].some((ext) => c.read(`${base}.${ext}`) !== undefined);

/**
 * Ordered most-specific → least-specific. First match wins.
 */
const TOOLS: ToolDef[] = [
  // ── Server-only / SSR-first stacks: refused for native packaging ───────────
  {
    id: "spring-boot",
    label: "Spring Boot",
    staticSupport: "server-only",
    detect: isSpringProject,
    resolve: (c) => {
      const usesGradle = c.read("gradlew") !== undefined || c.read("build.gradle") !== undefined || c.read("build.gradle.kts") !== undefined;
      return {
        outputDir: "src/main/resources/static",
        outputSource: "Spring Boot static resources convention",
        buildCommand: usesGradle ? "./gradlew build" : "./mvnw package",
        blockers: [
          "This Spring project is backend-only and has no browser entry point. Add a static web app at src/main/resources/static/index.html or include a frontend subproject (Vite, Angular, React, etc.) for native packaging.",
        ],
      };
    },
  },
  {
    id: "remix",
    label: "Remix",
    staticSupport: "server-only",
    detect: (c) => !!(c.deps["@remix-run/dev"] || c.deps["@remix-run/node"] || c.deps["@remix-run/serve"]),
    resolve: () => ({
      outputDir: "build/client",
      outputSource: "Remix default",
      blockers: ["Remix is a server-rendered framework — it cannot emit a fully static bundle for native packaging."],
    }),
  },
  {
    id: "tanstack-start",
    label: "TanStack Start",
    staticSupport: "server-only",
    detect: (c) => !!(c.deps["@tanstack/start"] || c.deps["@tanstack/react-start"] || c.deps["@tanstack/solid-start"]),
    resolve: () => ({
      outputDir: ".output/public",
      outputSource: "TanStack Start (Nitro) default",
      blockers: [
        "TanStack Start is server-first (Nitro/Vinxi). Its output directory is a server bundle, not a static web root.",
      ],
    }),
  },
  {
    id: "solid-start",
    label: "SolidStart",
    staticSupport: "conditional",
    detect: (c) => !!c.deps["@solidjs/start"],
    resolve: (c) => {
      const cfg = firstExisting(c, ["app.config.ts", "app.config.js", "vite.config.ts"]);
      const isStatic = !!cfg && /preset\s*:\s*['"`]static['"`]/.test(cfg.content);
      return {
        outputDir: ".output/public",
        outputSource: cfg ? `${cfg.path} → nitro preset` : "SolidStart default",
        staticSupport: isStatic ? "static" : "server-only",
        blockers: isStatic ? [] : ["SolidStart needs `server: { preset: 'static' }` in app.config to prerender a static bundle."],
      };
    },
  },
  {
    id: "qwik-city",
    label: "Qwik City",
    staticSupport: "conditional",
    detect: (c) => !!(c.deps["@builder.io/qwik-city"] || c.deps["@qwik.dev/router"]),
    resolve: (c) => {
      const isStatic = c.paths.some((p) => /adapters\/static\//.test(p)) || !!c.scripts["build.static"] || /static/.test(c.scripts.build || "");
      return {
        outputDir: "dist",
        outputSource: "Qwik City static adapter output",
        staticSupport: isStatic ? "static" : "server-only",
        blockers: isStatic ? [] : ["Qwik City needs the static adapter (`npm run qwik add static`) to emit a static bundle."],
      };
    },
  },
  {
    id: "redwood",
    label: "RedwoodJS",
    staticSupport: "server-only",
    detect: (c) => !!(c.deps["@redwoodjs/core"] || c.read("redwood.toml") !== undefined),
    resolve: () => ({
      outputDir: "web/dist",
      outputSource: "RedwoodJS web side default",
      blockers: ["RedwoodJS ships an API server alongside the web side — not statically packageable as a single bundle."],
    }),
  },
  {
    id: "nestjs",
    label: "NestJS",
    staticSupport: "server-only",
    detect: (c) => !!c.deps["@nestjs/core"],
    resolve: () => ({
      outputDir: "dist",
      outputSource: "NestJS default",
      blockers: ["NestJS is a Node backend — there is no web bundle to package."],
    }),
  },
  {
    id: "express-server",
    label: "Node server",
    staticSupport: "server-only",
    detect: (c) =>
      !c.deps.vite && !c.deps.react && !c.deps.vue && !c.deps["@angular/core"] &&
      !!(c.deps.express || c.deps.fastify || c.deps.koa || c.deps.hapi),
    resolve: () => ({
      outputDir: "public",
      outputSource: "Node server default",
      blockers: ["This is a Node server project, not a static web app."],
    }),
  },

  // ── Meta-frameworks with a static mode ────────────────────────────────────
  {
    id: "next",
    label: "Next.js",
    staticSupport: "conditional",
    detect: (c) => !!c.deps.next,
    resolve: (c) => {
      const cfg = firstExisting(c, ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs"]);
      const content = cfg?.content ?? "";
      const exported = /output\s*:\s*['"`]export['"`]/.test(content) || /next export/.test(c.scripts.build || "");
      const distDir = matchConfigValue(content, ["distDir"]);
      const outDir = exported ? distDir || "out" : distDir || ".next";
      return {
        outputDir: outDir,
        outputSource: cfg
          ? `${cfg.path} → ${distDir ? "distDir" : exported ? "output:'export' default (out)" : "server build (.next)"}`
          : "Next.js default",
        staticSupport: exported ? "static" : "server-only",
        blockers: exported
          ? []
          : ["Next.js is running in server mode. Add `output: 'export'` to next.config to produce a static bundle."],
      };
    },
  },
  {
    id: "nuxt",
    label: "Nuxt",
    staticSupport: "conditional",
    detect: (c) => !!(c.deps.nuxt || c.deps.nuxt3 || c.deps["nuxt-edge"]),
    resolve: (c) => {
      const cfg = firstExisting(c, ["nuxt.config.ts", "nuxt.config.js", "nuxt.config.mjs"]);
      const content = cfg?.content ?? "";
      const prerendered =
        /ssr\s*:\s*false/.test(content) ||
        /preset\s*:\s*['"`](static|github-pages|cloudflare-pages-static)['"`]/.test(content) ||
        !!c.scripts.generate;
      return {
        outputDir: ".output/public",
        outputSource: cfg ? `${cfg.path} → nitro static output` : "Nuxt default (.output/public)",
        buildCommand: c.scripts.generate ? "npm run generate" : "npx nuxt generate",
        staticSupport: prerendered ? "static" : "server-only",
        blockers: prerendered
          ? []
          : ["Nuxt is in SSR mode. Set `ssr: false` (or add a `generate` script) so Nuxt prerenders a static bundle."],
      };
    },
  },
  {
    id: "sveltekit",
    label: "SvelteKit",
    staticSupport: "conditional",
    detect: (c) => !!c.deps["@sveltejs/kit"],
    resolve: (c) => {
      const cfg = firstExisting(c, ["svelte.config.js", "svelte.config.ts", "svelte.config.mjs"]);
      const content = cfg?.content ?? "";
      const isStatic = /adapter-static/.test(content) || !!c.deps["@sveltejs/adapter-static"];
      const pages = matchConfigValue(content, ["pages"]);
      return {
        outputDir: pages || "build",
        outputSource: cfg ? `${cfg.path} → adapter-static ${pages ? "pages" : "default (build)"}` : "SvelteKit default",
        staticSupport: isStatic ? "static" : "server-only",
        blockers: isStatic
          ? []
          : ["SvelteKit is using a server adapter. Switch to `@sveltejs/adapter-static` for a static bundle."],
      };
    },
  },
  {
    id: "astro",
    label: "Astro",
    staticSupport: "conditional",
    detect: (c) => !!c.deps.astro,
    resolve: (c) => {
      const cfg = firstExisting(c, ["astro.config.mjs", "astro.config.ts", "astro.config.js", "astro.config.cjs"]);
      const content = cfg?.content ?? "";
      const outDir = matchConfigValue(content, ["outDir"]);
      const serverMode = /output\s*:\s*['"`](server|hybrid)['"`]/.test(content) && /adapter\s*:/.test(content);
      return {
        outputDir: outDir || "dist",
        outputSource: cfg ? `${cfg.path} → ${outDir ? "outDir" : "default (dist)"}` : "Astro default (dist)",
        staticSupport: serverMode ? "server-only" : "static",
        blockers: serverMode ? ["Astro is configured with a server adapter. Use `output: 'static'` for native packaging."] : [],
      };
    },
  },

  // ── Angular family ────────────────────────────────────────────────────────
  {
    id: "angular-cli",
    label: "Angular CLI",
    staticSupport: "conditional",
    detect: (c) => !!c.deps["@angular/core"] || c.read("angular.json") !== undefined,
    resolve: (c) => {
      const angularJson = c.read("angular.json") ?? c.read(".angular.json");
      if (!angularJson) {
        return { outputDir: "dist", outputSource: "Angular default (angular.json missing)", warnings: ["angular.json not found — using dist/"] };
      }
      const a = resolveAngularOutput(angularJson);
      const ssrDeps = !!(c.deps["@angular/ssr"] || c.deps["@nguniversal/express-engine"]);
      return {
        outputDir: a.outputDir,
        outputSource: a.source,
        staticSupport: "static",
        warnings: ssrDeps
          ? [`Angular SSR packages detected — only the browser bundle (${a.outputDir}) is packaged.`]
          : [],
      };
    },
  },
  {
    id: "ionic-angular",
    label: "Ionic (Angular)",
    staticSupport: "static",
    detect: (c) => !!c.deps["@ionic/angular"],
    resolve: (c) => {
      const angularJson = c.read("angular.json");
      if (angularJson) {
        const a = resolveAngularOutput(angularJson);
        return { outputDir: a.outputDir, outputSource: `Ionic Angular · ${a.source}` };
      }
      return { outputDir: "www", outputSource: "Ionic default (www)" };
    },
  },
  {
    id: "ionic",
    label: "Ionic",
    staticSupport: "static",
    detect: (c) => !!(c.deps["@ionic/react"] || c.deps["@ionic/vue"] || c.read("ionic.config.json") !== undefined),
    resolve: (c) => {
      const vite = firstExisting(c, ["vite.config.ts", "vite.config.js", "vite.config.mjs"]);
      const outDir = vite ? matchConfigValue(vite.content, ["outDir"]) : null;
      return { outputDir: outDir || "dist", outputSource: vite ? `${vite.path} → outDir` : "Ionic + Vite default (dist)" };
    },
  },

  // ── Static site generators ────────────────────────────────────────────────
  { id: "gatsby", label: "Gatsby", staticSupport: "static", detect: (c) => !!c.deps.gatsby, resolve: () => ({ outputDir: "public", outputSource: "Gatsby default (public)" }) },
  { id: "docusaurus", label: "Docusaurus", staticSupport: "static", detect: (c) => !!c.deps["@docusaurus/core"], resolve: () => ({ outputDir: "build", outputSource: "Docusaurus default (build)" }) },
  {
    id: "vitepress",
    label: "VitePress",
    staticSupport: "static",
    detect: (c) => !!c.deps.vitepress,
    resolve: (c) => {
      const dir = c.paths.find((p) => p.endsWith(".vitepress/config.ts") || p.endsWith(".vitepress/config.js") || p.endsWith(".vitepress/config.mts"));
      const base = dir ? dir.replace(/\.vitepress\/config\.[a-z]+$/, ".vitepress/dist") : ".vitepress/dist";
      return { outputDir: clean(base), outputSource: "VitePress (<docs>/.vitepress/dist)" };
    },
  },
  { id: "vuepress", label: "VuePress", staticSupport: "static", detect: (c) => !!(c.deps.vuepress || c.deps["@vuepress/cli"]), resolve: () => ({ outputDir: "docs/.vuepress/dist", outputSource: "VuePress default" }) },
  {
    id: "eleventy",
    label: "Eleventy",
    staticSupport: "static",
    detect: (c) => !!c.deps["@11ty/eleventy"],
    resolve: (c) => {
      const cfg = firstExisting(c, [".eleventy.js", "eleventy.config.js", "eleventy.config.mjs", "eleventy.config.cjs"]);
      const out = cfg ? matchConfigValue(cfg.content, ["output"]) : null;
      return { outputDir: out || outDirFromScript(c.scripts.build) || "_site", outputSource: cfg ? `${cfg.path} → dir.output` : "Eleventy default (_site)" };
    },
  },
  { id: "hugo", label: "Hugo", staticSupport: "static", detect: (c) => c.read("hugo.toml") !== undefined || c.read("config.toml") !== undefined && c.paths.some((p) => p.startsWith("content/")), resolve: () => ({ outputDir: "public", outputSource: "Hugo default (public)", buildCommand: "hugo --minify" }) },
  { id: "jekyll", label: "Jekyll", staticSupport: "static", detect: (c) => c.read("_config.yml") !== undefined, resolve: () => ({ outputDir: "_site", outputSource: "Jekyll default (_site)", buildCommand: "bundle exec jekyll build" }) },
  { id: "hexo", label: "Hexo", staticSupport: "static", detect: (c) => !!c.deps.hexo, resolve: () => ({ outputDir: "public", outputSource: "Hexo default (public)" }) },
  { id: "gridsome", label: "Gridsome", staticSupport: "static", detect: (c) => !!c.deps.gridsome, resolve: () => ({ outputDir: "dist", outputSource: "Gridsome default (dist)" }) },

  // ── App bundlers ──────────────────────────────────────────────────────────
  {
    id: "quasar",
    label: "Quasar CLI",
    staticSupport: "static",
    detect: (c) => !!(c.deps["@quasar/app-vite"] || c.deps["@quasar/app-webpack"] || c.read("quasar.config.js") !== undefined),
    resolve: (c) => {
      const cfg = firstExisting(c, ["quasar.config.js", "quasar.config.ts", "quasar.conf.js"]);
      const dist = cfg ? matchConfigValue(cfg.content, ["distDir"]) : null;
      return { outputDir: dist || "dist/spa", outputSource: cfg ? `${cfg.path} → build.distDir` : "Quasar SPA default (dist/spa)", buildCommand: "npx quasar build" };
    },
  },
  {
    id: "vue-cli",
    label: "Vue CLI",
    staticSupport: "static",
    detect: (c) => !!c.deps["@vue/cli-service"],
    resolve: (c) => {
      const cfg = firstExisting(c, ["vue.config.js", "vue.config.ts", "vue.config.mjs"]);
      const out = cfg ? matchConfigValue(cfg.content, ["outputDir"]) : null;
      return { outputDir: out || "dist", outputSource: cfg ? `${cfg.path} → outputDir` : "Vue CLI default (dist)" };
    },
  },
  {
    id: "cra",
    label: "Create React App",
    staticSupport: "static",
    detect: (c) => !!c.deps["react-scripts"],
    resolve: (c) => ({ outputDir: clean(c.pkg?.buildPath) || "build", outputSource: c.pkg?.buildPath ? "package.json → buildPath" : "react-scripts default (build)" }),
  },
  { id: "preact-cli", label: "Preact CLI", staticSupport: "static", detect: (c) => !!c.deps["preact-cli"], resolve: () => ({ outputDir: "build", outputSource: "Preact CLI default (build)" }) },
  { id: "expo-web", label: "Expo (web)", staticSupport: "conditional", detect: (c) => !!c.deps.expo, resolve: (c) => ({ outputDir: "dist", outputSource: "Expo web export (dist)", buildCommand: c.scripts.build ? "npm run build" : "npx expo export -p web", staticSupport: "static" }) },
  { id: "stencil", label: "Stencil", staticSupport: "static", detect: (c) => !!c.deps["@stencil/core"], resolve: () => ({ outputDir: "www", outputSource: "Stencil www output" }) },
  { id: "ember", label: "Ember CLI", staticSupport: "static", detect: (c) => !!c.deps["ember-cli"], resolve: () => ({ outputDir: "dist", outputSource: "Ember CLI default (dist)", buildCommand: "npx ember build --environment=production" }) },
  { id: "umi", label: "UmiJS", staticSupport: "static", detect: (c) => !!(c.deps.umi || c.deps["@umijs/max"]), resolve: () => ({ outputDir: "dist", outputSource: "Umi default (dist)" }) },
  {
    id: "rsbuild",
    label: "Rsbuild",
    staticSupport: "static",
    detect: (c) => !!c.deps["@rsbuild/core"] || hasCfg(c, "rsbuild.config"),
    resolve: (c) => {
      const cfg = firstExisting(c, ["rsbuild.config.ts", "rsbuild.config.js", "rsbuild.config.mjs"]);
      const dist = cfg ? matchConfigValue(cfg.content, ["root", "distPath"]) : null;
      return { outputDir: dist || "dist", outputSource: cfg ? `${cfg.path} → output.distPath.root` : "Rsbuild default (dist)" };
    },
  },
  {
    id: "rspack",
    label: "Rspack",
    staticSupport: "static",
    detect: (c) => !!c.deps["@rspack/cli"] || hasCfg(c, "rspack.config"),
    resolve: (c) => {
      const cfg = firstExisting(c, ["rspack.config.js", "rspack.config.ts", "rspack.config.mjs"]);
      const out = cfg ? webpackOutputPath(cfg.content) : null;
      return { outputDir: out || "dist", outputSource: cfg ? `${cfg.path} → output.path` : "Rspack default (dist)" };
    },
  },
  { id: "farm", label: "Farm", staticSupport: "static", detect: (c) => !!c.deps["@farmfe/core"], resolve: () => ({ outputDir: "dist", outputSource: "Farm default (dist)" }) },
  {
    id: "parcel",
    label: "Parcel",
    staticSupport: "static",
    detect: (c) => !!(c.deps["parcel"] || c.deps["parcel-bundler"]),
    resolve: (c) => {
      const fromScript = outDirFromScript(c.scripts.build);
      const targetDist = clean(c.pkg?.targets?.default?.distDir);
      return { outputDir: fromScript || targetDist || "dist", outputSource: fromScript ? "package.json build script → --dist-dir" : targetDist ? "package.json → targets.default.distDir" : "Parcel default (dist)" };
    },
  },
  {
    id: "webpack",
    label: "Webpack",
    staticSupport: "static",
    detect: (c) => !!c.deps.webpack || hasCfg(c, "webpack.config") || hasCfg(c, "webpack.prod.config"),
    resolve: (c) => {
      const cfg = firstExisting(c, [
        "webpack.config.prod.js", "webpack.prod.config.js", "webpack.config.js", "webpack.config.ts",
        "webpack.config.mjs", "webpack.config.babel.js", "config/webpack.prod.js",
      ]);
      const out = cfg ? webpackOutputPath(cfg.content) : null;
      return { outputDir: out || "dist", outputSource: cfg ? `${cfg.path} → output.path` : "Webpack default (dist)" };
    },
  },
  {
    id: "rollup",
    label: "Rollup",
    staticSupport: "static",
    detect: (c) => !!c.deps.rollup || hasCfg(c, "rollup.config"),
    resolve: (c) => {
      const cfg = firstExisting(c, ["rollup.config.js", "rollup.config.mjs", "rollup.config.ts"]);
      const dir = cfg ? matchConfigValue(cfg.content, ["dir"]) : null;
      return { outputDir: dir || outDirFromScript(c.scripts.build) || "dist", outputSource: cfg ? `${cfg.path} → output.dir` : "Rollup default (dist)" };
    },
  },
  {
    id: "esbuild",
    label: "esbuild",
    staticSupport: "static",
    detect: (c) => !!c.deps.esbuild,
    resolve: (c) => ({ outputDir: outDirFromScript(c.scripts.build) || "dist", outputSource: outDirFromScript(c.scripts.build) ? "package.json build script → --outdir" : "esbuild default (dist)" }),
  },
  { id: "snowpack", label: "Snowpack", staticSupport: "static", detect: (c) => !!c.deps.snowpack, resolve: () => ({ outputDir: "build", outputSource: "Snowpack default (build)" }) },
  { id: "brunch", label: "Brunch", staticSupport: "static", detect: (c) => !!c.deps.brunch, resolve: () => ({ outputDir: "public", outputSource: "Brunch default (public)" }) },
  {
    id: "gulp",
    label: "Gulp",
    staticSupport: "static",
    detect: (c) => !!c.deps.gulp,
    resolve: (c) => {
      const cfg = firstExisting(c, ["gulpfile.js", "gulpfile.mjs", "gulpfile.babel.js"]);
      const dest = cfg ? (cfg.content.match(/dest\(\s*['"`]([^'"`]+)['"`]/) || [])[1] : null;
      return { outputDir: clean(dest) || "dist", outputSource: cfg && dest ? `${cfg.path} → gulp.dest()` : "Gulp default (dist)" };
    },
  },
  { id: "grunt", label: "Grunt", staticSupport: "static", detect: (c) => !!c.deps.grunt, resolve: () => ({ outputDir: "dist", outputSource: "Grunt default (dist)" }) },

  // ── Vite last among bundlers: many tools above embed it ───────────────────
  {
    id: "vite",
    label: "Vite",
    staticSupport: "static",
    detect: (c) => !!c.deps.vite || hasCfg(c, "vite.config"),
    resolve: (c) => {
      const cfg = firstExisting(c, ["vite.config.ts", "vite.config.js", "vite.config.mjs", "vite.config.mts", "vite.config.cjs"]);
      const outDir = cfg ? matchConfigValue(cfg.content, ["outDir"]) : null;
      const fromScript = outDirFromScript(c.scripts.build);
      return {
        outputDir: outDir || fromScript || "dist",
        outputSource: outDir ? `${cfg!.path} → build.outDir` : fromScript ? "package.json build script → --outDir" : "Vite default (dist)",
      };
    },
  },
];

function buildCtx(files: BuildToolFile[], projectRoot: string): Ctx {
  const root = projectRoot ? `${projectRoot.replace(/\/+$/, "")}/` : "";
  const map = new Map<string, string | undefined>();
  const paths: string[] = [];
  for (const f of files) {
    if (f.type === "folder") continue;
    const p = f.path.replace(/^\.\//, "");
    if (root && !p.startsWith(root)) continue;
    const rel = root ? p.slice(root.length) : p;
    if (!rel || rel.startsWith("node_modules/")) continue;
    map.set(rel, f.isBinary ? undefined : f.content ?? "");
    paths.push(rel);
  }
  let pkg: any = null;
  try {
    pkg = JSON.parse(map.get("package.json") || "null");
  } catch {
    pkg = null;
  }
  return {
    paths,
    read: (p) => (map.has(p) ? map.get(p) ?? "" : undefined),
    pkg,
    deps: { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) },
    scripts: pkg?.scripts || {},
  };
}

function detectPackageManager(paths: string[]): BuildToolResolution["packageManager"] {
  if (paths.some((p) => p.endsWith("bun.lockb") || p.endsWith("bun.lock"))) return "bun";
  if (paths.some((p) => p.endsWith("pnpm-lock.yaml"))) return "pnpm";
  if (paths.some((p) => p.endsWith("yarn.lock"))) return "yarn";
  if (paths.some((p) => p.endsWith("package-lock.json"))) return "npm";
  return "unknown";
}

function detectNodeVersion(c: Ctx): string | null {
  const engines = c.pkg?.engines?.node;
  if (typeof engines === "string") return engines;
  const nvmrc = c.read(".nvmrc");
  if (nvmrc) return nvmrc.trim();
  const volta = c.pkg?.volta?.node;
  if (typeof volta === "string") return volta;
  return null;
}

/**
 * Resolves the build tool for a project rooted at `projectRoot`.
 * `isStaticHtml` short-circuits to the plain-HTML pipeline (copy → www).
 */
export function resolveBuildTool(
  files: BuildToolFile[],
  projectRoot = "",
  opts: { isStaticHtml?: boolean } = {},
): BuildToolResolution {
  const c = buildCtx(files, projectRoot);
  const packageManager = detectPackageManager(c.paths);
  const nodeVersion = detectNodeVersion(c);

  const hasBrowserIndex = c.paths.some((p) => /(^|\/)index\.html$/i.test(p)
    && !/(^|\/)src\/main\/resources\/templates\//.test(p));
  if (opts.isStaticHtml || (!c.pkg && hasBrowserIndex && !isSpringProject(c))) {
    return {
      id: "static-html",
      label: "Plain HTML",
      buildCommand: "npm run build",
      outputDir: "www",
      outputSource: "Plain HTML pipeline (assets copied to www)",
      staticSupport: "static",
      staticCapable: true,
      blockers: [],
      warnings: [],
      evidence: ["index.html without a build tool — a static copy step is synthesized"],
      nodeVersion,
      packageManager,
    };
  }

  const match = TOOLS.find((t) => {
    try {
      return t.detect(c);
    } catch {
      return false;
    }
  });

  if (!match) {
    // No recognised build tool, but the project ships HTML pages: it is a
    // static site (often with an unrelated backend package.json). Fall back to
    // the plain-HTML copy pipeline instead of blocking project creation.
    if (c.paths.some((p) => /\.html?$/i.test(p) && !/(^|\/)src\/main\/resources\/templates\//.test(p))) {
      return {
        id: "static-html",
        label: "Plain HTML",
        buildCommand: "npm run build",
        outputDir: "www",
        outputSource: "Plain HTML pipeline (assets copied to www)",
        staticSupport: "static",
        staticCapable: true,
        blockers: [],
        warnings: ["No build tool detected; treating the project as static HTML copied into www/."],
        evidence: ["HTML pages without a recognised build tool — a static copy step is synthesized"],
        nodeVersion,
        packageManager,
      };
    }
    return {
      id: "unknown",
      label: "Unknown build tool",
      buildCommand: c.scripts.build ? "npm run build" : "npm run build",
      outputDir: outDirFromScript(c.scripts.build) || "dist",
      outputSource: outDirFromScript(c.scripts.build) ? "package.json build script flag" : "unresolved — defaulted to dist",
      staticSupport: "conditional",
      staticCapable: false,
      blockers: [
        "No supported build tool was detected, so the web output directory cannot be resolved. Add a recognised build tool (Vite, Angular CLI, Webpack, Astro, …) before creating the project.",
      ],
      warnings: [],
      evidence: [],
      nodeVersion,
      packageManager,
    };
  }

  const r = match.resolve(c);
  const staticSupport = r.staticSupport ?? match.staticSupport;
  const blockers = r.blockers ?? [];
  const buildCommand =
    r.buildCommand ??
    (c.scripts.build
      ? "npm run build"
      : c.scripts["build:prod"]
        ? "npm run build:prod"
        : match.defaultBuild ?? "npm run build");

  return {
    id: match.id,
    label: match.label,
    buildCommand,
    outputDir: clean(r.outputDir) || "dist",
    outputSource: r.outputSource,
    staticSupport,
    staticCapable: staticSupport === "static" && blockers.length === 0,
    blockers,
    warnings: r.warnings ?? [],
    evidence: [
      `Detected ${match.label}`,
      `Build command: ${buildCommand}`,
      `Web output: ${clean(r.outputDir)} (${r.outputSource})`,
    ],
    nodeVersion,
    packageManager,
  };
}

// ── Normalization scanning ───────────────────────────────────────────────────

const NOISE_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "cookie-banner", re: /cookie\s*(consent|banner|notice|policy\s*bar)|CookieConsent|cookieyes|osano|onetrust|cookiebot/i },
  { kind: "install-prompt", re: /beforeinstallprompt|add\s*to\s*home\s*screen|InstallPrompt|PWAInstall|installPWA/i },
  { kind: "update-toast", re: /new\s*version\s*available|registerSW|updateServiceWorker|reload\s*to\s*update/i },
  { kind: "browser-notice", re: /download\s*our\s*app|open\s*in\s*app|smartbanner|apple-itunes-app/i },
  { kind: "newsletter-popup", re: /newsletter\s*(popup|modal)|exit\s*intent/i },
];

export function analyzeNormalization(files: BuildToolFile[], projectRoot = ""): NormalizationReport {
  const c = buildCtx(files, projectRoot);
  const report: NormalizationReport = {
    noiseComponents: [],
    nativeConfig: [],
    versionMigrations: [],
    absoluteAssetRefs: [],
    notes: [],
  };

  for (const p of c.paths) {
    const content = c.read(p);
    if (!content) continue;
    if (/\.(tsx?|jsx?|vue|svelte|html)$/i.test(p)) {
      for (const n of NOISE_PATTERNS) {
        if (n.re.test(content)) {
          report.noiseComponents.push({ path: p, kind: n.kind });
          break;
        }
      }
    }
    if (/(^|\/)capacitor\.config\.(ts|js|json)$/.test(p)) report.nativeConfig.push({ path: p, kind: "capacitor" });
    if (/(^|\/)config\.xml$/.test(p) && /widget/.test(content)) report.nativeConfig.push({ path: p, kind: "cordova" });
    if (/(^|\/)electron(-builder)?\.(json|yml|js)$/.test(p)) report.nativeConfig.push({ path: p, kind: "electron" });
    if (/^android\/app\/build\.gradle$/.test(p)) report.nativeConfig.push({ path: p, kind: "android" });
    if (/^ios\/App\/App\.xcodeproj/.test(p)) report.nativeConfig.push({ path: p, kind: "ios" });
  }

  // index.html absolute asset references break file:// / capacitor:// loading.
  for (const p of c.paths.filter((x) => /(^|\/)index\.html$/i.test(x))) {
    const html = c.read(p) || "";
    const refs = [...html.matchAll(/(?:src|href)\s*=\s*["'](\/[^"'>]*)["']/g)].map((m) => m[1]);
    const base = html.match(/<base[^>]+href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (base && base !== "./") report.absoluteAssetRefs.push(`${p} → <base href="${base}">`);
    for (const r of refs.slice(0, 20)) {
      if (r.startsWith("//")) continue;
      report.absoluteAssetRefs.push(`${p} → ${r}`);
    }
  }

  const node = detectNodeVersion(c);
  if (node && /^(?:>=?\s*)?(\d+)/.test(node)) {
    const major = Number(RegExp.$1);
    if (major < 18) report.versionMigrations.push({ field: "engines.node", from: node, to: "20.x" });
  }
  const capCore = c.deps["@capacitor/core"];
  if (capCore && /^[~^]?[0-5]\./.test(capCore)) report.versionMigrations.push({ field: "@capacitor/core", from: capCore, to: "^7.0.0" });

  if (report.noiseComponents.length)
    report.notes.push(`${report.noiseComponents.length} web-only UI surface(s) detected (cookie/install/update prompts) — hidden in the native shell.`);
  if (report.nativeConfig.length)
    report.notes.push(`Existing native config found: ${report.nativeConfig.map((n) => n.kind).join(", ")} — re-aligned to the platform toolchain.`);
  if (report.absoluteAssetRefs.length)
    report.notes.push("Absolute asset paths in index.html will be rewritten to relative paths.");

  return report;
}

export function buildToolToLogs(r: BuildToolResolution): string[] {
  const logs = [
    `Build tool: ${r.label} (${r.id})`,
    `Build command: ${r.buildCommand}`,
    `Web output dir: ${r.outputDir}  ← ${r.outputSource}`,
    `Static support: ${r.staticSupport}`,
  ];
  for (const b of r.blockers) logs.push(`✕ ${b}`);
  for (const w of r.warnings) logs.push(`⚠ ${w}`);
  return logs;
}
