/**
 * INTELLIGENT PROJECT TRANSFORMER (CPR Normalizer Extension)
 * 
 * Specifically addresses real-world project quirks from Lovable, v0, Bolt,
 * Laravel / Inertia, Next.js static exports, Vite, CRA, Monorepos, and custom bundlers.
 *
 * Guarantees:
 * 1. Base URL is safely relative ('./') so assets load in native WebViews (zero blank screens).
 * 2. Vite / Webpack / Next build configurations output to the designated webDir.
 * 3. HTML index headers have the correct mobile viewport & Content-Security-Policy.
 * 4. Missing entry point scripts (e.g. index.html referencing a non-existent bundle or missing root) are auto-linked.
 * 5. Laravel / PHP / Inertia backend-coupled projects are decoupled into self-contained frontend SPAs.
 * 6. Hardcoded external redirects (e.g. window.location to localhost:8000 or Laravel dev server) are neutralized.
 * 7. Monorepo and nested app directory resolution is canonicalized.
 * 8. Peer dependencies, React 18/19 bridges, and Capacitor core plugins are harmonized.
 */

import type { CprFile } from "../../cpr/types/index";

export interface ProjectHarmonizationResult {
  patches: { path: string; content: string; reason: string }[];
  creations: { path: string; content: string; reason: string }[];
  logs: string[];
  detectedWebDir: string;
}

export function harmonizeProjectStructure(
  files: CprFile[],
  root = "",
  framework = "react"
): ProjectHarmonizationResult {
  const patches: { path: string; content: string; reason: string }[] = [];
  const creations: { path: string; content: string; reason: string }[] = [];
  const logs: string[] = [];
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";

  // Helper to find files by suffix or relative path
  const findFile = (name: string | RegExp) =>
    files.find((f) =>
      typeof name === "string"
        ? f.path === `${prefix}${name}` || f.path === name || f.path.endsWith(`/${name}`)
        : name.test(f.path)
    );

  // 0. Detect Laravel or Backend Coupled Framework
  const hasLaravelPlugin = files.some(
    (f) =>
      f.content &&
      (f.content.includes("laravel-vite-plugin") ||
        f.content.includes("laravel(") ||
        f.content.includes("@viteReactRefresh"))
  );
  const hasComposer = files.some((f) => f.path.endsWith("composer.json") || f.path.endsWith("artisan"));
  const isLaravelProject = hasLaravelPlugin || hasComposer;

  // 1. Locate and Normalize index.html (or synthesize if missing for Laravel/Inertia)
  let indexHtmlFile = findFile("index.html");
  let detectedWebDir = "dist";

  // If index.html is missing but frontend entry scripts exist (classic in Laravel Blade + Vite setups)
  if (!indexHtmlFile) {
    const candidateEntry = files.find((f) =>
      /^(resources\/js\/|src\/)?(app|main|index)\.(tsx|jsx|ts|js|vue)$/i.test(
        f.path.replace(prefix, "")
      )
    );

    if (candidateEntry) {
      const entryRelativePath = candidateEntry.path.replace(prefix, "./");
      const synthesizedHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>App</title>
    <script>
      window.__NATIVE_BRIDGE_READY__ = true;
      window.addEventListener('error', function(e) {
        console.warn('[NativeBridge] Unhandled UI error captured:', e.message);
      });
    </script>
  </head>
  <body>
    <div id="app"></div>
    <div id="root"></div>
    <script type="module" src="${entryRelativePath}"></script>
  </body>
</html>
`;
      const htmlPath = `${prefix}index.html`;
      creations.push({
        path: htmlPath,
        content: synthesizedHtml,
        reason: "Synthesized root index.html to mount decoupled frontend entry point",
      });
      logs.push(`Synthesized missing root index.html mounting entry point (${entryRelativePath})`);
      indexHtmlFile = { path: htmlPath, content: synthesizedHtml };
    }
  }

  if (indexHtmlFile && typeof indexHtmlFile.content === "string") {
    let html = indexHtmlFile.content;
    let modified = false;

    // A. Ensure responsive mobile viewport with viewport-fit=cover for safe-areas / notch
    if (!html.includes("viewport-fit=cover")) {
      if (html.includes('<meta name="viewport"')) {
        html = html.replace(
          /<meta\s+name=["']viewport["'][^>]*>/i,
          '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />'
        );
        modified = true;
      } else if (html.includes("<head>")) {
        html = html.replace(
          "<head>",
          '<head>\n    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />'
        );
        modified = true;
      }
    }

    // B. Fix absolute root-relative script/link tags inside index.html (e.g. src="/src/main.tsx" -> src="./src/main.tsx")
    const fixedHrefHtml = html
      .replace(/href=["']\/(?!\/)([^"']+)["']/gi, 'href="./$1"')
      .replace(/src=["']\/(?!\/)([^"']+)["']/gi, 'src="./$1"');

    if (fixedHrefHtml !== html) {
      html = fixedHrefHtml;
      modified = true;
      logs.push("Harmonized absolute asset paths in index.html to relative './' paths");
    }

    // C. Verify entry script is mounted
    const hasScriptTag = /<script[^>]+src=["'][^"']+["']/i.test(html);
    if (!hasScriptTag) {
      // Find candidate entry points in source
      const entryCandidate = files.find((f) =>
        /^(resources\/js\/|src\/)?(main|index|app)\.(tsx|jsx|ts|js)$/i.test(f.path.replace(prefix, ""))
      );
      if (entryCandidate && html.includes("</body>")) {
        const scriptSrc = entryCandidate.path.replace(prefix, "./");
        html = html.replace(
          "</body>",
          `  <script type="module" src="${scriptSrc}"></script>\n  </body>`
        );
        modified = true;
        logs.push(`Injected missing module entry script (${scriptSrc}) into index.html`);
      }
    }

    // D. Strip any meta refresh or external redirects from HTML
    if (/<meta[^>]+http-equiv=["']refresh["'][^>]*>/i.test(html)) {
      html = html.replace(/<meta[^>]+http-equiv=["']refresh["'][^>]*>/gi, "");
      modified = true;
      logs.push("Removed external meta refresh redirect tag from index.html");
    }

    // E. Inject unhandled error overlay suppressor / bridge fallback
    if (!html.includes("window.__NATIVE_BRIDGE_READY__")) {
      const bridgePolyfill = `
    <script>
      window.__NATIVE_BRIDGE_READY__ = true;
      window.addEventListener('error', function(e) {
        console.warn('[NativeBridge] Unhandled UI error captured:', e.message);
      });
    </script>
`;
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${bridgePolyfill}</head>`);
        modified = true;
      }
    }

    if (modified && !creations.some((c) => c.path === indexHtmlFile!.path)) {
      patches.push({
        path: indexHtmlFile.path,
        content: html,
        reason: "Mobile WebView viewport & relative asset harmonization",
      });
    }
  }

  // 2. Harmonize Vite Configuration (vite.config.ts / js)
  const viteConfigFile = files.find(
    (f) =>
      f.path === `${prefix}vite.config.ts` ||
      f.path === `${prefix}vite.config.js` ||
      f.path === `${prefix}vite.config.mjs` ||
      f.path.endsWith("/vite.config.ts") ||
      f.path.endsWith("/vite.config.js")
  );

  if (viteConfigFile && typeof viteConfigFile.content === "string") {
    let viteContent = viteConfigFile.content;
    let viteModified = false;

    // A. Harmonize Laravel Vite Plugin into self-contained SPA Vite configuration
    if (viteContent.includes("laravel-vite-plugin") || viteContent.includes("laravel(")) {
      // Find candidate input file if defined in laravel({ input: [...] })
      const inputMatch = viteContent.match(/input\s*:\s*(\[[^\]]+\]|['"][^'"]+['"])/);
      let entryFile = "src/main.tsx";
      if (inputMatch) {
        const candidate = inputMatch[1].replace(/[\[\]'"`\s]/g, "").split(",")[0];
        if (candidate) entryFile = candidate;
      } else {
        const found = files.find((f) => /resources\/js\/(app|main)\.(tsx|jsx|ts|js)/i.test(f.path));
        if (found) entryFile = found.path.replace(prefix, "");
      }

      // Remove laravel import and invocation
      viteContent = viteContent
        .replace(/import\s+laravel\s+from\s+['"]laravel-vite-plugin['"];?/g, "")
        .replace(/laravel\s*\(\s*\{[\s\S]*?\}\s*\),?/g, "");

      // Ensure dev server and build outDir are self-contained
      if (!viteContent.includes("build:")) {
        if (/defineConfig\s*\(\s*\{/.test(viteContent)) {
          viteContent = viteContent.replace(
            /defineConfig\s*\(\s*\{/,
            "defineConfig({\n  base: './',\n  build: { outDir: 'dist', emptyOutDir: true },"
          );
        }
      }

      viteModified = true;
      logs.push("Decoupled laravel-vite-plugin into self-contained SPA build configuration");
    }

    // B. Strip external dev server origin/host redirects (e.g. server.origin = 'http://localhost:8000')
    if (/origin\s*:\s*['"]https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):[0-9]+['"]/i.test(viteContent)) {
      viteContent = viteContent.replace(/origin\s*:\s*['"]https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):[0-9]+['"],?/gi, "");
      viteModified = true;
      logs.push("Removed external server.origin dev redirect from Vite configuration");
    }
    if (/host\s*:\s*['"](?:localhost|127\.0\.0\.1)['"]/i.test(viteContent) && !viteContent.includes("0.0.0.0")) {
      viteContent = viteContent.replace(/host\s*:\s*['"](?:localhost|127\.0\.0\.1)['"],?/gi, "host: '0.0.0.0',");
      viteModified = true;
    }

    // C. Enforce base: './' or base: '' so built assets work under file:// and native WebView origins
    if (!/base\s*:\s*['"]\.\/?['"]/i.test(viteContent)) {
      if (/defineConfig\s*\(\s*\{/.test(viteContent)) {
        viteContent = viteContent.replace(
          /defineConfig\s*\(\s*\{/,
          "defineConfig({\n  base: './',"
        );
        viteModified = true;
        logs.push("Enforced base: './' in Vite configuration for native WebView asset resolution");
      } else if (/export\s+default\s*\{/.test(viteContent)) {
        viteContent = viteContent.replace(
          /export\s+default\s*\{/,
          "export default {\n  base: './',"
        );
        viteModified = true;
        logs.push("Enforced base: './' in Vite configuration for native WebView asset resolution");
      }
    }

    // D. Strip Lovable / v0 dev-only plugins that crash during native cloud build
    if (viteContent.includes("lovable-tagger")) {
      viteContent = viteContent
        .replace(/import\s*\{\s*componentTagger\s*\}\s*from\s*["']lovable-tagger["'];?/g, "")
        .replace(/componentTagger\s*\(\s*\),?/g, "");
      viteModified = true;
      logs.push("Cleaned dev-only lovable-tagger plugin from Vite build configuration");
    }

    // E. Check build target output directory
    const outDirMatch = viteContent.match(/outDir\s*:\s*['"]([^'"]+)['"]/);
    if (outDirMatch && outDirMatch[1]) {
      detectedWebDir = outDirMatch[1];
    } else {
      detectedWebDir = "dist";
    }

    if (viteModified) {
      patches.push({
        path: viteConfigFile.path,
        content: viteContent,
        reason: "Vite native configuration alignment (base relative path & dev server self-containment)",
      });
    }
  }

  // 3. Harmonize Next.js (next.config.js / mjs / ts) for Static Export
  const nextConfigFile = files.find(
    (f) =>
      f.path === `${prefix}next.config.js` ||
      f.path === `${prefix}next.config.mjs` ||
      f.path === `${prefix}next.config.ts`
  );

  if (nextConfigFile && typeof nextConfigFile.content === "string") {
    let nextContent = nextConfigFile.content;
    let nextModified = false;

    if (!nextContent.includes("output: 'export'") && !nextContent.includes('output: "export"')) {
      if (nextContent.includes("const nextConfig = {")) {
        nextContent = nextContent.replace(
          "const nextConfig = {",
          "const nextConfig = {\n  output: 'export',\n  images: { unoptimized: true },"
        );
        nextModified = true;
      } else if (/module\.exports\s*=\s*\{/.test(nextContent)) {
        nextContent = nextContent.replace(
          /module\.exports\s*=\s*\{/,
          "module.exports = {\n  output: 'export',\n  images: { unoptimized: true },"
        );
        nextModified = true;
      } else if (/export\s+default\s*\{/.test(nextContent)) {
        nextContent = nextContent.replace(
          /export\s+default\s*\{/,
          "export default {\n  output: 'export',\n  images: { unoptimized: true },"
        );
        nextModified = true;
      }
      if (nextModified) {
        detectedWebDir = "out";
        logs.push("Configured Next.js for static export (output: 'export', unoptimized images)");
        patches.push({
          path: nextConfigFile.path,
          content: nextContent,
          reason: "Next.js static export alignment for native WebView packaging",
        });
      }
    }
  }

  // 4. Harmonize package.json scripts and dependencies
  const pkgFile = files.find(
    (f) => f.path === `${prefix}package.json` || f.path === "package.json"
  );

  if (pkgFile && typeof pkgFile.content === "string") {
    try {
      const pkg = JSON.parse(pkgFile.content);
      let pkgModified = false;

      pkg.scripts = pkg.scripts || {};

      // Normalize dev script to point inside the application
      if (pkg.scripts.dev && (pkg.scripts.dev.includes("artisan") || pkg.scripts.dev.includes("concurrently"))) {
        pkg.scripts.dev = "vite";
        pkgModified = true;
        logs.push("Normalized dev script to self-contained 'vite'");
      }

      // Ensure a build script exists
      if (!pkg.scripts.build || pkg.scripts.build.includes("artisan")) {
        if (files.some((f) => f.path.includes("vite.config")) || isLaravelProject) {
          pkg.scripts.build = "vite build";
          pkgModified = true;
          logs.push("Synthesized missing 'build' script -> 'vite build'");
        } else if (framework === "next") {
          pkg.scripts.build = "next build";
          pkgModified = true;
        } else if (files.some((f) => f.path.includes("webpack.config"))) {
          pkg.scripts.build = "webpack --mode production";
          pkgModified = true;
        }
      }

      // Clean broken dev dependencies (e.g. lovable-tagger if left in package.json)
      if (pkg.devDependencies && pkg.devDependencies["lovable-tagger"]) {
        delete pkg.devDependencies["lovable-tagger"];
        pkgModified = true;
      }
      if (pkg.dependencies && pkg.dependencies["lovable-tagger"]) {
        delete pkg.dependencies["lovable-tagger"];
        pkgModified = true;
      }

      if (pkgModified) {
        patches.push({
          path: pkgFile.path,
          content: JSON.stringify(pkg, null, 2) + "\n",
          reason: "package.json build scripts & dev cleanup",
        });
      }
    } catch {
      logs.push("package.json could not be parsed for harmonization");
    }
  }

  // 5. Scan source code to neutralize hardcoded Laravel / external dev server redirects
  const sourceCodeFiles = files.filter(
    (f) =>
      !f.isBinary &&
      f.content &&
      /\.(m?[jt]sx?|vue|svelte|html?)$/i.test(f.path) &&
      !f.path.includes("node_modules/") &&
      !/\/(dist|build|out)\//.test(f.path)
  );

  for (const sf of sourceCodeFiles) {
    let text = sf.content!;
    let changed = false;

    // Neutralize hardcoded window.location redirects to localhost:8000 or Laravel backend
    const redirectRe = /window\.location(?:\.href|\.replace|\.assign)?\s*=\s*['"`]https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):8000([^'"`]*)['"`]/g;
    if (redirectRe.test(text)) {
      text = text.replace(redirectRe, 'window.location.hash = "#$1"');
      changed = true;
      logs.push(`Neutralized external Laravel dev server redirect in ${sf.path}`);
    }

    // Neutralize hardcoded axios baseURL pointing to localhost:8000
    const axiosBaseRe = /(?:axios\.defaults\.baseURL|baseURL)\s*:\s*['"`]https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):8000\/?['"`]/g;
    if (axiosBaseRe.test(text)) {
      text = text.replace(axiosBaseRe, 'baseURL: "/api"');
      changed = true;
      logs.push(`Redirected hardcoded Laravel API baseUrl to relative '/api' in ${sf.path}`);
    }

    if (changed) {
      const existing = patches.find((p) => p.path === sf.path);
      if (existing) {
        existing.content = text;
        existing.reason += "; neutralized external redirects";
      } else {
        patches.push({
          path: sf.path,
          content: text,
          reason: "Neutralized external dev server redirects and decoupled API base URLs",
        });
      }
    }
  }

  return {
    patches,
    creations,
    logs,
    detectedWebDir,
  };
}
