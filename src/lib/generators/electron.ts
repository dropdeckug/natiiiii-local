import type { GeneratorConfig, GeneratedFile } from "./shared";

export type DesktopPlatform = "windows" | "macos" | "linux";

interface ElectronConfig extends GeneratorConfig {
  platforms?: DesktopPlatform[];
}

function getMainJs(url?: string): string {
  const loadContent = url
    ? `mainWindow.loadURL('${url}');`
    : `mainWindow.loadFile(path.join(__dirname, 'www', 'index.html'));`;

  return `const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  ${loadContent}

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
`;
}

function getPreloadJs(): string {
  return `const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  send: (channel, data) => {
    const validChannels = ['app:minimize', 'app:maximize', 'app:close'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
});
`;
}

function getPackageJson(appName: string, packageName: string, platforms: DesktopPlatform[]): string {
  const targets: Record<string, any> = {};

  if (platforms.includes("windows")) {
    targets.win = { target: ["nsis"], icon: "assets/icon.png" };
    targets.nsis = {
      oneClick: true,
      perMachine: false,
      allowToChangeInstallationDirectory: false,
    };
  }
  if (platforms.includes("macos")) {
    targets.mac = { target: ["dmg"], category: "public.app-category.utilities", identity: null };
    targets.dmg = { writeUpdateInfo: false };
  }
  if (platforms.includes("linux")) {
    targets.linux = { target: ["AppImage"], icon: "assets/icon.png", category: "Utility" };
  }

  const pkg = {
    name: packageName.replace(/\./g, "-"),
    version: "1.0.0",
    description: appName,
    main: "main.js",
    scripts: {
      start: "electron .",
      "build:win": "electron-builder --win",
      "build:mac": "electron-builder --mac",
      "build:linux": "electron-builder --linux",
      "build:all": "electron-builder --win --mac --linux",
    },
    build: {
      appId: packageName,
      productName: appName,
      directories: { output: "dist-electron" },
      files: ["main.js", "preload.js", "www/**/*", "assets/**/*"],
      ...targets,
    },
    devDependencies: {
      electron: "^33.0.0",
      "electron-builder": "^25.1.0",
    },
  };

  return JSON.stringify(pkg, null, 2);
}

function getFallbackHtml(appName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f0f0f; color: #fff; }
    .container { text-align: center; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${appName}</h1>
    <p>Desktop app powered by Electron</p>
    <p id="info"></p>
  </div>
  <script>
    if (window.electronAPI) {
      document.getElementById('info').textContent = 
        'Electron ' + window.electronAPI.versions.electron + ' | Node ' + window.electronAPI.versions.node;
    }
  </script>
</body>
</html>`;
}

export function generateElectronProject(config: ElectronConfig): GeneratedFile[] {
  const { appName, packageName, url, platforms = ["windows", "macos", "linux"] } = config;
  const files: GeneratedFile[] = [];

  files.push({ path: "main.js", content: getMainJs(url) });
  files.push({ path: "preload.js", content: getPreloadJs() });
  files.push({ path: "package.json", content: getPackageJson(appName, packageName, platforms) });

  if (!url) {
    files.push({ path: "www/index.html", content: getFallbackHtml(appName) });
  }

  files.push({
    path: "README.md",
    content: `# ${appName}\n\nDesktop app built with Electron via NativeBridge.\n\n## Development\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n\n## Build\n\n\`\`\`bash\nnpm run build:all\n\`\`\`\n`,
  });

  return files;
}

export function getElectronWorkflowYml(platforms: DesktopPlatform[]): string {
  const jobs: string[] = [];

  // Windows + Linux can build on ubuntu
  const hasWin = platforms.includes("windows");
  const hasLinux = platforms.includes("linux");
  const hasMac = platforms.includes("macos");

  if (hasWin || hasLinux) {
    const buildCmd = [hasWin && "--win", hasLinux && "--linux"].filter(Boolean).join(" ");
    const artifactPaths = [
      hasWin && "dist-electron/*.exe",
      hasLinux && "dist-electron/*.AppImage",
    ].filter(Boolean).join("\n          ");

    jobs.push(`  build-linux-win:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm install
      - name: Build desktop apps
        run: |
          if [ ! -s www/index.html ]; then
            echo "ERROR: www/index.html missing or empty"
            find . -maxdepth 3 -type f | sort | head -120
            exit 1
          fi
          npx electron-builder ${buildCmd} --publish never
        env:
          GH_TOKEN: \${{ github.token }}
          CSC_IDENTITY_AUTO_DISCOVERY: "false"
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: desktop-builds-linux-win
          path: |
            ${artifactPaths}
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
      - name: Install dependencies
        run: npm install
      - name: Build macOS app
        run: |
          if [ ! -s www/index.html ]; then
            echo "ERROR: www/index.html missing or empty"
            find . -maxdepth 3 -type f | sort | head -120
            exit 1
          fi
          npx electron-builder --mac --publish never
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

  return `name: Build Desktop Apps

on:
  push:
    branches: [main]

jobs:
${jobs.join("\n\n")}
`;
}
