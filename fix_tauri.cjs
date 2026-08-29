const fs = require('fs');

const path = 'supabase/functions/build-desktop-tauri/index.ts';
let code = fs.readFileSync(path, 'utf8');

const tauriFunc = `function getTauriSourceWorkflow(appName: string, packageName: string, platforms: string[], url?: string): string {
  const hasWin = platforms.includes("windows");
  const hasLinux = platforms.includes("linux");
  const hasMac = platforms.includes("macos");

  const jobs: string[] = [];

  const sourceExtract = \\\`
      - name: Extract source code
        run: |
          echo "=== Extracting source ==="
          if [ -f source.zip ]; then
            unzip -o source.zip -d project-src
            node -e "const fs=require('fs'),path=require('path');function walk(d,depth,out){if(depth>4||!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,depth+1,out);}if(fs.existsSync(path.join(d,'package.json')))out.push(d);}const c=[];walk('project-src',0,c);function s(p){try{const j=JSON.parse(fs.readFileSync(path.join(p,'package.json'),'utf8'));const d={...j.dependencies,...j.devDependencies};let x=0;if(d.electron)x+=100;if(j.scripts&&j.scripts.build)x+=70;if(d.vite||d.react||d.vue||d['@angular/core']||d.next||d.svelte)x+=40;if(Array.isArray(j.workspaces)||j.workspaces&&j.workspaces.packages)x-=160;return x-p.split('/').length;}catch(e){return -999;}}c.sort((a,b)=>s(b)-s(a));console.log(c[0]||'');" > .project-root.txt
            PROJECT_ROOT=$(cat .project-root.txt); rm -f .project-root.txt
            if [ -z "$PROJECT_ROOT" ]; then
              echo "No package.json found — checking for static HTML project..."
              STATIC_ROOT=$(find project-src -maxdepth 4 -name "index.html" -not -path "*/node_modules/*" -exec dirname {} \\\\\\; | head -1)
              if [ -z "$STATIC_ROOT" ]; then
                echo "ERROR: No package.json AND no index.html found in source.zip"
                exit 1
              fi
              PROJECT_ROOT="$STATIC_ROOT"
              echo "Detected static HTML project at: $PROJECT_ROOT"
              cat > "$PROJECT_ROOT/package.json" <<'STATICPKG'
{"name":"static-html-app","version":"1.0.0","private":true,"scripts":{"build":"node -e \\\\\\"const fs=require('fs'),path=require('path');fs.mkdirSync('dist',{recursive:true});function cp(s,d){for(const e of fs.readdirSync(s,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='dist'||e.name==='android'||e.name==='ios'||e.name==='www'||e.name.startsWith('.'))continue;const sp=path.join(s,e.name),dp=path.join(d,e.name);if(e.isDirectory()){fs.mkdirSync(dp,{recursive:true});cp(sp,dp);}else fs.copyFileSync(sp,dp);}}cp('.','dist');if(!fs.existsSync('dist/index.html')&&fs.existsSync('index.html'))fs.copyFileSync('index.html','dist/index.html');console.log('static copy -> dist');\\\\\\""}}
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
          mkdir -p www
          FOUND_OUTPUT=""
          for dir in dist build out .output/public; do
            if [ -d "$dir" ] && [ "$(ls -A $dir 2>/dev/null)" ]; then
              cp -r "$dir"/* www/
              FOUND_OUTPUT="$dir"
              break
            fi
          done
          if [ -z "$FOUND_OUTPUT" ] && [ -f index.html ]; then
            cp -r ./* www/ 2>/dev/null || true
            FOUND_OUTPUT="."
          fi
          if [ ! -s www/index.html ]; then
            if [ -z "\\\${url || ''}" ]; then
              echo "ERROR: Build output verification failed — www/index.html missing or empty"
              exit 1
            fi
          fi
\\\`;

  const tauriSetup = \\\`
      - name: Setup Tauri project
        run: |
          # If no www/index.html and no URL, create a fallback
          if [ ! -f www/index.html ] && [ -z "\\\${url || ''}" ]; then
            mkdir -p www
            echo '<!DOCTYPE html><html><head><title>\\\${appName}</title></head><body><h1>\\\${appName}</h1><p>Desktop app</p></body></html>' > www/index.html
          fi
          npm install @tauri-apps/cli@latest @tauri-apps/api@latest
          npx tauri init --app-name "\\\${appName}" --window-title "\\\${appName}" --frontend-dist "../www" --frontend-dev-cmd "npm run dev" --frontend-build-cmd "npm run build" --force
          
          # Fix tauri.conf.json to use the correct bundle identifier
          node -e "
            const fs = require('fs');
            const confPath = 'src-tauri/tauri.conf.json';
            const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
            if(conf.tauri) {
                conf.tauri.bundle = conf.tauri.bundle || {};
                conf.tauri.bundle.identifier = '\\\${packageName}';
            } else if(conf.app) {
                // Tauri 2.0 structure
                conf.identifier = '\\\${packageName}';
            }
            fs.writeFileSync(confPath, JSON.stringify(conf, null, 2));
          "
\\\`;

  if (hasWin || hasLinux) {
    jobs.push(\\\`
  build-linux-win:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Set up Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Install dependencies (Linux)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
\\\${sourceExtract}\\\${tauriSetup}
      - name: Build desktop apps
        run: npx tauri build
        env:
          GITHUB_TOKEN: \\\\\\\${{ github.token }}
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: desktop-builds-linux-win
          path: |
            src-tauri/target/release/bundle/appimage/*.AppImage
            src-tauri/target/release/bundle/deb/*.deb
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/nsis/*.exe
          retention-days: 7
          if-no-files-found: warn\\\`);
  }

  if (hasMac) {
    jobs.push(\\\`
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Set up Rust
        uses: dtolnay/rust-toolchain@stable
\\\${sourceExtract}\\\${tauriSetup}
      - name: Build macOS app
        run: npx tauri build
        env:
          GITHUB_TOKEN: \\\\\\\${{ github.token }}
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: desktop-builds-mac
          path: |
            src-tauri/target/release/bundle/dmg/*.dmg
          retention-days: 7
          if-no-files-found: warn\\\`);
  }

  return \\\`name: Build Desktop Apps (Tauri)
on:
  push:
    branches: [main]
env:
  CI: false
jobs:
\\\${jobs.join("\\\\n")}\\\`;
}`;

const startIdx = code.indexOf('function getTauriSourceWorkflow');
const endIdx = code.indexOf('async function startBuild');
if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + tauriFunc + "\n\n" + code.substring(endIdx);
} else {
    console.error("Could not find start/end indices in index.ts");
    process.exit(1);
}
fs.writeFileSync(path, code);
