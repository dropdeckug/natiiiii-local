/**
 * TOOL: Plugin Code Injector
 * Scans user source code for entry points (main.tsx, App.tsx, etc.)
 * and generates plugin initialization code, permissions, and gradle
 * dependency snippets that should be injected into the build.
 *
 * This tool works at the SOURCE level (before Capacitor CLI),
 * injecting import statements and initialization calls into the
 * user's web app code so Capacitor plugins are properly registered.
 */

import { PLUGIN_NPM_MAP } from "@/lib/generators/pluginMapping";

export interface PluginInjection {
  pluginId: string;
  npmPackage: string;
  importStatement: string;
  initCode: string;
  /** Android permissions needed */
  androidPermissions: string[];
  /** Any extra setup instructions */
  notes: string[];
}

export interface InjectionPlan {
  /** The file where plugin imports should be added */
  targetFile: string;
  /** Injections to apply */
  injections: PluginInjection[];
  /** Modified source code for the target file */
  modifiedSource: string | null;
  /** Warnings about the injection */
  warnings: string[];
  /** Summary of what was done */
  summary: string[];
}

// Plugin-specific initialization templates
const PLUGIN_INIT_MAP: Record<string, {
  importStatement: string;
  initCode: string;
  permissions: string[];
  notes: string[];
}> = {
  camera: {
    importStatement: `import { Camera } from '@capacitor/camera';`,
    initCode: `// Camera is auto-registered by Capacitor`,
    permissions: ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"],
    notes: ["Camera permission will be requested at runtime"],
  },
  geolocation: {
    importStatement: `import { Geolocation } from '@capacitor/geolocation';`,
    initCode: `// Geolocation is auto-registered by Capacitor`,
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    notes: ["Location permission required — add a rationale for App Store review"],
  },
  "push-notifications": {
    importStatement: `import { PushNotifications } from '@capacitor/push-notifications';`,
    initCode: `
// Register push notifications
PushNotifications.requestPermissions().then(result => {
  if (result.receive === 'granted') {
    PushNotifications.register();
  }
});
PushNotifications.addListener('registration', token => {
  console.log('Push token:', token.value);
});
PushNotifications.addListener('pushNotificationReceived', notification => {
  console.log('Push received:', notification);
});`,
    permissions: ["POST_NOTIFICATIONS"],
    notes: ["Requires google-services.json for Firebase Cloud Messaging", "Add FCM server key to your backend"],
  },
  filesystem: {
    importStatement: `import { Filesystem } from '@capacitor/filesystem';`,
    initCode: `// Filesystem is auto-registered by Capacitor`,
    permissions: ["READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"],
    notes: [],
  },
  share: {
    importStatement: `import { Share } from '@capacitor/share';`,
    initCode: `// Share is auto-registered by Capacitor`,
    permissions: [],
    notes: [],
  },
  haptics: {
    importStatement: `import { Haptics } from '@capacitor/haptics';`,
    initCode: `// Haptics is auto-registered by Capacitor`,
    permissions: ["VIBRATE"],
    notes: [],
  },
  "splash-screen": {
    importStatement: `import { SplashScreen } from '@capacitor/splash-screen';`,
    initCode: `// Hide splash screen after app is ready
SplashScreen.hide();`,
    permissions: [],
    notes: [],
  },
  "status-bar": {
    importStatement: `import { StatusBar, Style } from '@capacitor/status-bar';`,
    initCode: `// Configure status bar
StatusBar.setStyle({ style: Style.Dark });`,
    permissions: [],
    notes: [],
  },
  app: {
    importStatement: `import { App as CapApp } from '@capacitor/app';`,
    initCode: `// Handle back button for Android
CapApp.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) { window.history.back(); }
  else { CapApp.exitApp(); }
});`,
    permissions: [],
    notes: ["Back button handler auto-injected"],
  },
  preferences: {
    importStatement: `import { Preferences } from '@capacitor/preferences';`,
    initCode: `// Preferences is auto-registered by Capacitor`,
    permissions: [],
    notes: [],
  },
  network: {
    importStatement: `import { Network } from '@capacitor/network';`,
    initCode: `// Network is auto-registered by Capacitor`,
    permissions: ["ACCESS_NETWORK_STATE"],
    notes: [],
  },
  clipboard: {
    importStatement: `import { Clipboard } from '@capacitor/clipboard';`,
    initCode: `// Clipboard is auto-registered by Capacitor`,
    permissions: [],
    notes: [],
  },
  device: {
    importStatement: `import { Device } from '@capacitor/device';`,
    initCode: `// Device is auto-registered by Capacitor`,
    permissions: [],
    notes: [],
  },
  keyboard: {
    importStatement: `import { Keyboard } from '@capacitor/keyboard';`,
    initCode: `// Keyboard is auto-registered by Capacitor`,
    permissions: [],
    notes: [],
  },
  "local-notifications": {
    importStatement: `import { LocalNotifications } from '@capacitor/local-notifications';`,
    initCode: `// Request notification permissions
LocalNotifications.requestPermissions();`,
    permissions: ["POST_NOTIFICATIONS"],
    notes: [],
  },
  browser: {
    importStatement: `import { Browser } from '@capacitor/browser';`,
    initCode: `// Browser is auto-registered by Capacitor`,
    permissions: [],
    notes: [],
  },
  "capawesome-biometrics": {
    importStatement: `import { Biometrics } from '@capawesome/capacitor-biometrics';`,
    initCode: `// BiometricAuth is auto-registered by Capacitor`,
    permissions: ["USE_BIOMETRIC"],
    notes: ["Ensure device has biometric hardware"],
  },
  "edge-to-edge": {
    importStatement: ``,
    initCode: ``,
    permissions: [],
    notes: ["Edge-to-edge display is configured via Android theme and WindowInsetsCompat"],
  },
  barcode: {
    importStatement: `import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';`,
    initCode: `// BarcodeScanner is auto-registered by Capacitor`,
    permissions: ["CAMERA"],
    notes: ["ML Kit barcode scanning requires Google Play Services"],
  },
  "google-auth": {
    importStatement: `import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';`,
    initCode: `// Initialize Google Sign-In (Capawesome)
await GoogleSignIn.initialize({ clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID });`,
    permissions: [],
    notes: ["Set VITE_GOOGLE_WEB_CLIENT_ID in .env (your Web OAuth Client ID)", "Android requires SHA-1 fingerprint added to OAuth client; iOS requires GIDClientID in Info.plist"],
  },
  microphone: {
    importStatement: `import { Microphone } from '@mozartec/capacitor-microphone';`,
    initCode: `// Microphone is auto-registered by Capacitor`,
    permissions: ["RECORD_AUDIO"],
    notes: [],
  },
};

/**
 * Resolves a plugin identifier to an internal ID.
 * Accepts both internal IDs (e.g. "camera") and npm package names (e.g. "@capacitor/camera").
 */
export function resolvePluginId(input: string): string | null {
  // Direct match
  if (PLUGIN_NPM_MAP[input]) return input;

  // Reverse lookup by npm package name
  for (const [id, entry] of Object.entries(PLUGIN_NPM_MAP)) {
    if (entry.npm === input) return id;
  }

  // Try extracting the last segment (e.g. "@capacitor/camera" → "camera")
  const lastSegment = input.split("/").pop()?.toLowerCase();
  if (lastSegment && PLUGIN_NPM_MAP[lastSegment]) return lastSegment;

  return null;
}

/**
 * Resolves an array of mixed plugin identifiers (internal IDs or npm names)
 * to internal IDs.
 */
export function resolvePluginIds(inputs: string[]): { resolved: string[]; unresolved: string[] } {
  const resolved: string[] = [];
  const unresolved: string[] = [];

  for (const input of inputs) {
    const id = resolvePluginId(input);
    if (id) {
      if (!resolved.includes(id)) resolved.push(id);
    } else {
      unresolved.push(input);
    }
  }

  return { resolved, unresolved };
}

/**
 * Scans source files and generates an injection plan for the given plugins.
 * Also ALWAYS injects the back button handler via @capacitor/app.
 */
export function planPluginInjections(
  sourceFiles: { path: string; content?: string }[],
  pluginIds: string[],
  engine: string
): InjectionPlan {
  const warnings: string[] = [];
  const summary: string[] = [];
  const injections: PluginInjection[] = [];

  // Resolve any npm names to internal IDs
  const { resolved, unresolved } = resolvePluginIds(pluginIds);
  for (const u of unresolved) {
    warnings.push(`Plugin '${u}' could not be resolved to a known plugin`);
  }

  // Always include the back button handler for capacitor/ionic builds
  if ((engine === "capacitor" || engine === "ionic") && !resolved.includes("app")) {
    resolved.push("app");
  }

  // Find the best entry point file
  const entryPriority = [
    "src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js",
    "src/index.tsx", "src/index.ts", "src/index.jsx", "src/index.js",
    "src/App.tsx", "src/App.ts", "src/App.jsx", "src/App.js",
    "main.tsx", "main.ts", "index.tsx", "index.ts",
  ];

  let targetFile = "";
  let targetContent = "";

  for (const candidate of entryPriority) {
    const file = sourceFiles.find(f =>
      f.path === candidate || f.path.endsWith("/" + candidate)
    );
    if (file?.content) {
      targetFile = file.path;
      targetContent = file.content;
      break;
    }
  }

  if (!targetFile) {
    // Fall back to any .tsx/.ts file that imports React
    const reactFile = sourceFiles.find(f =>
      f.content?.includes("import React") || f.content?.includes("from 'react'")
    );
    if (reactFile?.content) {
      targetFile = reactFile.path;
      targetContent = reactFile.content;
    }
  }

  if (!targetFile) {
    warnings.push("No entry point found for plugin injection");
    return { targetFile: "", injections: [], modifiedSource: null, warnings, summary: ["No entry point found"] };
  }

  summary.push(`Entry point: ${targetFile}`);

  // Build injections for each plugin
  for (const pluginId of resolved) {
    const npmEntry = PLUGIN_NPM_MAP[pluginId];
    if (!npmEntry) {
      // Check if it's a special plugin like "edge-to-edge" handled only in init map
      const initTemplate = PLUGIN_INIT_MAP[pluginId];
      if (initTemplate) {
        injections.push({
          pluginId,
          npmPackage: "",
          importStatement: initTemplate.importStatement,
          initCode: initTemplate.initCode,
          androidPermissions: initTemplate.permissions,
          notes: initTemplate.notes,
        });
      }
      continue;
    }

    // Check engine compatibility
    if (!npmEntry.engines.includes(engine as any)) {
      warnings.push(`Plugin '${pluginId}' does not support engine '${engine}'`);
      continue;
    }

    const initTemplate = PLUGIN_INIT_MAP[pluginId];
    if (!initTemplate) {
      // Basic auto-registration for unknown plugins
      injections.push({
        pluginId,
        npmPackage: npmEntry.npm,
        importStatement: `// ${npmEntry.npm} — auto-registered by Capacitor`,
        initCode: "",
        androidPermissions: npmEntry.permissions || [],
        notes: [],
      });
      continue;
    }

    injections.push({
      pluginId,
      npmPackage: npmEntry.npm,
      importStatement: initTemplate.importStatement,
      initCode: initTemplate.initCode,
      androidPermissions: initTemplate.permissions,
      notes: initTemplate.notes,
    });
  }

  // Generate modified source
  let modifiedSource: string | null = null;
  if (injections.length > 0 && targetContent) {
    const importLines = injections
      .filter(inj => inj.importStatement && !inj.importStatement.startsWith("//") && !targetContent.includes(inj.importStatement))
      .map(inj => inj.importStatement);

    const initLines = injections
      .filter(inj => inj.initCode && inj.initCode.trim() !== "" && !inj.initCode.includes("auto-registered"))
      .map(inj => inj.initCode);

    if (importLines.length > 0 || initLines.length > 0) {
      const lines = targetContent.split("\n");
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("import ") || lines[i].startsWith("import{")) {
          lastImportIdx = i;
        }
      }

      const insertIdx = lastImportIdx + 1;
      const newImports = importLines.length > 0
        ? ["\n// Capacitor Plugin Imports (auto-injected by NativeBridge)", ...importLines]
        : [];

      const newInit = initLines.length > 0
        ? ["\n// Capacitor Plugin Initialization (auto-injected by NativeBridge)", ...initLines, ""]
        : [];

      lines.splice(insertIdx, 0, ...newImports, ...newInit);
      modifiedSource = lines.join("\n");
      summary.push(`Injected ${importLines.length} import(s) and ${initLines.length} init block(s)`);
    } else {
      summary.push("All plugin code already present in source");
    }
  }

  summary.push(`${injections.length} plugin(s) configured`);
  if (injections.some(inj => inj.androidPermissions.length > 0)) {
    const allPerms = [...new Set(injections.flatMap(inj => inj.androidPermissions))];
    summary.push(`Android permissions: ${allPerms.join(", ")}`);
  }

  return { targetFile, injections, modifiedSource, warnings, summary };
}

/**
 * Apply the injection plan to actual source files in memory.
 * Returns the list of modified file paths.
 */
export function applyInjectionPlan(
  plan: InjectionPlan,
  updateFileContent: (path: string, content: string) => void
): string[] {
  const modified: string[] = [];
  if (plan.modifiedSource && plan.targetFile) {
    updateFileContent(plan.targetFile, plan.modifiedSource);
    modified.push(plan.targetFile);
  }
  return modified;
}

export function injectionPlanToLogs(plan: InjectionPlan): string[] {
  const logs: string[] = [];
  logs.push("── Plugin Code Injection ──");
  for (const s of plan.summary) logs.push(s);
  for (const inj of plan.injections) {
    logs.push(`  • ${inj.pluginId} → ${inj.npmPackage || "(built-in)"}`);
    for (const note of inj.notes) logs.push(`    ℹ ${note}`);
  }
  for (const w of plan.warnings) logs.push(`⚠ ${w}`);
  return logs;
}
