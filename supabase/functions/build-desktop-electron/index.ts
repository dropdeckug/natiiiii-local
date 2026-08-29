import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GITHUB_API = "https://api.github.com";

function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface DesktopBuildRequest {
  action: "start" | "status" | "download" | "delete-repo";
  projectZip?: string;
  projectName?: string;
  runId?: number;
  repoName?: string;
  appName?: string;
  packageName?: string;
  platforms?: string[]; // "windows" | "macos" | "linux"
  url?: string;
  sourceRepoUrl?: string;
  sourceBranch?: string;
}

async function githubFetch(path: string, token: string, options: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (options.body) headers["Content-Type"] = "application/json";
  return await fetch(url, { ...options, headers });
}

async function getAuthenticatedUser(token: string): Promise<string> {
  const res = await githubFetch("/user", token);
  if (!res.ok) throw new Error(`Invalid GitHub token: ${res.status}`);
  const user = await res.json();
  return user.login;
}

function getRepoName(projectName: string): string {
  return `nativebridge-desktop-${projectName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`;
}

function getElectronSourceWorkflow(appName: string, packageName: string, platforms: string[], url?: string): string {
  const hasWin = platforms.includes("windows");
  const hasLinux = platforms.includes("linux");
  const hasMac = platforms.includes("macos");

  const jobs: string[] = [];

  // Common setup for the source project
  const sourceExtract = `
      - name: Extract source code
        run: |
          echo "=== Extracting source ==="
          if [ -f source.zip ]; then
            unzip -o source.zip -d project-src
            node -e "const fs=require('fs'),path=require('path');function walk(d,depth,out){if(depth>4||!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,depth+1,out);}if(fs.existsSync(path.join(d,'package.json')))out.push(d);}const c=[];walk('project-src',0,c);function s(p){try{const j=JSON.parse(fs.readFileSync(path.join(p,'package.json'),'utf8'));const d={...j.dependencies,...j.devDependencies};let x=0;if(d.electron)x+=100;if(j.scripts&&j.scripts.build)x+=70;if(d.vite||d.react||d.vue||d['@angular/core']||d.next||d.svelte)x+=40;if(Array.isArray(j.workspaces)||j.workspaces&&j.workspaces.packages)x-=160;return x-p.split('/').length;}catch(e){return -999;}}c.sort((a,b)=>s(b)-s(a));console.log(c[0]||'');" > .project-root.txt
            PROJECT_ROOT=$(cat .project-root.txt); rm -f .project-root.txt
            if [ -z "$PROJECT_ROOT" ]; then
              echo "No package.json found — checking for static HTML project..."
              STATIC_ROOT=$(find project-src -maxdepth 4 -name "index.html" -not -path "*/node_modules/*" -exec dirname {} \\; | head -1)
              if [ -z "$STATIC_ROOT" ]; then
                echo "ERROR: No package.json AND no index.html found in source.zip"
                exit 1
              fi
              PROJECT_ROOT="$STATIC_ROOT"
              echo "Detected static HTML project at: $PROJECT_ROOT"
              cat > "$PROJECT_ROOT/package.json" <<'STATICPKG'
{"name":"static-html-app","version":"1.0.0","private":true,"scripts":{"build":"node -e \"const fs=require('fs'),path=require('path');fs.mkdirSync('dist',{recursive:true});function cp(s,d){for(const e of fs.readdirSync(s,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='dist'||e.name==='android'||e.name==='ios'||e.name==='www'||e.name.startsWith('.'))continue;const sp=path.join(s,e.name),dp=path.join(d,e.name);if(e.isDirectory()){fs.mkdirSync(dp,{recursive:true});cp(sp,dp);}else fs.copyFileSync(sp,dp);}}cp('.','dist');if(!fs.existsSync('dist/index.html')&&fs.existsSync('index.html'))fs.copyFileSync('index.html','dist/index.html');console.log('static copy -> dist');\""}}
STATICPKG
            fi
            echo "Selected project root: $PROJECT_ROOT"
            shopt -s dotglob
            cp -r "$PROJECT_ROOT"/* ./ 2>/dev/null || true
            shopt -u dotglob
            rm -rf project-src source.zip
          fi
          echo "=== Source ready ==="
          ls -la

      - name: Install project dependencies
        run: |
          rm -f bun.lockb
          npm install --legacy-peer-deps

      - name: Build web project
        run: |
          if [ -f package.json ] && grep -q '"build"' package.json; then
            npm run build 2>&1 || { echo "ERROR: Web build failed"; exit 1; }
          fi
          # Copy build output to www/
          mkdir -p www
          FOUND_OUTPUT=""
          for dir in dist build out .output/public; do
            if [ -d "$dir" ] && [ "$(ls -A $dir 2>/dev/null)" ]; then
              cp -r "$dir"/* www/
              echo "Copied $dir to www/"
              FOUND_OUTPUT="$dir"
              break
            fi
          done
          if [ -z "$FOUND_OUTPUT" ] && [ -f index.html ]; then
            cp -r ./* www/ 2>/dev/null || true
            FOUND_OUTPUT="."
            echo "Copied root static files to www/"
          fi
          if [ ! -s www/index.html ]; then
            echo "ERROR: Build output verification failed — www/index.html missing or empty"
            echo "Available files:" && find . -maxdepth 3 -type f | sort | head -120
            exit 1
          fi
          echo "Verified web output from $FOUND_OUTPUT"`;

  const electronSetup = `
      - name: Setup Electron project
        run: |
          # Create Electron main process files
          cat > main.js << 'MAINEOF'
const { app, BrowserWindow } = require('electron');
const path = require('path');
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    show: false,
  });
  ${url ? `mainWindow.loadURL('${url}');` : `mainWindow.loadFile(path.join(__dirname, 'www', 'index.html'));`}
  mainWindow.once('ready-to-show', () => mainWindow.show());
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
MAINEOF

          cat > preload.js << 'PREEOF'
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: { node: process.versions.node, chrome: process.versions.chrome, electron: process.versions.electron },
});
PREEOF

          # If no www/index.html and no URL, create a fallback
          if [ ! -f www/index.html ] && [ -z "${url || ""}" ]; then
            mkdir -p www
            echo '<!DOCTYPE html><html><head><title>${appName}</title></head><body><h1>${appName}</h1><p>Desktop app</p></body></html>' > www/index.html
          fi

          # Create electron-builder config
          npm install electron@33.4.11 electron-builder@25.1.8 --save-dev

          # Update package.json with electron-builder config
          node -e "
            const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8'));
            pkg.main = 'main.js';
            pkg.build = {
              appId: '${packageName}',
              productName: '${appName}',
              directories: { output: 'dist-electron' },
              files: ['main.js','preload.js','www/**/*','assets/**/*'],
              ${hasWin ? "win: { target: ['nsis'] }," : ""}
              ${hasMac ? "mac: { target: ['dmg'], category: 'public.app-category.utilities', identity: null }," : ""}
              ${hasLinux ? "linux: { target: ['AppImage'], category: 'Utility' }," : ""}
            };
            require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));
          "

          mkdir -p assets build
          echo "=== Electron setup complete ==="`;

  if (hasWin || hasLinux) {
    const buildFlags = [hasWin && "--win", hasLinux && "--linux"].filter(Boolean).join(" ");
    jobs.push(`  build-linux-win:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
${sourceExtract}
${electronSetup}
      - name: Build desktop apps
        run: npx electron-builder ${buildFlags} --publish never
        env:
          GH_TOKEN: \${{ github.token }}
          CSC_IDENTITY_AUTO_DISCOVERY: "false"
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: desktop-builds-linux-win
          path: |
            dist-electron/*.exe
            dist-electron/*.AppImage
            dist-electron/*.deb
          retention-days: 7
          if-no-files-found: warn`);
  }

  if (hasMac) {
    jobs.push(`  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
${sourceExtract}
${electronSetup}
      - name: Build macOS app
        run: npx electron-builder --mac --publish never
        env:
          GH_TOKEN: \${{ github.token }}
          CSC_IDENTITY_AUTO_DISCOVERY: "false"
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: desktop-builds-mac
          path: |
            dist-electron/*.dmg
          retention-days: 7
          if-no-files-found: warn`);
  }

  return `name: Build Desktop Apps (Electron)

on:
  push:
    branches: [main]

env:
  CI: "true"

jobs:
${jobs.join("\n\n")}
`;
}

// ── Build orchestration ──

async function startBuild(body: DesktopBuildRequest, token: string) {
  const effectiveName = body.projectName || body.appName || "my-desktop-app";
  const platforms = body.platforms || ["windows", "macos", "linux"];

  if (!body.projectZip && !body.sourceRepoUrl && !body.url) {
    return new Response(
      JSON.stringify({ error: "Either projectZip, sourceRepoUrl, or url is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const username = await getAuthenticatedUser(token);
  const repoName = getRepoName(effectiveName);

  console.log(`Starting desktop build: repo=${repoName}, platforms=${platforms.join(",")}`);

  // Check if repo exists
  const checkRes = await githubFetch(`/repos/${username}/${repoName}`, token);
  let repoExists = checkRes.ok;
  if (!checkRes.ok) await checkRes.text();
  else await checkRes.json();

  let baseSha: string;

  if (repoExists) {
    const mainRefRes = await githubFetch(`/repos/${username}/${repoName}/git/ref/heads/main`, token);
    if (!mainRefRes.ok) {
      try {
        const delRes = await githubFetch(`/repos/${username}/${repoName}`, token, { method: "DELETE" });
        if (!delRes.ok) await delRes.text();
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
      repoExists = false;
    } else {
      const mainRef = await mainRefRes.json();
      baseSha = mainRef.object.sha;
    }
  }

  if (!repoExists) {
    const createRes = await githubFetch("/user/repos", token, {
      method: "POST",
      body: JSON.stringify({
        name: repoName,
        description: `NativeBridge desktop build: ${effectiveName}`,
        private: false,
        auto_init: true,
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(`Failed to create repo: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
    const mainRefRes = await githubFetch(`/repos/${username}/${repoName}/git/ref/heads/main`, token);
    if (!mainRefRes.ok) throw new Error("Failed to get initial commit ref");
    const mainRef = await mainRefRes.json();
    baseSha = mainRef.object.sha;
  }

  const workflowYml = getElectronSourceWorkflow(
    body.appName || effectiveName,
    body.packageName || "com.nativebridge.desktop",
    platforms,
    body.url
  );

  const treeItems: any[] = [];

  // Workflow blob
  const wfBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, {
    method: "POST",
    body: JSON.stringify({ content: utf8ToBase64(workflowYml), encoding: "base64" }),
  });
  if (!wfBlobRes.ok) throw new Error("Failed to create workflow blob");
  const wfBlob = await wfBlobRes.json();
  treeItems.push({ path: ".github/workflows/build.yml", mode: "100644", type: "blob", sha: wfBlob.sha });

  // Project zip if provided
  if (body.projectZip) {
    const zipBlobRes = await githubFetch(`/repos/${username}/${repoName}/git/blobs`, token, {
      method: "POST",
      body: JSON.stringify({ content: body.projectZip, encoding: "base64" }),
    });
    if (!zipBlobRes.ok) throw new Error("Failed to create project blob");
    const zipBlob = await zipBlobRes.json();
    treeItems.push({ path: "source.zip", mode: "100644", type: "blob", sha: zipBlob.sha });
  }

  // Create tree, commit, update ref
  const treeRes = await githubFetch(`/repos/${username}/${repoName}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({ tree: treeItems, base_tree: baseSha! }),
  });
  if (!treeRes.ok) throw new Error("Failed to create tree");
  const tree = await treeRes.json();

  const commitRes = await githubFetch(`/repos/${username}/${repoName}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({ message: "NativeBridge: Desktop build", tree: tree.sha, parents: [baseSha!] }),
  });
  if (!commitRes.ok) throw new Error("Failed to create commit");
  const commit = await commitRes.json();

  await githubFetch(`/repos/${username}/${repoName}/git/refs/heads/main`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });

  await new Promise(r => setTimeout(r, 3000));

  const runsRes = await githubFetch(`/repos/${username}/${repoName}/actions/runs`, token);
  const runs = await runsRes.json();
  const runId = runs.workflow_runs?.[0]?.id;

  return new Response(
    JSON.stringify({ success: true, repoName, username, runId, platforms }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function checkStatus(body: DesktopBuildRequest, token: string) {
  if (!body.repoName) {
    return new Response(JSON.stringify({ error: "repoName is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const username = await getAuthenticatedUser(token);

  if (!body.runId) {
    const runsRes = await githubFetch(`/repos/${username}/${body.repoName}/actions/runs`, token);
    const runs = await runsRes.json();
    const run = runs.workflow_runs?.[0];
    if (!run) {
      return new Response(JSON.stringify({ status: "waiting" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      status: run.status === "completed" ? run.conclusion : run.status,
      runId: run.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const runRes = await githubFetch(`/repos/${username}/${body.repoName}/actions/runs/${body.runId}`, token);
  const run = await runRes.json();

  let logs: string[] = [];
  let buildLogs: string | null = null;

  if (run.status === "in_progress" || run.status === "completed") {
    try {
      const jobsRes = await githubFetch(`/repos/${username}/${body.repoName}/actions/runs/${body.runId}/jobs`, token);
      const jobs = await jobsRes.json();

      for (const job of (jobs.jobs || [])) {
        const steps = job.steps || [];
        for (const s of steps) {
          logs.push(`${s.status === "completed" ? (s.conclusion === "success" ? "✓" : "✗") : "⟳"} [${job.name}] ${s.name}`);
        }
      }

      if (run.status === "completed" && run.conclusion === "failure") {
        for (const job of (jobs.jobs || [])) {
          if (!job?.id) continue;
          try {
            const logRes = await fetch(`${GITHUB_API}/repos/${username}/${body.repoName}/actions/jobs/${job.id}/logs`, {
              headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
              redirect: "follow",
            });
            if (logRes.ok) {
              const logText = await logRes.text();
              const lines = logText.split("\n").map(l => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/, ""));
              const errorLines = lines.filter(l =>
                l.includes("Error") || l.includes("error:") || l.includes("FAILURE") ||
                l.includes("Cannot find") || l.includes("not found") || l.includes("npm ERR!")
              ).slice(0, 50);
              if (errorLines.length > 0) {
                buildLogs = errorLines.join("\n");
                break;
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  return new Response(JSON.stringify({
    status: run.status === "completed" ? run.conclusion : run.status,
    runId: run.id,
    logs,
    buildLogs,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function downloadArtifact(body: DesktopBuildRequest, token: string) {
  if (!body.repoName || !body.runId) {
    return new Response(JSON.stringify({ error: "repoName and runId required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const username = await getAuthenticatedUser(token);
  const artifactsRes = await githubFetch(`/repos/${username}/${body.repoName}/actions/runs/${body.runId}/artifacts`, token);
  const artifacts = await artifactsRes.json();

  const allArtifacts = artifacts.artifacts || [];
  const desktopArtifact = allArtifacts.find((a: any) => a.name.startsWith("desktop-builds"));

  if (!desktopArtifact) {
    return new Response(JSON.stringify({
      error: "Desktop build artifacts not found",
      available: allArtifacts.map((a: any) => a.name),
    }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const dlUrl = `${GITHUB_API}/repos/${username}/${body.repoName}/actions/artifacts/${desktopArtifact.id}/zip`;
  const initialRes = await fetch(dlUrl, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
    redirect: "manual",
  });

  let buf: ArrayBuffer;
  if (initialRes.status === 302) {
    const loc = initialRes.headers.get("Location");
    if (!loc) throw new Error("No redirect URL");
    await initialRes.text();
    const r = await fetch(loc);
    buf = await r.arrayBuffer();
  } else if (initialRes.ok) {
    buf = await initialRes.arrayBuffer();
  } else {
    throw new Error(`Download failed: ${initialRes.status}`);
  }

  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, i + 8192);
    binary += String.fromCharCode(...chunk);
  }

  return new Response(JSON.stringify({
    success: true,
    artifactBase64: btoa(binary),
    artifactName: desktopArtifact.name,
    artifactSize: buf.byteLength,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function cleanupRepo(body: DesktopBuildRequest, token: string) {
  if (!body.repoName) {
    return new Response(JSON.stringify({ error: "repoName required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const username = await getAuthenticatedUser(token);
  const res = await githubFetch(`/repos/${username}/${body.repoName}`, token, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    await res.text();
    return new Response(JSON.stringify({ success: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (res.ok) await res.text();
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("GITHUB_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: DesktopBuildRequest = await req.json();

    switch (body.action) {
      case "start": return await startBuild(body, token);
      case "status": return await checkStatus(body, token);
      case "download": return await downloadArtifact(body, token);
      case "delete-repo": return await cleanupRepo(body, token);
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("build-desktop-electron error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
