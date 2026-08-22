import { forwardRef } from "react";
import CodeBlock from "./CodeBlock";
import Callout from "./Callout";

const DocsContent = forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref} className="flex-1 min-w-0 max-w-[780px] mx-auto px-6 lg:px-10 py-8 pb-32">
      
      {/* ═══════════════════ OVERVIEW ═══════════════════ */}
      <section className="mb-16">
        <h1 className="text-3xl font-bold text-white mb-3">NativeBridge Documentation</h1>
        <p className="text-[#888] text-base leading-relaxed mb-8">
          The complete guide to converting web applications into native mobile and desktop apps.
          NativeBridge handles the entire pipeline — from source upload to signed APK delivery.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
          {[
            { title: "Quick Start", desc: "Build your first APK in 5 minutes", href: "quick-start" },
            { title: "Build Engines", desc: "Capacitor, WebView, TWA, Electron", href: "engines" },
            { title: "Native Plugins", desc: "Camera, GPS, Push, Biometrics & 20+", href: "plugins" },
            { title: "AI Assistant", desc: "ForgeAI build intelligence", href: "ai-assistant" },
          ].map(c => (
            <button
              key={c.href}
              onClick={() => document.getElementById(c.href)?.scrollIntoView({ behavior: "smooth" })}
              className="text-left p-4 rounded-xl border border-[#222] bg-[#161616] hover:border-emerald-500/30 hover:bg-[#1a1a1a] transition-all group"
            >
              <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">{c.title}</h3>
              <p className="text-xs text-[#666] mt-1">{c.desc}</p>
            </button>
          ))}
        </div>

        <h2 id="what-is-nativebridge" className="text-xl font-bold text-white mt-12 mb-3 scroll-mt-20">What is NativeBridge?</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          NativeBridge is a cloud-based platform that transforms any web application into native mobile and desktop apps.
          It supports React, Vue, Angular, Svelte, Next.js (static export), Astro, plain HTML, and any framework 
          that produces static HTML/CSS/JS output.
        </p>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Instead of maintaining separate native codebases, NativeBridge generates production-ready Android projects
          using your choice of runtime engine — Capacitor, Ionic, WebView, TWA, or Electron for desktop.
        </p>

        <h2 id="how-it-works" className="text-xl font-bold text-white mt-12 mb-3 scroll-mt-20">How It Works</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          The build pipeline follows three phases:
        </p>
        <div className="space-y-3 mb-6">
          {[
            { phase: "1. Pre-Build Intelligence", desc: "Project scanning, compatibility checking, dependency resolution, plugin wiring, and config generation." },
            { phase: "2. Build Execution", desc: "Source bundling, GitHub repo creation, GitHub Actions workflow trigger, Gradle build on cloud runners." },
            { phase: "3. Post-Build", desc: "Build error parsing, artifact download, APK validation, and build logging." },
          ].map(p => (
            <div key={p.phase} className="flex gap-3 p-3 rounded-lg bg-[#161616] border border-[#1e1e1e]">
              <span className="text-emerald-400 text-sm font-semibold whitespace-nowrap">{p.phase.split(".")[0]}.</span>
              <div>
                <span className="text-white text-sm font-medium">{p.phase.split(". ")[1]}</span>
                <p className="text-[#777] text-xs mt-0.5">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 id="supported-platforms" className="text-xl font-bold text-white mt-12 mb-3 scroll-mt-20">Supported Platforms</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-[#222] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#161616]">
                <th className="text-left p-3 text-[#ccc] font-medium">Platform</th>
                <th className="text-left p-3 text-[#ccc] font-medium">Status</th>
                <th className="text-left p-3 text-[#ccc] font-medium">Engine</th>
              </tr>
            </thead>
            <tbody className="text-[#999]">
              {[
                ["Android", "✅ Production", "Capacitor, Ionic, WebView, TWA"],
                ["Windows", "✅ Production", "Electron"],
                ["macOS", "✅ Production", "Electron"],
                ["Linux", "✅ Production", "Electron"],
                ["iOS", "🗓 Roadmap", "Capacitor (planned)"],
              ].map(([platform, status, engine]) => (
                <tr key={platform} className="border-t border-[#1e1e1e]">
                  <td className="p-3 text-white font-medium">{platform}</td>
                  <td className="p-3">{status}</td>
                  <td className="p-3">{engine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══════════════════ QUICK START ═══════════════════ */}
      <section id="quick-start" className="mb-16 scroll-mt-20">
        <h2 id="upload-source" className="text-xl font-bold text-white mb-3 scroll-mt-20">Quick Start</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-6">
          Get a production-ready APK in three steps. No Android Studio, no Gradle, no local setup required.
        </p>

        <h3 id="configure-build" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Step 1: Upload Source Code</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          Drag & drop your web app's build output (the <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">dist/</code> or <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">build/</code> folder containing HTML, CSS, JS)
          or connect a GitHub repository.
        </p>
        <Callout type="tip" title="Supported Formats">
          Any framework that produces static output: React (<code className="text-emerald-300">npm run build</code>), Vue, Angular, Svelte, Next.js (static export), Astro, plain HTML.
        </Callout>

        <h3 className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Step 2: Configure Build</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          Select your runtime engine, set your app name, package ID (e.g., <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">com.mycompany.myapp</code>), and version.
          Optionally select native plugins (Camera, GPS, Push, etc.).
        </p>

        <h3 id="build-apk" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Step 3: Build APK</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          Click <strong className="text-white">Build</strong>. NativeBridge generates the native project, pushes it to GitHub, and triggers a GitHub Actions workflow.
          Your signed APK is ready in 3-5 minutes.
        </p>
        <CodeBlock
          language="bash"
          filename="Build output"
          code={`✓ Project scanned — React (Vite) detected
✓ Compatibility check passed
✓ Dependencies resolved (14 packages)
✓ Plugins wired: camera, geolocation, push-notifications
✓ Config generated (Capacitor 6.2.0, compileSdk 36)
✓ Source bundled (2.4 MB ZIP)
✓ GitHub repo created
✓ Build workflow triggered
✓ APK ready — download link available`}
        />
      </section>

      {/* ═══════════════════ BUILD ENGINES ═══════════════════ */}
      <section id="engines" className="mb-16 scroll-mt-20">
        <h2 className="text-xl font-bold text-white mb-3">Build Engines</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-6">
          Choose the right engine for your app. Each has different trade-offs for performance, APK size, and native API access.
        </p>

        {/* Capacitor */}
        <h2 id="engine-capacitor" className="text-xl font-bold text-white mt-10 mb-3 scroll-mt-20">Capacitor</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          The recommended engine for most web apps. Capacitor provides full native API access through a rich plugin ecosystem,
          excellent performance via the native WebView, and deep platform integration. Your web app runs inside a <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">BridgeActivity</code> that
          bridges JavaScript calls to native Android APIs.
        </p>
        <Callout type="info" title="Capacitor 6.2.0">
          NativeBridge uses Capacitor 6.2.0 with compileSdk 36, AGP 8.7.3, and Gradle 8.10.2. The AAR metadata requirement for compileSdk 36+ is automatically handled.
        </Callout>

        <h3 className="text-base font-semibold text-white mt-6 mb-2">Configuration</h3>
        <CodeBlock
          language="typescript"
          filename="capacitor.config.ts"
          code={`import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.myapp',
  appName: 'My App',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;`}
        />

        <h3 className="text-base font-semibold text-white mt-6 mb-2">Generated MainActivity.java</h3>
        <CodeBlock
          language="java"
          filename="MainActivity.java"
          code={`package com.example.myapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}`}
        />

        <h3 className="text-base font-semibold text-white mt-6 mb-2">App-level build.gradle</h3>
        <CodeBlock
          language="groovy"
          filename="app/build.gradle"
          code={`apply plugin: 'com.android.application'

android {
    namespace "com.example.myapp"
    compileSdk rootProject.ext.compileSdkVersion

    defaultConfig {
        applicationId "com.example.myapp"
        minSdk rootProject.ext.minSdkVersion
        targetSdk rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }
}

dependencies {
    implementation 'com.capacitorjs:core:7.5.0'
    implementation 'org.apache.cordova:framework:10.1.1'
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.activity:activity:$androidxActivityVersion"
    implementation "androidx.webkit:webkit:$androidxWebkitVersion"
}`}
        />

        {/* Ionic */}
        <h2 id="engine-ionic" className="text-xl font-bold text-white mt-12 mb-3 scroll-mt-20">Ionic Capacitor</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Best for apps built with the Ionic Framework. Ionic Capacitor extends the standard Capacitor engine with
          Ionic-specific UI component integration, adaptive styling per platform, and pre-configured plugins for
          StatusBar, SplashScreen, and Keyboard.
        </p>
        <CodeBlock
          language="typescript"
          filename="capacitor.config.ts (Ionic)"
          code={`import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.myapp',
  appName: 'My Ionic App',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    }
  }
};

export default config;`}
        />
        <Callout type="tip" title="Material Design">
          Ionic Capacitor adds <code className="text-emerald-300">com.google.android.material:material:1.11.0</code> to your dependencies for native Material component support.
        </Callout>

        {/* WebView */}
        <h2 id="engine-webview" className="text-xl font-bold text-white mt-12 mb-3 scroll-mt-20">Android WebView</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Wraps your web app in a production-grade native Android WebView. This engine generates a feature-rich <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">MainActivity.java</code> with:
        </p>
        <ul className="text-[#999] text-sm space-y-1.5 mb-4 list-disc list-inside">
          <li>Edge-to-edge display with WindowInsetsCompat</li>
          <li>Pull-to-refresh via SwipeRefreshLayout</li>
          <li>File upload support (camera + gallery)</li>
          <li>Download manager for file downloads</li>
          <li>Geolocation permission handling</li>
          <li>Cookie persistence across sessions</li>
          <li>JavaScript interface bridge (<code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">window.NativeBridge</code>)</li>
          <li>Proper back navigation</li>
          <li>Offline error page with retry</li>
          <li>External intent handling (tel:, mailto:, whatsapp:)</li>
        </ul>

        <h3 className="text-base font-semibold text-white mt-6 mb-2">JavaScript Bridge</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          The WebView engine exposes a <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">NativeBridge</code> JavaScript interface to your web app:
        </p>
        <CodeBlock
          language="javascript"
          filename="Using the JS Bridge"
          code={`// Check platform
const platform = window.NativeBridge.getPlatform(); // "android"

// Show native toast
window.NativeBridge.showToast("Hello from native!");

// Check connectivity
const online = window.NativeBridge.isOnline();

// Open external URL
window.NativeBridge.openExternal("https://play.google.com/store/apps/details?id=com.example.app");`}
        />

        <h3 className="text-base font-semibold text-white mt-6 mb-2">Network Security Config</h3>
        <CodeBlock
          language="xml"
          filename="network_security_config.xml"
          code={`<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>`}
        />

        {/* TWA */}
        <h2 id="engine-twa" className="text-xl font-bold text-white mt-12 mb-3 scroll-mt-20">Trusted Web Activity (TWA)</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Runs your Progressive Web App (PWA) in Chrome with a full-screen native experience. TWA uses Chrome's rendering engine
          directly — no WebView overhead. Your site must pass PWA criteria and set up Digital Asset Links verification.
        </p>
        <Callout type="warning" title="PWA Required">
          Your web app must be a valid PWA with a <code className="text-yellow-300">manifest.json</code>, service worker, and HTTPS hosting.
          TWA verifies ownership via Digital Asset Links.
        </Callout>

        <h3 className="text-base font-semibold text-white mt-6 mb-2">Digital Asset Links</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          Host this file at <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">https://yourdomain.com/.well-known/assetlinks.json</code>:
        </p>
        <CodeBlock
          language="json"
          filename=".well-known/assetlinks.json"
          code={`[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.example.myapp",
    "sha256_cert_fingerprints": [
      "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
    ]
  }
}]`}
        />

        <h3 className="text-base font-semibold text-white mt-6 mb-2">Strings Resource</h3>
        <CodeBlock
          language="xml"
          filename="strings.xml (TWA)"
          code={`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">My PWA App</string>
    <string name="asset_statements">
        [{
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {
                "namespace": "web",
                "site": "https://yourdomain.com"
            }
        }]
    </string>
</resources>`}
        />

        {/* Electron */}
        <h2 id="engine-electron" className="text-xl font-bold text-white mt-12 mb-3 scroll-mt-20">Electron (Desktop)</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Build native desktop apps for Windows (.exe), macOS (.dmg), and Linux (.AppImage) using Electron.
          NativeBridge generates a complete Electron project with <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">main.js</code>, <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">preload.js</code>,
          and electron-builder configuration.
        </p>

        <h3 className="text-base font-semibold text-white mt-6 mb-2">Main Process</h3>
        <CodeBlock
          language="javascript"
          filename="main.js"
          code={`const { app, BrowserWindow } = require('electron');
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

  mainWindow.loadURL('https://myapp.com');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});`}
        />

        <h3 className="text-base font-semibold text-white mt-6 mb-2">Preload Script</h3>
        <CodeBlock
          language="javascript"
          filename="preload.js"
          code={`const { contextBridge, ipcRenderer } = require('electron');

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
});`}
        />

        <h3 className="text-base font-semibold text-white mt-6 mb-2">Desktop Build Targets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-[#222] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#161616]">
                <th className="text-left p-3 text-[#ccc] font-medium">Platform</th>
                <th className="text-left p-3 text-[#ccc] font-medium">Output</th>
                <th className="text-left p-3 text-[#ccc] font-medium">Runner</th>
              </tr>
            </thead>
            <tbody className="text-[#999]">
              <tr className="border-t border-[#1e1e1e]"><td className="p-3 text-white">Windows</td><td className="p-3">.exe (NSIS installer)</td><td className="p-3">ubuntu-latest</td></tr>
              <tr className="border-t border-[#1e1e1e]"><td className="p-3 text-white">macOS</td><td className="p-3">.dmg</td><td className="p-3">macos-latest</td></tr>
              <tr className="border-t border-[#1e1e1e]"><td className="p-3 text-white">Linux</td><td className="p-3">.AppImage</td><td className="p-3">ubuntu-latest</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══════════════════ PLUGINS ═══════════════════ */}
      <section id="plugins" className="mb-16 scroll-mt-20">
        <h2 id="plugin-overview" className="text-xl font-bold text-white mb-3 scroll-mt-20">Native Plugins</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-6">
          Plugins add native device capabilities to your web app. NativeBridge supports 24+ plugins via the Capacitor ecosystem.
          Plugins are installed via npm and automatically wired into your Android project — permissions, Gradle dependencies, 
          and Java registrations are all handled for you.
        </p>
        <Callout type="info" title="Plugin Engines">
          Most plugins support <strong className="text-blue-300">Capacitor</strong> and <strong className="text-blue-300">Ionic</strong> engines.
          WebView and TWA engines have limited plugin support — they use their own native integrations.
        </Callout>

        {/* Camera */}
        <h3 id="plugin-camera" className="text-lg font-semibold text-white mt-10 mb-2 scroll-mt-20">Camera</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          Capture photos and videos using the device camera or pick from the photo gallery.
        </p>
        <div className="text-xs text-[#666] mb-3 flex flex-wrap gap-2">
          <span className="bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-1 rounded">@capacitor/camera</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">CAMERA</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">READ_MEDIA_IMAGES</span>
        </div>
        <CodeBlock language="typescript" filename="Camera usage" code={`import { Camera, CameraResultType } from '@capacitor/camera';

const takePicture = async () => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Uri
  });

  const imageUrl = image.webPath;
  // Can use imageUrl to display in an <img> tag
};`} />

        {/* Geolocation */}
        <h3 id="plugin-geolocation" className="text-lg font-semibold text-white mt-10 mb-2 scroll-mt-20">Geolocation</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          Access GPS coordinates, watch position changes, and get high-accuracy location data.
        </p>
        <div className="text-xs text-[#666] mb-3 flex flex-wrap gap-2">
          <span className="bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-1 rounded">@capacitor/geolocation</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">ACCESS_FINE_LOCATION</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">ACCESS_COARSE_LOCATION</span>
        </div>
        <CodeBlock language="typescript" filename="Geolocation usage" code={`import { Geolocation } from '@capacitor/geolocation';

// Get current position
const position = await Geolocation.getCurrentPosition();
console.log('Lat:', position.coords.latitude);
console.log('Lng:', position.coords.longitude);

// Watch position changes
const watchId = await Geolocation.watchPosition({}, (position) => {
  console.log('Position changed:', position);
});`} />

        {/* Push Notifications */}
        <h3 id="plugin-push" className="text-lg font-semibold text-white mt-10 mb-2 scroll-mt-20">Push Notifications</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          Send and receive push notifications via Firebase Cloud Messaging (FCM).
        </p>
        <div className="text-xs text-[#666] mb-3 flex flex-wrap gap-2">
          <span className="bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-1 rounded">@capacitor/push-notifications</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">POST_NOTIFICATIONS</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">WAKE_LOCK</span>
        </div>
        <CodeBlock language="typescript" filename="Push Notifications setup" code={`import { PushNotifications } from '@capacitor/push-notifications';

// Request permission
await PushNotifications.requestPermissions();

// Register for push
await PushNotifications.register();

// Listen for registration
PushNotifications.addListener('registration', (token) => {
  console.log('FCM Token:', token.value);
  // Send token to your backend
});

// Listen for incoming notifications
PushNotifications.addListener('pushNotificationReceived', (notification) => {
  console.log('Push received:', notification);
});`} />

        {/* Filesystem */}
        <h3 id="plugin-filesystem" className="text-lg font-semibold text-white mt-10 mb-2 scroll-mt-20">File System</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">Read, write, and manage files on device storage.</p>
        <div className="text-xs text-[#666] mb-3 flex flex-wrap gap-2">
          <span className="bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-1 rounded">@capacitor/filesystem</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">READ_EXTERNAL_STORAGE</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">WRITE_EXTERNAL_STORAGE</span>
        </div>
        <CodeBlock language="typescript" filename="Filesystem usage" code={`import { Filesystem, Directory } from '@capacitor/filesystem';

// Write a file
await Filesystem.writeFile({
  path: 'secrets/text.txt',
  data: 'Hello, world!',
  directory: Directory.Documents,
});

// Read a file
const contents = await Filesystem.readFile({
  path: 'secrets/text.txt',
  directory: Directory.Documents,
});`} />

        {/* Biometrics */}
        <h3 id="plugin-biometrics" className="text-lg font-semibold text-white mt-10 mb-2 scroll-mt-20">Biometrics</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">Fingerprint and face recognition authentication.</p>
        <div className="text-xs text-[#666] mb-3 flex flex-wrap gap-2">
          <span className="bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-1 rounded">@capawesome/capacitor-biometric-auth</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">USE_BIOMETRIC</span>
        </div>
        <CodeBlock language="typescript" filename="Biometrics usage" code={`import { BiometricAuth } from '@capawesome/capacitor-biometric-auth';

// Check availability
const { isAvailable } = await BiometricAuth.checkBiometry();

if (isAvailable) {
  // Authenticate
  await BiometricAuth.authenticate({
    reason: 'Please authenticate to continue',
    cancelTitle: 'Cancel',
  });
  console.log('Authenticated!');
}`} />

        {/* Local Notifications */}
        <h3 id="plugin-local-notif" className="text-lg font-semibold text-white mt-10 mb-2 scroll-mt-20">Local Notifications</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">Schedule and display local notifications without a server.</p>
        <div className="text-xs text-[#666] mb-3 flex flex-wrap gap-2">
          <span className="bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-1 rounded">@capacitor/local-notifications</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">POST_NOTIFICATIONS</span>
          <span className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">SCHEDULE_EXACT_ALARM</span>
        </div>
        <CodeBlock language="typescript" filename="Local Notifications" code={`import { LocalNotifications } from '@capacitor/local-notifications';

await LocalNotifications.schedule({
  notifications: [{
    title: 'Reminder',
    body: 'Don\\'t forget your daily check-in!',
    id: 1,
    schedule: { at: new Date(Date.now() + 1000 * 60 * 5) }, // 5 min
  }]
});`} />

        {/* Remaining plugins - compact */}
        {[
          { id: "plugin-share", name: "Share", pkg: "@capacitor/share", perms: [], desc: "Native share dialog for text, URLs, and files.", code: `import { Share } from '@capacitor/share';\n\nawait Share.share({\n  title: 'Check this out',\n  text: 'Really cool thing I found',\n  url: 'https://example.com',\n  dialogTitle: 'Share with friends',\n});` },
          { id: "plugin-haptics", name: "Haptics", pkg: "@capacitor/haptics", perms: ["VIBRATE"], desc: "Trigger haptic feedback (vibration) on the device.", code: `import { Haptics, ImpactStyle } from '@capacitor/haptics';\n\nawait Haptics.impact({ style: ImpactStyle.Medium });\nawait Haptics.vibrate();` },
          { id: "plugin-clipboard", name: "Clipboard", pkg: "@capacitor/clipboard", perms: [], desc: "Read and write to the system clipboard.", code: `import { Clipboard } from '@capacitor/clipboard';\n\nawait Clipboard.write({ string: 'Hello, clipboard!' });\nconst { value } = await Clipboard.read();\nconsole.log('Clipboard:', value);` },
          { id: "plugin-network", name: "Network", pkg: "@capacitor/network", perms: ["ACCESS_NETWORK_STATE"], desc: "Monitor network status and connection type changes.", code: `import { Network } from '@capacitor/network';\n\nconst status = await Network.getStatus();\nconsole.log('Connected:', status.connected);\nconsole.log('Type:', status.connectionType);\n\nNetwork.addListener('networkStatusChange', (status) => {\n  console.log('Network changed:', status);\n});` },
          { id: "plugin-device", name: "Device", pkg: "@capacitor/device", perms: [], desc: "Get device information (model, OS, battery, language).", code: `import { Device } from '@capacitor/device';\n\nconst info = await Device.getInfo();\nconsole.log('Model:', info.model);\nconsole.log('OS:', info.operatingSystem);\nconsole.log('OS Version:', info.osVersion);` },
          { id: "plugin-statusbar", name: "Status Bar", pkg: "@capacitor/status-bar", perms: [], desc: "Control status bar color, style, and visibility.", code: `import { StatusBar, Style } from '@capacitor/status-bar';\n\nawait StatusBar.setStyle({ style: Style.Dark });\nawait StatusBar.setBackgroundColor({ color: '#000000' });\nawait StatusBar.hide();` },
          { id: "plugin-keyboard", name: "Keyboard", pkg: "@capacitor/keyboard", perms: [], desc: "Listen to keyboard events and control keyboard behavior.", code: `import { Keyboard } from '@capacitor/keyboard';\n\nKeyboard.addListener('keyboardWillShow', (info) => {\n  console.log('Keyboard height:', info.keyboardHeight);\n});\n\nKeyboard.addListener('keyboardWillHide', () => {\n  console.log('Keyboard hidden');\n});\n\nawait Keyboard.hide();` },
          { id: "plugin-splash", name: "Splash Screen", pkg: "@capacitor/splash-screen", perms: [], desc: "Configure and control the app launch splash screen.", code: `import { SplashScreen } from '@capacitor/splash-screen';\n\n// Show splash\nawait SplashScreen.show({ autoHide: false });\n\n// Hide after your app is ready\nawait SplashScreen.hide();` },
          { id: "plugin-storage", name: "Preferences / Storage", pkg: "@capacitor/preferences", perms: [], desc: "Simple key-value persistent storage.", code: `import { Preferences } from '@capacitor/preferences';\n\nawait Preferences.set({ key: 'user', value: JSON.stringify({ name: 'John' }) });\n\nconst { value } = await Preferences.get({ key: 'user' });\nconst user = JSON.parse(value || '{}');` },
          { id: "plugin-browser", name: "In-App Browser", pkg: "@capacitor/browser", perms: [], desc: "Open URLs in an in-app browser (Chrome Custom Tabs).", code: `import { Browser } from '@capacitor/browser';\n\nawait Browser.open({ url: 'https://capacitorjs.com' });\n\nBrowser.addListener('browserFinished', () => {\n  console.log('Browser closed');\n});` },
          { id: "plugin-google-auth", name: "Google Sign-In", pkg: "@capawesome/capacitor-google-sign-in", perms: [], desc: "Google Sign-In via the maintained Capawesome plugin (Credential Manager on Android, native iOS).", code: `import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';\n\nawait GoogleSignIn.initialize({ clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID });\n\nconst result = await GoogleSignIn.signIn();\nconsole.log('User:', result.email);` },
          { id: "plugin-apple-auth", name: "Apple Sign-In", pkg: "@capawesome/capacitor-apple-sign-in", perms: [], desc: "Sign in with Apple via the maintained Capawesome plugin.", code: `import { AppleSignIn } from '@capawesome/capacitor-apple-sign-in';\n\nconst result = await AppleSignIn.authorize({\n  clientId: import.meta.env.VITE_APPLE_SERVICE_ID,\n  redirectURI: 'https://your-app.com/auth/apple/callback',\n  scopes: 'email name',\n});\nconsole.log('Apple User:', result);` },
          { id: "plugin-barcode", name: "Barcode Scanning", pkg: "@capacitor-mlkit/barcode-scanning", perms: ["CAMERA"], desc: "Scan QR codes and barcodes using ML Kit.", code: `import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';\n\nconst { barcodes } = await BarcodeScanner.scan();\nbarcodes.forEach(barcode => {\n  console.log('Value:', barcode.rawValue);\n  console.log('Format:', barcode.format);\n});` },
          { id: "plugin-bluetooth", name: "Bluetooth LE", pkg: "@capacitor-community/bluetooth-le", perms: ["BLUETOOTH", "BLUETOOTH_ADMIN", "BLUETOOTH_SCAN", "BLUETOOTH_CONNECT"], desc: "Bluetooth Low Energy communication.", code: `import { BleClient } from '@capacitor-community/bluetooth-le';\n\nawait BleClient.initialize();\n\nconst devices = await BleClient.requestDevice({ services: [] });\nconsole.log('Device:', devices.name);` },
          { id: "plugin-sms", name: "SMS", pkg: "@byteowls/capacitor-sms", perms: ["SEND_SMS"], desc: "Send SMS messages from the device.", code: `import { Sms } from '@byteowls/capacitor-sms';\n\nawait Sms.send({\n  numbers: ['+1234567890'],\n  text: 'Hello from NativeBridge!'\n});` },
          { id: "plugin-iap", name: "In-App Purchases", pkg: "@capawesome-team/capacitor-purchases", perms: ["BILLING"], desc: "In-app purchases and subscriptions via Google Play Billing.", code: `import { Purchases } from '@capawesome-team/capacitor-purchases';\n\nawait Purchases.configure({ apiKey: 'YOUR_API_KEY' });\n\nconst { products } = await Purchases.getProducts({\n  productIdentifiers: ['premium_monthly']\n});\n\nawait Purchases.purchaseProduct({ productIdentifier: 'premium_monthly' });` },
          { id: "plugin-microphone", name: "Microphone", pkg: "@mozartec/capacitor-microphone", perms: ["RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"], desc: "Record audio from the device microphone.", code: `import { Microphone } from '@mozartec/capacitor-microphone';\n\nawait Microphone.requestPermission();\n\n// Start recording\nawait Microphone.startRecording();\n\n// Stop and get the recording\nconst recording = await Microphone.stopRecording();\nconsole.log('Recording:', recording.path);` },
        ].map(plugin => (
          <div key={plugin.id}>
            <h3 id={plugin.id} className="text-lg font-semibold text-white mt-10 mb-2 scroll-mt-20">{plugin.name}</h3>
            <p className="text-[#999] text-sm leading-relaxed mb-3">{plugin.desc}</p>
            <div className="text-xs text-[#666] mb-3 flex flex-wrap gap-2">
              <span className="bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-1 rounded">{plugin.pkg}</span>
              {plugin.perms.map(p => (
                <span key={p} className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-red-400">{p}</span>
              ))}
            </div>
            <CodeBlock language="typescript" filename={`${plugin.name} usage`} code={plugin.code} />
          </div>
        ))}
      </section>

      {/* ═══════════════════ AI ASSISTANT ═══════════════════ */}
      <section id="ai-assistant" className="mb-16 scroll-mt-20">
        <h2 id="forge-ai-overview" className="text-xl font-bold text-white mb-3 scroll-mt-20">AI Assistant — ForgeAI</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          ForgeAI is the built-in AI assistant that helps you throughout the build process. It has deep knowledge of
          Android development, Capacitor, Gradle, and the NativeBridge pipeline.
        </p>

        <h3 id="forge-ai-capabilities" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Capabilities</h3>
        <ul className="text-[#999] text-sm space-y-2 mb-4 list-disc list-inside">
          <li><strong className="text-white">Build Assistant</strong> — Diagnose build errors, suggest fixes for Gradle/AAR/SDK issues</li>
          <li><strong className="text-white">Code Analyzer</strong> — Analyze your web app source code for compatibility issues</li>
          <li><strong className="text-white">Project Setup Guide</strong> — Walk you through engine selection, plugin choices, and configuration</li>
          <li><strong className="text-white">Plugin Expert</strong> — Help with plugin installation, permissions, and usage examples</li>
          <li><strong className="text-white">General Coding Help</strong> — Answer questions about web-to-native development</li>
        </ul>

        <h3 id="forge-ai-context" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Context & Memory</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          ForgeAI receives context about your current project: the selected engine, enabled plugins, app name, package ID,
          build status, and recent error logs. This allows it to give highly specific advice tailored to your build.
        </p>
      </section>

      {/* ═══════════════════ BUILD TOOLS ═══════════════════ */}
      <section id="build-tools" className="mb-16 scroll-mt-20">
        <h2 className="text-xl font-bold text-white mb-3">Build Tools Pipeline</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-6">
          NativeBridge uses 12 specialized tools that run at each stage of the build pipeline.
          Each tool is self-contained, composable, and produces structured logs.
        </p>

        {[
          { id: "tool-project-scanner", name: "Project Scanner", desc: "Detects the framework (React, Vue, Angular, etc.), package manager, build scripts, and project structure. Identifies the web output directory and entry point.", phase: "Pre-Build" },
          { id: "tool-compatibility", name: "Compatibility Checker", desc: "Validates that your project can build for the selected target engine. Checks for known incompatibilities, missing requirements (e.g., PWA for TWA), and SDK constraints.", phase: "Pre-Build" },
          { id: "tool-dependency", name: "Dependency Resolver", desc: "Analyzes npm dependencies, identifies native plugin requirements, resolves version conflicts, and determines the install strategy (npm/yarn/pnpm).", phase: "Pre-Build" },
          { id: "tool-plugin-wirer", name: "Plugin Wirer", desc: "Maps selected plugins to their required Android permissions, Gradle dependencies, Java imports, and plugin registrations. Generates the wiring code for MainActivity.", phase: "Pre-Build" },
          { id: "tool-config-gen", name: "Config Generator", desc: "Generates all build configuration files from the version matrix: variables.gradle, gradle-wrapper.properties, capacitor.config.ts, and build.gradle files.", phase: "Pre-Build" },
          { id: "tool-source-bundler", name: "Source Bundler", desc: "Bundles the generated Android project into a ZIP file for upload to GitHub. Handles binary files (icons), text encoding, and path normalization.", phase: "Build" },
          { id: "tool-error-parser", name: "Build Error Parser", desc: "Classifies Gradle and npm build errors into categories (SDK mismatch, dependency conflict, compilation error, resource error) and suggests fixes.", phase: "Post-Build" },
          { id: "tool-artifact", name: "Artifact Downloader", desc: "Downloads the built APK artifact from GitHub Actions. Monitors workflow status, handles pagination, and manages download timeouts.", phase: "Post-Build" },
          { id: "tool-manifest", name: "Manifest Merger", desc: "Merges Android manifest entries when plugins require additional activities, services, receivers, or metadata. Handles permission deduplication.", phase: "Pre-Build" },
          { id: "tool-logger", name: "Build Logger", desc: "Streams build logs to the UI store and persists them to the database. Supports structured log entries with timestamps, levels, and categories.", phase: "All Phases" },
          { id: "tool-apk-validator", name: "APK Validator", desc: "Validates the downloaded APK artifact: checks file size, ZIP integrity, and presence of expected entries (classes.dex, AndroidManifest.xml).", phase: "Post-Build" },
          { id: "tool-plugin-injector", name: "Plugin Code Injector", desc: "Plans and executes code injections for plugins that require modifications to MainActivity.java, AndroidManifest.xml, and build.gradle.", phase: "Pre-Build" },
        ].map(tool => (
          <div key={tool.id} id={tool.id} className="p-4 rounded-lg border border-[#1e1e1e] bg-[#141414] mb-3 scroll-mt-20">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-semibold text-white">{tool.name}</h3>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">{tool.phase}</span>
            </div>
            <p className="text-[#888] text-xs leading-relaxed">{tool.desc}</p>
          </div>
        ))}
      </section>

      {/* ═══════════════════ BUILD CONFIG ═══════════════════ */}
      <section id="build-config" className="mb-16 scroll-mt-20">
        <h2 id="sdk-versions" className="text-xl font-bold text-white mb-3 scroll-mt-20">Build Configuration & Infrastructure</h2>
        
        <h3 className="text-lg font-semibold text-white mt-6 mb-2">SDK & Gradle Versions</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          All version numbers are centralized in the version matrix. The build pipeline automatically uses the correct versions.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-[#222] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#161616]">
                <th className="text-left p-3 text-[#ccc] font-medium">Component</th>
                <th className="text-left p-3 text-[#ccc] font-medium">Version</th>
                <th className="text-left p-3 text-[#ccc] font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="text-[#999]">
              {[
                ["compileSdk", "36", "Auto-upgrades if plugins require higher"],
                ["targetSdk", "36", "Required for latest Play Store policies"],
                ["minSdk", "24", "Supports Android 7.0+ (95%+ devices)"],
                ["AGP", "8.7.3", "Android Gradle Plugin"],
                ["Gradle", "8.10.2", "Wrapper distribution"],
                ["JDK", "21", "Java Development Kit on runners"],
                ["Capacitor", "6.2.0", "Latest stable with compileSdk 36 support"],
                ["Kotlin", "1.9.x", "Required by some plugins"],
                ["Node.js", "20.x", "Used for npm install during build"],
                ["Cordova Framework", "10.1.1", "Legacy compatibility layer"],
              ].map(([comp, ver, note]) => (
                <tr key={comp} className="border-t border-[#1e1e1e]">
                  <td className="p-3 text-white font-medium">{comp}</td>
                  <td className="p-3 text-emerald-400 font-mono text-xs">{ver}</td>
                  <td className="p-3">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 id="github-actions" className="text-lg font-semibold text-white mt-10 mb-2 scroll-mt-20">GitHub Actions Runners</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Builds run on GitHub Actions runners. Android builds use <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">ubuntu-latest</code>,
          macOS desktop builds use <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">macos-latest</code>.
          Each build typically uses 3-5 minutes of runner time.
        </p>

        <h3 id="aar-metadata" className="text-lg font-semibold text-white mt-10 mb-2 scroll-mt-20">AAR Metadata Resolution</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          When plugins ship AAR artifacts that require a minimum <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">compileSdk</code>,
          Gradle will fail with a metadata check error. NativeBridge automatically detects these conflicts and upgrades
          the compileSdk to the required version (e.g., 34 → 36 for Capacitor 6.2.0).
        </p>
        <Callout type="warning" title="AAR Metadata Check">
          If you see errors like "requires compileSdk 36 but this module was compiled with compileSdk 34", NativeBridge's
          version matrix already handles this. The build will auto-upgrade your project's compileSdk.
        </Callout>
      </section>

      {/* ═══════════════════ PROJECT STRUCTURE ═══════════════════ */}
      <section id="project-structure" className="mb-16 scroll-mt-20">
        <h2 className="text-xl font-bold text-white mb-3">Project Structure</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-6">
          Here's what NativeBridge generates for each engine.
        </p>

        <h3 id="structure-capacitor" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Capacitor Project</h3>
        <CodeBlock language="text" filename="File tree" code={`├── build.gradle                    # Root build script
├── settings.gradle                 # Project settings
├── variables.gradle                # Version variables (from matrix)
├── gradle.properties               # Gradle JVM settings
├── gradlew / gradlew.bat           # Gradle wrapper scripts
├── gradle/wrapper/
│   └── gradle-wrapper.properties   # Gradle distribution URL
├── capacitor.config.ts             # Capacitor configuration
├── app/
│   ├── build.gradle                # App-level build script
│   ├── proguard-rules.pro          # ProGuard rules
│   └── src/main/
│       ├── AndroidManifest.xml     # App manifest
│       ├── java/com/.../
│       │   └── MainActivity.java   # Bridge activity
│       ├── assets/
│       │   ├── capacitor.config.json
│       │   └── public/index.html   # Your web app
│       └── res/
│           ├── values/strings.xml
│           ├── values/styles.xml
│           ├── values/colors.xml
│           ├── drawable/splash_screen.xml
│           ├── xml/file_paths.xml
│           └── mipmap-*/ic_launcher.png`} />

        <h3 id="structure-webview" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">WebView Project</h3>
        <CodeBlock language="text" filename="File tree" code={`├── build.gradle                    # Root build script (AGP 8.2.2)
├── settings.gradle
├── app/
│   ├── build.gradle                # compileSdk 36, minSdk 24
│   └── src/main/
│       ├── AndroidManifest.xml     # WebView permissions
│       ├── java/com/.../
│       │   └── MainActivity.java   # Full WebView with bridge
│       └── res/
│           ├── xml/network_security_config.xml
│           └── values/styles.xml   # Edge-to-edge theme`} />

        <h3 id="structure-twa" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">TWA Project</h3>
        <CodeBlock language="text" filename="File tree" code={`├── build.gradle
├── settings.gradle
├── app/
│   ├── build.gradle                # androidbrowserhelper dependency
│   └── src/main/
│       ├── AndroidManifest.xml     # LauncherActivity + asset links
│       └── res/values/
│           └── strings.xml         # asset_statements for DAL`} />

        <h3 id="structure-electron" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Electron Project</h3>
        <CodeBlock language="text" filename="File tree" code={`├── main.js                  # Main process
├── preload.js               # Preload script (context bridge)
├── package.json             # electron-builder config
├── www/index.html           # Fallback HTML (if no URL)
├── assets/icon.png          # App icon
└── README.md`} />
      </section>

      {/* ═══════════════════ GITHUB INTEGRATION ═══════════════════ */}
      <section id="github-integration" className="mb-16 scroll-mt-20">
        <h2 id="repo-connection" className="text-xl font-bold text-white mb-3 scroll-mt-20">GitHub Integration</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          NativeBridge can build from a connected GitHub repository instead of uploaded files.
        </p>

        <h3 id="branch-selection" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Branch Selection</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Select which branch to build from. The build pipeline will clone the specified branch,
          run <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">npm install</code> and <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">npm run build</code>,
          then use the output for the native project.
        </p>

        <h3 id="webhook-builds" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Webhook Builds</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Configure webhooks to trigger builds automatically on push to your selected branch.
          This enables continuous deployment of your mobile app whenever you update your web app.
        </p>
      </section>

      {/* ═══════════════════ SIGNING ═══════════════════ */}
      <section id="signing" className="mb-16 scroll-mt-20">
        <h2 id="debug-keystore" className="text-xl font-bold text-white mb-3 scroll-mt-20">Signing & Deployment</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Android apps must be signed to install on devices. NativeBridge supports both debug and release signing.
        </p>

        <h3 id="release-keystore" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Release Keystore</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          For Google Play publishing, upload your own release keystore (.jks or .keystore file) with the key alias and passwords.
          NativeBridge stores these securely and uses them during the signing step.
        </p>

        <h3 id="google-play" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">Google Play Upload</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          Release builds produce signed APKs ready for upload to Google Play Console. You can also generate AAB (Android App Bundle) 
          files, which Google Play prefers for optimized delivery.
        </p>

        <h3 id="aab-generation" className="text-lg font-semibold text-white mt-8 mb-2 scroll-mt-20">AAB Generation</h3>
        <p className="text-[#999] text-sm leading-relaxed mb-3">
          AAB (Android App Bundle) is the recommended publishing format for Google Play. It allows Google Play to generate
          optimized APKs for each device configuration, reducing download size.
        </p>
        <CodeBlock language="bash" filename="Build AAB" code={`# The build workflow generates both APK and AAB
./gradlew assembleRelease    # Produces APK
./gradlew bundleRelease      # Produces AAB`} />
      </section>

      {/* ═══════════════════ SDK REFERENCE ═══════════════════ */}
      <section id="sdk-reference" className="mb-16 scroll-mt-20">
        <h2 id="version-matrix" className="text-xl font-bold text-white mb-3 scroll-mt-20">SDK & Version Reference</h2>
        <p className="text-[#999] text-sm leading-relaxed mb-4">
          Complete version matrix for all dependencies used in generated projects.
        </p>
        <CodeBlock language="groovy" filename="variables.gradle (auto-generated)" code={`ext {
    minSdkVersion = 24
    compileSdkVersion = 36
    targetSdkVersion = 36
    androidxActivityVersion = '1.9.3'
    androidxAppCompatVersion = '1.7.0'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.15.0'
    androidxFragmentVersion = '1.8.5'
    coreSplashScreenVersion = '1.0.1'
    androidxWebkitVersion = '1.12.1'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.2.1'
    androidxEspressoCoreVersion = '3.6.1'
    cordovaAndroidVersion = '10.1.1'
}`} />
      </section>

      {/* ═══════════════════ FAQ ═══════════════════ */}
      <section id="faq" className="mb-16 scroll-mt-20">
        <h2 className="text-xl font-bold text-white mb-6">Frequently Asked Questions</h2>

        {[
          { id: "faq-frameworks", q: "What web frameworks are supported?", a: "Any framework that produces static HTML/CSS/JS output: React, Vue, Angular, Svelte, Next.js (static export), Astro, plain HTML, and more. If it has a build step that outputs a dist/ or build/ folder, it works." },
          { id: "faq-build-time", q: "How long does a build take?", a: "Typical builds complete in 3-5 minutes. Complex projects with many plugins may take up to 8 minutes. Desktop (Electron) builds for multiple platforms may take 5-10 minutes due to parallel runners." },
          { id: "faq-play-store", q: "Can I publish to Google Play?", a: "Yes! Use release builds with your own signing keystore. NativeBridge generates signed APKs and AABs ready for Google Play Console upload. Make sure to set targetSdk to 34+ as required by Google Play." },
          { id: "faq-aar-errors", q: "What causes AAR metadata errors?", a: "These occur when a Capacitor plugin's AAR artifact requires a higher compileSdk than your project. For example, Capacitor 6.2.0 requires compileSdk 36. NativeBridge's version matrix auto-resolves this." },
          { id: "faq-ios", q: "Is iOS supported?", a: "iOS support is on our roadmap. Currently, NativeBridge focuses on Android and desktop builds. The Capacitor engine is designed to support iOS — we'll add Xcode Cloud integration when iOS support launches." },
          { id: "faq-desktop", q: "Can I build desktop apps?", a: "Yes! Use the Electron engine to build for Windows (.exe), macOS (.dmg), and Linux (.AppImage). Each platform builds on the appropriate GitHub Actions runner. You can select one or all platforms." },
        ].map(faq => (
          <div key={faq.id} id={faq.id} className="p-4 rounded-lg border border-[#1e1e1e] bg-[#141414] mb-3 scroll-mt-20">
            <h3 className="text-sm font-semibold text-white mb-2">{faq.q}</h3>
            <p className="text-[#888] text-xs leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </section>

    </div>
  );
});

DocsContent.displayName = "DocsContent";

export default DocsContent;
