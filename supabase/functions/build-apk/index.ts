import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PLATFORM_RELEASE } from "../_shared/platformRelease.ts";
import { BUILD_INTEGRITY_JS, BUILD_RETRY_JS, PEER_AUDIT_JS } from "../_shared/cprRunnerScripts.ts";
import { POST_INSTALL_JS } from "../_shared/cprPostInstall.ts";
import { RESILIENCE_RUNNER_JS } from "../_shared/resilienceRunner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GITHUB_API = "https://api.github.com";

/**
 * NativeBridge custom Android asset generator script.
 * Inlined into the workflow YAML so the runner can produce exact-size icons
 * without depending on @capacitor/assets.
 */
function getAssetGeneratorScript(): string {
  return [
    "const fs = require('fs');",
    "const path = require('path');",
    "let sharp; try { sharp = require('sharp'); } catch { console.error('sharp missing'); process.exit(1); }",
    "function parseArgs(a){ const o={iconBackground:'#FFFFFF'}; for(let i=2;i<a.length;i++){const x=a[i]; if(x==='--source')o.source=a[++i]; else if(x==='--foreground')o.foreground=a[++i]; else if(x==='--res')o.res=a[++i]; else if(x==='--background')o.background=a[++i]; else if(x==='--iconBackground')o.iconBackground=a[++i]; else if(x==='--splash')o.splash=a[++i];} return o; }",
    "function walk(d,r=[]){ if(!fs.existsSync(d)) return r; for(const e of fs.readdirSync(d,{withFileTypes:true})){ const f=path.join(d,e.name); if(e.isDirectory()) walk(f,r); else if(e.isFile()&&e.name.toLowerCase().endsWith('.png')) r.push(f);} return r; }",
    "function role(p){ const n=path.basename(p).toLowerCase(); const dir=path.basename(path.dirname(p)); if(n.includes('foreground')) return 'adaptiveForeground'; if(n.includes('background')) return 'adaptiveBackground'; if(n.includes('round')) return 'launcherRound'; if(n.includes('splash')) return 'splash'; if(dir.startsWith('mipmap')) return 'launcher'; if(dir.startsWith('drawable')&&n.startsWith('ic_')) return 'launcher'; return 'other'; }",
    "function hexToRgb(h){ h=(h||'').replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); if(h.length===8) h=h.slice(0,6); const n=parseInt(h,16); if(!Number.isFinite(n)) return {r:255,g:255,b:255,alpha:1}; return {r:(n>>16)&255,g:(n>>8)&255,b:n&255,alpha:1}; }",
    "function roundedMaskSvg(w,h,rPct){ const r=Math.round(Math.min(w,h)*(rPct/100)); return Buffer.from(`<svg width=\"${w}\" height=\"${h}\"><rect x=\"0\" y=\"0\" width=\"${w}\" height=\"${h}\" rx=\"${r}\" ry=\"${r}\" fill=\"white\"/></svg>`); }",
    "function circleMaskSvg(w,h){ return Buffer.from(`<svg width=\"${w}\" height=\"${h}\"><circle cx=\"${w/2}\" cy=\"${h/2}\" r=\"${Math.min(w,h)/2}\" fill=\"white\"/></svg>`); }",
    "async function flattenedLauncher(fgBuf, w, h, iconBg, maskSvg){",
    "  const scale=0.78; const inner=Math.round(Math.min(w,h)*scale);",
    "  const fgFit=await sharp(fgBuf).resize(inner,inner,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();",
    "  const off=Math.round((w-inner)/2);",
    "  const base=await sharp({create:{width:w,height:h,channels:4,background:hexToRgb(iconBg)}}).composite([{input:fgFit,left:off,top:off}]).png().toBuffer();",
    "  return await sharp(base).composite([{input:maskSvg,blend:'dest-in'}]).png().toBuffer();",
    "}",
    "async function gen(buf, fgBuf, role, w, h, opts){ const bg=opts.background||'#FFFFFF'; const iconBg=opts.iconBackground||'#FFFFFF';",
    "  const fg = fgBuf || buf;",
    "  if(role==='launcher'){ return await flattenedLauncher(fg, w, h, iconBg, roundedMaskSvg(w,h,22)); }",
    "  if(role==='launcherRound'){ return await flattenedLauncher(fg, w, h, iconBg, circleMaskSvg(w,h)); }",
    "  if(role==='adaptiveForeground'){ const inner=Math.round(w*0.5); const off=Math.round((w-inner)/2); return await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input: await sharp(fg).resize(inner,inner,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(), left:off, top:off}]).png().toBuffer(); }",
    "  if(role==='adaptiveBackground') return await sharp({create:{width:w,height:h,channels:4,background:hexToRgb(iconBg)}}).png().toBuffer();",
    "  if(role==='splash'){ const ss=opts.splashBuffer||fg; return await sharp({create:{width:w,height:h,channels:4,background:hexToRgb(bg)}}).composite([{input: await sharp(ss).resize(Math.round(Math.min(w,h)*0.35),Math.round(Math.min(w,h)*0.35),{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(), gravity:'center'}]).png().toBuffer(); }",
    "  return await sharp(buf).resize(w,h,{fit:'cover'}).png().toBuffer();",
    "}",
    "(async()=>{ const a=parseArgs(process.argv);",
    "  // Resolve background from appearance.json if present (single source of truth)",
    "  try { if(fs.existsSync('appearance.json')){ const ap=JSON.parse(fs.readFileSync('appearance.json','utf8')); if(ap && ap.splash && ap.splash.bg && !a.background) a.background=ap.splash.bg; if(ap && ap.icon && ap.icon.bg) a.iconBackground=ap.icon.bg; } } catch(e){}",
    "  // Auto-detect foreground file if not passed explicitly",
    "  if(!a.foreground && fs.existsSync('icon_fg.png')) a.foreground='icon_fg.png';",
    "  if(!fs.existsSync(a.source)||!fs.existsSync(a.res)){ console.error('Missing source or res'); process.exit(1);}",
    "  const buf=fs.readFileSync(a.source);",
    "  const fgBuf=a.foreground&&fs.existsSync(a.foreground)?fs.readFileSync(a.foreground):null;",
    "  const splashBuffer=a.splash&&fs.existsSync(a.splash)?fs.readFileSync(a.splash):null;",
    "  console.log(`[assets] iconBg=${a.iconBackground} splashBg=${a.background} foreground=${fgBuf?'yes':'no'}`);",
    "  const pngs=walk(a.res); console.log(`[assets] Found ${pngs.length} PNG(s)`);",
    "  let n=0; for(const f of pngs){ try{ const m=await sharp(f).metadata(); if(!m.width||!m.height) continue; const r=role(f); const out=await gen(buf,fgBuf,r,m.width,m.height,{background:a.background,iconBackground:a.iconBackground,splashBuffer}); fs.writeFileSync(f,out); n++; }catch(e){ console.warn('skip',f,e.message); } }",
    "  console.log(`[assets] Replaced ${n}/${pngs.length}`);",
    "})().catch(e=>{ console.error(e); process.exit(1); });",
  ].join("\n");
}

/** UTF-8 safe base64 encoding — handles characters outside Latin1 range */
function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface BuildRequest {
  action: "start" | "setup" | "rebuild" | "status" | "download" | "download-phase1-source" | "cleanup" | "delete-repo" | "generate-keystore";
  projectZip?: string;
  projectStoragePath?: string;
  projectName?: string;
  runId?: number;
  repoName?: string;
  commitSha?: string;
  buildMode?: "capacitor-source" | "prebuilt-project" | "github-repo";
  appName?: string;
  packageName?: string;
  plugins?: string[];
  sourceRepoUrl?: string;
  sourceBranch?: string;
  signingMode?: "debug" | "release";
  keystorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
  keystoreBase64?: string;
  iconDataUrl?: string;
  iconForegroundDataUrl?: string;
  iconBackgroundColor?: string;
  splashDataUrl?: string;
  appearanceJson?: string;
  existingRepoName?: string;
  pluginConfigFiles?: { path: string; contentBase64: string }[];
  modifiedFiles?: { path: string; contentBase64: string }[];
  versionName?: string;
  versionCode?: number;
  minSdk?: number;
  targetSdk?: number;
  webDir?: string;
  phase?: string;
  platform?: string;
  maxLines?: number;
  cprBlueprint?: { cprProjectBlueprint?: CprHints };
  projectId?: string;
  buildId?: string;
}

async function resolveProjectZip(body: BuildRequest): Promise<string> {
  if (body.projectZip) return body.projectZip;
  if (!body.projectStoragePath) throw new Error("projectZip or projectStoragePath is required");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Build source storage is not configured");
  }

  const encodedPath = body.projectStoragePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const response = await fetch(`${supabaseUrl}/storage/v1/object/project-files/${encodedPath}`, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Failed to load build source from Storage: ${response.status} ${detail}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const githubToken = normalizeGitHubToken(Deno.env.get("GITHUB_TOKEN"));
    if (!githubToken) {
      return new Response(
        JSON.stringify({
          error: "GITHUB_TOKEN not configured",
          message:
            "A GitHub Personal Access Token is required for cloud builds. Add it as a secret named GITHUB_TOKEN.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: BuildRequest = await req.json();

    if (body.action === "start") {
      return await startBuild(body, githubToken);
    } else if (body.action === "setup") {
      return await setupPhase(body, githubToken);
    } else if (body.action === "rebuild") {
      return await rebuildPhase(body, githubToken);
    } else if (body.action === "status") {
      return await checkStatus(body, githubToken);
    } else if (body.action === "download") {
      return await downloadArtifact(body, githubToken);
    } else if (body.action === "download-phase1-source") {
      return await downloadPhase1Source(body, githubToken);
    } else if (body.action === "cleanup" || body.action === "delete-repo") {
      return await cleanupRepo(body, githubToken);
    } else if (body.action === "export-logs") {
      return await exportLogs(body, githubToken);
    } else if (body.action === "generate-keystore") {
      return await generateKeystoreAction(body, githubToken);
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("build-apk error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── GitHub API helpers ──

async function githubFetch(
  path: string,
  token: string,
  options: RequestInit = {}
) {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  return await fetch(url, { ...options, headers });
}

function normalizeGitHubToken(value?: string | null): string {
  return (value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^(bearer|token)\s+/i, "")
    .trim();
}

async function getAuthenticatedUser(token: string): Promise<string> {
  const res = await githubFetch("/user", token);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Invalid GitHub token: ${res.status} ${text}`);
  }
  const user = await res.json();
  return user.login;
}

async function getRepositoryHead(
  username: string,
  repoName: string,
  token: string,
): Promise<{ branch: string; sha: string }> {
  const repoRes = await githubFetch(`/repos/${username}/${repoName}`, token);
  if (!repoRes.ok) {
    throw new Error(`Failed to inspect repository: ${repoRes.status} ${(await repoRes.text()).slice(0, 300)}`);
  }
  const repo = await repoRes.json();
  const branch = typeof repo.default_branch === "string" && repo.default_branch.trim()
    ? repo.default_branch.trim()
    : "main";

  for (let attempt = 0; attempt < 8; attempt++) {
    const refRes = await githubFetch(
      `/repos/${username}/${repoName}/git/ref/heads/${encodeURIComponent(branch)}`,
      token,
    );
    if (refRes.ok) {
      const ref = await refRes.json();
      return { branch, sha: ref.object.sha };
    }
    if (![404, 409, 422].includes(refRes.status)) {
      throw new Error(`Failed to get ${branch} ref: ${refRes.status} ${(await refRes.text()).slice(0, 300)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error(`Repository default branch "${branch}" was not ready after initialization`);
}

// Unique repo name with timestamp to avoid stale repo issues
function getRepoName(projectName: string): string {
  const slug = projectName
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `nb-${slug}-${Date.now()}`;
}

// ── YAML helpers ──

/** Sanitize a string for safe interpolation into YAML / shell commands */
function sanitizeForYaml(value: string): string {
  return value
    .replace(/[`$\\]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/['"]/g, "")
    .trim();
}

function indentBlock(value: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return value.split("\n").map((line) => `${pad}${line}`).join("\n");
}

/** Build a plugin install step block with correct 6-space YAML indentation */
function buildPluginInstallStep(plugins: string[]): string {
  if (plugins.length === 0) return "";
  // Filter out known invalid/non-existent npm packages
  const INVALID_PACKAGES = new Set([
    "@capacitor/edge-to-edge",
    "@capawesome/capacitor-android-edge-to-edge-support",
  ]);
  const validPlugins = plugins.filter(p => !INVALID_PACKAGES.has(p));
  const skippedPlugins = plugins.filter(p => INVALID_PACKAGES.has(p));

  // Dependencies were version-resolved and written to package.json before the
  // source archive was uploaded. Never install a bare package here: npm would
  // resolve "latest" and could replace a Capacitor-compatible major.
  const lines = validPlugins.flatMap((p) => {
    const safe = sanitizeForYaml(p);
    return [
      `          echo ">>> ${safe}"`,
      `          if node -e "const p=require('./package.json');const d={...(p.dependencies||{}),...(p.devDependencies||{})};if(!d['${safe}']||d['${safe}']==='latest'||d['${safe}']==='*')process.exit(1);console.log('${safe}@'+d['${safe}'])" 2>&1 | tee -a plugin-install.log; then`,
      `            echo "OK ${safe}" >> plugin-install-report.txt`,
      `          else`,
      `            echo "FAIL ${safe}: missing pinned version in package.json" | tee -a plugin-install.log`,
      `            echo "FAIL ${safe}" >> plugin-install-report.txt`,
      `            exit 1`,
      `          fi`,
    ];
  });
  const skippedLines = skippedPlugins.map(p => `          echo "SKIP ${sanitizeForYaml(p)}" >> plugin-install-report.txt`);
  return [
    "",
    "      - name: Install Capacitor plugins",
    "        run: |",
    `          echo "=== Installing ${validPlugins.length} Capacitor plugin(s) ==="`,
    `          : > plugin-install-report.txt`,
    ...skippedLines,
    ...lines,
    `          echo "=== Plugin install report ==="`,
    `          cat plugin-install-report.txt`,
    `          # Verify each plugin actually landed in package.json — fail loudly otherwise`,
    `          MISSING=""`,
    ...validPlugins.map(p => {
      const safe = sanitizeForYaml(p);
      return `          node -e "const p=require('./package.json');const d={...(p.dependencies||{}),...(p.devDependencies||{})};process.exit(d['${safe}']?0:1)" || MISSING="$MISSING ${safe}"`;
    }),
    `          if [ -n "$MISSING" ]; then echo "::error::Plugins missing from package.json after install:$MISSING"; echo "MISSING_FROM_PKG:$MISSING" >> plugin-install-report.txt; exit 1; fi`,
    "          if ! npx cap sync android 2>&1 | tee -a plugin-install.log; then echo 'CAP_SYNC_FAILED' >> plugin-install-report.txt; exit 1; fi",
    `          echo "=== Plugins synced ==="`,
    "",
  ].join("\n");
}


/**
 * Pre-flight workflow YAML validator. Throws on hard failures so we never
 * push a broken workflow file to GitHub Actions (which would otherwise show
 * the user a cryptic "Workflow failed before any job could start" error).
 */
function validateWorkflowYaml(yaml: string, label: string): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = yaml.split("\n");
  const openHeredocs: { tag: string; line: number }[] = [];

  // Hard error: tabs are illegal in YAML
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("\t")) {
      errors.push(`Line ${i + 1}: contains tab character (YAML requires spaces)`);
    }
  }

  // Catch malformed shell heredocs before a workflow is pushed to GitHub.
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (openHeredocs.length > 0) {
      const current = openHeredocs[openHeredocs.length - 1];
      if (raw.trim() === current.tag) openHeredocs.pop();
      continue;
    }
    const match = raw.match(/<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/);
    if (match) openHeredocs.push({ tag: match[1], line: i + 1 });
  }
  for (const heredoc of openHeredocs) {
    errors.push(`Line ${heredoc.line}: heredoc "${heredoc.tag}" has no standalone terminator`);
  }

  // setup-node fails before our source archive is extracted when cache is
  // enabled but the repository root has no lockfile (source.zip repositories
  // intentionally have this shape). Dependency caching is handled explicitly
  // after extraction, so generated setup-node blocks must never enable it.
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("actions/setup-node@")) continue;
    for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
      if (/^\s*-\s+name:|^\s*-\s+uses:/.test(lines[j])) break;
      if (/^\s+cache\s*:\s*['\"]?(npm|yarn|pnpm)['\"]?\s*$/.test(lines[j])) {
        errors.push(`Line ${j + 1}: setup-node caching is forbidden before source extraction; use the post-extraction cache step`);
      }
    }
  }

  // Hard error: required top-level keys
  const topLevelKeys = lines
    .filter((l) => /^[A-Za-z_]/.test(l))
    .map((l) => l.split(":")[0].trim());
  for (const required of ["name", "on", "jobs"]) {
    if (!topLevelKeys.includes(required)) {
      errors.push(`Missing required top-level key: "${required}:"`);
    }
  }

  // Indent sanity: every non-empty, non-block-scalar line must be a multiple of 2 spaces
  let inBlockScalar = false;
  let blockIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length;
    if (inBlockScalar) {
      if (indent <= blockIndent) inBlockScalar = false; else continue;
    }
    if (/[|>][-+]?\s*$/.test(raw.trimEnd())) {
      inBlockScalar = true;
      blockIndent = indent;
      continue;
    }
    if (indent % 2 !== 0) {
      errors.push(`Line ${i + 1}: odd indentation (${indent} spaces) — "${raw.trim().slice(0, 60)}"`);
    }
    if (indent === 0 && !/^#/.test(raw.trim()) && !/^[A-Za-z_][A-Za-z0-9_-]*:\s*($|.)/.test(raw)) {
      errors.push(`Line ${i + 1}: invalid top-level YAML content — "${raw.trim().slice(0, 60)}"`);
    }
    // unmatched single quote (skip if line uses double-quote wrap)
    const sq = (raw.match(/'/g) || []).length;
    const dq = (raw.match(/"/g) || []).length;
    if (sq % 2 !== 0) warnings.push(`Line ${i + 1}: unmatched single quote`);
    if (dq % 2 !== 0) warnings.push(`Line ${i + 1}: unmatched double quote`);
  }

  if (warnings.length) console.warn(`[${label}] YAML warnings:\n  - ${warnings.join("\n  - ")}`);
  if (errors.length) {
    const msg = `Workflow YAML validation failed (${label}):\n  - ${errors.join("\n  - ")}`;
    console.error(msg);
    throw new Error(msg);
  }
  console.log(`[${label}] Workflow validated: ${lines.length} lines, ${warnings.length} warnings, 0 errors`);
}

// ── Step failure classifier ──

interface StepClassification {
  category: string;
  detail: string;
  suggestedFix: string;
}

function classifyFailedStep(stepName: string, logExcerpt: string): StepClassification {
  const lowerStep = stepName.toLowerCase();
  const lowerLog = logExcerpt.toLowerCase();

  if (lowerStep.includes("set up jdk") || lowerStep.includes("setup-java") || lowerStep.includes("java")) {
    return { category: "JDK Setup", detail: `Java setup failed at step: ${stepName}`, suggestedFix: "Check JDK version compatibility. The build uses JDK 21 with Temurin distribution." };
  }
  if (lowerStep.includes("set up node") || lowerStep.includes("setup-node") || lowerStep.includes("node")) {
    return { category: "Node Setup", detail: `Node.js setup failed at step: ${stepName}`, suggestedFix: "Check Node.js version compatibility. The build uses Node 18." };
  }
  if (lowerStep.includes("extract source") || lowerStep.includes("checkout") || lowerStep.includes("clone")) {
    return { category: "Source Extraction", detail: `Source code extraction/checkout failed at step: ${stepName}`, suggestedFix: "Check that the ZIP file contains a valid project with package.json." };
  }
  if (lowerStep.includes("install dep") || lowerStep.includes("npm install")) {
    if (lowerLog.includes("eresolve") || lowerLog.includes("peer dep")) {
      return { category: "Dependency Conflict", detail: "npm peer dependency conflict during install", suggestedFix: "Check package.json for conflicting peer dependencies. Try removing lock files." };
    }
    return { category: "Dependency Install", detail: `npm install failed at step: ${stepName}`, suggestedFix: "Check that all dependencies in package.json are valid and available on npm." };
  }
  if (lowerStep.includes("build web") || lowerStep.includes("build project")) {
    const webBuildLooksSuccessful = lowerLog.includes("built in") || lowerLog.includes("web build complete") || lowerLog.includes("found:");
    if (webBuildLooksSuccessful && lowerLog.includes("process completed with exit code 1")) {
      return {
        category: "Workflow Script",
        detail: `Web build succeeded, but the workflow shell exited non-zero in the post-build output check: ${stepName}`,
        suggestedFix: "Ensure every successful shell step ends with a zero-status command after diagnostic loops, and validate the detected web output directory explicitly."
      };
    }
    if (lowerLog.includes("module not found") || lowerLog.includes("cannot find module")) {
      return { category: "Missing Module", detail: "A required module was not found during web build", suggestedFix: "Ensure all imports exist and dependencies are listed in package.json." };
    }
    if (lowerLog.includes("typescript") || lowerLog.includes("ts(")) {
      return { category: "TypeScript Error", detail: "TypeScript compilation errors during web build", suggestedFix: "Fix TypeScript errors in your source code before building." };
    }
    return { category: "Web Build", detail: `Web project build failed at step: ${stepName}`, suggestedFix: "Check that 'npm run build' works locally. Ensure build output goes to dist/ or build/." };
  }
  if (lowerStep.includes("capacitor") || lowerStep.includes("cap sync") || lowerStep.includes("cap init") || lowerStep.includes("cap add")) {
    return { category: "Capacitor", detail: `Capacitor setup failed at step: ${stepName}`, suggestedFix: "Ensure your project builds successfully and has a valid output directory (dist/build/www)." };
  }
  if (lowerStep.includes("sdk") || lowerStep.includes("sdkmanager")) {
    return { category: "Android SDK", detail: `Android SDK setup failed at step: ${stepName}`, suggestedFix: "SDK platform installation issue. This is usually transient — try rebuilding." };
  }
  if (lowerStep.includes("patch agp") || lowerStep.includes("patch") || lowerStep.includes("variables.gradle")) {
    return { category: "Gradle Config", detail: `Gradle configuration patching failed at step: ${stepName}`, suggestedFix: "Build configuration mismatch. Check AGP and SDK version compatibility." };
  }
  if (lowerStep.includes("gradle") || lowerStep.includes("build debug") || lowerStep.includes("build release") || lowerStep.includes("assemble")) {
    if (lowerLog.includes("checkdebugaarmetadata") || lowerLog.includes("aar metadata") || lowerLog.includes("compilesdk")) {
      return { category: "AAR Metadata", detail: "A dependency requires a higher compileSdk than configured", suggestedFix: "Update compileSdk in variables.gradle to match the required version." };
    }
    if (lowerLog.includes("manifest merger") || lowerLog.includes("manifest merge")) {
      return { category: "Manifest Merge", detail: "AndroidManifest.xml has conflicting entries", suggestedFix: "Add tools:replace attributes to resolve conflicting manifest entries." };
    }
    if (lowerLog.includes("outofmemoryerror") || lowerLog.includes("out of memory")) {
      return { category: "Out of Memory", detail: "Gradle ran out of memory during compilation", suggestedFix: "Reduce project size or increase Gradle heap: org.gradle.jvmargs=-Xmx4g" };
    }
    if (lowerLog.includes("bouncycastle") || lowerLog.includes("bcprov-jdk") || lowerLog.includes("failed to create jar file") || lowerLog.includes("failed to process the entry")) {
      return { category: "Gradle Cache Corruption", detail: "BouncyCastle JAR processing failed — likely a corrupted Gradle cache or Java 21 bytecode incompatibility with JDK 17", suggestedFix: "The Gradle JAR cache has been cleared automatically. Try rebuilding. If it persists, update BouncyCastle to 1.80+ or check plugin dependencies." };
    }
    return { category: "Gradle Build", detail: `Gradle compilation failed at step: ${stepName}`, suggestedFix: "Check the build logs for specific Gradle errors. Ensure SDK versions are compatible." };
  }
  if (lowerStep.includes("upload") || lowerStep.includes("artifact")) {
    return { category: "Artifact Upload", detail: `Artifact upload failed at step: ${stepName}`, suggestedFix: "The APK may not have been generated. Check previous build steps for errors." };
  }
  if (lowerStep.includes("plugin") || lowerStep.includes("capacitor plugin")) {
    if (lowerLog.includes("404") || lowerLog.includes("not found") || lowerLog.includes("e404")) {
      return { category: "Plugin Not Found", detail: `One or more Capacitor plugins do not exist on npm. Failed at step: ${stepName}`, suggestedFix: "Check that all enabled plugins have valid npm package names. Remove any plugins that return 404 errors." };
    }
    return { category: "Plugin Install", detail: `Plugin installation failed at step: ${stepName}`, suggestedFix: "One or more Capacitor plugins could not be installed. Check plugin compatibility." };
  }

  // Generic fallback
  return { category: "Build Error", detail: `Failed at step: ${stepName}`, suggestedFix: "Check the build logs for specific error details." };
}

// ── Workflow YAML generators ──

/** Generates the Android workflow from the shared platform release. */
interface VersionCfg { versionName?: string; versionCode?: number; minSdk?: number; targetSdk?: number; }
// Runtime resolver: derives the web output directory from capacitor config,
// bundler config or framework defaults when no hint was supplied by the
// project index, and exports it as NB_WEB_DIR for later steps.
const WEB_DIR_RESOLVER_JS = [
  "const fs=require('fs');",
  "function read(p){try{return fs.readFileSync(p,'utf8')}catch(e){return ''}}",
  "function clean(s){return String(s||'').trim().replace(/^\\.\\//,'').replace(/^\\/+/,'').replace(/\\/+$/,'')}",
  "function val(txt,keys){for(const k of keys){const m=txt.match(new RegExp(\"['\\\"`]?\"+k+\"['\\\"`]?\\\\s*[:=]\\\\s*['\\\"`]([^'\\\"`]+)['\\\"`]\"));if(m)return clean(m[1])}return ''}",
  "function anyOf(list){for(const f of list){const c=read(f);if(c)return{f:f,c:c}}return null}",
  "let d=clean(process.env.NB_WEB_DIR);let src=d?'platform project index':'';",
  // 1. capacitor config wins when the project already declares a webDir
  "if(!d){const cap=anyOf(['capacitor.config.ts','capacitor.config.js','capacitor.config.json']);if(cap){const m=cap.c.match(/webDir\\s*[:=]\\s*['\\\"`]([^'\\\"`]+)/);if(m){d=clean(m[1]);src=cap.f+' webDir'}}}",
  // 2. Angular: angular.json outputPath (string|object) + /browser for the application builder
  "if(!d){const aj=read('angular.json')||read('.angular.json');if(aj){try{const j=JSON.parse(aj);const ps=j.projects||{};const name=(j.defaultProject&&ps[j.defaultProject])?j.defaultProject:Object.keys(ps).find(n=>ps[n].projectType!=='library')||Object.keys(ps)[0];const b=(ps[name]&&(ps[name].architect||ps[name].targets)||{}).build||{};const o=b.options||{};const pr=(b.configurations||{}).production||{};const raw=pr.outputPath||o.outputPath;let base='',sub=null;if(typeof raw==='string')base=clean(raw);else if(raw&&typeof raw==='object'){base=clean(raw.base);if(typeof raw.browser==='string')sub=clean(raw.browser)}if(!base)base='dist/'+name;let out=base;if(sub!==null)out=sub?base+'/'+sub:base;else if(String(b.builder||'').indexOf(':application')>-1)out=base+'/browser';d=out;src='angular.json outputPath'}catch(e){}}}",
  "let pkg={};try{pkg=JSON.parse(read('package.json')||'{}')}catch(e){}",
  "const dep=Object.assign({},pkg.dependencies,pkg.devDependencies);const sc=pkg.scripts||{};",
  // 3. framework configs
  "if(!d){const nx=anyOf(['next.config.js','next.config.mjs','next.config.ts','next.config.cjs']);if(nx){const dd=val(nx.c,['distDir']);const exp=/output\\s*:\\s*['\\\"`]export['\\\"`]/.test(nx.c);d=dd||(exp?'out':'');if(d)src=nx.f}}",
  "if(!d&&dep.nuxt){d='.output/public';src='nuxt nitro static output'}",
  "if(!d){const as=anyOf(['astro.config.mjs','astro.config.ts','astro.config.js']);if(as){d=val(as.c,['outDir'])||'dist';src=as.f}}",
  "if(!d){const sv=anyOf(['svelte.config.js','svelte.config.ts','svelte.config.mjs']);if(sv&&/adapter-static/.test(sv.c)){d=val(sv.c,['pages'])||'build';src=sv.f+' adapter-static'}}",
  "if(!d){const q=anyOf(['quasar.config.js','quasar.config.ts','quasar.conf.js']);if(q){d=val(q.c,['distDir'])||'dist/spa';src=q.f}}",
  "if(!d){const vc=anyOf(['vue.config.js','vue.config.ts','vue.config.mjs']);if(vc){d=val(vc.c,['outputDir'])||'dist';src=vc.f}}",
  "if(!d){const vi=anyOf(['vite.config.ts','vite.config.js','vite.config.mjs','vite.config.mts','vite.config.cjs']);if(vi){const o=val(vi.c,['outDir']);if(o){d=o;src=vi.f+' build.outDir'}}}",
  "if(!d){const wp=anyOf(['webpack.config.prod.js','webpack.prod.config.js','webpack.config.js','webpack.config.ts','rspack.config.js']);if(wp){const m=wp.c.match(/path\\s*:\\s*(?:path\\.(?:resolve|join)\\s*\\(\\s*__dirname\\s*,\\s*)?['\\\"`]([^'\\\"`]+)['\\\"`]/);if(m){d=clean(m[1]);src=wp.f+' output.path'}}}",
  "if(!d){const ele=anyOf(['.eleventy.js','eleventy.config.js','eleventy.config.mjs']);if(ele){d=val(ele.c,['output'])||'_site';src=ele.f}}",
  // 4. build-script flags (parcel/esbuild/rollup/vite --outDir)
  "if(!d&&sc.build){const m=String(sc.build).match(/--(?:out-dir|outDir|outdir|dist-dir|output-path)[= ]+([^\\s\"']+)/);if(m){d=clean(m[1]);src='package.json build script flag'}}",
  // 5. documented framework defaults
  "if(!d){if(dep.gatsby)d='public';else if(dep['@docusaurus/core'])d='build';else if(dep.vitepress)d='.vitepress/dist';else if(dep.vuepress)d='docs/.vuepress/dist';else if(dep['@stencil/core'])d='www';else if(dep['@ionic/angular']||dep['@ionic/react']||dep['@ionic/vue'])d='www';else if(dep['react-scripts']||dep['preact-cli']||dep.snowpack)d='build';else if(dep.hexo||dep.brunch)d='public';else if(dep.next)d='out';else if(dep['@angular/core'])d='dist';else if(dep.vite||dep['@rsbuild/core']||dep.parcel||dep.rollup||dep.esbuild||dep.umi||dep['ember-cli'])d='dist';if(d)src=src||'framework default'}",
  "if(d){d=clean(d);fs.appendFileSync(process.env.GITHUB_ENV,'NB_WEB_DIR='+d+'\\n');console.log('[nativeforge] web output dir -> '+d+'  (source: '+(src||'default')+')');}",
  "else{console.log('[nativeforge] no web output dir hint; falling back to scan');}",
].join("\n");

function webDirResolveStep(): string {
  const b64 = utf8ToBase64(WEB_DIR_RESOLVER_JS);
  return `      - name: Resolve web output directory
        run: |
          echo '${b64}' | base64 -d > /tmp/nb-webdir.cjs
          node /tmp/nb-webdir.cjs
`;
}

/**
 * POST-BUILD reconciliation. The pre-build hint (CPR blueprint / config parse)
 * is only a prediction: configs can be dynamic, mode-specific or simply stale.
 * After the web build actually ran we look at the filesystem, pick the folder
 * that truly contains the built index.html, re-export NB_WEB_DIR and align
 * capacitor.config.* so `cap sync` copies the right tree.
 */
const WEB_DIR_RECONCILE_JS = [
  "const fs=require('fs'),path=require('path');",
  "function clean(s){return String(s||'').trim().replace(/^\\.\\//,'').replace(/^\\/+/,'').replace(/\\/+$/,'')}",
  "function ok(d){try{return !!d&&fs.statSync(d).isDirectory()&&fs.statSync(path.join(d,'index.html')).size>0}catch(e){return false}}",
  "function read(p){try{return fs.readFileSync(p,'utf8')}catch(e){return ''}}",
  "const capFiles=['capacitor.config.ts','capacitor.config.js','capacitor.config.json'].filter(f=>fs.existsSync(f));",
  "let capDir='';for(const f of capFiles){const m=read(f).match(/webDir\\s*[:=]\\s*['\\\"`]([^'\\\"`]+)/);if(m){capDir=clean(m[1]);break}}",
  "const hinted=clean(process.env.NB_WEB_DIR);",
  "const listed=String(process.env.NB_WEB_DIR_CANDIDATES||'').split(',').map(clean);",
  "const defaults=['dist','build','www','out','public','.output/public','dist/spa','dist/public','build/client','.svelte-kit/output/client','.next/out'];",
  // Angular-style dist/<app>/browser and any single-level nesting under dist/build
  "const nested=[];for(const base of ['dist','build']){try{for(const e of fs.readdirSync(base,{withFileTypes:true})){if(!e.isDirectory())continue;nested.push(base+'/'+e.name);nested.push(base+'/'+e.name+'/browser')}}catch(e){}}",
  "const ordered=[];for(const c of [hinted,capDir,...listed,...defaults,...nested]){if(c&&ordered.indexOf(c)<0)ordered.push(c)}",
  "let picked=ordered.find(ok)||'';",
  // Last resort: shallow scan for a generated index.html anywhere sane.
  "if(!picked){const skip=new Set(['node_modules','android','ios','.git','.github','coverage','src']);const found=[];(function walk(d,depth){if(depth>3)return;let es=[];try{es=fs.readdirSync(d,{withFileTypes:true})}catch(e){return}for(const e of es){if(e.name.startsWith('.')&&e.name!=='.output'&&e.name!=='.svelte-kit')continue;if(skip.has(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,depth+1);else if(e.name==='index.html'&&d!=='.'){try{if(fs.statSync(p).size>0)found.push({d:clean(d),m:fs.statSync(p).mtimeMs})}catch(err){}}}})('.',0);found.sort((a,b)=>b.m-a.m);if(found.length){picked=found[0].d;console.log('[nativeforge] reconcile fell back to filesystem scan')}}",
  "if(!picked){console.error('[nativeforge] No built web output found. Probed: '+ordered.join(', '));console.error('[nativeforge] The build finished but produced no index.html — check the build command and its configured output directory.');process.exit(1)}",
  "if(picked!==hinted){console.log('[nativeforge] ::warning:: predicted web dir \"'+(hinted||'(none)')+'\" did not exist; using actual build output \"'+picked+'\"')}",
  "console.log('[nativeforge] web output reconciled -> '+picked);",
  "if(process.env.GITHUB_ENV)fs.appendFileSync(process.env.GITHUB_ENV,'NB_WEB_DIR='+picked+'\\n');",
  // Align capacitor config so `cap sync` copies the real output.
  "for(const f of capFiles){const c=read(f);if(!c)continue;let next=c;if(/webDir\\s*[:=]/.test(c)){next=c.replace(/(webDir\\s*[:=]\\s*)['\\\"`][^'\\\"`]*['\\\"`]/,'$1'+JSON.stringify(picked))}else if(f.endsWith('.json')){try{const j=JSON.parse(c);j.webDir=picked;next=JSON.stringify(j,null,2)+'\\n'}catch(e){}}if(next!==c){fs.writeFileSync(f,next);console.log('[nativeforge] '+f+' webDir -> '+picked)}}",
].join("\n");

function webDirReconcileStep(label = "Reconcile web output directory"): string {
  const b64 = utf8ToBase64(WEB_DIR_RECONCILE_JS);
  return `      - name: "${label}"
        run: |
          echo '${b64}' | base64 -d > /tmp/nb-webdir-reconcile.cjs
          node /tmp/nb-webdir-reconcile.cjs
`;
}


function depDoctorStep(label: string): string {
  // Deliberately non-mutating. Registry probes cannot distinguish a missing
  // public package from a private package, registry outage, or auth failure.
  return `      - name: "${label}"
        run: echo "Dependency manifest preserved; package manager will report exact resolution errors."
`;
}

function smartInstallStep(label: string, _extraArgs = ""): string {
  return `      - name: "${label}"
        run: |
          set -o pipefail
          echo "[cpr] release=\${NB_CPR_RELEASE:-legacy} lockfile-policy=\${NB_LOCKFILE_POLICY:-regenerate}"
          if [ -f pnpm-lock.yaml ]; then
            corepack enable
            if [ "\${NB_LOCKFILE_POLICY:-regenerate}" = "preserved" ]; then
              pnpm install --frozen-lockfile 2>&1 | tee dependency-install.log
            else
              pnpm install --no-frozen-lockfile 2>&1 | tee dependency-install.log
            fi
          elif [ -f yarn.lock ]; then
            corepack enable
            if [ "\${NB_LOCKFILE_POLICY:-regenerate}" != "preserved" ]; then
              yarn install 2>&1 | tee dependency-install.log
            elif grep -q 'yarnPath:' .yarnrc.yml 2>/dev/null || [ -d .yarn ]; then
              yarn install --immutable 2>&1 | tee dependency-install.log
            else
              yarn install --frozen-lockfile 2>&1 | tee dependency-install.log
            fi
          elif [ -f bun.lockb ] || [ -f bun.lock ]; then
            curl -fsSL https://bun.sh/install | bash
            export PATH="\$HOME/.bun/bin:\$PATH"
            if [ "\${NB_LOCKFILE_POLICY:-regenerate}" = "preserved" ]; then
              bun install --frozen-lockfile 2>&1 | tee dependency-install.log
            else
              bun install 2>&1 | tee dependency-install.log
            fi
          elif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
            if [ "\${NB_LOCKFILE_POLICY:-regenerate}" = "preserved" ]; then
              npm ci --no-audit --no-fund 2>&1 | tee dependency-install.log
            else
              npm install --package-lock-only --no-audit --no-fund 2>&1 | tee dependency-install.log
              npm ci --no-audit --no-fund 2>&1 | tee -a dependency-install.log
            fi
          else
            npm install --no-audit --no-fund 2>&1 | tee dependency-install.log
          fi
${peerAuditStep(`${label} · peer dependency audit`)}${postInstallStep(`${label} · post-install verification`)}`;
}

/**
 * CPR peer dependency audit — walks node_modules after a successful install
 * and installs every unsatisfied peer (the recharts → react-is class of
 * failure). Never fails the job.
 */
function peerAuditStep(label = "CPR · Peer dependency audit"): string {
  const b64 = utf8ToBase64(PEER_AUDIT_JS);
  return `      - name: "${label}"
        continue-on-error: true
        run: |
          echo '${b64}' | base64 -d > /tmp/nb-peer-audit.cjs
          node /tmp/nb-peer-audit.cjs || true
`;
}

/** Shell prelude that materialises the CPR build-retry runner. */
/**
 * CPR post-install remediation — duplicate React collapse, npm dedupe and the
 * category 8 verification matrix. Fails the job only when a check could not be
 * auto-repaired, because building on top of it would produce a broken app.
 */
function postInstallStep(label = "CPR · Post-install verification"): string {
  const b64 = utf8ToBase64(POST_INSTALL_JS);
  return `      - name: "${label}"
        run: |
          echo '${b64}' | base64 -d > /tmp/nb-post-install.cjs
          set +e
          node /tmp/nb-post-install.cjs
          PI_EXIT=$?
          set -e
          export PI_EXIT
          if [ -f cpr-post-install.json ]; then
            PAYLOAD=$(node -e "const fs=require('fs');let r=null;try{r=JSON.parse(fs.readFileSync('cpr-post-install.json','utf8'))}catch(e){};process.stdout.write(JSON.stringify({step:'post-install',exit_code:Number(process.env.PI_EXIT||0),post_install:r}))" || echo '{}')
            test -s "$GITHUB_WORKSPACE/nb-resilience.cjs" || echo '${utf8ToBase64(RESILIENCE_RUNNER_JS)}' | base64 -d > "$GITHUB_WORKSPACE/nb-resilience.cjs"
            node "$GITHUB_WORKSPACE/nb-resilience.cjs" event post_install_complete "$PAYLOAD" || true
          fi
          exit $PI_EXIT
`;
}


function buildRetryPrelude(): string {
  const b64 = utf8ToBase64(BUILD_RETRY_JS);
  return `echo '${b64}' | base64 -d > /tmp/nb-build-retry.cjs`;
}

function buildIntegrityStep(label = "CPR · Production build integrity"): string {
  const b64 = utf8ToBase64(BUILD_INTEGRITY_JS);
  return `      - name: "${label}"
        run: |
          echo '${b64}' | base64 -d > /tmp/nb-build-integrity.cjs
          node /tmp/nb-build-integrity.cjs
`;
}

function productionEnvironmentStep(): string {
  return `      - name: "CPR · Verify production environment files"
        run: |
          rm -f .env.production.local .env.development .env.local
          test ! -e .env.production.local
          echo "Production environment file order verified"
`;
}

/* ------------------------------------------------------------------------- */
/* Self-healing resilience system (classifier + fix executor + retry loop +  */
/* output-dir resilience + platform callbacks). The runner is written into    */
/* the workspace (not /tmp, which does not persist between steps reliably)    */
/* and every fragile step is executed through it.                            */
/* ------------------------------------------------------------------------- */

interface CallbackCfg {
  url?: string;
  secret?: string;
  buildId?: string;
  projectId?: string;
}

/** Env block injected into every resilience-aware workflow. */
/** Builds the platform callback config for a build request. */
function callbackCfgFor(body: BuildRequest): CallbackCfg {
  const base = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("NB_CALLBACK_SECRET") ?? "";
  return {
    url: base ? `${base}/functions/v1/build-callback` : "",
    secret,
    buildId: body.buildId ?? "",
    projectId: body.projectId ?? "",
  };
}

function resilienceEnv(cb: CallbackCfg): string {
  return `  NB_CALLBACK_URL: "${sanitizeForYaml(cb.url ?? "")}"
  NB_CALLBACK_SECRET: "${sanitizeForYaml(cb.secret ?? "")}"
  NB_BUILD_ID: "${sanitizeForYaml(cb.buildId ?? "")}"
  NB_PROJECT_ID: "${sanitizeForYaml(cb.projectId ?? "")}"
  NB_NODE_TS_VERSION: "5.6.3"
`;
}

/** Writes nb-resilience.cjs into the workspace and emits workflow_started. */
function resilienceInstallStep(label = "Resilience · install self-healing runner"): string {
  const b64 = utf8ToBase64(RESILIENCE_RUNNER_JS);
  return `      - name: "${label}"
        run: |
          echo '${b64}' | base64 -d > "\$GITHUB_WORKSPACE/nb-resilience.cjs"
          cp "\$GITHUB_WORKSPACE/nb-resilience.cjs" ./nb-resilience.cjs 2>/dev/null || true
          test -s "\$GITHUB_WORKSPACE/nb-resilience.cjs" || echo '${b64}' | base64 -d > "\$GITHUB_WORKSPACE/nb-resilience.cjs"
          node "\$GITHUB_WORKSPACE/nb-resilience.cjs" event workflow_started '{}' || true
`;
}

const RESILIENCE_RUNNER_B64 = utf8ToBase64(RESILIENCE_RUNNER_JS);
const NB_RUNNER = `test -s "\$GITHUB_WORKSPACE/nb-resilience.cjs" || echo '${RESILIENCE_RUNNER_B64}' | base64 -d > "\$GITHUB_WORKSPACE/nb-resilience.cjs"
          node "\$GITHUB_WORKSPACE/nb-resilience.cjs"`;

/**
 * Runs one shell command through the retry loop controller: classify → fix →
 * retry, three attempts max, with checkpoint callbacks on every attempt.
 */
function resilientStep(label: string, stepName: string, command: string, opts: { workingDirectory?: string; env?: string } = {}): string {
  return `      - name: "${label}"
${opts.workingDirectory ? `        working-directory: ${opts.workingDirectory}\n` : ""}${opts.env ?? ""}        run: |
          cp "\$GITHUB_WORKSPACE/nb-resilience.cjs" ./nb-resilience.cjs 2>/dev/null || true
          ${NB_RUNNER} step "${stepName}" -- ${command}
`;
}

/** Package-manager-aware install, executed through the resilience runner. */
const RESILIENT_INSTALL_SCRIPT = `set -o pipefail
echo "[cpr] release=\${NB_CPR_RELEASE:-legacy} lockfile-policy=\${NB_LOCKFILE_POLICY:-regenerate}"
if [ -f pnpm-lock.yaml ]; then
  corepack enable
  if [ "\${NB_LOCKFILE_POLICY:-regenerate}" = "preserved" ]; then
    pnpm install --frozen-lockfile 2>&1 | tee dependency-install.log
  else
    pnpm install --no-frozen-lockfile 2>&1 | tee dependency-install.log
  fi
elif [ -f yarn.lock ]; then
  corepack enable
  if [ "\${NB_LOCKFILE_POLICY:-regenerate}" != "preserved" ]; then
    yarn install 2>&1 | tee dependency-install.log
  else
    yarn install --frozen-lockfile 2>&1 | tee dependency-install.log
  fi
elif [ -f bun.lockb ] || [ -f bun.lock ]; then
  curl -fsSL https://bun.sh/install | bash
  export PATH="\$HOME/.bun/bin:\$PATH"
  bun install 2>&1 | tee dependency-install.log
elif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
  if [ "\${NB_LOCKFILE_POLICY:-regenerate}" = "preserved" ]; then
    npm ci --no-audit --no-fund 2>&1 | tee dependency-install.log
  else
    npm install --no-audit --no-fund 2>&1 | tee dependency-install.log
  fi
else
  npm install --no-audit --no-fund 2>&1 | tee dependency-install.log
fi`;

/** Web build, executed through the resilience runner. */
const RESILIENT_WEB_BUILD_SCRIPT = `set -o pipefail
echo "=== Building web project ==="
if [ -f nativeforge.static.json ]; then
  echo "[nativeforge] static-html marker found — running static copy -> www/"
  npm run build 2>&1
elif [ -f /tmp/nb-build-retry.cjs ]; then
  node /tmp/nb-build-retry.cjs 2>&1
else
  npm run build 2>&1
fi`;

/**
 * Runs a multi-line shell script through the retry loop controller. The script
 * is written to a file first so the whole thing is a single command the runner
 * can re-execute after applying a fix.
 */
function resilientShellStep(label: string, stepName: string, scriptBody: string, opts: { env?: string; file?: string } = {}): string {
  const file = opts.file ?? `nb-${stepName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.sh`;
  const indented = scriptBody
    .split("\n")
    .map((l) => (l.length ? `          ${l}` : ""))
    .join("\n");
  return `      - name: "${label}"
${opts.env ?? ""}        run: |
          cp "\$GITHUB_WORKSPACE/nb-resilience.cjs" ./nb-resilience.cjs 2>/dev/null || true
          cat > ${file} <<'NBSTEP'
${indented}
          NBSTEP
          ${NB_RUNNER} step "${stepName}" -- bash ${file}
`;
}

/** One-off checkpoint callback step. */
function resilienceEventStep(label: string, event: string, data = "{}", always = true): string {
  return `      - name: "${label}"
${always ? "        if: always()\n" : ""}        run: ${NB_RUNNER} event ${event} '${data}' || true
`;
}

/** COMPONENT 4 — always run after the web build, success or failure. */
function resilienceWebDirStep(label = "Resilience · resolve web output directory"): string {
  return `      - name: "${label}"
        if: always()
        run: ${NB_RUNNER} webdir
`;
}

/** Terminal callbacks. */
function resilienceResultSteps(): string {
  return `      - name: "Resilience · report success"
        if: success()
        run: ${NB_RUNNER} event build_success '{"artifact":"apk"}' || true

      - name: "Resilience · report failure"
        if: failure()
        run: ${NB_RUNNER} event build_failed '{}' || true
`;
}






// Normalize a project's configured web output directory (from the project
// index / framework detection) into a safe relative path usable in shell.
function sanitizeWebDir(dir?: string): string {
  if (!dir) return "";
  const cleaned = String(dir).trim().replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!cleaned || cleaned.includes("..")) return "";
  if (!/^[A-Za-z0-9._\-\/]+$/.test(cleaned)) return "";
  return cleaned;
}

interface CprHints {
  releaseId?: string;
  nodeVersion?: string;
  requiredNodeVersion?: string;
  capacitorVersion?: string;
  packageManagerVersion?: string;
  packageManager?: "npm" | "yarn" | "pnpm" | "bun";
  manifestChecksum?: string;
  lockfileChecksum?: string;
  lockfilePath?: string;
  lockfilePolicy?: "preserved" | "regenerate";
  appRoot?: string;
  buildCommand?: string;
  installCommand?: string;
  outputDir?: string;
  outputCandidates?: string[];
}

function sanitizeNodeVersion(v?: string): string {
  const major = String(v || "").match(/\d{2}/)?.[0];
  return major && ["20", "22", "24"].includes(major) ? major : PLATFORM_RELEASE.nodeVersion;
}

function sanitizeShellValue(v?: string): string {
  return String(v || "").replace(/["'`$\\\n\r]/g, "").slice(0, 200);
}

function getCapacitorSourceWorkflow(appName: string, packageName: string, plugins: string[], signingMode: string = "debug", keystorePassword: string = "android", keyAlias: string = "release-key", keyPassword: string = "android", versionCfg: VersionCfg = {}, webDirHint: string = "", defaultBranch: string = "main", cpr: CprHints = {}, cb: CallbackCfg = {}): string {
  const safeWebDir = sanitizeWebDir(webDirHint || cpr.outputDir || "");
  const safeWebDirCandidates = [...new Set([webDirHint, cpr.outputDir, ...(cpr.outputCandidates ?? [])].map((d) => sanitizeWebDir(d)).filter(Boolean))].join(",");
  const nodeVersion = sanitizeNodeVersion(cpr.requiredNodeVersion || cpr.nodeVersion);
  const cprRoot = sanitizeShellValue(cpr.appRoot);
  const cprBuild = sanitizeShellValue(cpr.buildCommand);
  const cprRelease = sanitizeShellValue(cpr.releaseId || PLATFORM_RELEASE.id);
  const lockfilePolicy = cpr.lockfilePolicy === "preserved" ? "preserved" : "regenerate";

  const vName = (versionCfg.versionName || "1.0.0").replace(/[^0-9A-Za-z._-]/g, "");
  const vCode = Number.isInteger(versionCfg.versionCode) && (versionCfg.versionCode as number) > 0 ? versionCfg.versionCode : 1;
  const minSdk = versionCfg.minSdk && versionCfg.minSdk >= 21 ? versionCfg.minSdk : 24;
  const tgtSdk = versionCfg.targetSdk && versionCfg.targetSdk >= 30 ? versionCfg.targetSdk : 36;
  const safeAppName = sanitizeForYaml(appName);
  const safePackageName = sanitizeForYaml(packageName);
  const pluginInstallStep = buildPluginInstallStep(plugins);
  const isRelease = signingMode === "release";
  const nonce = crypto.randomUUID();

  return `name: Build APK (Capacitor Source)

on:
  push:
    branches: [${JSON.stringify(defaultBranch)}]
  workflow_dispatch:

permissions:
  contents: read
  actions: write

env:
  CI: "true"
  NB_CPR_RELEASE: "${cprRelease}"
  NB_LOCKFILE_POLICY: "${lockfilePolicy}"
  NB_WEB_DIR: "${safeWebDir}"
  NB_WEB_DIR_CANDIDATES: "${safeWebDirCandidates}"
  NB_PROJECT_ROOT: "${cprRoot}"
  NB_BUILD_COMMAND: "${cprBuild}"
${resilienceEnv(cb)}
  VITE_SUPABASE_URL: "https://placeholder.supabase.co"
  VITE_SUPABASE_PUBLISHABLE_KEY: "placeholder"
  VITE_SUPABASE_ANON_KEY: "placeholder"
  VITE_SUPABASE_PROJECT_ID: "placeholder"

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Preflight diagnostics
        run: |
          echo "=== Preflight Diagnostics ==="
          echo "OS: \$(uname -a)"
          echo "Runner: \$RUNNER_OS"
          echo "ANDROID_HOME: \${ANDROID_HOME:-not set}"
          echo "Working directory: \$(pwd)"
          echo "Contents:"
          ls -la
          echo "Disk space:"
          df -h /
          echo "=== End Diagnostics ==="

      - name: Set up Node.js ${nodeVersion}
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'


      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Clean Gradle cache
        run: |
          rm -rf ~/.gradle/caches/jars-9 || true
          rm -rf ~/.gradle/caches/transforms-* || true
          echo "Gradle JAR and transform caches cleared"

      - name: Verify environment
        run: |
          echo "Node: \$(node --version)"
          echo "npm: \$(npm --version)"
          echo "Java: \$(java -version 2>&1 | head -1)"
          echo "ANDROID_HOME: \$ANDROID_HOME"

      - name: Extract source code
        run: |
          echo "=== Extracting source code ==="
          unzip -o source.zip -d project-src
          # Frontend-first project root picker. If root index.html exists and
          # package.json only exists in backend/server folders, treat this as a
          # static frontend and synthesize our own root package below.
          cat > /tmp/nativeforge-pick-root.cjs <<'NBROOT'
          const fs = require('fs');
          const path = require('path');
          const ROOT = 'project-src';
          const packageDirs = [];
          const htmlDirs = [];
          function walk(dir, depth) {
            if (depth > 4 || !fs.existsSync(dir)) return;
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
              if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.cache')) continue;
              const p = path.join(dir, e.name);
              if (e.isDirectory()) walk(p, depth + 1);
            }
            if (fs.existsSync(path.join(dir, 'package.json'))) packageDirs.push(dir);
            if (fs.existsSync(path.join(dir, 'index.html'))) htmlDirs.push(dir);
          }
          function rel(p) { return path.relative(ROOT, p).replace(/\\\\/g, '/'); }
          function hasRootHtmlWithoutRootPackage() {
            return fs.existsSync(path.join(ROOT, 'index.html')) && !fs.existsSync(path.join(ROOT, 'package.json'));
          }
          function isFrontendPackage(pkg) {
            const d = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
            const b = pkg.scripts && pkg.scripts.build || '';
            return Boolean(d['@capacitor/core'] || d.vite || d.react || d.vue || d['@angular/core'] || d.svelte || d.next || d.nuxt || d['@ionic/react'] || b.includes('vite') || b.includes('react-scripts') || b.includes('next') || b.includes('nuxt') || b.includes('ng build'));
          }
          function score(dir) {
            try {
              const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
              const d = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
              let x = 0;
              if (d['@capacitor/core']) x += 140;
              if (isFrontendPackage(pkg)) x += 90;
              if (pkg.scripts && pkg.scripts.build) x += 30;
              if (fs.existsSync(path.join(dir, 'index.html'))) x += 120;
              if (/\\/(backend|server|api)($|\\/)/i.test('/' + rel(dir) + '/')) x -= 120;
              if (Array.isArray(pkg.workspaces) || pkg.workspaces && pkg.workspaces.packages) x -= 160;
              x -= rel(dir).split('/').filter(Boolean).length * 25;
              return x;
            } catch (e) { return -999; }
          }
          walk(ROOT, 0);
          if (hasRootHtmlWithoutRootPackage()) {
            console.log(ROOT);
          } else if (packageDirs.length) {
            packageDirs.sort((a, b) => score(b) - score(a));
            console.log(packageDirs[0]);
          } else {
            htmlDirs.sort((a, b) => rel(a).split('/').length - rel(b).split('/').length);
            console.log(htmlDirs[0] || '');
          }
          NBROOT
          CPR_ROOT=""
          if [ -n "\${NB_PROJECT_ROOT:-}" ]; then
            for cand in "\$NB_PROJECT_ROOT" "project-src/\$NB_PROJECT_ROOT"; do
              if [ -d "\$cand" ] && { [ -f "\$cand/package.json" ] || [ -f "\$cand/index.html" ]; }; then CPR_ROOT="\$cand"; break; fi
            done
          fi
          if [ -n "\$CPR_ROOT" ]; then
            echo "\$CPR_ROOT" > .project-root.txt
            echo "[cpr] using blueprint app root: \$CPR_ROOT"
          else
            node /tmp/nativeforge-pick-root.cjs > .project-root.txt
          fi

          PROJECT_ROOT=\$(cat .project-root.txt); rm -f .project-root.txt
          if [ -n "\$PROJECT_ROOT" ]; then echo "[monorepo] picked workspace: \$PROJECT_ROOT"; fi

          if [ -z "\$PROJECT_ROOT" ]; then
            echo "ERROR: No package.json AND no index.html found in uploaded source!"
            exit 1
          fi
          if [ ! -f "\$PROJECT_ROOT/package.json" ]; then
            if [ ! -f "\$PROJECT_ROOT/index.html" ]; then
              echo "ERROR: Static project root has no index.html; refusing to synthesize a blank fallback."
              exit 1
            fi
            echo "Detected static HTML project at: \$PROJECT_ROOT (synthesizing package.json)"
            cat > "\$PROJECT_ROOT/nb-static-copy.cjs" <<'STATICCOPY'
          const fs=require('fs'),path=require('path');
          const EX=new Set(['node_modules','www','dist','build','android','ios','.git','package.json','package-lock.json','nb-static-copy.cjs','capacitor.config.ts','capacitor.config.js','capacitor.config.json']);
          fs.mkdirSync('www',{recursive:true});
          function cp(s,d){for(const e of fs.readdirSync(s,{withFileTypes:true})){if(EX.has(e.name)||e.name.startsWith('.'))continue;const sp=path.join(s,e.name),dp=path.join(d,e.name);if(e.isDirectory()){fs.mkdirSync(dp,{recursive:true});cp(sp,dp);}else fs.copyFileSync(sp,dp);}}
          cp('.','www');
          if(!fs.existsSync('www/index.html'))throw new Error('www/index.html missing after copy');
          console.log('static copy -> www');
          STATICCOPY
            cat > "\$PROJECT_ROOT/package.json" <<'STATICPKG'
          {
            "name": "static-html-app",
            "version": "1.0.0",
            "private": true,
            "nativeforge": { "type": "static-html" },
            "scripts": {
              "build": "node nb-static-copy.cjs"
            }
          }
          STATICPKG
            cat > "\$PROJECT_ROOT/nativeforge.static.json" <<'STATICMARKER'
          { "type": "static-html", "webDir": "www", "entry": "index.html", "generatedBy": "nativeforge-runner" }
          STATICMARKER
          fi
          echo "Found project root: \$PROJECT_ROOT"
          shopt -s dotglob
          cp -r "\$PROJECT_ROOT"/* ./ 2>/dev/null || true
          shopt -u dotglob
          rm -rf project-src source.zip
          echo "[cpr] preserving canonical Capacitor configuration"
          echo "=== Source extracted ==="
          ls -la
          echo "=== package.json contents ==="
          cat package.json | head -30


${resilienceInstallStep()}${depDoctorStep("Dependency doctor")}${resilientShellStep("Install dependencies (self-healing)", "Install dependencies", RESILIENT_INSTALL_SCRIPT)}${peerAuditStep("Install dependencies · peer dependency audit")}${postInstallStep("Install dependencies · post-install verification")}

${webDirResolveStep()}      - name: "Prepare CPR build retry runner"
        run: |
          ${buildRetryPrelude()}
${productionEnvironmentStep()}${resilientShellStep("Build web project (self-healing)", "Build web project", RESILIENT_WEB_BUILD_SCRIPT)}${buildIntegrityStep()}${resilienceWebDirStep()}${webDirReconcileStep("Reconcile web output directory")}

      - name: Lint check (advisory)
        run: |
          echo "=== Running lint check ==="
          npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 999 2>&1 || echo "Lint check reported issues (advisory)"
          echo "=== Lint check done ==="

      - name: TypeScript check (advisory)
        run: |
          echo "=== Running TypeScript check ==="
          npx tsc --noEmit 2>&1 || echo "TypeScript check reported issues (advisory)"
          echo "=== TypeScript check done ==="

      - name: Inject plugin config files
        run: |
          echo "=== Injecting plugin config files ==="
          if [ -f google-services.json ]; then
            mkdir -p android/app
            cp google-services.json android/app/google-services.json
            echo "Copied google-services.json to android/app/"
          fi
          if [ -f GoogleService-Info.plist ]; then
            echo "Found GoogleService-Info.plist (iOS config)"
          fi
          echo "=== Plugin config injection done ==="

      - name: Install Capacitor
        run: |
          echo "=== Detecting Capacitor version ==="
          CAP_VERSION=\$(node -e "try{const p=require('./package.json');console.log((p.dependencies&&p.dependencies['@capacitor/core'])||(p.devDependencies&&p.devDependencies['@capacitor/core'])||'${PLATFORM_RELEASE.capacitorVersion}')}catch(e){console.log('${PLATFORM_RELEASE.capacitorVersion}')}" | sed 's/[\\^~>=<]//g')
          echo "Using Capacitor version: \$CAP_VERSION"
          npm install @capacitor/core@\$CAP_VERSION @capacitor/cli@\$CAP_VERSION --legacy-peer-deps
          
          WEB_DIR=""
          for dir in \$NB_WEB_DIR dist build www out .output/public; do
            if [ -d "\$dir" ] && [ "\$(ls -A \$dir 2>/dev/null)" ]; then
              WEB_DIR="\$dir"
              break
            fi
          done
          
          if [ -z "\$WEB_DIR" ]; then
            echo "::error::No web build output found (dist/build/www/out/.output/public). Refusing to synthesize a blank index.html — this would ship a blank APK. Fix the build (or provide an index.html for static projects) and retry."
            exit 1
          fi
          
          echo "Using web-dir: \$WEB_DIR"
          if [ ! -f capacitor.config.ts ] && [ ! -f capacitor.config.js ] && [ ! -f capacitor.config.json ]; then
            npx cap init "${safeAppName}" "${safePackageName}" --web-dir "\$WEB_DIR"
          fi
          echo "=== Cap init complete ==="
          cat capacitor.config.ts 2>/dev/null || cat capacitor.config.json 2>/dev/null || echo "No cap config found"
          
          npm install @capacitor/android@\$CAP_VERSION --legacy-peer-deps
          if [ ! -d android ]; then npx cap add android; else npx cap sync android; fi
          echo "=== Capacitor initialized ==="
${pluginInstallStep}
      - name: Inject back button handler
        run: |
          echo "=== Injecting back button handler ==="
          npm install @capacitor/app --legacy-peer-deps || echo "capacitor/app already present"
          MAIN_FILE=\$(find . -name "main.ts" -o -name "main.tsx" -o -name "index.ts" -o -name "index.tsx" | grep -v node_modules | head -1)
          if [ -n "\$MAIN_FILE" ]; then
            cat >> "\$MAIN_FILE" << 'BACKBUTTON'

          // Auto-injected: Capacitor back button handler
          import { App as CapApp } from '@capacitor/app';
          CapApp.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) { window.history.back(); }
            else { CapApp.exitApp(); }
          });
          BACKBUTTON
            echo "Back button handler injected into \$MAIN_FILE"
          else
            echo "No main entry file found, skipping back button injection"
          fi
          echo "=== Back button injection complete ==="

      - name: NativeBridge — Generate Exact-Size Android Assets
        run: |
          echo "=== NativeBridge custom asset generator ==="
          if [ ! -f icon.png ]; then
            echo "No icon.png found — skipping (Capacitor defaults will be used)."
            exit 0
          fi
          npm install --save-dev sharp --legacy-peer-deps || {
            echo "sharp install failed — leaving Capacitor default icons in place."
            exit 0
          }
          mkdir -p scripts
          cat > scripts/nativebridge-generate-android-assets.cjs <<'NBASSETS'
${indentBlock(getAssetGeneratorScript(), 10)}
          NBASSETS
          SPLASH_ARG=""; [ -f splash.png ] && SPLASH_ARG="--splash splash.png"
          FG_ARG=""; [ -f icon_fg.png ] && FG_ARG="--foreground icon_fg.png"
          node scripts/nativebridge-generate-android-assets.cjs --source icon.png \$FG_ARG \$SPLASH_ARG --res android/app/src/main/res || echo "Asset generator returned non-zero (continuing)"
          echo "=== Asset generation complete ==="
          find android/app/src/main/res/mipmap-* -type f 2>/dev/null | head -20 || echo "No mipmap files found"
          # Deduplicate launcher resources (PNG wins over XML) to avoid mergeDebugResources duplicate-resource errors
          find android/app/src/main/res -type d \\( -name 'drawable*' -o -name 'mipmap*' \\) 2>/dev/null | while IFS= read -r dir; do
            for base in ic_launcher_background ic_launcher_foreground ic_launcher ic_launcher_round; do
              if [ -f "\$dir/\$base.png" ] && [ -f "\$dir/\$base.xml" ]; then
                echo "[dedup] Removing \$dir/\$base.xml (PNG takes precedence)"
                rm -f "\$dir/\$base.xml"
              fi
            done
          done || true

      - name: NativeBridge — Apply Appearance Config
        run: |
          if [ ! -f appearance.json ]; then echo "No appearance.json — skipping"; exit 0; fi
          if [ -f splash.png ]; then
            for d in drawable drawable-port-mdpi drawable-port-hdpi drawable-port-xhdpi drawable-port-xxhdpi drawable-port-xxxhdpi drawable-land-mdpi drawable-land-hdpi drawable-land-xhdpi drawable-land-xxhdpi drawable-land-xxxhdpi; do
              [ -d "android/app/src/main/res/\$d" ] && cp splash.png "android/app/src/main/res/\$d/splash.png" || true
            done
          fi
          cat > /tmp/apply-appearance.cjs <<'NBAPP'
          const fs=require("fs"),path=require("path"),{execSync}=require("child_process");
          const cfg=JSON.parse(fs.readFileSync("appearance.json","utf8"));
          const sb=cfg.statusBar||{},sp=cfg.splash||{},ee=cfg.edgeToEdge||{};
          const drawsBehind=ee.enabled&&ee.mode!=="status-bar-tint";
          const wc=(dir,bg)=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"colors.xml"),'<?xml version="1.0" encoding="utf-8"?>\\n<resources>\\n  <color name="colorPrimary">'+(sb.color||"#000000")+'</color>\\n  <color name="colorPrimaryDark">'+(sb.color||"#000000")+'</color>\\n  <color name="colorAccent">'+(sb.color||"#000000")+'</color>\\n  <color name="ic_launcher_background">'+bg+'</color>\\n  <color name="splash_background">'+bg+'</color>\\n</resources>\\n');};
          wc("android/app/src/main/res/values",sp.bg||"#FFFFFF");
          wc("android/app/src/main/res/values-night",sp.bgDark||"#000000");
          const sp2="android/app/src/main/res/values/styles.xml";
          if(fs.existsSync(sp2)){let s=fs.readFileSync(sp2,"utf8");const lb='<item name="android:windowLightStatusBar">'+(sb.style==="dark"?"true":"false")+'</item>';const cb='<item name="android:statusBarColor">'+(sb.color||"#000000")+'</item>';s=s.replace(/<item name="android:statusBarColor">[\\s\\S]*?<\\/item>/g,"").replace(/<item name="android:windowLightStatusBar">[\\s\\S]*?<\\/item>/g,"");s=s.replace(/(<style name="AppTheme\\.NoActionBar"[^>]*>)/, "\$1\\n        "+cb+"\\n        "+lb);fs.writeFileSync(sp2,s);}
          const cap=["capacitor.config.ts","capacitor.config.json"].find(f=>fs.existsSync(f));
          if(cap&&!fs.readFileSync(cap,"utf8").includes("nativebridge-appearance")){let c=fs.readFileSync(cap,"utf8");const block='/* nativebridge-appearance */\\n  plugins: {\\n    StatusBar: { style: "'+((sb.style||"DEFAULT")+"").toUpperCase()+'", backgroundColor: "'+(sb.color||"#000000")+'", overlaysWebView: '+(drawsBehind?"true":"false")+' },\\n    SplashScreen: { launchShowDuration: '+(sp.durationMs||3000)+', backgroundColor: "'+(sp.bg||"#FFFFFF")+'", androidSplashResourceName: "splash", showSpinner: false }\\n  },';c=c.replace(/(appName:\\s*['"][^'"]+['"]\\s*,)/,"\$1\\n  "+block);fs.writeFileSync(cap,c);}
          if(drawsBehind){try{const bg="android/app/build.gradle";if(fs.existsSync(bg)){let g=fs.readFileSync(bg,"utf8");if(!g.includes("androidx.core:core")){const dep=g.includes("$androidxCoreVersion")?'    implementation "androidx.core:core:$androidxCoreVersion"':'    implementation "androidx.core:core:1.15.0"';g=g.replace(/(dependencies\\s*\\{)/,"$1\\n"+dep);fs.writeFileSync(bg,g);}}const main=execSync("find android/app/src -name MainActivity.java -o -name MainActivity.kt | head -1",{encoding:"utf8"}).trim();if(main){let m=fs.readFileSync(main,"utf8");m=m.replace(/\\n\\s*\\/\\/ True native edge-to-edge[\\s\\S]*?\\n\\s*WindowCompat\\.setDecorFitsSystemWindows\\(getWindow\\(\\),\\s*false\\);/g,"").replace(/\\n\\s*WindowCompat\\.setDecorFitsSystemWindows\\(getWindow\\(\\),\\s*false\\);/g,"");if(main.endsWith(".java")){if(!m.includes("import android.os.Bundle;"))m=m.replace(/(package\\s+[^;]+;\\s*)/,"$1\\nimport android.os.Bundle;\\n");if(!m.includes("import androidx.core.view.WindowCompat;"))m=m.replace(/(package\\s+[^;]+;\\s*)/,"$1\\nimport androidx.core.view.WindowCompat;\\n");m=m.replace(/(super\\.onCreate\\(savedInstanceState\\);)/,"$1\\n        // True native edge-to-edge. super.onCreate(...) must run first so Capacitor creates the WebView.\\n        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);");}else{if(!m.includes("androidx.core.view.WindowCompat"))m=m.replace("import com.getcapacitor.BridgeActivity","import com.getcapacitor.BridgeActivity\\nimport androidx.core.view.WindowCompat");m=m.replace(/(super\\.onCreate\\(savedInstanceState\\))/,"$1\\n        WindowCompat.setDecorFitsSystemWindows(window, false)");}fs.writeFileSync(main,m);console.log("true edge-to-edge applied:",main);}}catch(e){console.warn(e.message);}}
          console.log("Appearance applied.");
          NBAPP
          node /tmp/apply-appearance.cjs || echo "Appearance step warning (non-fatal)"

      - name: NativeBridge — Pre-sync hardening (strip server.url, relativize + viewport-inject index.html)
        run: |
          cat > /tmp/nb-presync.cjs <<'NBPRESYNC'
          const fs=require('fs'),path=require('path');
          // 1) Strip any dev server.url from capacitor.config — leaking it makes the APK blank offline.
          for (const f of ['capacitor.config.ts','capacitor.config.js','capacitor.config.json']) {
            if (!fs.existsSync(f)) continue;
            let s=fs.readFileSync(f,'utf8');
            const before=s;
            s=s.replace(/server\\s*:\\s*\\{[^}]*\\}\\s*,?/g,'');
            s=s.replace(/"server"\\s*:\\s*\\{[^}]*\\}\\s*,?/g,'');
            if (s!==before){fs.writeFileSync(f,s);console.log('[presync] stripped server.* from',f);}
          }
          // 2) Normalize each built web output's index.html:
          //    - rewrite /assets/* → ./assets/* (works when webDir base is not '/')
          //    - inject viewport meta if missing (WebView otherwise renders at 980px)
          //    - inject html,body,#root{height:100%} so flex-fill apps don't collapse to 0px
          for (const dir of [process.env.NB_WEB_DIR||'dist','dist','build','www','out','.output/public','public']){
            const idx=path.join(dir,'index.html');
            if (!fs.existsSync(idx)) continue;
            let h=fs.readFileSync(idx,'utf8');
            const before=h;
            h=h.replace(/(src|href)="\\/(?!\\/)/g,'$1="./');
            if (!/<meta[^>]+name=["']viewport["']/i.test(h)) {
              h=h.replace(/<head[^>]*>/i, m => m + '\\n    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
              console.log('[presync] injected viewport meta in',idx);
            }
            if (!/nb-root-height/.test(h)) {
              h=h.replace(/<\\/head>/i, '  <style id="nb-root-height">html,body,#root,#__next{height:100%;margin:0}</style>\\n  </head>');
              console.log('[presync] injected root height css in',idx);
            }
            if (h!==before){fs.writeFileSync(idx,h);console.log('[presync] normalized',idx);}
          }
          NBPRESYNC
          node /tmp/nb-presync.cjs || echo "presync warning (non-fatal)"

      - name: NativeBridge — Verify web output (blank-screen guard)
        run: |
          cat > /tmp/nb-verify-web.cjs <<'NBVERIFY'
          const fs=require('fs'),path=require('path');
          const dirs=[process.env.NB_WEB_DIR||'dist','dist','build','www','out','.output/public'];
          const found=dirs.find(d=>fs.existsSync(path.join(d,'index.html')));
          if(!found){console.error('[verify-web] FAIL: no index.html in any expected output dir ('+dirs.join(', ')+')');process.exit(2);}
          const idx=path.join(found,'index.html');
          const html=fs.readFileSync(idx,'utf8');
          const hasRoot=/id=["'](root|app|__next|__nuxt)["']/.test(html);
          const hasScript=/<script[^>]+src=/.test(html);
          const hasViewport=/<meta[^>]+name=["']viewport["']/i.test(html);
          const assetsDir=path.join(found,'assets');
          const assetCount=fs.existsSync(assetsDir)?fs.readdirSync(assetsDir).length:0;
          console.log('[verify-web] output='+found+' scripts='+hasScript+' mount='+hasRoot+' viewport='+hasViewport+' assets='+assetCount);
          const problems=[];
          if(!hasRoot) problems.push('no mount element (<div id="root">) — createRoot will crash silently');
          if(!hasScript) problems.push('no <script src=…> tag — bundler output missing');
          if(assetCount===0) problems.push('assets/ folder empty — bundle likely failed');
          if(problems.length){console.error('[verify-web] FAIL:\\n - '+problems.join('\\n - '));process.exit(3);}
          console.log('[verify-web] OK: web output looks renderable');
          NBVERIFY
          node /tmp/nb-verify-web.cjs


${resilientStep("Sync Capacitor (self-healing)", "Capacitor sync", "npx cap sync android")}

      - name: NativeBridge — Post-sync smoke check (fail fast on blank APK)
        run: |
          ASSETS=android/app/src/main/assets/public
          IDX="\$ASSETS/index.html"
          if [ ! -f "\$IDX" ]; then echo "::error::No index.html in \$ASSETS — APK will be blank."; exit 1; fi
          if ! grep -qE '<script[ >]' "\$IDX"; then
            echo "::warning::index.html has no <script> tags — likely blank APK. (Static HTML projects: ignore if intentional.)"
          fi
          BYTES=\$(wc -c < "\$IDX")
          echo "[smoke] index.html=\$BYTES bytes"
          if [ "\$BYTES" -lt 80 ]; then echo "::error::index.html is essentially empty (\$BYTES bytes) — failing build to avoid shipping a blank APK."; exit 1; fi
          # Verify each referenced local asset actually exists on disk.
          MISSING=0
          for ref in \$(grep -oE '(src|href)="[^"]+"' "\$IDX" | sed -E 's/.*="([^"]+)"/\\1/' | grep -vE '^(https?:|data:|#|mailto:)'); do
            REL=\$(echo "\$ref" | sed 's|^\\./||; s|^/||')
            if [ -n "\$REL" ] && [ ! -e "\$ASSETS/\$REL" ]; then
              echo "::warning::Asset referenced by index.html missing in bundle: \$REL"
              MISSING=\$((MISSING+1))
            fi
          done
          [ "\$MISSING" -gt 0 ] && echo "[smoke] \$MISSING missing asset(s) — APK may render blank." || echo "[smoke] all referenced assets present."



      - name: Install Android SDK platforms
        run: |
          echo "=== Installing Android SDK build-tools ==="
          \$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --install "platforms;android-36" "build-tools;36.0.0"
          echo "=== SDK setup complete ==="

      - name: Cache Gradle dependencies
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: gradle-\${{ runner.os }}-\${{ hashFiles('android/**/*.gradle*', 'android/gradle/wrapper/gradle-wrapper.properties') }}
          restore-keys: |
            gradle-\${{ runner.os }}-

      - name: Cache npm dependencies
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: npm-\${{ runner.os }}-\${{ hashFiles('package-lock.json') }}
          restore-keys: |
            npm-\${{ runner.os }}-

      - name: Patch SDK versions and Gradle wrapper
        run: |
          echo "=== Overwriting android/variables.gradle with versionMatrix values ==="
          printf '%s\\n' 'ext {' '    minSdkVersion = ${minSdk}' '    compileSdkVersion = ${tgtSdk}' '    targetSdkVersion = ${tgtSdk}' "    androidxActivityVersion = '1.9.3'" "    androidxAppCompatVersion = '1.7.0'" "    androidxCoordinatorLayoutVersion = '1.2.0'" "    androidxCoreVersion = '1.15.0'" "    androidxFragmentVersion = '1.8.5'" "    coreSplashScreenVersion = '1.0.1'" "    androidxWebkitVersion = '1.12.1'" "    junitVersion = '4.13.2'" "    androidxJunitVersion = '1.2.1'" "    androidxEspressoCoreVersion = '3.6.1'" "    cordovaAndroidVersion = '10.1.1'" '}' > android/variables.gradle
          echo "=== variables.gradle overwritten ==="
          cat android/variables.gradle

          echo "=== Patching compileSdk/minSdk/targetSdk + versionCode/versionName in all build.gradle files ==="
          BUILD_GRADLE_FILES=\$(find android -type f -name "build.gradle")
          if [ -z "\$BUILD_GRADLE_FILES" ]; then
            echo "WARNING: No build.gradle files found under android/"
          else
            while IFS= read -r file; do
              sed -i -E \\
                -e 's/compileSdk[[:space:]]+[0-9]+/compileSdk ${tgtSdk}/g' \\
                -e 's/compileSdkVersion[[:space:]]+[0-9]+/compileSdkVersion ${tgtSdk}/g' \\
                -e 's/minSdk[[:space:]]+[0-9]+/minSdk ${minSdk}/g' \\
                -e 's/minSdkVersion[[:space:]]+[0-9]+/minSdkVersion ${minSdk}/g' \\
                -e 's/targetSdk[[:space:]]+[0-9]+/targetSdk ${tgtSdk}/g' \\
                -e 's/targetSdkVersion[[:space:]]+[0-9]+/targetSdkVersion ${tgtSdk}/g' \\
                -e 's/versionCode[[:space:]]+[0-9]+/versionCode ${vCode}/g' \\
                -e 's/versionName[[:space:]]+"[^"]*"/versionName "${vName}"/g' \\
                "\$file" || echo "Warning: SDK patch failed for \$file"
            done <<< "\$BUILD_GRADLE_FILES"
          fi
          
          if [ -f android/gradle/wrapper/gradle-wrapper.properties ]; then
            sed -i 's|distributionUrl=.*|distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip|' android/gradle/wrapper/gradle-wrapper.properties
            echo "=== Patched Gradle wrapper ==="
            cat android/gradle/wrapper/gradle-wrapper.properties
          fi
          
          echo "=== Printing app/build.gradle for diagnostics ==="
          cat android/app/build.gradle

      - name: ${isRelease ? "Build Release APK" : "Build Debug APK"}
        working-directory: android
${isRelease ? `        env:
          KEYSTORE_PASSWORD: '${sanitizeForYaml(keystorePassword)}'
          KEY_ALIAS: '${sanitizeForYaml(keyAlias)}'
          KEY_PASSWORD: '${sanitizeForYaml(keyPassword)}'
` : ""}        run: |
          chmod +x gradlew
          echo "=== Building APK with Gradle ==="
${isRelease ? `          # Decode keystore if provided
          if [ -f ../keystore.b64 ]; then
            base64 -d ../keystore.b64 > release.keystore
            echo "=== Release keystore decoded ==="
          else
            echo "=== Generating debug-signed release keystore ==="
            keytool -genkeypair -v -keystore release.keystore \\
              -alias "\$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \\
              -storepass "\$KEYSTORE_PASSWORD" -keypass "\$KEY_PASSWORD" \\
              -dname "CN=NativeBridge, O=NativeBridge, L=Unknown, ST=Unknown, C=US"
          fi
          cat > key.properties <<KEYPROPS
          storeFile=release.keystore
          storePassword=\$KEYSTORE_PASSWORD
          keyAlias=\$KEY_ALIAS
          keyPassword=\$KEY_PASSWORD
          KEYPROPS
          if ! grep -q "NativeBridge signing config" app/build.gradle; then
            cat >> app/build.gradle <<'SIGNING'

          // NativeBridge signing config
          def keystoreProperties = new Properties()
          def keystorePropertiesFile = rootProject.file('key.properties')
          if (keystorePropertiesFile.exists()) {
              keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
          }

          android {
              signingConfigs {
                  if (findByName("release") == null) {
                      create("release")
                  }
                  release {
                      storeFile rootProject.file(keystoreProperties["storeFile"] ?: "release.keystore")
                      storePassword keystoreProperties["storePassword"]
                      keyAlias keystoreProperties["keyAlias"]
                      keyPassword keystoreProperties["keyPassword"]
                  }
              }
              buildTypes {
                  release {
                      signingConfig signingConfigs.release
                  }
              }
          }
          SIGNING
          fi
          echo "=== Release signing configured ==="
          node "\$GITHUB_WORKSPACE/nb-resilience.cjs" step "Gradle build" -- ./gradlew assembleRelease --no-daemon --stacktrace
` : `          node "\$GITHUB_WORKSPACE/nb-resilience.cjs" step "Gradle build" -- ./gradlew assembleDebug --no-daemon --stacktrace
`}          echo "=== APK Build complete ==="

      - name: ${isRelease ? "Build Release AAB" : "Build Debug AAB"}
        working-directory: android
        run: |
          echo "=== Building AAB ==="
${isRelease ? `          ./gradlew bundleRelease --no-daemon --stacktrace
` : `          ./gradlew bundleDebug --no-daemon --stacktrace
`}          echo "=== AAB Build complete ==="

${resilienceEventStep("Resilience · gradle complete", "gradle_complete", '{"succeeded":true}')}${resilienceEventStep("Resilience · signing started", "signing_started")}      - name: Extract Signing Key Fingerprints
        if: always()
        working-directory: android
        run: |
          echo "=== Extracting Signing Key Fingerprints ==="
          KEYSTORE_FILE=""
          if [ -f "release.keystore" ]; then
            KEYSTORE_FILE="release.keystore"
          else
            KEYSTORE_FILE=\$(find . -name "debug.keystore" -o -name "*.jks" -o -name "*.keystore" 2>/dev/null | head -1)
          fi
          if [ -n "\$KEYSTORE_FILE" ]; then
            STORE_PASS="android"
            if [ -f "key.properties" ]; then
              STORE_PASS=\$(grep '^storePassword=' key.properties | cut -d= -f2-)
            fi
            echo "--- SHA-1 ---"
            keytool -list -v -keystore "\$KEYSTORE_FILE" -storepass "\$STORE_PASS" 2>/dev/null | grep "SHA1:" || echo "N/A"
            echo "--- SHA-256 ---"
            keytool -list -v -keystore "\$KEYSTORE_FILE" -storepass "\$STORE_PASS" 2>/dev/null | grep "SHA256:" || echo "N/A"
            echo "--- MD5 ---"
            keytool -list -v -keystore "\$KEYSTORE_FILE" -storepass "\$STORE_PASS" 2>/dev/null | grep "MD5:" || echo "N/A"
            base64 -w 0 "\$KEYSTORE_FILE" > ../keystore-export.b64 2>/dev/null || echo "Keystore export skipped"
          else
            echo "No keystore found"
          fi

      - name: Upload Keystore
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: keystore-export
          path: keystore-export.b64
          retention-days: 30
          if-no-files-found: warn

${resilienceEventStep("Resilience · signing complete", "signing_complete")}${resilienceEventStep("Resilience · upload started", "upload_started")}      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: ${isRelease ? "release-apk" : "debug-apk"}
          path: android/app/build/outputs/apk/${isRelease ? "release" : "debug"}/*.apk
          retention-days: 7
          if-no-files-found: error
${resilienceEventStep("Resilience · upload complete", "upload_complete")}
      - name: Upload AAB
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ${isRelease ? "release-aab" : "debug-aab"}
          path: android/app/build/outputs/bundle/${isRelease ? "release" : "debug"}/*.aab
          retention-days: 7
          if-no-files-found: warn
${resilienceResultSteps()}# build-nonce: ${nonce}
`;
}

/**
 * Phase 1 Setup Workflow — installs deps, Capacitor + plugins, caches.
 */
function getSetupWorkflow(appName: string, packageName: string, plugins: string[], webDirHint: string = "", defaultBranch: string = "main", cpr: CprHints = {}): string {
  const safeWebDir = sanitizeWebDir(webDirHint || cpr.outputDir || "");
  const safeWebDirCandidates = [...new Set([webDirHint, cpr.outputDir, ...(cpr.outputCandidates ?? [])].map((d) => sanitizeWebDir(d)).filter(Boolean))].join(",");
  const nodeVersion = sanitizeNodeVersion(cpr.requiredNodeVersion || cpr.nodeVersion);
  const cprRelease = sanitizeShellValue(cpr.releaseId || PLATFORM_RELEASE.id);
  const manifestChecksum = sanitizeShellValue(cpr.manifestChecksum);
  const lockfileChecksum = sanitizeShellValue(cpr.lockfileChecksum);
  const lockfilePath = sanitizeShellValue(cpr.lockfilePath);
  const packageManager = ["npm", "yarn", "pnpm", "bun"].includes(cpr.packageManager || "") ? cpr.packageManager : "npm";
  const lockfilePolicy = cpr.lockfilePolicy === "preserved" ? "preserved" : "regenerate";
  const pluginInstallStep = buildPluginInstallStep(plugins);
  const nonce = crypto.randomUUID();
  return `name: Phase 1 - Setup
on:
  push:
    branches: [${JSON.stringify(defaultBranch)}]
  workflow_dispatch:
permissions:
  contents: read
env:
  CI: "true"
  NB_WEB_DIR: "${safeWebDir}"
  NB_WEB_DIR_CANDIDATES: "${safeWebDirCandidates}"
  NB_CPR_RELEASE: "${cprRelease}"
  NB_LOCKFILE_POLICY: "${lockfilePolicy}"
  NB_EXPECTED_MANIFEST_SHA256: "${manifestChecksum}"
  NB_EXPECTED_LOCKFILE_SHA256: "${lockfileChecksum}"
  NB_EXPECTED_LOCKFILE_PATH: "${lockfilePath}"
  NB_PACKAGE_MANAGER: "${packageManager}"
jobs:
  setup:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - name: "Phase 1 - Set up Node.js ${nodeVersion}"
        uses: actions/setup-node@v4
        with:
          node-version: "${nodeVersion}"
      - name: "Phase 1 - Set up JDK 21"
        uses: actions/setup-java@v4
        with:
          java-version: "21"
          distribution: "temurin"
      - name: "Phase 1 - Extract source code"
        run: |
          unzip -o source.zip -d project-src
          node -e "const fs=require('fs'),path=require('path');function walk(d,depth,out){if(depth>3||!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,depth+1,out);}if(fs.existsSync(path.join(d,'package.json')))out.push(d);}const c=[];walk('project-src',0,c);function s(p){try{const j=JSON.parse(fs.readFileSync(path.join(p,'package.json'),'utf8'));const d={...j.dependencies,...j.devDependencies};let x=0;if(d['@capacitor/core'])x+=100;if(j.scripts&&j.scripts.build)x+=50;if(d.vite||d.next||d['react-scripts']||d['@angular/core']||d.nuxt||d.svelte)x+=20;if(Array.isArray(j.workspaces))x-=200;return x-p.split('/').length;}catch(e){return -999;}}c.sort((a,b)=>s(b)-s(a));console.log(c[0]||'');" > .pr.txt
          PROJECT_ROOT=\$(cat .pr.txt); rm -f .pr.txt
          if [ -z "\$PROJECT_ROOT" ]; then
            STATIC_ENTRY=\$(find project-src -maxdepth 5 -type f \\( -iname "index.html" -o -iname "home.html" -o -iname "main.html" -o -iname "*.html" \\) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/www/*" | sort | head -1)
            STATIC_ROOT=\$(dirname "\$STATIC_ENTRY")
            if [ -z "\$STATIC_ENTRY" ]; then echo "No package.json and no HTML entry in source.zip"; exit 1; fi
            PROJECT_ROOT="\$STATIC_ROOT"
            echo "Static HTML detected → synthesizing package.json at \$PROJECT_ROOT"
            cat > "\$PROJECT_ROOT/nb-static-copy.cjs" <<'STATICCOPY'
          const fs=require('fs'),path=require('path');
          fs.mkdirSync('www',{recursive:true});
          function cp(s,d){for(const e of fs.readdirSync(s,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='www'||e.name==='dist'||e.name==='android'||e.name==='ios'||e.name==='nb-static-copy.cjs'||e.name.startsWith('.'))continue;const sp=path.join(s,e.name),dp=path.join(d,e.name);if(e.isDirectory()){fs.mkdirSync(dp,{recursive:true});cp(sp,dp);}else fs.copyFileSync(sp,dp);}}
          cp('.','www');
          if(!fs.existsSync('www/index.html')){const source=['home.html','main.html'].find(f=>fs.existsSync(f))||fs.readdirSync('.').find(f=>/\\.html?$/i.test(f));if(!source)throw new Error('No HTML entry');fs.copyFileSync(source,'www/index.html');}
          console.log('static copy -> www');
          STATICCOPY
            cat > "\$PROJECT_ROOT/package.json" <<'STATICPKG'
          {"name":"static-html-app","version":"1.0.0","private":true,"scripts":{"build":"node nb-static-copy.cjs"}}
          STATICPKG
            touch /tmp/nb-synthetic-manifest
          fi
          shopt -s dotglob
          cp -r "\$PROJECT_ROOT"/* ./ 2>/dev/null || true
          shopt -u dotglob
          rm -rf project-src source.zip
          echo "[cpr] preserving canonical Capacitor configuration"

      - name: "Phase 1 - Verify CPR dependency contract"
        run: |
          set -euo pipefail
          ACTUAL_MANIFEST_SHA256="$(sha256sum package.json | awk '{print $1}')"
          LOCKFILE=""
          for candidate in package-lock.json npm-shrinkwrap.json pnpm-lock.yaml yarn.lock bun.lock bun.lockb; do
            if [ -f "$candidate" ]; then LOCKFILE="$candidate"; break; fi
          done
          {
            echo "CPR release: $NB_CPR_RELEASE"
            echo "Package manager: $NB_PACKAGE_MANAGER"
            echo "Lockfile policy: $NB_LOCKFILE_POLICY"
            echo "Manifest SHA-256: $ACTUAL_MANIFEST_SHA256"
            echo "Expected manifest SHA-256: \${NB_EXPECTED_MANIFEST_SHA256:-not-sealed}"
            echo "Lockfile: \${LOCKFILE:-missing}"
            if [ -n "$LOCKFILE" ]; then echo "Lockfile SHA-256: $(sha256sum "$LOCKFILE" | awk '{print $1}')"; fi
            echo "Node: $(node --version)"
            echo "npm: $(npm --version)"
          } | tee cpr-dependency-contract.log
          DRIFTED=0
          if [ -f /tmp/nb-synthetic-manifest ]; then
            echo "::notice::Manifest was synthesized for a static HTML project — checksum seal not applicable."
            DRIFTED=1
          elif [ -n "$NB_EXPECTED_MANIFEST_SHA256" ] && [ "$ACTUAL_MANIFEST_SHA256" != "$NB_EXPECTED_MANIFEST_SHA256" ]; then
            echo "::warning::CPR manifest checksum drifted (plugins were toggled after the seal). Continuing with the manifest that shipped with this build."
            echo "--- package.json dependencies ---"
            node -e "const p=require('./package.json');console.log(JSON.stringify({dependencies:p.dependencies||{},devDependencies:p.devDependencies||{}},null,2))" | tee -a cpr-dependency-contract.log
            DRIFTED=1
          fi

          if [ "$NB_LOCKFILE_POLICY" = "preserved" ] && [ -z "$LOCKFILE" ]; then
            echo "::warning::Lockfile marked preserved but missing — regenerating it during install."
            DRIFTED=1
          fi
          if [ -n "$NB_EXPECTED_LOCKFILE_PATH" ] && [ "$LOCKFILE" != "$NB_EXPECTED_LOCKFILE_PATH" ]; then
            echo "::warning::CPR expected lockfile $NB_EXPECTED_LOCKFILE_PATH but found \${LOCKFILE:-none} — regenerating."
            DRIFTED=1
          fi
          if [ -n "$NB_EXPECTED_LOCKFILE_SHA256" ] && [ -n "$LOCKFILE" ] && [ "$(sha256sum "$LOCKFILE" | awk '{print $1}')" != "$NB_EXPECTED_LOCKFILE_SHA256" ]; then
            echo "::warning::Lockfile drifted from the sealed dependency graph — it will be regenerated from package.json."
            DRIFTED=1
          fi
          # A drifted graph can never satisfy "npm ci"; force a regeneration so
          # newly enabled plugins are actually installed.
          if [ "$DRIFTED" = "1" ]; then echo "NB_LOCKFILE_POLICY=regenerate" >> "$GITHUB_ENV"; fi



${depDoctorStep("Phase 1 - Dependency doctor")}${smartInstallStep("Phase 1 - Install npm dependencies")}

      - name: "Phase 1 - Upload CPR dependency diagnostics"
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: cpr-dependency-diagnostics
          path: |
            cpr-dependency-contract.log
            dependency-install.log
            package.json
            package-lock.json
            npm-shrinkwrap.json
            pnpm-lock.yaml
            yarn.lock
            bun.lock
            bun.lockb
          if-no-files-found: warn
          retention-days: 7

      - name: "Phase 1 - Install Capacitor + build web output"
        run: |
          CAP_VERSION=\$(node -e "try{const p=require('./package.json');console.log((p.dependencies&&p.dependencies['@capacitor/core'])||(p.devDependencies&&p.devDependencies['@capacitor/core'])||'${PLATFORM_RELEASE.capacitorVersion}')}catch(e){console.log('${PLATFORM_RELEASE.capacitorVersion}')}" | sed 's/[\\^~>=<]//g')
          node -e "for(const p of ['@capacitor/core','@capacitor/cli','@capacitor/android']){try{require.resolve(p+'/package.json')}catch(e){process.exit(1)}}" || npm install @capacitor/core@\$CAP_VERSION @capacitor/cli@\$CAP_VERSION @capacitor/android@\$CAP_VERSION --legacy-peer-deps --no-audit --no-fund
          ${buildRetryPrelude()}
          if ! node /tmp/nb-build-retry.cjs; then
            echo "Web build failed after CPR retries and no validated output was produced"; exit 1
          fi
${webDirReconcileStep("Phase 1 - Reconcile web output directory")}      - name: "Phase 1 - Add Android platform"
        run: |
          WEB_DIR="\${NB_WEB_DIR:-www}"
          if [ ! -f capacitor.config.ts ] && [ ! -f capacitor.config.js ] && [ ! -f capacitor.config.json ]; then
            npx cap init "${sanitizeForYaml(appName)}" "${sanitizeForYaml(packageName)}" --web-dir "\$WEB_DIR"
          fi
          if [ ! -d android ]; then npx cap add android; else npx cap sync android; fi

${pluginInstallStep}
      - name: "Phase 1 - Generate manifest"
        run: |
          cat > /tmp/gen-manifest.cjs <<'GENMANIFEST'
          const fs = require('fs');
          const path = require('path');
          const p = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
          const deps = { ...(p.dependencies || {}), ...(p.devDependencies || {}) };
          let report = '';
          try { report = fs.readFileSync('plugin-install-report.txt', 'utf8'); } catch (e) {}
          const reportLines = report.split('\\n').filter(Boolean);
          const pluginsInstalled = reportLines.filter(l => l.startsWith('OK ')).map(l => l.slice(3).trim());
          const pluginsFailed    = reportLines.filter(l => l.startsWith('FAIL ')).map(l => l.slice(5).trim());
          const pluginsSkipped   = reportLines.filter(l => l.startsWith('SKIP ')).map(l => l.slice(5).trim());
          const m = {
            appRoot: './',
            installedDeps: Object.keys(p.dependencies || {}).map(k => k + '@' + p.dependencies[k]),
            installedDevDeps: Object.keys(p.devDependencies || {}).map(k => k + '@' + p.devDependencies[k]),
            plugins: Object.keys(deps).filter(k => k.startsWith('@capacitor/') || k.startsWith('capacitor-') || k.startsWith('@capawesome/') || k.includes('cordova-plugin')),
            pluginsInstalled, pluginsFailed, pluginsSkipped,
            hasAndroidFolder: fs.existsSync('android'),
            buildOutputDir: process.env.NB_WEB_DIR || (fs.existsSync('www/index.html') ? 'www' : (fs.existsSync('dist/index.html') ? 'dist' : 'build')),
          };
          fs.writeFileSync('phase1-manifest.json', JSON.stringify(m, null, 2));
          console.log(JSON.stringify(m, null, 2));
          GENMANIFEST
          node /tmp/gen-manifest.cjs
      - name: "Phase 1 - Bundle source artifact"
        run: |
          mkdir -p phase1-out
          cp package.json phase1-out/ 2>/dev/null || true
          cp package-lock.json phase1-out/ 2>/dev/null || true
          cp capacitor.config.json phase1-out/ 2>/dev/null || true
          cp capacitor.config.ts phase1-out/ 2>/dev/null || true
          cp phase1-manifest.json phase1-out/ 2>/dev/null || true
          cp plugin-install-report.txt phase1-out/ 2>/dev/null || true
          if [ -d android ]; then cp -r android phase1-out/android; fi
          cd phase1-out && zip -r ../phase1-source.zip . > /dev/null && cd ..
          ls -la phase1-source.zip
      - name: "Phase 1 - Cache npm"
        uses: actions/cache/save@v4
        continue-on-error: true
        with:
          path: |
            ~/.npm
            node_modules
          key: npm-setup-\${{ runner.os }}-\${{ hashFiles('package-lock.json') }}
      - name: "Phase 1 - Report installed"
        run: |
          echo "=== SETUP_COMPLETE ==="
          npm ls --depth=0 2>/dev/null | tail -30
      - name: "Phase 1 - Upload source artifact"
        uses: actions/upload-artifact@v4
        with:
          name: phase1-source
          path: phase1-source.zip
          retention-days: 1
# build-nonce: ${nonce}
`;
}

/**
 * Phase 3 Rebuild Workflow — restores caches, builds, Gradle.
 */
function getRebuildWorkflow(appName: string, packageName: string, signingMode: string = "debug", keystorePassword: string = "android", keyAlias: string = "release-key", keyPassword: string = "android", plugins: string[] = [], versionCfg: VersionCfg = {}, webDirHint: string = "", defaultBranch: string = "main", cpr: CprHints = {}, cb: CallbackCfg = {}): string {
  const safeWebDir = sanitizeWebDir(webDirHint || cpr.outputDir || "");
  const safeWebDirCandidates = [...new Set([webDirHint, cpr.outputDir, ...(cpr.outputCandidates ?? [])].map((d) => sanitizeWebDir(d)).filter(Boolean))].join(",");
  const nodeVersion = sanitizeNodeVersion(cpr.requiredNodeVersion || cpr.nodeVersion);
  const cprRelease = sanitizeShellValue(cpr.releaseId || PLATFORM_RELEASE.id);
  const lockfilePolicy = cpr.lockfilePolicy === "preserved" ? "preserved" : "regenerate";
  const vName = (versionCfg.versionName || "1.0.0").replace(/[^0-9A-Za-z._-]/g, "");
  const vCode = Number.isInteger(versionCfg.versionCode) && (versionCfg.versionCode as number) > 0 ? versionCfg.versionCode : 1;
  const minSdk = versionCfg.minSdk && versionCfg.minSdk >= 21 ? versionCfg.minSdk : 24;
  const tgtSdk = versionCfg.targetSdk && versionCfg.targetSdk >= 30 ? versionCfg.targetSdk : 36;
  const safeAppName = sanitizeForYaml(appName);
  const safePackageName = sanitizeForYaml(packageName);
  const isRelease = signingMode === "release";
  const nonce = crypto.randomUUID();
  // Reconcile installed plugins with the CURRENT enabled list so toggling a
  // plugin OFF actually removes it on rebuild (instead of relying on the
  // stale package.json from Phase 1).
  const desiredSet = JSON.stringify(plugins);
  const reinstallStep = plugins.length > 0 ? buildPluginInstallStep(plugins) : "";
  return `name: Phase 3 - Build APK
on:
  push:
    branches: [${JSON.stringify(defaultBranch)}]
  workflow_dispatch:
permissions:
  contents: read
  actions: write
env:
  CI: "true"
  NB_WEB_DIR: "${safeWebDir}"
  NB_WEB_DIR_CANDIDATES: "${safeWebDirCandidates}"
  NB_CPR_RELEASE: "${cprRelease}"
  NB_LOCKFILE_POLICY: "${lockfilePolicy}"
${resilienceEnv(cb)}  VITE_SUPABASE_URL: "https://placeholder.supabase.co"
  VITE_SUPABASE_PUBLISHABLE_KEY: "placeholder"
  VITE_SUPABASE_ANON_KEY: "placeholder"
  VITE_SUPABASE_PROJECT_ID: "placeholder"
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
${resilienceInstallStep()}      - name: Set up Node.js ${nodeVersion}
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
      - name: Extract source code
        run: |
          rm -rf project-src
          unzip -o source.zip -d project-src
          node -e "const fs=require('fs'),path=require('path');function walk(d,depth,out){if(depth>3||!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,depth+1,out);}if(fs.existsSync(path.join(d,'package.json')))out.push(d);}const c=[];walk('project-src',0,c);function s(p){try{const j=JSON.parse(fs.readFileSync(path.join(p,'package.json'),'utf8'));const d={...j.dependencies,...j.devDependencies};let x=0;if(d['@capacitor/core'])x+=100;if(j.scripts&&j.scripts.build)x+=50;if(d.vite||d.next||d['react-scripts']||d['@angular/core']||d.nuxt||d.svelte)x+=20;if(Array.isArray(j.workspaces))x-=200;return x-p.split('/').length;}catch(e){return -999;}}c.sort((a,b)=>s(b)-s(a));console.log(c[0]||'');" > .pr.txt
          PROJECT_ROOT=\$(cat .pr.txt); rm -f .pr.txt
          if [ -z "\$PROJECT_ROOT" ]; then exit 1; fi
          shopt -s dotglob && cp -r "\$PROJECT_ROOT"/* ./ 2>/dev/null || true && shopt -u dotglob
          rm -rf project-src source.zip
          echo "[cpr] preserving canonical Capacitor configuration"
      - name: 'Phase 3 · Restore npm cache'
        id: npm-cache
        uses: actions/cache@v4
        continue-on-error: true
        with:
          path: |
            ~/.npm
            node_modules
          key: npm-rebuild-\${{ runner.os }}-\${{ hashFiles('package.json') }}
          restore-keys: |
            npm-rebuild-\${{ runner.os }}-
            npm-setup-\${{ runner.os }}-
      - name: 'Phase 3 · Restore Gradle cache'
        uses: actions/cache@v4
        continue-on-error: true
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: gradle-build-\${{ runner.os }}-\${{ hashFiles('package.json') }}
          restore-keys: |
            gradle-build-\${{ runner.os }}-
            gradle-setup-\${{ runner.os }}-
      - name: 'Phase 3 · Clean Gradle JAR cache'
        run: rm -rf ~/.gradle/caches/jars-9 ~/.gradle/caches/transforms-* || true
${depDoctorStep("Phase 3 · Dependency manifest check")}${smartInstallStep("Phase 3 · Install locked dependencies")}
      - name: 'Phase 3 · Reconcile enabled plugins'
        run: |
          # Preserve user-owned plugins. NativeBridge only installs explicitly
          # enabled plugins and never infers ownership from the current UI list.
          cat > /tmp/desired-plugins.json <<'DPJSON'
          ${desiredSet}
          DPJSON
          node -e "const fs=require('fs');console.log('Enabled NativeBridge plugins:',JSON.parse(fs.readFileSync('/tmp/desired-plugins.json','utf8')))"
 ${reinstallStep}
      - name: 'Phase 3 · Verify imported Capacitor packages'
        run: |
          echo "=== Scanning source for @capacitor/* and @capawesome/* imports ==="
          cat > /tmp/scan-missing.cjs <<'SCAN_EOF'
          const fs = require('fs'), path = require('path');
          const pkg = require(process.cwd() + '/package.json');
          const have = new Set([...Object.keys(pkg.dependencies||{}), ...Object.keys(pkg.devDependencies||{})]);
          const found = new Set();
           const re = /(?:from\\s*|require\\(\\s*|import\\(\\s*)['"]((?:@capacitor|@capawesome|@capacitor-community|@capacitor-mlkit|@capawesome-team)\\/[a-z0-9-]+)['"]/g;
          const walk = (d) => {
            let entries;
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
            for (const e of entries) {
               if (e.name === 'node_modules' || e.name === 'android' || e.name === 'ios' || e.name === 'dist' || e.name === 'build' || e.name === 'www' || e.name.startsWith('.')) continue;
              const p = path.join(d, e.name);
              if (e.isDirectory()) walk(p);
              else if (/\\.(t|j)sx?$/.test(e.name)) {
                const c = fs.readFileSync(p, 'utf8');
                let m; while ((m = re.exec(c))) found.add(m[1]);
              }
            }
          };
           walk('.');
          console.log([...found].filter(p => !have.has(p)).join(' '));
          SCAN_EOF
          MISSING=\$(node /tmp/scan-missing.cjs)
           if [ -n "\$MISSING" ]; then
             echo "::error::Imported Capacitor packages are missing pinned package.json entries: \$MISSING"
             exit 1
           else
            echo "=== All imported Capacitor packages are present in package.json ==="
          fi
${webDirResolveStep()}      - name: 'Phase 3 · Build web project'
        run: |
          echo "=== Detecting build script ==="
          BUILD_SCRIPT=""
          for s in build build:prod generate; do
            if node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts['\$s']?0:1)" 2>/dev/null; then
              BUILD_SCRIPT="\$s"
              break
            fi
          done
          if [ -z "\$BUILD_SCRIPT" ]; then
            echo "WARNING: No build script found in package.json. Available scripts:"
            node -e "console.log(Object.keys(require('./package.json').scripts||{}).join(', '))"
          else
            echo "=== Running: npm run \$BUILD_SCRIPT ==="
            if ! node "\$GITHUB_WORKSPACE/nb-resilience.cjs" step "Build web project" -- npm run "\$BUILD_SCRIPT" 2>&1 | tee /tmp/nativebridge-web-build.log; then
              EXIT=\${PIPESTATUS[0]}
              echo "=== WEB BUILD FAILED (exit \$EXIT). Continuing with any existing output or a safe fallback. Last 80 lines: ==="
              tail -80 /tmp/nativebridge-web-build.log || true
            fi
          fi
          echo "=== Web build complete. Output dirs: ==="
          FOUND_WEB_OUTPUT=""
          for dir in \$NB_WEB_DIR dist build www out .output/public .next; do
            if [ -d "\$dir" ]; then
              FOUND_WEB_OUTPUT="\${FOUND_WEB_OUTPUT} \$dir"
              echo "  found: \$dir (\$(du -sh \$dir 2>/dev/null | cut -f1))"
            fi
          done
          if [ -z "\$FOUND_WEB_OUTPUT" ]; then
            echo "::error::No usable web output directory was produced by the build. Refusing to synthesize a placeholder — that would ship a blank APK. Check the build log above."
            exit 1
          fi
          true
${webDirReconcileStep("Phase 3 · Reconcile web output directory")}      - name: 'Phase 3 · Inject plugin config files'

        run: if [ -f google-services.json ]; then mkdir -p android/app && cp google-services.json android/app/google-services.json; fi
      - name: 'Phase 3 · Setup Capacitor'
        run: |
          CAP_VERSION=\$(node -e "try{const p=require('./package.json');console.log((p.dependencies&&p.dependencies['@capacitor/core'])||(p.devDependencies&&p.devDependencies['@capacitor/core'])||'${PLATFORM_RELEASE.capacitorVersion}')}catch(e){console.log('${PLATFORM_RELEASE.capacitorVersion}')}" | sed 's/[\\^~>=<]//g')
          node -e "for(const p of ['@capacitor/core','@capacitor/cli','@capacitor/android']){try{require.resolve(p+'/package.json')}catch(e){process.exit(1)}}" || npm install @capacitor/core@\$CAP_VERSION @capacitor/cli@\$CAP_VERSION @capacitor/android@\$CAP_VERSION --legacy-peer-deps --no-audit --no-fund
          WEB_DIR=""
          for dir in \$NB_WEB_DIR dist build www out .output/public; do if [ -d "\$dir" ] && [ "\$(ls -A \$dir 2>/dev/null)" ]; then WEB_DIR="\$dir"; break; fi; done
          if [ -z "\$WEB_DIR" ]; then echo "::error::No web output directory to hand to Capacitor — aborting to avoid a blank APK."; exit 1; fi
          if [ ! -f capacitor.config.ts ] && [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.js ]; then
            npx cap init "${safeAppName}" "${safePackageName}" --web-dir "\$WEB_DIR"
          else
            echo "Reusing existing capacitor.config"
          fi
          if [ ! -d android ]; then
            npx cap add android
          else
            echo "Reusing existing android/ folder (preserving user mipmap icons & customizations)"
          fi
      - name: 'Phase 3 · Inject back button handler'
        run: |
          node -e "require.resolve('@capacitor/app/package.json')" 2>/dev/null || npm install @capacitor/app@\$CAP_VERSION --legacy-peer-deps --no-audit --no-fund
          MAIN_FILE=\$(find . -name "main.ts" -o -name "main.tsx" -o -name "index.ts" -o -name "index.tsx" | grep -v node_modules | head -1)
          if [ -n "\$MAIN_FILE" ]; then echo "import { App as CapApp } from '@capacitor/app'; CapApp.addListener('backButton', ({ canGoBack }) => { if (canGoBack) window.history.back(); else CapApp.exitApp(); });" >> "\$MAIN_FILE"; fi
      - name: 'Phase 3 · Generate App Icons (NativeBridge exact-size)'
        run: |
          if [ -f icon.png ]; then
            npm install --save-dev sharp --legacy-peer-deps || true
            mkdir -p scripts
            cat > scripts/nativebridge-generate-android-assets.cjs <<'NBASSETS'
${indentBlock(getAssetGeneratorScript(), 12)}
          NBASSETS
            SPLASH_ARG=""; [ -f splash.png ] && SPLASH_ARG="--splash splash.png"
            FG_ARG=""; [ -f icon_fg.png ] && FG_ARG="--foreground icon_fg.png"
            node scripts/nativebridge-generate-android-assets.cjs --source icon.png \$FG_ARG \$SPLASH_ARG --res android/app/src/main/res || echo "Asset generator returned non-zero (continuing)"
          fi
      - name: 'Phase 3 · Deduplicate launcher resources'
        run: |
          # Resolve "Duplicate resources" errors: when both ic_launcher_background.xml and .png
          # (or _foreground.xml and .png) exist in the same res/ folder, keep the PNG (generated
          # by our asset script) and drop the XML so mergeDebugResources doesn't fail.
          find android/app/src/main/res -type d \\( -name 'drawable*' -o -name 'mipmap*' \\) 2>/dev/null | while IFS= read -r dir; do
            for base in ic_launcher_background ic_launcher_foreground ic_launcher ic_launcher_round; do
              if [ -f "\$dir/\$base.png" ] && [ -f "\$dir/\$base.xml" ]; then
                echo "[dedup] Removing \$dir/\$base.xml (PNG takes precedence)"
                rm -f "\$dir/\$base.xml"
              fi
            done
          done || true
      - name: 'Phase 3 · Pre-sync hardening'
        run: |
          for f in capacitor.config.ts capacitor.config.js capacitor.config.json; do
            [ -f "\$f" ] && sed -i -E 's/("?server"?\\s*:\\s*\\{[^}]*\\}\\s*,?)//g' "\$f" || true
          done
          for d in \$NB_WEB_DIR dist build www out .output/public; do
            [ -f "\$d/index.html" ] && sed -i -E 's@(src|href)="/([^/])@\\1="./\\2@g' "\$d/index.html" || true
          done
${resilientStep("Phase 3 · Sync Capacitor (self-healing)", "Capacitor sync", "npx cap sync android")}      - name: 'Phase 3 · Post-sync smoke check'
        run: |
          IDX=android/app/src/main/assets/public/index.html
          if [ ! -f "\$IDX" ]; then echo "::error::No index.html synced — APK will be blank."; exit 1; fi
          B=\$(wc -c < "\$IDX"); echo "[smoke] \$B bytes"
          [ "\$B" -lt 80 ] && { echo "::error::index.html essentially empty — blank APK."; exit 1; } || true
          grep -qE '<script[ >]' "\$IDX" || echo "::warning::No <script> tags in index.html"

      - name: 'Phase 3 · Install Android SDK'
        run: \$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --install "platforms;android-36" "build-tools;36.0.0" || true
      - name: 'Phase 3 · Patch SDK versions'
        run: |
          printf '%s\\n' 'ext {' '    minSdkVersion = ${minSdk}' '    compileSdkVersion = ${tgtSdk}' '    targetSdkVersion = ${tgtSdk}' "    androidxActivityVersion = '1.9.3'" "    androidxAppCompatVersion = '1.7.0'" "    androidxCoordinatorLayoutVersion = '1.2.0'" "    androidxCoreVersion = '1.15.0'" "    androidxFragmentVersion = '1.8.5'" "    coreSplashScreenVersion = '1.0.1'" "    androidxWebkitVersion = '1.12.1'" "    junitVersion = '4.13.2'" "    androidxJunitVersion = '1.2.1'" "    androidxEspressoCoreVersion = '3.6.1'" "    cordovaAndroidVersion = '10.1.1'" '}' > android/variables.gradle
          find android -type f -name "build.gradle" | while IFS= read -r file; do sed -i -E -e 's/compileSdk[[:space:]]+[0-9]+/compileSdk ${tgtSdk}/g' -e 's/compileSdkVersion[[:space:]]+[0-9]+/compileSdkVersion ${tgtSdk}/g' -e 's/minSdk[[:space:]]+[0-9]+/minSdk ${minSdk}/g' -e 's/targetSdk[[:space:]]+[0-9]+/targetSdk ${tgtSdk}/g' -e 's/versionCode[[:space:]]+[0-9]+/versionCode ${vCode}/g' -e 's/versionName[[:space:]]+"[^"]*"/versionName "${vName}"/g' "\$file" || true; done
          if [ -f android/gradle/wrapper/gradle-wrapper.properties ]; then sed -i 's|distributionUrl=.*|distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip|' android/gradle/wrapper/gradle-wrapper.properties; fi
      - name: 'Phase 3 · ${isRelease ? "Build Release APK" : "Build Debug APK"}'
        working-directory: android
${isRelease ? `        env:
          KEYSTORE_PASSWORD: '${sanitizeForYaml(keystorePassword)}'
          KEY_ALIAS: '${sanitizeForYaml(keyAlias)}'
          KEY_PASSWORD: '${sanitizeForYaml(keyPassword)}'` : ""}
        run: |
          chmod +x gradlew
${isRelease ? `          if [ -f ../keystore.b64 ]; then base64 -d ../keystore.b64 > release.keystore; else keytool -genkeypair -v -keystore release.keystore -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -storepass "$KEYSTORE_PASSWORD" -keypass "$KEY_PASSWORD" -dname "CN=NativeBridge, O=NativeBridge"; fi
          cat > key.properties <<KEYPROPS
          storeFile=release.keystore
          storePassword=$KEYSTORE_PASSWORD
          keyAlias=$KEY_ALIAS
          keyPassword=$KEY_PASSWORD
          KEYPROPS
          node "\$GITHUB_WORKSPACE/nb-resilience.cjs" step "Gradle build" -- ./gradlew assembleRelease --no-daemon --stacktrace` : `          node "\$GITHUB_WORKSPACE/nb-resilience.cjs" step "Gradle build" -- ./gradlew assembleDebug --no-daemon --stacktrace`}
      # AAB build skipped — focusing on APK builds for now
      - name: Extract Signing Key Fingerprints
        if: always()
        working-directory: android
        run: |
          KEYSTORE_FILE=""; if [ -f "release.keystore" ]; then KEYSTORE_FILE="release.keystore"; else KEYSTORE_FILE=\$(find . -name "debug.keystore" -o -name "*.jks" -o -name "*.keystore" 2>/dev/null | head -1); fi
          if [ -n "\$KEYSTORE_FILE" ]; then STORE_PASS="android"; if [ -f "key.properties" ]; then STORE_PASS=\$(grep '^storePassword=' key.properties | cut -d= -f2-); fi; keytool -list -v -keystore "\$KEYSTORE_FILE" -storepass "\$STORE_PASS" 2>/dev/null | grep -E "SHA1:|SHA256:|MD5:" || true; base64 -w 0 "\$KEYSTORE_FILE" > ../keystore-export.b64 2>/dev/null || true; fi
      - name: Upload Keystore
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: keystore-export
          path: keystore-export.b64
          retention-days: 30
          if-no-files-found: warn
${resilienceEventStep("Resilience · signing complete", "signing_complete")}${resilienceEventStep("Resilience · upload started", "upload_started")}      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: ${isRelease ? "release-apk" : "debug-apk"}
          path: android/app/build/outputs/apk/${isRelease ? "release" : "debug"}/*.apk
          retention-days: 7
          if-no-files-found: error
${resilienceEventStep("Resilience · upload complete", "upload_complete")}      # AAB upload skipped — focusing on APK builds for now
${resilienceResultSteps()}
# build-nonce: ${nonce}
`;
}

// ── Helper: ensure Actions enabled + eagerly trigger and locate the run ──

async function ensureActionsAndDispatch(
  username: string,
  repoName: string,
  commitSha: string,
  token: string,
  tag: string,
  branch: string,
): Promise<{ matchedRun: any; diagnostic: string | null }> {
  let diagnostic: string | null = null;

  // 1) Force-enable Actions on the repo (no-op if already enabled).
  try {
    await githubFetch(`/repos/${username}/${repoName}/actions/permissions`, token, {
      method: "PUT",
      body: JSON.stringify({ enabled: true, allowed_actions: "all" }),
    });
  } catch (e) {
    console.warn(`[${tag}] actions/permissions PUT failed:`, e);
  }

  // 2) Wait briefly for GitHub to index the workflow file we just pushed.
  await new Promise((r) => setTimeout(r, 4000));

  // 3) Eagerly dispatch the workflow — don't wait for `on: push` (which is
  //    unreliable for tree-API commits on brand-new repos).
  let dispatched = false;
  let dispatchedAt = 0;
  let lastDispatchError: string | null = null;
  for (let i = 0; i < 4; i++) {
    const dispatchRes = await githubFetch(
      `/repos/${username}/${repoName}/actions/workflows/build.yml/dispatches`,
      token,
      { method: "POST", body: JSON.stringify({ ref: branch }) },
    );
    if (dispatchRes.ok) {
      dispatched = true;
      dispatchedAt = Date.now();
      console.log(`[${tag}] workflow_dispatch sent (attempt ${i + 1})`);
      break;
    }
    const errTxt = (await dispatchRes.text()).slice(0, 200);
    lastDispatchError = `${dispatchRes.status}: ${errTxt}`;
    console.warn(`[${tag}] dispatch attempt ${i + 1} -> ${dispatchRes.status}: ${errTxt}`);
    if (dispatchRes.status === 404 || dispatchRes.status === 422) {
      // Workflow not yet registered — retry after backoff.
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
      continue;
    }
    diagnostic = `dispatch failed ${dispatchRes.status}: ${errTxt}`;
    break;
  }

  if (!dispatched && !diagnostic) {
    diagnostic = `workflow dispatch was not accepted after 4 attempts${lastDispatchError ? ` (last response ${lastDispatchError})` : ""}`;
  }

  // 4) Poll for the run. Match by SHA first (covers push-triggered runs),
  //    otherwise only accept a workflow_dispatch created after this dispatch.
  let matchedRun: any = null;
  for (let attempt = 0; dispatched && attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, 4000));
    const runsRes = await githubFetch(
      `/repos/${username}/${repoName}/actions/runs?per_page=20`,
      token,
    );
    if (!runsRes.ok) {
      console.error(`[${tag}] runs list ${runsRes.status}`);
      continue;
    }
    const runs = await runsRes.json();
    const list = runs.workflow_runs || [];
    matchedRun =
      list.find((r: any) => r.head_sha === commitSha) ||
      list.find((r: any) =>
        r.event === "workflow_dispatch" &&
        r.head_branch === branch &&
        new Date(r.created_at).getTime() >= dispatchedAt - 2000
      ) ||
      null;
    if (matchedRun) break;
    console.log(`[${tag}] poll ${attempt + 1}: no run yet (${list.length} recent, dispatched=${dispatched})`);
  }

  if (!matchedRun && !diagnostic) {
    try {
      const wfRes = await githubFetch(`/repos/${username}/${repoName}/actions/workflows`, token);
      if (wfRes.ok) {
        const wfList = await wfRes.json();
        const total = wfList.total_count ?? wfList.workflows?.length ?? 0;
        const states = (wfList.workflows || []).map((w: any) => `${w.path}=${w.state}`).join(", ");
        diagnostic = `no run after dispatch — workflows: ${total} (${states || "none"})`;
      }
    } catch { /* ignore */ }
  }

  return { matchedRun, diagnostic };
}

// ── Phase 1: Setup action ──

async function setupPhase(body: BuildRequest, token: string) {
  const effectiveProjectName = body.projectName || body.appName || "my-app";
  if (!body.projectZip && !body.projectStoragePath) {
    return new Response(JSON.stringify({ error: "projectZip or projectStoragePath is required for setup" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const projectZip = await resolveProjectZip(body);

  const username = await getAuthenticatedUser(token);
  const repoName = body.existingRepoName || getRepoName(effectiveProjectName);
  let isReusing = false;

  if (body.existingRepoName) {
    const checkRes = await githubFetch(`/repos/${username}/${body.existingRepoName}`, token);
    isReusing = checkRes.ok;
  }
  if (!isReusing) {
    const createRes = await githubFetch("/user/repos", token, { method: "POST", body: JSON.stringify({ name: repoName, description: `NativeBridge setup: ${effectiveProjectName}`, private: false, auto_init: true }) });
    if (!createRes.ok) { const err = await createRes.json(); throw new Error(`Failed to create repo: ${err.message}`); }
    await new Promise(r => setTimeout(r, 2000));
  }

  const repositoryHead = await getRepositoryHead(username, repoName, token);
  const baseSha = repositoryHead.sha;

  const workflowYml = getSetupWorkflow(body.appName || "MyApp", body.packageName || "com.nativebridge.app", body.plugins || [], body.webDir || "", repositoryHead.branch, body.cprBlueprint?.cprProjectBlueprint ?? {});
  validateWorkflowYaml(workflowYml, "setup");

  const treeItems: any[] = [];
  const wfBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, { method: "POST", body: JSON.stringify({ content: utf8ToBase64(workflowYml), encoding: "base64" }) });
  if (!wfBlobRes.ok) throw new Error("Failed to create workflow blob");
  const wfBlob = await wfBlobRes.json();
  treeItems.push({ path: ".github/workflows/build.yml", mode: "100644", type: "blob", sha: wfBlob.sha });

  const zipBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, { method: "POST", body: JSON.stringify({ content: projectZip, encoding: "base64" }) });
  if (!zipBlobRes.ok) throw new Error("Failed to create source blob");
  const zipBlob = await zipBlobRes.json();
  treeItems.push({ path: "source.zip", mode: "100644", type: "blob", sha: zipBlob.sha });

  const treeRes = await githubFetch(`/repos/${username}/${repoName}/git/trees`, token, { method: "POST", body: JSON.stringify({ tree: treeItems, base_tree: baseSha }) });
  if (!treeRes.ok) throw new Error("Failed to create tree");
  const tree = await treeRes.json();

  const commitRes = await githubFetch(`/repos/${username}/${repoName}/git/commits`, token, { method: "POST", body: JSON.stringify({ message: "NativeBridge: Phase 1 Setup", tree: tree.sha, parents: [baseSha] }) });
  if (!commitRes.ok) throw new Error("Failed to create commit");
  const commit = await commitRes.json();

  await githubFetch(`/repos/${username}/${repoName}/git/refs/heads/${encodeURIComponent(repositoryHead.branch)}`, token, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: true }) });

  const { matchedRun, diagnostic } = await ensureActionsAndDispatch(
    username, repoName, commit.sha, token, "setup", repositoryHead.branch,
  );

  return new Response(JSON.stringify({
    success: true, phase: "setup", repoName, username, runId: matchedRun?.id || null, commitSha: commit.sha, isReusing,
    message: matchedRun ? "Phase 1: Setup started" : "Phase 1: Commit pushed, waiting for workflow to start",
    diagnostic,
    checkUrl: `https://github.com/${username}/${repoName}/actions`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Phase 3: Rebuild action ──

async function rebuildPhase(body: BuildRequest, token: string) {
  if (!body.repoName) {
    return new Response(JSON.stringify({ error: "repoName is required for rebuild" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!body.projectZip && !body.projectStoragePath) {
    return new Response(JSON.stringify({ error: "projectZip or projectStoragePath is required for rebuild" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const projectZip = await resolveProjectZip(body);

  const username = await getAuthenticatedUser(token);
  const repoName = body.repoName;

  const repositoryHead = await getRepositoryHead(username, repoName, token);
  const baseSha = repositoryHead.sha;

  const workflowYml = getRebuildWorkflow(
    body.appName || "MyApp", body.packageName || "com.nativebridge.app",
    body.signingMode || "debug", body.keystorePassword || "android",
    body.keyAlias || "release-key", body.keyPassword || "android",
    body.plugins || [],
    { versionName: body.versionName, versionCode: body.versionCode, minSdk: body.minSdk, targetSdk: body.targetSdk },
    body.webDir || "",
    repositoryHead.branch,
    body.cprBlueprint?.cprProjectBlueprint ?? {},
    callbackCfgFor(body),
  );
  validateWorkflowYaml(workflowYml, "rebuild");

  const treeItems: any[] = [];

  const wfBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, { method: "POST", body: JSON.stringify({ content: utf8ToBase64(workflowYml), encoding: "base64" }) });
  if (!wfBlobRes.ok) throw new Error("Failed to create rebuild workflow blob");
  const wfBlob = await wfBlobRes.json();
  treeItems.push({ path: ".github/workflows/build.yml", mode: "100644", type: "blob", sha: wfBlob.sha });

  const zipBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, { method: "POST", body: JSON.stringify({ content: projectZip, encoding: "base64" }) });
  if (!zipBlobRes.ok) throw new Error("Failed to create source blob for rebuild");
  const zipBlob = await zipBlobRes.json();
  treeItems.push({ path: "source.zip", mode: "100644", type: "blob", sha: zipBlob.sha });

  if (body.iconDataUrl) {
    const base64Data = body.iconDataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    const iconBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, { method: "POST", body: JSON.stringify({ content: base64Data, encoding: "base64" }) });
    if (iconBlobRes.ok) { const iconBlob = await iconBlobRes.json(); treeItems.push({ path: "icon.png", mode: "100644", type: "blob", sha: iconBlob.sha }); }
  }

  if (body.iconForegroundDataUrl) {
    const fgB64 = body.iconForegroundDataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    const fgRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, { method: "POST", body: JSON.stringify({ content: fgB64, encoding: "base64" }) });
    if (fgRes.ok) { const fgBlob = await fgRes.json(); treeItems.push({ path: "icon_fg.png", mode: "100644", type: "blob", sha: fgBlob.sha }); }
  }

  if (body.keystoreBase64 && body.signingMode === "release") {
    const ksBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, { method: "POST", body: JSON.stringify({ content: body.keystoreBase64, encoding: "base64" }) });
    if (ksBlobRes.ok) { const ksBlob = await ksBlobRes.json(); treeItems.push({ path: "keystore.b64", mode: "100644", type: "blob", sha: ksBlob.sha }); }
  }

  if (body.pluginConfigFiles?.length) {
    for (const cf of body.pluginConfigFiles) {
      const cfgBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, { method: "POST", body: JSON.stringify({ content: cf.contentBase64, encoding: "base64" }) });
      if (cfgBlobRes.ok) { const cfgBlob = await cfgBlobRes.json(); treeItems.push({ path: cf.path, mode: "100644", type: "blob", sha: cfgBlob.sha }); }
    }
  }

  const treeRes = await githubFetch(`/repos/${username}/${repoName}/git/trees`, token, { method: "POST", body: JSON.stringify({ tree: treeItems, base_tree: baseSha }) });
  if (!treeRes.ok) throw new Error("Failed to create rebuild tree");
  const tree = await treeRes.json();

  const commitRes = await githubFetch(`/repos/${username}/${repoName}/git/commits`, token, { method: "POST", body: JSON.stringify({ message: "NativeBridge: Phase 3 Rebuild", tree: tree.sha, parents: [baseSha] }) });
  if (!commitRes.ok) throw new Error("Failed to create rebuild commit");
  const commit = await commitRes.json();

  await githubFetch(`/repos/${username}/${repoName}/git/refs/heads/${encodeURIComponent(repositoryHead.branch)}`, token, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: true }) });

  const { matchedRun, diagnostic } = await ensureActionsAndDispatch(
    username, repoName, commit.sha, token, "rebuild", repositoryHead.branch,
  );

  return new Response(JSON.stringify({
    success: true, phase: "rebuild", repoName, username, runId: matchedRun?.id || null, commitSha: commit.sha,
    message: matchedRun ? "Phase 3: Rebuild started" : "Phase 3: Commit pushed, waiting for workflow to start",
    diagnostic,
    checkUrl: `https://github.com/${username}/${repoName}/actions`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/**
 * Generates a GitHub Actions workflow that clones a user's GitHub repo and builds it with Capacitor.
 */
function getGitHubRepoWorkflow(appName: string, packageName: string, repoUrl: string, branch: string, plugins: string[], webDirHint: string = "", defaultBranch: string = "main", cpr: CprHints = {}, cb: CallbackCfg = {}): string {
  const safeWebDir = sanitizeWebDir(webDirHint || cpr.outputDir || "");
  const safeWebDirCandidates = [...new Set([webDirHint, cpr.outputDir, ...(cpr.outputCandidates ?? [])].map((d) => sanitizeWebDir(d)).filter(Boolean))].join(",");
  const nodeVersion = sanitizeNodeVersion(cpr.requiredNodeVersion || cpr.nodeVersion);
  const cprRelease = sanitizeShellValue(cpr.releaseId || PLATFORM_RELEASE.id);
  const lockfilePolicy = cpr.lockfilePolicy === "preserved" ? "preserved" : "regenerate";
  const safeAppName = sanitizeForYaml(appName);
  const safePackageName = sanitizeForYaml(packageName);
  const safeRepoUrl = sanitizeForYaml(repoUrl);
  const safeBranch = sanitizeForYaml(branch);
  const pluginInstallStep = buildPluginInstallStep(plugins);
  const nonce = crypto.randomUUID();

  return `name: Build APK (GitHub Repo)

on:
  push:
    branches: [${JSON.stringify(defaultBranch)}]
  workflow_dispatch:

permissions:
  contents: read
  actions: write

env:
  CI: "true"
  NB_WEB_DIR: "${safeWebDir}"
  NB_WEB_DIR_CANDIDATES: "${safeWebDirCandidates}"
  NB_CPR_RELEASE: "${cprRelease}"
  NB_LOCKFILE_POLICY: "${lockfilePolicy}"
${resilienceEnv(cb)}  VITE_SUPABASE_URL: "https://placeholder.supabase.co"
  VITE_SUPABASE_PUBLISHABLE_KEY: "placeholder"
  VITE_SUPABASE_ANON_KEY: "placeholder"
  VITE_SUPABASE_PROJECT_ID: "placeholder"

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Preflight diagnostics
        run: |
          echo "=== Preflight Diagnostics ==="
          echo "OS: \$(uname -a)"
          echo "ANDROID_HOME: \${ANDROID_HOME:-not set}"
          echo "=== End Diagnostics ==="

${resilienceInstallStep()}
      - name: Clone source repository
        run: |
          echo "=== Cloning ${safeRepoUrl} (branch: ${safeBranch}) ==="
          git clone --depth 1 --branch "${safeBranch}" "${safeRepoUrl}" project-src
          echo "=== Clone complete ==="
          ls -la project-src/

      - name: Set up Node.js ${nodeVersion}
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Clean Gradle cache
        run: |
          rm -rf ~/.gradle/caches/jars-9 || true
          rm -rf ~/.gradle/caches/transforms-* || true

      - name: Verify environment
        run: |
          echo "Node: \$(node --version)"
          echo "Java: \$(java -version 2>&1 | head -1)"

      - name: Prepare project
        run: |
          echo "=== Setting up project ==="
          node -e "const fs=require('fs'),path=require('path');function walk(d,depth,out){if(depth>3||!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,depth+1,out);}if(fs.existsSync(path.join(d,'package.json')))out.push(d);}const c=[];walk('project-src',0,c);function s(p){try{const j=JSON.parse(fs.readFileSync(path.join(p,'package.json'),'utf8'));const d={...j.dependencies,...j.devDependencies};let x=0;if(d['@capacitor/core'])x+=100;if(j.scripts&&j.scripts.build)x+=50;if(d.vite||d.next||d['react-scripts']||d['@angular/core']||d.nuxt||d.svelte)x+=20;if(Array.isArray(j.workspaces))x-=200;return x-p.split('/').length;}catch(e){return -999;}}c.sort((a,b)=>s(b)-s(a));console.log(c[0]||'');" > .pr.txt
          PROJECT_ROOT=\$(cat .pr.txt); rm -f .pr.txt
          if [ -z "\$PROJECT_ROOT" ]; then
            echo "ERROR: No package.json found in cloned repo!"
            exit 1
          fi
          echo "Found project root: \$PROJECT_ROOT"
          shopt -s dotglob
          cp -r "\$PROJECT_ROOT"/* ./ 2>/dev/null || true
          shopt -u dotglob
          rm -rf project-src
          echo "[cpr] preserving canonical Capacitor configuration"
          echo "=== Project ready ==="
          ls -la
          cat package.json | head -30

${depDoctorStep("Dependency doctor")}${smartInstallStep("Install dependencies")}

${webDirResolveStep()}      - name: Build web project
        run: |
          ${buildRetryPrelude()}
          node /tmp/nb-build-retry.cjs || {
            npm run build:prod 2>&1 || npm run generate 2>&1 || {
              echo "ERROR: Could not build the project"
              exit 1
            }
          }
          for dir in \$NB_WEB_DIR dist build www out .output/public .next/static public; do
            if [ -d "\$dir" ]; then
              echo "Found output directory: \$dir"
            fi
          done

${webDirReconcileStep("Reconcile web output directory")}


      - name: Lint check (advisory)
        run: npx eslint . --ext .ts,.tsx,.js,.jsx --max-warnings 999 2>&1 || echo "Lint completed with warnings"

      - name: TypeScript check (advisory)
        run: npx tsc --noEmit 2>&1 || echo "TSC completed with errors"

      - name: Inject plugin config files
        run: |
          if [ -f google-services.json ]; then
            mkdir -p android/app
            cp google-services.json android/app/google-services.json
            echo "Copied google-services.json to android/app/"
          fi

      - name: Install Capacitor
        run: |
          CAP_VERSION=\$(node -e "try{const p=require('./package.json');console.log((p.dependencies&&p.dependencies['@capacitor/core'])||(p.devDependencies&&p.devDependencies['@capacitor/core'])||'${PLATFORM_RELEASE.capacitorVersion}')}catch(e){console.log('${PLATFORM_RELEASE.capacitorVersion}')}" | sed 's/[\\^~>=<]//g')
          echo "Using Capacitor version: \$CAP_VERSION"
          npm install @capacitor/core@\$CAP_VERSION @capacitor/cli@\$CAP_VERSION --legacy-peer-deps
          WEB_DIR=""
          for dir in \$NB_WEB_DIR dist build www out .output/public; do
            if [ -d "\$dir" ] && [ "\$(ls -A \$dir 2>/dev/null)" ]; then
              WEB_DIR="\$dir"
              break
            fi
          done
          if [ -z "\$WEB_DIR" ]; then
            echo "::error::No web output directory to hand to Capacitor — aborting to avoid a blank APK."
            exit 1
          fi
          echo "Using web-dir: \$WEB_DIR"
          if [ ! -f capacitor.config.ts ] && [ ! -f capacitor.config.json ] && [ ! -f capacitor.config.js ]; then
            npx cap init "${safeAppName}" "${safePackageName}" --web-dir "\$WEB_DIR"
          else
            echo "Reusing existing capacitor.config"
          fi
          npm install @capacitor/android@\$CAP_VERSION --legacy-peer-deps
          if [ ! -d android ]; then
            npx cap add android
          else
            echo "Reusing existing android/ folder (preserving user mipmap icons & customizations)"
          fi
${pluginInstallStep}
      - name: Inject back button handler
        run: |
          echo "=== Injecting back button handler ==="
          npm install @capacitor/app --legacy-peer-deps || echo "capacitor/app already present"
          MAIN_FILE=\$(find . -name "main.ts" -o -name "main.tsx" -o -name "index.ts" -o -name "index.tsx" | grep -v node_modules | head -1)
          if [ -n "\$MAIN_FILE" ]; then
            cat >> "\$MAIN_FILE" << 'BACKBUTTON'

          // Auto-injected: Capacitor back button handler
          import { App as CapApp } from '@capacitor/app';
          CapApp.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) { window.history.back(); }
            else { CapApp.exitApp(); }
          });
          BACKBUTTON
            echo "Back button handler injected into \$MAIN_FILE"
          else
            echo "No main entry file found, skipping back button injection"
          fi

      - name: Pre-sync hardening
        run: |
          for f in capacitor.config.ts capacitor.config.js capacitor.config.json; do
            [ -f "\$f" ] && sed -i -E 's/("?server"?\s*:\s*\{[^}]*\}\s*,?)//g' "\$f" || true
          done
          for d in \$NB_WEB_DIR dist build www out .output/public; do
            [ -f "\$d/index.html" ] && sed -i -E 's/(src|href)="\/(?!\/)/\\1="\.\//g' "\$d/index.html" || true
          done

      - name: Sync Capacitor
        run: npx cap sync android

      - name: Post-sync smoke check
        run: |
          IDX=android/app/src/main/assets/public/index.html
          [ -f "\$IDX" ] || { echo "::error::No index.html synced"; exit 1; }
          B=\$(wc -c < "\$IDX"); echo "[smoke] \$B bytes"
          [ "\$B" -lt 80 ] && { echo "::error::index.html essentially empty"; exit 1; } || true
          grep -qE '<script[ >]' "\$IDX" || echo "::warning::No <script> tags in index.html"


      - name: Extract Signing Key Fingerprints
        if: always()
        run: |
          echo "=== Extracting Signing Key Fingerprints ==="
          KEYSTORE_FILE=\$(find . -name "debug.keystore" -o -name "*.jks" -o -name "*.keystore" 2>/dev/null | head -1)
          if [ -n "\$KEYSTORE_FILE" ]; then
            STORE_PASS="android"
            echo "--- SHA-1 ---"
            keytool -list -v -keystore "\$KEYSTORE_FILE" -storepass "\$STORE_PASS" 2>/dev/null | grep "SHA1:" || echo "N/A"
            echo "--- SHA-256 ---"
            keytool -list -v -keystore "\$KEYSTORE_FILE" -storepass "\$STORE_PASS" 2>/dev/null | grep "SHA256:" || echo "N/A"
            echo "--- MD5 ---"
            keytool -list -v -keystore "\$KEYSTORE_FILE" -storepass "\$STORE_PASS" 2>/dev/null | grep "MD5:" || echo "N/A"
            base64 -w 0 "\$KEYSTORE_FILE" > keystore-export.b64 2>/dev/null || echo "Keystore export skipped"
          else
            echo "No keystore found"
          fi

      - name: Upload Keystore
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: keystore-export
          path: keystore-export.b64
          retention-days: 30
          if-no-files-found: warn

      - name: Install Android SDK platforms
        run: |
          \$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --install "platforms;android-36" "build-tools;36.0.0"

      - name: Cache Gradle dependencies
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: gradle-\${{ runner.os }}-\${{ hashFiles('android/**/*.gradle*') }}
          restore-keys: |
            gradle-\${{ runner.os }}-

      - name: Patch SDK versions and Gradle wrapper
        run: |
          printf '%s\\n' 'ext {' '    minSdkVersion = 24' '    compileSdkVersion = 36' '    targetSdkVersion = 36' "    androidxActivityVersion = '1.9.3'" "    androidxAppCompatVersion = '1.7.0'" "    androidxCoordinatorLayoutVersion = '1.2.0'" "    androidxCoreVersion = '1.15.0'" "    androidxFragmentVersion = '1.8.5'" "    coreSplashScreenVersion = '1.0.1'" "    androidxWebkitVersion = '1.12.1'" "    junitVersion = '4.13.2'" "    androidxJunitVersion = '1.2.1'" "    androidxEspressoCoreVersion = '3.6.1'" "    cordovaAndroidVersion = '10.1.1'" '}' > android/variables.gradle
          echo "=== Patching compileSdk/minSdk ==="
          BUILD_GRADLE_FILES=\$(find android -type f -name "build.gradle")
          if [ -z "\$BUILD_GRADLE_FILES" ]; then
            echo "WARNING: No build.gradle files found under android/"
          else
            while IFS= read -r file; do
              sed -i -E \
                -e 's/compileSdk[[:space:]]+[0-9]+/compileSdk 36/g' \
                -e 's/compileSdkVersion[[:space:]]+[0-9]+/compileSdkVersion 36/g' \
                -e 's/minSdk[[:space:]]+[0-9]+/minSdk 24/g' \
                -e 's/minSdkVersion[[:space:]]+[0-9]+/minSdkVersion 24/g' \
                -e 's/targetSdk[[:space:]]+[0-9]+/targetSdk 36/g' \
                -e 's/targetSdkVersion[[:space:]]+[0-9]+/targetSdkVersion 36/g' \
                "\$file" || echo "Warning: SDK patch failed for \$file"
            done <<< "\$BUILD_GRADLE_FILES"
          fi
          
          if [ -f android/gradle/wrapper/gradle-wrapper.properties ]; then
            sed -i 's|distributionUrl=.*|distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip|' android/gradle/wrapper/gradle-wrapper.properties
          fi
          
          cat android/variables.gradle
          cat android/app/build.gradle

      - name: Build Debug APK
        working-directory: android
        run: |
          chmod +x gradlew
          node "\$GITHUB_WORKSPACE/nb-resilience.cjs" step "Gradle build" -- ./gradlew assembleDebug --no-daemon --stacktrace

      - name: Build Debug AAB
        working-directory: android
        run: |
          ./gradlew bundleDebug --no-daemon --stacktrace

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: debug-apk
          path: android/app/build/outputs/apk/debug/*.apk
          retention-days: 7
          if-no-files-found: error

      - name: Upload AAB
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: debug-aab
          path: android/app/build/outputs/bundle/debug/*.aab
          retention-days: 7
          if-no-files-found: warn
${resilienceResultSteps()}# build-nonce: ${nonce}
`;
}

/**
 * Generates the GitHub Actions workflow for prebuilt projects (WebView/TWA).
 */
function getPrebuiltProjectWorkflow(defaultBranch: string = "main", cpr: CprHints = {}): string {
  const nodeVersion = sanitizeNodeVersion(cpr.requiredNodeVersion || cpr.nodeVersion);
  const cprRelease = sanitizeShellValue(cpr.releaseId || PLATFORM_RELEASE.id);
  const lockfilePolicy = cpr.lockfilePolicy === "preserved" ? "preserved" : "regenerate";
  const nonce = crypto.randomUUID();
  return `name: Build APK

on:
  push:
    branches: [${JSON.stringify(defaultBranch)}]
  workflow_dispatch:

permissions:
  contents: read
  actions: write

env:
  NB_CPR_RELEASE: "${cprRelease}"
  NB_LOCKFILE_POLICY: "${lockfilePolicy}"

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Preflight diagnostics
        run: |
          echo "OS: \$(uname -a)"
          echo "ANDROID_HOME: \${ANDROID_HOME:-not set}"
          ls -la

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Clean Gradle cache
        run: |
          rm -rf ~/.gradle/caches/jars-9 || true
          rm -rf ~/.gradle/caches/transforms-* || true

      - name: Extract project
        run: |
          if [ -f project.zip ]; then
            unzip -o project.zip -d extracted
            CONTENT_DIR=\$(find extracted -name "build.gradle" -not -path "*/app/*" -exec dirname {} \\; | head -1)
            if [ -z "\$CONTENT_DIR" ]; then
              CONTENT_DIR=\$(find extracted -maxdepth 2 -name "settings.gradle" -exec dirname {} \\; | head -1)
            fi
            if [ -n "\$CONTENT_DIR" ]; then
              cp -r "\$CONTENT_DIR"/* ./ 2>/dev/null || true
              cp -r "\$CONTENT_DIR"/.* ./ 2>/dev/null || true
            else
              cp -r extracted/* ./ 2>/dev/null || true
            fi
            rm -rf extracted project.zip
          fi

      - name: Set up Node.js
        if: hashFiles('web-source/package.json') != ''
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'

${webDirResolveStep()}      - name: Build web project
        if: hashFiles('web-source/package.json') != ''
        run: |
          cd web-source
          if [ "\${NB_LOCKFILE_POLICY:-regenerate}" = "preserved" ] && [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
          npm run build
          mkdir -p ../app/src/main/assets/public
          WEB_DIR=""
          for dir in \$NB_WEB_DIR \$(echo "\${NB_WEB_DIR_CANDIDATES}" | tr ',' ' ') dist build www out public .output/public; do
            if [ -s "\$dir/index.html" ]; then WEB_DIR="\$dir"; break; fi
          done
          if [ -z "\$WEB_DIR" ]; then echo "::error::Web build produced no index.html — cannot populate the native assets."; exit 1; fi
          echo "[nativeforge] copying \$WEB_DIR -> app/src/main/assets/public"
          cp -r "\$WEB_DIR"/* ../app/src/main/assets/public/

          cd ..
          rm -rf web-source

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4

      - name: Generate Gradle Wrapper
        run: |
          rm -f gradlew gradlew.bat
          gradle wrapper --gradle-version 8.10.2
          chmod +x gradlew

      - name: Build Debug APK
        run: node "\$GITHUB_WORKSPACE/nb-resilience.cjs" step "Gradle build" -- ./gradlew assembleDebug --no-daemon --stacktrace

      - name: Find APK
        id: find_apk
        run: |
          APK_PATH=\$(find . -name "*.apk" -path "*/debug/*" | head -1)
          if [ -z "\$APK_PATH" ]; then
            APK_PATH=\$(find . -name "*.apk" | head -1)
          fi
          echo "apk_path=\$APK_PATH" >> \$GITHUB_OUTPUT

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: debug-apk
          path: \${{ steps.find_apk.outputs.apk_path }}
          retention-days: 7
          if-no-files-found: error
# build-nonce: ${nonce}
`;
}

// ── Build orchestration ──

async function startBuild(body: BuildRequest, token: string) {
  const buildMode = body.buildMode || "prebuilt-project";
  const effectiveProjectName = body.projectName || body.appName || "my-app";
  
  if (buildMode !== "github-repo" && !body.projectZip) {
    return new Response(
      JSON.stringify({ error: "projectZip is required for non-repo builds" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (buildMode === "github-repo" && !body.sourceRepoUrl) {
    return new Response(
      JSON.stringify({ error: "sourceRepoUrl is required for github-repo mode" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const username = await getAuthenticatedUser(token);
  
  // ── Incremental rebuild: try to reuse existing repo ──
  let repoName: string;
  let isReusing = false;
  
  if (body.existingRepoName) {
    // Check if the repo still exists
    const checkRes = await githubFetch(`/repos/${username}/${body.existingRepoName}`, token);
    if (checkRes.ok) {
      repoName = body.existingRepoName;
      isReusing = true;
      console.log(`Reusing existing repo: ${repoName}`);
    } else {
      repoName = getRepoName(effectiveProjectName);
      console.log(`Existing repo not found, creating new: ${repoName}`);
    }
  } else {
    repoName = getRepoName(effectiveProjectName);
  }

  console.log(`Starting build: mode=${buildMode}, repo=${repoName}, reusing=${isReusing}`);

  if (!isReusing) {
    const createRes = await githubFetch("/user/repos", token, {
      method: "POST",
      body: JSON.stringify({
        name: repoName,
        description: `NativeBridge build: ${effectiveProjectName}`,
        private: false,
        auto_init: true,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(`Failed to create repo: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  const repositoryHead = await getRepositoryHead(username, repoName, token);
  const baseSha: string = repositoryHead.sha;

  console.log("Base commit SHA:", baseSha);

  let workflowYml: string;
  if (buildMode === "capacitor-source") {
    workflowYml = getCapacitorSourceWorkflow(
      body.appName || body.projectName || "MyApp",
      body.packageName || "com.nativebridge.app",
      body.plugins || [],
      body.signingMode || "debug",
      body.keystorePassword || "android",
      body.keyAlias || "release-key",
      body.keyPassword || "android",
      { versionName: body.versionName, versionCode: body.versionCode, minSdk: body.minSdk, targetSdk: body.targetSdk },
      body.webDir || "",
      repositoryHead.branch,
      (body.cprBlueprint?.cprProjectBlueprint ?? {}) as CprHints,
      callbackCfgFor(body),
    );

  } else if (buildMode === "github-repo") {
    workflowYml = getGitHubRepoWorkflow(
      body.appName || body.projectName || "MyApp",
      body.packageName || "com.nativebridge.app",
      body.sourceRepoUrl || "",
      body.sourceBranch || "main",
      body.plugins || [],
      body.webDir || "",
      repositoryHead.branch,
      (body.cprBlueprint?.cprProjectBlueprint ?? {}) as CprHints,
      callbackCfgFor(body),
    );
  } else {
    workflowYml = getPrebuiltProjectWorkflow(repositoryHead.branch, (body.cprBlueprint?.cprProjectBlueprint ?? {}) as CprHints);
  }

  validateWorkflowYaml(workflowYml, buildMode);
  const workflowContent = utf8ToBase64(workflowYml);

  const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];

  // Workflow blob
  const workflowBlobRes = await githubFetch(
    `/repos/${username}/${repoName}/git/blobs`,
    token,
    { method: "POST", body: JSON.stringify({ content: workflowContent, encoding: "base64" }) }
  );
  if (!workflowBlobRes.ok) {
    const err = await workflowBlobRes.text();
    throw new Error(`Failed to create workflow blob: ${workflowBlobRes.status} ${err}`);
  }
  const workflowBlob = await workflowBlobRes.json();
  treeItems.push({ path: ".github/workflows/build.yml", mode: "100644", type: "blob", sha: workflowBlob.sha });

  // Project zip blob
  if (buildMode !== "github-repo" && body.projectZip) {
    const zipFileName = buildMode === "capacitor-source" ? "source.zip" : "project.zip";
    const zipBlobRes = await githubFetch(
      `/repos/${username}/${repoName}/git/blobs`,
      token,
      { method: "POST", body: JSON.stringify({ content: body.projectZip, encoding: "base64" }) }
    );
    if (!zipBlobRes.ok) {
      const err = await zipBlobRes.text();
      throw new Error(`Failed to create project blob: ${zipBlobRes.status} ${err}`);
    }
    const zipBlob = await zipBlobRes.json();
    treeItems.push({ path: zipFileName, mode: "100644", type: "blob", sha: zipBlob.sha });
  }

  // Icon blob — upload as icon.png at repo root for the workflow to resize
  if (body.iconDataUrl) {
    const base64Data = body.iconDataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    const iconBlobRes = await githubFetch(
      `/repos/${username}/${repoName}/git/blobs`,
      token,
      { method: "POST", body: JSON.stringify({ content: base64Data, encoding: "base64" }) }
    );
    if (iconBlobRes.ok) {
      const iconBlob = await iconBlobRes.json();
      treeItems.push({ path: "icon.png", mode: "100644", type: "blob", sha: iconBlob.sha });
      console.log("Icon uploaded as icon.png");
    } else {
      console.warn("Failed to upload icon, builds will use default icons");
    }
  }

  // Foreground (raw transparent logo) — used by the asset generator for the
  // adaptive foreground layer and the flattened legacy ic_launcher composite.
  if (body.iconForegroundDataUrl) {
    const fgB64 = body.iconForegroundDataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    const fgRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token,
      { method: "POST", body: JSON.stringify({ content: fgB64, encoding: "base64" }) });
    if (fgRes.ok) {
      const fgBlob = await fgRes.json();
      treeItems.push({ path: "icon_fg.png", mode: "100644", type: "blob", sha: fgBlob.sha });
      console.log("Foreground uploaded as icon_fg.png");
    }
  }

  // Splash blob — uploaded as splash.png at repo root

  if (body.splashDataUrl) {
    const base64Data = body.splashDataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    const sBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token,
      { method: "POST", body: JSON.stringify({ content: base64Data, encoding: "base64" }) });
    if (sBlobRes.ok) {
      const sBlob = await sBlobRes.json();
      treeItems.push({ path: "splash.png", mode: "100644", type: "blob", sha: sBlob.sha });
      console.log("Splash uploaded as splash.png");
    }
  }

  // appearance.json — applied by workflow to styles.xml/colors.xml/capacitor.config + edge-to-edge
  if (body.appearanceJson) {
    const apBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token,
      { method: "POST", body: JSON.stringify({ content: btoa(body.appearanceJson), encoding: "base64" }) });
    if (apBlobRes.ok) {
      const apBlob = await apBlobRes.json();
      treeItems.push({ path: "appearance.json", mode: "100644", type: "blob", sha: apBlob.sha });
      console.log("appearance.json uploaded");
    }
  }

  // Keystore blob for release signing
  if (body.keystoreBase64 && body.signingMode === "release") {
    const ksBlobRes = await githubFetch(
      `/repos/${username}/${repoName}/git/blobs`,
      token,
      { method: "POST", body: JSON.stringify({ content: body.keystoreBase64, encoding: "base64" }) }
    );
    if (ksBlobRes.ok) {
      const ksBlob = await ksBlobRes.json();
      treeItems.push({ path: "keystore.b64", mode: "100644", type: "blob", sha: ksBlob.sha });
    }
  }

  // Plugin config files (google-services.json, etc.)
  if (body.pluginConfigFiles && body.pluginConfigFiles.length > 0) {
    for (const configFile of body.pluginConfigFiles) {
      try {
        const cfgBlobRes = await githubFetch(
          `/repos/${username}/${repoName}/git/blobs`,
          token,
          { method: "POST", body: JSON.stringify({ content: configFile.contentBase64, encoding: "base64" }) }
        );
        if (cfgBlobRes.ok) {
          const cfgBlob = await cfgBlobRes.json();
          treeItems.push({ path: configFile.path, mode: "100644", type: "blob", sha: cfgBlob.sha });
          console.log(`Plugin config file uploaded: ${configFile.path}`);
        }
      } catch (cfgErr) {
        console.warn(`Failed to upload config file ${configFile.path}:`, cfgErr);
      }
    }
  }

  // Create tree
  const treeRes = await githubFetch(
    `/repos/${username}/${repoName}/git/trees`,
    token,
    { method: "POST", body: JSON.stringify({ tree: treeItems, base_tree: baseSha }) }
  );
  if (!treeRes.ok) {
    const err = await treeRes.text();
    throw new Error(`Failed to create tree: ${treeRes.status} ${err}`);
  }
  const tree = await treeRes.json();

  // Create commit
  const commitRes = await githubFetch(
    `/repos/${username}/${repoName}/git/commits`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        message: `NativeBridge: ${buildMode === "capacitor-source" ? "Capacitor source build" : buildMode === "github-repo" ? "GitHub repo build" : "Prebuilt project build"}`,
        tree: tree.sha,
        parents: [baseSha],
      }),
    }
  );
  if (!commitRes.ok) {
    const err = await commitRes.text();
    throw new Error(`Failed to create commit: ${commitRes.status} ${err}`);
  }
  const commit = await commitRes.json();

  // Update main branch ref
  const refRes = await githubFetch(`/repos/${username}/${repoName}/git/refs/heads/${encodeURIComponent(repositoryHead.branch)}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });
  if (!refRes.ok) {
    const refErr = await refRes.json();
    throw new Error(`Failed to update branch: ${refErr.message}`);
  }

  // Enable Actions + eagerly workflow_dispatch + poll for the run.
  const { matchedRun } = await ensureActionsAndDispatch(
    username, repoName, commit.sha, token, "start", repositoryHead.branch,
  );

  const runId = matchedRun?.id;

  return new Response(
    JSON.stringify({
      success: true,
      repoName,
      username,
      runId: runId || null,
      commitSha: commit.sha,
      buildMode,
      isReusing,
      message: runId ? `Build started (${buildMode}${isReusing ? ", incremental" : ""})` : "Repository created, waiting for workflow to trigger",
      checkUrl: `https://github.com/${username}/${repoName}/actions`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Enhanced Status with exact failure reporting ──

// ── Log export ──────────────────────────────────────────────────────────────
// Downloads the full job logs for a workflow run, splits them per job/step and
// per line, redacts secrets, and returns structured rows the client persists
// into `build_logs`.

const SECRET_PATTERNS: RegExp[] = [
  /gh[pousr]_[A-Za-z0-9]{16,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /(?<=(?:password|passwd|pwd|secret|token|api[-_]?key)["'\s:=]{1,4})[^\s"']{6,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

function redactLog(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "***redacted***");
  return out;
}

function classifyLogType(stepName: string): string {
  const s = stepName.toLowerCase();
  if (/checkout|setup|node|java|jdk|sdk/.test(s)) return "setup";
  if (/install|npm ci|dependenc/.test(s)) return "install";
  if (/web build|npm run build|vite|resolve web/.test(s)) return "web-build";
  if (/cap |capacitor|sync/.test(s)) return "capacitor";
  if (/gradle|assemble|bundle/.test(s)) return "gradle";
  if (/sign|keystore|zipalign/.test(s)) return "signing";
  if (/upload|artifact|download/.test(s)) return "artifact";
  if (/xcode|xcodebuild|ipa|pod/.test(s)) return "xcode";
  return "build";
}

function classifyLevel(line: string): { level: string; statusCode: number } {
  const l = line.toLowerCase();
  if (/\b(error|failed|failure|fatal|exception|cannot find|not found|✗)\b/.test(l)) {
    return { level: "error", statusCode: 500 };
  }
  if (/\b(warn|warning|deprecated|skipped|⚠)\b/.test(l)) {
    return { level: "warning", statusCode: 400 };
  }
  if (/\b(success|succeeded|built|passed|complete|✓|done)\b/.test(l)) {
    return { level: "success", statusCode: 200 };
  }
  if (/\b(debug|verbose)\b/.test(l)) return { level: "debug", statusCode: 0 };
  return { level: "info", statusCode: 0 };
}

interface ExportedLogLine {
  ts: string;
  job_name: string;
  step_name: string;
  log_type: string;
  level: string;
  status_code: number;
  event_message: string;
  conclusion: string | null;
}

/** GitHub prefixes each log line with an RFC3339 timestamp. */
function parseJobLog(
  raw: string,
  jobName: string,
  conclusion: string | null,
  maxLines: number,
): ExportedLogLine[] {
  const out: ExportedLogLine[] = [];
  const lines = raw.split(/\r?\n/);
  const slice = lines.length > maxLines ? lines.slice(-maxLines) : lines;
  let currentStep = jobName;

  for (const rawLine of slice) {
    if (!rawLine.trim()) continue;
    const m = rawLine.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s?(.*)$/);
    const ts = m ? m[1] : new Date().toISOString();
    let message = m ? m[2] : rawLine;

    const group = message.match(/^##\[group\](.*)$/);
    if (group) {
      currentStep = group[1].trim();
      continue;
    }
    if (/^##\[endgroup\]/.test(message)) continue;
    message = message.replace(/^##\[[a-z]+\]/, "").replace(/\u001b\[[0-9;]*m/g, "");
    if (!message.trim()) continue;

    const { level, statusCode } = classifyLevel(message);
    out.push({
      ts,
      job_name: jobName,
      step_name: currentStep,
      log_type: classifyLogType(currentStep),
      level,
      status_code: statusCode,
      event_message: redactLog(message).slice(0, 4000),
      conclusion,
    });
  }
  return out;
}

async function exportLogs(body: BuildRequest, token: string) {
  if (!body.repoName || !body.runId) {
    return new Response(
      JSON.stringify({ error: "repoName and runId are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const username = await getAuthenticatedUser(token);
  const maxLines = Math.min(body.maxLines ?? 4000, 8000);

  const jobsRes = await githubFetch(
    `/repos/${username}/${body.repoName}/actions/runs/${body.runId}/jobs`,
    token,
  );
  if (!jobsRes.ok) {
    const detail = await jobsRes.text();
    return new Response(
      JSON.stringify({ error: `GitHub jobs API ${jobsRes.status}`, details: detail.slice(0, 500) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const jobs = await jobsRes.json();

  const lines: ExportedLogLine[] = [];
  const perJob = Math.max(500, Math.floor(maxLines / Math.max(1, jobs.jobs?.length || 1)));

  for (const job of jobs.jobs || []) {
    try {
      const logRes = await githubFetch(
        `/repos/${username}/${body.repoName}/actions/jobs/${job.id}/logs`,
        token,
        { redirect: "follow" },
      );
      if (!logRes.ok) {
        lines.push({
          ts: job.started_at || new Date().toISOString(),
          job_name: job.name,
          step_name: job.name,
          log_type: "build",
          level: "warning",
          status_code: logRes.status,
          event_message: `Logs unavailable for job "${job.name}" (GitHub ${logRes.status})`,
          conclusion: job.conclusion ?? null,
        });
        continue;
      }
      const text = await logRes.text();
      lines.push(...parseJobLog(text, job.name, job.conclusion ?? null, perJob));
    } catch (e) {
      lines.push({
        ts: new Date().toISOString(),
        job_name: job.name,
        step_name: job.name,
        log_type: "build",
        level: "error",
        status_code: 500,
        event_message: `Failed to download logs: ${e instanceof Error ? e.message : String(e)}`,
        conclusion: job.conclusion ?? null,
      });
    }
  }

  const errorLine = lines.find((l) => l.level === "error");
  const failureSummary = errorLine
    ? {
        category: errorLine.log_type,
        failingStep: errorLine.step_name,
        firstError: errorLine.event_message,
      }
    : null;

  return new Response(
    JSON.stringify({
      runId: body.runId,
      platform: body.platform || "android",
      phase: body.phase || null,
      runUrl: `https://github.com/${username}/${body.repoName}/actions/runs/${body.runId}`,
      total: lines.length,
      failureSummary,
      lines,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function checkStatus(body: BuildRequest, token: string) {
  if (!body.repoName) {
    return new Response(
      JSON.stringify({ error: "repoName is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const username = await getAuthenticatedUser(token);

  if (!body.runId) {
    const runsRes = await githubFetch(`/repos/${username}/${body.repoName}/actions/runs?per_page=20`, token);
    if (!runsRes.ok) {
      const errText = await runsRes.text();
      console.error(`[status] Failed to list runs: ${runsRes.status} ${errText}`);
      return new Response(
        JSON.stringify({ status: "waiting", message: `GitHub API error listing runs (${runsRes.status})`, diagnostic: errText.slice(0, 400) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const runs = await runsRes.json();
    let run: any = null;
    if (body.commitSha) {
      // STRICT: only accept exact SHA match — never a stale older run
      run = runs.workflow_runs?.find((r: any) => r.head_sha === body.commitSha) || null;
    } else {
      run = runs.workflow_runs?.[0] || null;
    }
    if (!run) {
      // Workflow registration diagnostics — surface why no run was created
      let diagnostic: string | null = null;
      try {
        const wfListRes = await githubFetch(`/repos/${username}/${body.repoName}/actions/workflows`, token);
        if (wfListRes.ok) {
          const wfList = await wfListRes.json();
          const total = wfList.total_count ?? wfList.workflows?.length ?? 0;
          const states = (wfList.workflows || []).map((w: any) => `${w.path}:${w.state}`).join(", ");
          diagnostic = `workflows registered: ${total} (${states || "none"}); commitSha=${body.commitSha || "n/a"}; recent runs=${runs.workflow_runs?.length || 0}`;
          if (total === 0) {
            diagnostic += " — GitHub did not register .github/workflows/build.yml. Likely YAML rejected by GitHub or Actions disabled on repo.";
          }
        } else {
          diagnostic = `workflows API ${wfListRes.status}: ${(await wfListRes.text()).slice(0, 200)}`;
        }
      } catch (e) {
        diagnostic = `workflow diagnostic failed: ${e instanceof Error ? e.message : String(e)}`;
      }
      console.log(`[status] Waiting for run. ${diagnostic}`);
      return new Response(
        JSON.stringify({ status: "waiting", message: "Waiting for GitHub Actions runner to start.", diagnostic }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        status: run.status === "completed" ? run.conclusion : run.status,
        runId: run.id,
        message: `Build ${run.status}${run.conclusion ? ` (${run.conclusion})` : ""}`,
        runUrl: run.html_url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const runRes = await githubFetch(`/repos/${username}/${body.repoName}/actions/runs/${body.runId}`, token);
  const run = await runRes.json();

  let logs: string[] = [];
  let buildLogs: string | null = null;
  let errorInfo: { errorType: string; errorDetail: string; suggestedFix: string; failedStep?: string; runUrl?: string; jobName?: string } | null = null;
  const runUrl = run.html_url || `https://github.com/${username}/${body.repoName}/actions/runs/${body.runId}`;
  let allStepsData: { name: string; status: string; conclusion: string | null; startedAt: string | null; completedAt: string | null; number: number }[] = [];

  if (run.status === "in_progress" || run.status === "completed") {
    try {
      const jobsRes = await githubFetch(`/repos/${username}/${body.repoName}/actions/runs/${body.runId}/jobs`, token);
      const jobs = await jobsRes.json();

      console.log(`Jobs response: ${jobs.total_count || 0} jobs, first job status: ${jobs.jobs?.[0]?.status || 'none'}`);

      // ── ZERO JOBS CASE ──
      if (!jobs.jobs || jobs.jobs.length === 0) {
        if (run.status === "completed" && run.conclusion === "failure") {
          buildLogs = `Workflow failed before any job could start.\n\nPossible causes:\n• Workflow YAML syntax error\n• Invalid GitHub Action reference (e.g. wrong action version)\n• Repository permissions or configuration issue\n• Missing required secrets\n\nRun URL: ${runUrl}`;
          logs = ["✗ Workflow failed (no jobs ran)"];
          errorInfo = {
            errorType: "Workflow Configuration",
            errorDetail: "The workflow failed before any job could start. This usually means the YAML file has a syntax error or references an invalid action.",
            suggestedFix: `Check the workflow run at ${runUrl} for the exact YAML error. Common causes: invalid action versions, missing permissions block, or YAML indentation errors.`,
            runUrl,
          };
        }
      } else {
      // ── PARSE ALL JOBS ──
        const allSteps: typeof allStepsData = [];
        let failedJobName: string | undefined;

        for (const job of jobs.jobs) {
          if (job.steps) {
            for (const step of job.steps) {
              allSteps.push({
                name: step.name,
                status: step.status,
                conclusion: step.conclusion,
                startedAt: step.started_at || null,
                completedAt: step.completed_at || null,
                number: step.number || 0,
              });
            }
          }
          if (job.conclusion === "failure" && !failedJobName) {
            failedJobName = job.name;
          }
        }

        allStepsData = allSteps;
        logs = allSteps.map((s) =>
          `${s.status === "completed" ? (s.conclusion === "success" ? "✓" : "✗") : "⟳"} ${s.name}`
        );

        // ── FAILURE HANDLING ──
        if (run.status === "completed" && run.conclusion === "failure") {
          const failedSteps = allSteps.filter(s => s.conclusion === "failure").map(s => s.name);

          // Fetch logs from failed jobs
          for (const job of (jobs.jobs || [])) {
            if (!job?.id) continue;
            try {
              const logRes = await fetch(
                `${GITHUB_API}/repos/${username}/${body.repoName}/actions/jobs/${job.id}/logs`,
                {
                  headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
                  redirect: "manual",
                }
              );

              let logText = "";
              if (logRes.status === 302) {
                const redirectUrl = logRes.headers.get("Location");
                if (redirectUrl) {
                  const r = await fetch(redirectUrl);
                  if (r.ok) logText = await r.text();
                }
              } else if (logRes.ok) {
                logText = await logRes.text();
              }

              if (logText) {
                const lines = logText.split("\n").map(l => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/, ""));

                // Extract error-relevant lines
                const importantLines = lines.filter(l =>
                  l.includes("FAILURE") || l.includes("BUILD FAILED") ||
                  l.includes("error:") || l.includes("Error:") ||
                  l.includes("Exception") || l.includes("Could not") ||
                  l.includes("not found") || l.includes("npm ERR!") ||
                  l.includes("compileSdk") || l.includes("compileSdkVersion") ||
                  l.includes("Dependency requires") || l.includes("checkDebugAarMetadata") ||
                  l.includes("AAR metadata") || l.includes("AAPT:") ||
                  l.includes("Cannot resolve") || l.includes("Module not found") ||
                  l.includes("missing") || l.includes("ERR_") ||
                  l.includes("exited with code") || l.includes("Process completed with exit code")
                ).slice(0, 60);

                if (importantLines.length > 0) {
                  buildLogs = importantLines.join("\n");
                } else {
                  // Tail of logs
                  buildLogs = lines.slice(-100).filter(l => l.trim()).join("\n");
                }

                if (buildLogs) break;
              }
            } catch (logErr) {
              console.error("Failed to fetch job logs:", logErr);
            }
          }

          // Classify the failure
          const primaryFailedStep = failedSteps[0] || "Unknown step";
          const classification = classifyFailedStep(primaryFailedStep, buildLogs || "");

          errorInfo = {
            errorType: classification.category,
            errorDetail: classification.detail,
            suggestedFix: classification.suggestedFix,
            failedStep: primaryFailedStep,
            runUrl,
            jobName: failedJobName,
          };

          if (!buildLogs && failedSteps.length > 0) {
            buildLogs = `Build failed at step(s): ${failedSteps.join(", ")}\n\nCheck the GitHub Actions run for full logs:\n${runUrl}`;
          }

          // Attach a short logExcerpt to each failed step so the timeline can render details inline.
          if (buildLogs) {
            const excerpt = buildLogs.split("\n").slice(-20).join("\n");
            allStepsData = allStepsData.map((s) =>
              s.conclusion === "failure" ? { ...s, logExcerpt: excerpt } as any : s
            );
          }
        }

        // ── Extract signing key fingerprints from successful builds ──
        if (run.status === "completed" && run.conclusion === "success") {
          try {
            for (const job of (jobs.jobs || [])) {
              if (!job?.id) continue;
              const logRes = await fetch(
                `${GITHUB_API}/repos/${username}/${body.repoName}/actions/jobs/${job.id}/logs`,
                {
                  headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
                  redirect: "manual",
                }
              );
              let logText = "";
              if (logRes.status === 302) {
                const redirectUrl = logRes.headers.get("Location");
                if (redirectUrl) {
                  const r = await fetch(redirectUrl);
                  if (r.ok) logText = await r.text();
                }
              } else if (logRes.ok) {
                logText = await logRes.text();
              }
              if (logText) {
                const sha1Match = logText.match(/SHA1:\s*([A-Fa-f0-9:]+)/);
                const sha256Match = logText.match(/SHA256:\s*([A-Fa-f0-9:]+)/);
                const md5Match = logText.match(/MD5:\s*([A-Fa-f0-9:]+)/);
                if (sha1Match || sha256Match || md5Match) {
                  // Add fingerprints to the response
                  (errorInfo as any) = errorInfo || {};
                  logs.push(`> ✓ SHA1: ${sha1Match?.[1] || "N/A"}`);
                  logs.push(`> ✓ SHA256: ${sha256Match?.[1] || "N/A"}`);
                  if (md5Match) logs.push(`> ✓ MD5: ${md5Match[1]}`);
                  
                  // Save fingerprints to response for client to persist
                  try {
                    const fingerprintsData = {
                      sha1: sha1Match?.[1] || null,
                      sha256: sha256Match?.[1] || null,
                      md5: md5Match?.[1] || null,
                    };
                    (errorInfo as any) = { ...(errorInfo || {}), fingerprints: fingerprintsData };
                    console.log("Signing fingerprints extracted and attached to response");
                  } catch (ksErr) {
                    console.error("Failed to attach signing keys:", ksErr);
                  }
                  break;
                }
              }
            }
          } catch (sigErr) {
            console.error("Failed to extract signing fingerprints:", sigErr);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching job details:", e);
    }
  }

  return new Response(
    JSON.stringify({
      status: run.status === "completed" ? run.conclusion : run.status,
      runId: run.id,
      message: `Build ${run.status}${run.conclusion ? ` (${run.conclusion})` : ""}`,
      logs,
      buildLogs,
      errorInfo,
      runUrl,
      allSteps: allStepsData.length > 0 ? allStepsData : undefined,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Helper to compute allSteps from jobs response for the UI
function extractAllSteps(jobs: any): { name: string; status: string; conclusion: string | null; startedAt: string | null; completedAt: string | null; number: number }[] {
  const allSteps: any[] = [];
  if (!jobs?.jobs) return allSteps;
  for (const job of jobs.jobs) {
    if (job.steps) {
      for (const step of job.steps) {
        allSteps.push({
          name: step.name,
          status: step.status,
          conclusion: step.conclusion,
          startedAt: step.started_at || null,
          completedAt: step.completed_at || null,
          number: step.number || 0,
        });
      }
    }
  }
  return allSteps;
}

async function downloadArtifact(body: BuildRequest, token: string) {
  if (!body.repoName || !body.runId) {
    return new Response(
      JSON.stringify({ error: "repoName and runId are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const username = await getAuthenticatedUser(token);

  const artifactsRes = await githubFetch(
    `/repos/${username}/${body.repoName}/actions/runs/${body.runId}/artifacts`,
    token
  );
  const artifacts = await artifactsRes.json();

  // Find APK artifact (try release first, then debug)
  const apkArtifact =
    artifacts.artifacts?.find((a: any) => a.name === "release-apk") ||
    artifacts.artifacts?.find((a: any) => a.name === "debug-apk");

  // Find AAB artifact
  const aabArtifact =
    artifacts.artifacts?.find((a: any) => a.name === "release-aab") ||
    artifacts.artifacts?.find((a: any) => a.name === "debug-aab");

  // Find keystore artifact
  const keystoreArtifact = artifacts.artifacts?.find((a: any) => a.name === "keystore-export");

  if (!apkArtifact && !aabArtifact) {
    return new Response(
      JSON.stringify({
        error: "No artifacts found",
        message: "Build completed but no APK/AAB artifact was uploaded. The build may have failed during the artifact upload step.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Inline base64 in the JSON response ONLY for small artifacts. Larger artifacts
  // are extracted server-side and uploaded directly to Supabase storage using the
  // service role — bypassing the previous 50 MB client cap that left APKs orphaned.
  const MAX_INLINE_MB = 20;
  const runHtmlUrl = `https://github.com/${username}/${body.repoName}/actions/runs/${body.runId}`;

  // Optional server-side upload target (client passes userId + jobId so the
  // edge function can write straight to build-artifacts/{userId}/{jobId}/...).
  const uploadUserId = (body as any).userId as string | undefined;
  const uploadJobId = (body as any).jobId as string | undefined;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const canUpload = Boolean(uploadUserId && uploadJobId && SUPABASE_URL && SERVICE_ROLE);

  async function uploadToStorage(path: string, bytes: Uint8Array, contentType: string): Promise<string | null> {
    if (!canUpload) return null;
    const url = `${SUPABASE_URL}/storage/v1/object/build-artifacts/${encodeURI(path)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE!,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!res.ok) {
      console.error(`[download] storage upload failed for ${path}: ${res.status} ${await res.text()}`);
      return null;
    }
    return path;
  }

  // Load JSZip once (Deno-friendly via npm: specifier)
  let JSZipCtor: any = null;
  async function getJSZip() {
    if (JSZipCtor) return JSZipCtor;
    const mod = await import("npm:jszip@3.10.1");
    JSZipCtor = mod.default || mod;
    return JSZipCtor;
  }

  const processOne = async (
    artifact: any,
    kind: "apk" | "aab" | "keystore"
  ): Promise<any> => {
    if (!artifact) return null;
    const sizeMB = (artifact.size_in_bytes || 0) / (1024 * 1024);
    const meta = { name: artifact.name, size: artifact.size_in_bytes, runUrl: runHtmlUrl };

    // Fetch the artifact zip from GitHub
    const dlRes = await fetch(artifact.archive_download_url, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
      redirect: "follow",
    });
    if (!dlRes.ok) return { ...meta, base64: null, tooLarge: sizeMB > MAX_INLINE_MB, storagePath: null };

    const buffer = await dlRes.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Extract the inner APK/AAB and upload it directly to storage when we can.
    let storagePath: string | null = null;
    if (canUpload && (kind === "apk" || kind === "aab")) {
      try {
        const JSZip = await getJSZip();
        const zip = await JSZip.loadAsync(bytes);
        const ext = kind === "apk" ? ".apk" : ".aab";
        const entryName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(ext));
        if (entryName) {
          const inner: Uint8Array = await zip.files[entryName].async("uint8array");
          const ct = kind === "apk"
            ? "application/vnd.android.package-archive"
            : "application/octet-stream";
          storagePath = await uploadToStorage(`${uploadUserId}/${uploadJobId}/app${ext}`, inner, ct);
        }
      } catch (err) {
        console.error(`[download] extract+upload failed for ${kind}:`, err);
      }
    }

    // Only inline base64 for small artifacts to keep the response small.
    let base64: string | null = null;
    const tooLarge = sizeMB > MAX_INLINE_MB;
    if (!tooLarge) {
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.byteLength; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      base64 = btoa(binary);
    }

    return { ...meta, base64, tooLarge, storagePath };
  };

  const [apkResult, aabResult, keystoreResult] = await Promise.all([
    processOne(apkArtifact, "apk"),
    processOne(aabArtifact, "aab"),
    processOne(keystoreArtifact, "keystore"),
  ]);

  return new Response(
    JSON.stringify({
      // Legacy field for backward compat
      artifactBase64: apkResult?.base64 || aabResult?.base64 || null,
      artifactName: apkResult?.name || aabResult?.name,
      artifactSize: apkResult?.size || aabResult?.size,
      runUrl: runHtmlUrl,
      // Dual-artifact fields with optional server-uploaded storagePath.
      apk: apkResult
        ? { base64: apkResult.base64, name: apkResult.name, size: apkResult.size, tooLarge: apkResult.tooLarge, runUrl: apkResult.runUrl, storagePath: apkResult.storagePath }
        : null,
      aab: aabResult
        ? { base64: aabResult.base64, name: aabResult.name, size: aabResult.size, tooLarge: aabResult.tooLarge, runUrl: aabResult.runUrl, storagePath: aabResult.storagePath }
        : null,
      keystore: keystoreResult && keystoreResult.base64 ? { base64: keystoreResult.base64 } : null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}


async function downloadPhase1Source(body: BuildRequest, token: string) {
  if (!body.repoName || !body.runId) {
    return new Response(
      JSON.stringify({ error: "repoName and runId are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const username = await getAuthenticatedUser(token);
  const artifactsRes = await githubFetch(
    `/repos/${username}/${body.repoName}/actions/runs/${body.runId}/artifacts`,
    token
  );
  const artifacts = await artifactsRes.json();
  const artifact = artifacts.artifacts?.find((a: any) => a.name === "phase1-source");
  if (!artifact) {
    return new Response(
      JSON.stringify({ error: "phase1-source artifact not found" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const dlRes = await fetch(artifact.archive_download_url, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
    redirect: "follow",
  });
  if (!dlRes.ok) {
    return new Response(
      JSON.stringify({ error: `Failed to download artifact: ${dlRes.status}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const buffer = await dlRes.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return new Response(
    JSON.stringify({ base64: btoa(binary), size: artifact.size_in_bytes }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function generateKeystoreAction(body: BuildRequest, token: string) {
  const alias = body.keyAlias || "release-key";
  const storePass = body.keystorePassword || "android";
  const keyPass = body.keyPassword || "android";
  const org = body.projectName || "NativeBridge";

  const username = await getAuthenticatedUser(token);
  const repoName = `nb-keygen-${Date.now()}`;

  // Create temp repo
  const createRes = await githubFetch("/user/repos", token, {
    method: "POST",
    body: JSON.stringify({ name: repoName, private: false, auto_init: true }),
  });
  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Failed to create repo: ${err.message}`);
  }

  await new Promise((r) => setTimeout(r, 2000));

  const repositoryHead = await getRepositoryHead(username, repoName, token);
  const baseSha = repositoryHead.sha;

  // Create workflow that generates a keystore and uploads it
  const workflowYml = `name: Generate Keystore
on:
  push:
    branches: [${JSON.stringify(repositoryHead.branch)}]
permissions:
  contents: read
  actions: write
jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Generate Keystore
        run: |
          keytool -genkeypair -v -keystore release.keystore \
            -alias "${sanitizeForYaml(alias)}" -keyalg RSA -keysize 2048 -validity 10000 \
            -storepass "${sanitizeForYaml(storePass)}" -keypass "${sanitizeForYaml(keyPass)}" \
            -dname "CN=${sanitizeForYaml(org)}, O=${sanitizeForYaml(org)}, L=Unknown, ST=Unknown, C=US"
          echo "=== Keystore generated ==="
          echo "=== FINGERPRINTS_START ==="
          keytool -list -v -keystore release.keystore -storepass "${sanitizeForYaml(storePass)}" 2>&1
          echo "=== FINGERPRINTS_END ==="
          base64 -w 0 release.keystore > keystore.b64
      - name: Upload Keystore
        uses: actions/upload-artifact@v4
        with:
          name: generated-keystore
          path: keystore.b64
          retention-days: 7
`;

  const workflowContent = utf8ToBase64(workflowYml);
  const workflowBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, {
    method: "POST", body: JSON.stringify({ content: workflowContent, encoding: "base64" }),
  });
  const workflowBlob = await workflowBlobRes.json();

  const treeRes = await githubFetch(`/repos/${username}/${repoName}/git/trees`, token, {
    method: "POST", body: JSON.stringify({ tree: [{ path: ".github/workflows/build.yml", mode: "100644", type: "blob", sha: workflowBlob.sha }], base_tree: baseSha }),
  });
  const tree = await treeRes.json();

  const commitRes = await githubFetch(`/repos/${username}/${repoName}/git/commits`, token, {
    method: "POST", body: JSON.stringify({ message: "Generate keystore", tree: tree.sha, parents: [baseSha] }),
  });
  const commit = await commitRes.json();

  await githubFetch(`/repos/${username}/${repoName}/git/refs/heads/${encodeURIComponent(repositoryHead.branch)}`, token, {
    method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: true }),
  });

  // Poll for completion
  let runId: number | null = null;
  let keystoreBase64: string | null = null;
  let fingerprints: { sha1: string | null; sha256: string | null; md5: string | null } | null = null;

  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, attempt < 3 ? 8000 : 5000));

    if (!runId) {
      const runsRes = await githubFetch(`/repos/${username}/${repoName}/actions/runs`, token);
      const runs = await runsRes.json();
      const run = runs.workflow_runs?.[0];
      if (run) runId = run.id;
      if (!run || run.status !== "completed") continue;
    }

    if (runId) {
      const runRes = await githubFetch(`/repos/${username}/${repoName}/actions/runs/${runId}`, token);
      const run = await runRes.json();

      if (run.status === "completed") {
        if (run.conclusion === "success") {
          // Extract fingerprints from logs
          try {
            const jobsRes = await githubFetch(`/repos/${username}/${repoName}/actions/runs/${runId}/jobs`, token);
            const jobs = await jobsRes.json();
            for (const job of (jobs.jobs || [])) {
              if (!job?.id) continue;
              const logRes = await fetch(`${GITHUB_API}/repos/${username}/${repoName}/actions/jobs/${job.id}/logs`, {
                headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
                redirect: "manual",
              });
              let logText = "";
              if (logRes.status === 302) {
                const redirectUrl = logRes.headers.get("Location");
                if (redirectUrl) { const r = await fetch(redirectUrl); if (r.ok) logText = await r.text(); }
              } else if (logRes.ok) { logText = await logRes.text(); }
              if (logText) {
                // Match multiple JDK output formats:
                // JDK 8-11: "SHA1: XX:XX:..." / "SHA256: XX:XX:..." / "MD5: XX:XX:..."
                // JDK 17+: "SHA1: XX:XX:..." or "Certificate fingerprint (SHA-1): XX:XX:..."
                // Some JDKs: "Certificate fingerprints:" section with indented "SHA-1: XX:XX:..."
                const sha1Match = logText.match(/(?:SHA1|SHA-1|Certificate fingerprint \(SHA-1\)):\s*([A-Fa-f0-9:]+)/i);
                const sha256Match = logText.match(/(?:SHA256|SHA-256|Certificate fingerprint \(SHA-256\)):\s*([A-Fa-f0-9:]+)/i);
                const md5Match = logText.match(/(?:MD5|Certificate fingerprint \(MD5\)):\s*([A-Fa-f0-9:]+)/i);
                fingerprints = { sha1: sha1Match?.[1] || null, sha256: sha256Match?.[1] || null, md5: md5Match?.[1] || null };
              }
            }
          } catch (e) { console.error("Failed to extract fingerprints:", e); }

          // Download keystore artifact
          try {
            const artifactsRes = await githubFetch(`/repos/${username}/${repoName}/actions/runs/${runId}/artifacts`, token);
            const artifacts = await artifactsRes.json();
            const ksArtifact = artifacts.artifacts?.find((a: any) => a.name === "generated-keystore");
            if (ksArtifact) {
              const dlRes = await fetch(ksArtifact.archive_download_url, {
                headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
                redirect: "follow",
              });
              if (dlRes.ok) {
                const buffer = await dlRes.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = "";
                const chunkSize = 8192;
                for (let i = 0; i < bytes.byteLength; i += chunkSize) {
                  const chunk = bytes.subarray(i, i + chunkSize);
                  binary += String.fromCharCode(...chunk);
                }
                // This is a zip containing keystore.b64
                // We need to handle it - for simplicity, pass the whole zip
                // The client will need to extract the b64 file and decode it
                keystoreBase64 = btoa(binary);
              }
            }
          } catch (e) { console.error("Failed to download keystore:", e); }
        }

        // Cleanup temp repo
        try {
          await githubFetch(`/repos/${username}/${repoName}`, token, { method: "DELETE" });
        } catch {}

        break;
      }
    }
  }

  if (!keystoreBase64 && !fingerprints) {
    // Cleanup on failure
    try { await githubFetch(`/repos/${username}/${repoName}`, token, { method: "DELETE" }); } catch {}
    return new Response(
      JSON.stringify({ error: "Keystore generation timed out or failed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, keystoreBase64, fingerprints }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function cleanupRepo(body: BuildRequest, token: string) {
  if (!body.repoName) {
    return new Response(
      JSON.stringify({ error: "repoName is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const username = await getAuthenticatedUser(token);

  try {
    const delRes = await githubFetch(`/repos/${username}/${body.repoName}`, token, {
      method: "DELETE",
    });

    if (delRes.status === 403) {
      console.warn(`Cannot delete repo ${body.repoName} — token lacks delete_repo scope. Skipping cleanup.`);
      return new Response(
        JSON.stringify({ success: false, message: "Token lacks delete_repo scope. Repo will remain." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!delRes.ok && delRes.status !== 404) {
      const err = await delRes.text();
      console.error(`Failed to delete repo: ${delRes.status} ${err}`);
      return new Response(
        JSON.stringify({ success: false, error: `Delete failed: ${delRes.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("Cleanup error:", e);
  }

  return new Response(
    JSON.stringify({ success: true, message: "Repository deleted" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
