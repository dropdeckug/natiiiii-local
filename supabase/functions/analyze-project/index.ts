import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalyzeRequest {
  fileList: string[];
  packageJson?: Record<string, any>;
  framework?: string;
  engine: string; // webview | capacitor | ionic | twa | electron
  platform: string; // android | desktop
  url?: string;
  hasSourceFiles: boolean;
}

interface AnalysisResult {
  compatible: boolean;
  score: number; // 0-100
  checks: AnalysisCheck[];
  recommendations: string[];
  autoFixes: AutoFix[];
  buildStrategy: string;
  projectShape: ProjectShape;
}

export type ShapeKind =
  | "vite-spa" | "cra" | "next-static" | "next-ssr"
  | "nuxt" | "angular" | "svelte-kit" | "ionic"
  | "static-html" | "monorepo" | "url-only" | "unknown";

interface ProjectShape {
  shape: ShapeKind;
  expectedWebDir: "dist" | "build" | "www" | "out" | "." | null;
  entryHtml: string | null;
  routerMode: "hash" | "history" | "none";
  assetBaseHref: string | null;
  hasServiceWorker: boolean;
  isMonorepo: boolean;
  appPackagePath: string | null;
  warnings: string[];
}

interface AnalysisCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

interface AutoFix {
  id: string;
  description: string;
  type: "config" | "dependency" | "file";
}

function classifyShape(req: AnalyzeRequest): ProjectShape {
  const { fileList, packageJson, url, hasSourceFiles } = req;
  const has = (p: string) => fileList.some((f) => f === p || f.endsWith("/" + p));
  const anyEnds = (s: string) => fileList.some((f) => f.endsWith(s));
  const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies };

  const isMonorepo =
    has("pnpm-workspace.yaml") || has("turbo.json") ||
    !!(packageJson && Array.isArray((packageJson as any).workspaces));

  let shape: ShapeKind = "unknown";
  let expectedWebDir: ProjectShape["expectedWebDir"] = null;
  let entryHtml: string | null = null;

  if (url && !hasSourceFiles) {
    shape = "url-only";
  } else if (!has("package.json") && !packageJson) {
    if (fileList.some((f) => f.endsWith("index.html"))) {
      shape = "static-html";
      expectedWebDir = ".";
      entryHtml = fileList.find((f) => f.endsWith("index.html")) || "index.html";
    }
  } else if (deps?.next) {
    shape = anyEnds("next.config.js") || anyEnds("next.config.mjs") || anyEnds("next.config.ts")
      ? "next-static" // assume static; downstream check verifies output:'export'
      : "next-ssr";
    expectedWebDir = "out";
  } else if (deps?.["@angular/core"]) { shape = "angular"; expectedWebDir = "dist"; }
  else if (deps?.["@ionic/angular"] || deps?.["@ionic/react"] || deps?.["@ionic/vue"]) {
    shape = "ionic"; expectedWebDir = "www";
  } else if (deps?.["@sveltejs/kit"]) { shape = "svelte-kit"; expectedWebDir = "build"; }
  else if (deps?.nuxt) { shape = "nuxt"; expectedWebDir = ".output/public" as any; }
  else if (deps?.vite || anyEnds("vite.config.ts") || anyEnds("vite.config.js")) {
    shape = "vite-spa"; expectedWebDir = "dist";
  } else if (deps?.["react-scripts"]) { shape = "cra"; expectedWebDir = "build"; }
  else if (isMonorepo) { shape = "monorepo"; }

  // Router mode (best-effort, won't have source contents here)
  const routerMode: ProjectShape["routerMode"] =
    deps?.["react-router-dom"] || deps?.["@tanstack/react-router"] ? "history" : "none";

  const hasServiceWorker = anyEnds("service-worker.js") || anyEnds("sw.js") || fileList.some((f) => /workbox|service-?worker/i.test(f));

  const warnings: string[] = [];
  if (shape === "next-ssr") warnings.push("Next.js SSR detected — needs `output: 'export'` for native builds.");
  if (shape === "static-html") warnings.push("Static HTML project — package.json will be synthesized at build time.");
  if (isMonorepo) warnings.push("Monorepo detected — build will run in the first workspace containing a build script.");
  if (routerMode === "history") warnings.push("History-mode router detected — deep links should fall back to index.html.");

  return {
    shape,
    expectedWebDir,
    entryHtml,
    routerMode,
    assetBaseHref: null,
    hasServiceWorker,
    isMonorepo,
    appPackagePath: null,
    warnings,
  };
}



function analyzeProject(req: AnalyzeRequest): AnalysisResult {
  const checks: AnalysisCheck[] = [];
  const recommendations: string[] = [];
  const autoFixes: AutoFix[] = [];
  let score = 100;

  const { fileList, packageJson, engine, platform, url, hasSourceFiles } = req;

  // === Check 1: Package.json existence (static HTML is OK — we synthesize one at build) ===
  const hasPackageJson = fileList.some(f => f === "package.json" || f.endsWith("/package.json"));
  const hasIndexHtml = fileList.some(f => f === "index.html" || f.endsWith("/index.html"));
  if (hasSourceFiles && !hasPackageJson && !url) {
    if (hasIndexHtml) {
      checks.push({ id: "pkg-json", label: "package.json", status: "warn", detail: "Static HTML project — package.json will be auto-synthesized." });
      autoFixes.push({ id: "synthesize-pkg", description: "Generate minimal package.json for static HTML build", type: "file" });
    } else {
      checks.push({ id: "pkg-json", label: "package.json", status: "fail", detail: "No package.json and no index.html — nothing to build." });
      score -= 30;
    }
  } else if (hasPackageJson) {
    checks.push({ id: "pkg-json", label: "package.json", status: "pass", detail: "Found package.json" });
  }


  // === Check 2: Framework detection ===
  const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies };
  let detectedFramework = "unknown";
  if (deps?.react) detectedFramework = "react";
  else if (deps?.vue) detectedFramework = "vue";
  else if (deps?.["@angular/core"]) detectedFramework = "angular";
  else if (deps?.svelte) detectedFramework = "svelte";
  else if (deps?.next) detectedFramework = "nextjs";

  checks.push({
    id: "framework",
    label: "Framework detection",
    status: detectedFramework !== "unknown" ? "pass" : "warn",
    detail: detectedFramework !== "unknown" ? `Detected: ${detectedFramework}` : "Could not detect framework",
  });

  if (detectedFramework === "nextjs") {
    checks.push({ id: "nextjs-compat", label: "Next.js compatibility", status: "warn", detail: "Next.js requires static export (output: 'export') for native builds" });
    recommendations.push("Add 'output: \"export\"' to next.config.js for static site generation");
    autoFixes.push({ id: "nextjs-export", description: "Configure Next.js for static export", type: "config" });
    score -= 10;
  }

  // === Check 3: Build script ===
  if (packageJson?.scripts?.build) {
    checks.push({ id: "build-script", label: "Build script", status: "pass", detail: `Found: "${packageJson.scripts.build}"` });
  } else if (hasSourceFiles && hasPackageJson) {
    checks.push({ id: "build-script", label: "Build script", status: "fail", detail: "No 'build' script in package.json" });
    score -= 20;
    recommendations.push("Add a 'build' script to package.json (e.g., 'vite build' or 'react-scripts build')");
  }

  // === Check 4: Entry point ===
  const hasIndex = fileList.some(f =>
    f === "index.html" || f === "public/index.html" || f === "src/index.html" ||
    f === "src/main.tsx" || f === "src/main.ts" || f === "src/App.tsx" || f === "src/App.vue"
  );
  if (hasSourceFiles && !hasIndex && !url) {
    checks.push({ id: "entry-point", label: "Entry point", status: "warn", detail: "No standard entry point found" });
    score -= 5;
  } else {
    checks.push({ id: "entry-point", label: "Entry point", status: "pass", detail: "Entry point found" });
  }

  // === Check 5: Platform-specific checks ===
  if (platform === "android") {
    // Check for browser-only APIs in source
    if (engine === "capacitor" || engine === "ionic") {
      if (deps?.["@capacitor/core"]) {
        checks.push({ id: "cap-existing", label: "Existing Capacitor", status: "warn", detail: "Project already has Capacitor. Our build will reinitialize it." });
        recommendations.push("Existing Capacitor config will be replaced during build");
      }

      const nativePlugins = ["@capacitor/camera", "@capacitor/filesystem", "@capacitor/push-notifications", "@capacitor/geolocation"];
      const foundPlugins = nativePlugins.filter(p => deps?.[p]);
      if (foundPlugins.length > 0) {
        checks.push({ id: "native-plugins", label: "Native plugins", status: "pass", detail: `Found: ${foundPlugins.join(", ")}` });
      }
    }

    if (engine === "twa") {
      if (!url) {
        checks.push({ id: "twa-url", label: "TWA URL required", status: "fail", detail: "TWA requires a valid HTTPS URL to a PWA" });
        score -= 30;
      }
    }
  }

  if (platform === "desktop") {
    // Electron-specific checks
    if (deps?.electron) {
      checks.push({ id: "electron-existing", label: "Existing Electron", status: "warn", detail: "Project already has Electron. Config will be adjusted." });
    }

    // Check for native Node.js modules that might cause issues
    const problematicDeps = ["sharp", "canvas", "sqlite3", "better-sqlite3", "bcrypt"].filter(d => deps?.[d]);
    if (problematicDeps.length > 0) {
      checks.push({ id: "native-modules", label: "Native Node modules", status: "warn", detail: `Found native modules that may need rebuilding: ${problematicDeps.join(", ")}` });
      recommendations.push("Native Node modules may need electron-rebuild to work properly");
      score -= 5;
    }
  }

  // === Check 6: URL validation ===
  if (url) {
    const isHttps = url.startsWith("https://");
    checks.push({
      id: "url-https",
      label: "HTTPS URL",
      status: isHttps ? "pass" : "warn",
      detail: isHttps ? "URL uses HTTPS" : "URL does not use HTTPS. Some features may not work.",
    });
    if (!isHttps) score -= 5;
  }

  // === Check 7: Lock file detection ===
  const hasLockfile = fileList.some(f => 
    f.endsWith("package-lock.json") || f.endsWith("yarn.lock") || f.endsWith("pnpm-lock.yaml") || f.endsWith("bun.lockb")
  );
  if (hasSourceFiles && hasPackageJson) {
    const lockStatus = hasLockfile ? "pass" : "warn";
    checks.push({
      id: "lockfile",
      label: "Lock file",
      status: lockStatus,
      detail: hasLockfile ? "Lock file found for reproducible builds" : "No lock file. Using npm install with --legacy-peer-deps",
    });
  }

  // === Determine build strategy ===
  let buildStrategy: string;
  if (url && !hasSourceFiles) {
    buildStrategy = platform === "desktop" ? "url-to-electron" : "url-to-native";
  } else if (hasSourceFiles) {
    buildStrategy = platform === "desktop" ? "source-to-electron" : `source-to-${engine}`;
  } else {
    buildStrategy = "unknown";
    score -= 20;
  }

  const compatible = score >= 50;

  const projectShape = classifyShape(req);
  for (const w of projectShape.warnings) recommendations.push(w);
  return { compatible, score: Math.max(0, score), checks, recommendations, autoFixes, buildStrategy, projectShape };

}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: AnalyzeRequest = await req.json();
    const result = analyzeProject(body);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("analyze-project error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
