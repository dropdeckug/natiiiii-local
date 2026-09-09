/**
 * Server-side plugin knowledge pack (source of truth for agent injection).
 * Mirrored client-side by src/lib/tools/pluginKnowledgePack.ts for the
 * dashboard "What this touches" surface — keep both in sync.
 */

export type PluginCategory =
  | "auth" | "media" | "storage" | "notifications" | "device"
  | "ui" | "network" | "payments" | "analytics" | "background" | "location" | "system";

export interface PluginKnowledge {
  id: string;
  npm: string;
  importName: string;
  category: PluginCategory;
  androidPermissions: string[];
  manifestEntries: string[];
  gradleDependencies: string[];
  gradlePlugins: string[];
  variablesGradle: Record<string, string>;
  filesTouched: string[];
  codeTemplates: { importLine?: string; usage?: string; nativeJava?: string };
  setupNotes?: string;
  pitfalls?: string[];
  playStoreCompliance?: string[];
  targetSdkNotes?: string;
  docsUrl: string;
}

const ANDROID_ENTRY_FILES = [
  "android/app/src/main/AndroidManifest.xml",
  "android/app/build.gradle",
  "android/build.gradle",
  "android/variables.gradle",
];

export const PLUGIN_KNOWLEDGE: Record<string, PluginKnowledge> = {
  "edge-to-edge": {
    id: "edge-to-edge",
    npm: "@capacitor/status-bar",
    importName: "StatusBar",
    category: "ui",
    androidPermissions: [],
    manifestEntries: [],
    gradleDependencies: ["androidx.core:core:1.13.1"],
    gradlePlugins: [],
    variablesGradle: { compileSdkVersion: "35", targetSdkVersion: "35", androidxCoreVersion: "1.13.1" },
    filesTouched: [
      ...ANDROID_ENTRY_FILES,
      "android/app/src/main/java/{package}/MainActivity.java",
      "android/app/src/main/res/values/styles.xml",
      "android/app/src/main/res/values-night/styles.xml",
      "android/app/src/main/res/values-v31/styles.xml",
      "android/app/src/main/res/values-night-v31/styles.xml",
      "android/app/src/main/res/values/colors.xml",
      "android/app/src/main/res/values-night/colors.xml",
      "android/app/src/main/assets/capacitor.config.json",
      "capacitor.config.json",
      "index.html",
      "src/capacitor/display-mode.ts",
      "src/capacitor/display-mode.css",
      "src/main.tsx",
    ],
    codeTemplates: {
      importLine: `import { StatusBar, Style } from '@capacitor/status-bar';`,
      usage: `// NativeForge Display Mode owns this. The deterministic wiring step writes\n// src/capacitor/display-mode.ts (runtime colour matching), the hook file and all\n// four Android resource folders for the mode the user selected:\n// CLASSIC | THEMED | EDGE_TO_EDGE | GLASSMORPHISM | PER_PAGE.\nimport "@/capacitor/display-mode";`,
      nativeJava: `super.onCreate(savedInstanceState);\n// NativeForge Display Mode — system bar handling.\nWindowCompat.setDecorFitsSystemWindows(getWindow(), false);`,
    },
    setupNotes:
      "This is the NativeForge Display Mode plugin: one plugin, five modes (CLASSIC, THEMED, EDGE_TO_EDGE, GLASSMORPHISM, PER_PAGE). The deterministic wiring step (src/lib/plugins/displayMode) already applied: all four Android resource folders (values, values-night, values-v31, values-night-v31), capacitor.config.json StatusBar + Keyboard(resize:body), viewport-fit=cover, safe-area CSS, the runtime colour-matching module, the detected/created display-mode hook file and the entry-point import. Do NOT duplicate or rewrite any of that. Only fix genuine compile errors or missing imports.",
    pitfalls: [
      "Never overwrite an existing user status-bar hook — the wiring step extends it; report conflicts instead.",
      "Do NOT install @capacitor/edge-to-edge or @capawesome/capacitor-android-edge-to-edge-support — NativeForge owns the native WindowCompat call.",
      "Never mix pre-Android-12 attributes (windowTranslucentStatus) with v31 attributes (enforceStatusBarContrast) in the same resource file.",
      "Modes 3/4/5 require viewport-fit=cover, otherwise env(safe-area-inset-*) resolves to 0 and content hides under the bars.",
      "@capacitor/keyboard must use resize: 'body' so insets stay correct when the keyboard opens.",
    ],
    playStoreCompliance: ["Android 15 enforces edge-to-edge for targetSdk 35."],
    targetSdkNotes: "Set targetSdkVersion = 35 in android/variables.gradle; bump androidx.core to 1.13.1+.",
    docsUrl: "https://developer.android.com/develop/ui/views/layout/edge-to-edge",

  },
  "push-notifications": {
    id: "push-notifications",
    npm: "@capacitor/push-notifications",
    importName: "PushNotifications",
    category: "notifications",
    androidPermissions: ["android.permission.POST_NOTIFICATIONS"],
    manifestEntries: [`<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`],
    gradleDependencies: ["com.google.gms:google-services:4.4.2"],
    gradlePlugins: ["com.google.gms.google-services"],
    variablesGradle: {},
    filesTouched: [...ANDROID_ENTRY_FILES, "android/app/google-services.json"],
    codeTemplates: {
      importLine: `import { PushNotifications } from '@capacitor/push-notifications';`,
      usage: `const perm = await PushNotifications.requestPermissions();\nif (perm.receive === 'granted') await PushNotifications.register();`,
    },
    setupNotes: "Drop google-services.json into android/app/. FCM v1 only — legacy HTTP API is deprecated.",
    playStoreCompliance: ["POST_NOTIFICATIONS is required at runtime on Android 13+."],
    targetSdkNotes: "Runtime permission on API 33+.",
    docsUrl: "https://capacitorjs.com/docs/apis/push-notifications",
  },
  "google-auth": {
    id: "google-auth",
    npm: "@capawesome/capacitor-google-sign-in",
    importName: "GoogleSignIn",
    category: "auth",
    androidPermissions: [],
    manifestEntries: [],
    gradleDependencies: [],
    gradlePlugins: [],
    variablesGradle: { minSdkVersion: "23" },
    filesTouched: [...ANDROID_ENTRY_FILES, "src/contexts/AuthProvider.tsx", ".env", "src/vite-env.d.ts"],
    codeTemplates: {
      importLine: `import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';`,
      usage: `await GoogleSignIn.initialize({ webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID });\nconst result = await GoogleSignIn.signIn();`,
    },
    setupNotes: "Uses Credential Manager. Register the signing SHA-1 in your Google Cloud OAuth client.",
    pitfalls: ["Use the WEB client ID (not Android) in webClientId."],
    playStoreCompliance: ["Credential Manager is the only Google-supported auth path for new apps."],
    targetSdkNotes: "Requires minSdkVersion 23.",
    docsUrl: "https://capawesome.io/plugins/google-sign-in/",
  },
  camera: {
    id: "camera",
    npm: "@capacitor/camera",
    importName: "Camera",
    category: "media",
    androidPermissions: ["android.permission.CAMERA"],
    manifestEntries: [
      `<uses-permission android:name="android.permission.CAMERA" />`,
      `<uses-feature android:name="android.hardware.camera" android:required="false" />`,
    ],
    gradleDependencies: [],
    gradlePlugins: [],
    variablesGradle: {},
    filesTouched: ANDROID_ENTRY_FILES,
    codeTemplates: {
      importLine: `import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';`,
      usage: `const photo = await Camera.getPhoto({ quality: 90, resultType: CameraResultType.Uri, source: CameraSource.Prompt });`,
    },
    setupNotes: "Prefer the system Photo Picker — no storage permission needed.",
    playStoreCompliance: ["Photo Picker avoids the Play Console media-permissions declaration."],
    docsUrl: "https://capacitorjs.com/docs/apis/camera",
  },
  geolocation: {
    id: "geolocation",
    npm: "@capacitor/geolocation",
    importName: "Geolocation",
    category: "location",
    androidPermissions: ["android.permission.ACCESS_COARSE_LOCATION", "android.permission.ACCESS_FINE_LOCATION"],
    manifestEntries: [
      `<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />`,
      `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />`,
    ],
    gradleDependencies: [],
    gradlePlugins: [],
    variablesGradle: {},
    filesTouched: ANDROID_ENTRY_FILES,
    codeTemplates: {
      importLine: `import { Geolocation } from '@capacitor/geolocation';`,
      usage: `await Geolocation.requestPermissions();\nconst pos = await Geolocation.getCurrentPosition();`,
    },
    playStoreCompliance: ["Do NOT add ACCESS_BACKGROUND_LOCATION unless absolutely required."],
    docsUrl: "https://capacitorjs.com/docs/apis/geolocation",
  },
  filesystem: {
    id: "filesystem",
    npm: "@capacitor/filesystem",
    importName: "Filesystem",
    category: "storage",
    androidPermissions: [],
    manifestEntries: [],
    gradleDependencies: [],
    gradlePlugins: [],
    variablesGradle: {},
    filesTouched: ANDROID_ENTRY_FILES,
    codeTemplates: {
      importLine: `import { Filesystem, Directory } from '@capacitor/filesystem';`,
      usage: `await Filesystem.writeFile({ path: 'note.txt', data: 'hi', directory: Directory.Documents });`,
    },
    setupNotes: "Scoped storage on Android 11+; no storage permission needed for app-private dirs.",
    docsUrl: "https://capacitorjs.com/docs/apis/filesystem",
  },
  "local-notifications": {
    id: "local-notifications",
    npm: "@capacitor/local-notifications",
    importName: "LocalNotifications",
    category: "notifications",
    androidPermissions: ["android.permission.POST_NOTIFICATIONS"],
    manifestEntries: [`<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`],
    gradleDependencies: [],
    gradlePlugins: [],
    variablesGradle: {},
    filesTouched: ANDROID_ENTRY_FILES,
    codeTemplates: {
      importLine: `import { LocalNotifications } from '@capacitor/local-notifications';`,
      usage: `await LocalNotifications.requestPermissions();\nawait LocalNotifications.schedule({ notifications: [{ id: 1, title: 'Hi', body: 'Reminder' }] });`,
    },
    playStoreCompliance: ["USE_EXACT_ALARM is only allowed for alarm/clock/calendar apps."],
    docsUrl: "https://capacitorjs.com/docs/apis/local-notifications",
  },
  "capawesome-biometrics": {
    id: "capawesome-biometrics",
    npm: "@capawesome/capacitor-biometrics",
    importName: "Biometrics",
    category: "auth",
    androidPermissions: ["android.permission.USE_BIOMETRIC"],
    manifestEntries: [`<uses-permission android:name="android.permission.USE_BIOMETRIC" />`],
    gradleDependencies: ["androidx.biometric:biometric:1.2.0-alpha05"],
    gradlePlugins: [],
    variablesGradle: { minSdkVersion: "23" },
    filesTouched: ANDROID_ENTRY_FILES,
    codeTemplates: {
      importLine: `import { Biometrics } from '@capawesome/capacitor-biometrics';`,
      usage: `if ((await Biometrics.isAvailable()).available) await Biometrics.authenticate({ reason: 'Unlock' });`,
    },
    targetSdkNotes: "androidx.biometric (not deprecated FingerprintManager).",
    docsUrl: "https://capawesome.io/plugins/biometrics/",
  },
  "capawesome-app-update": {
    id: "capawesome-app-update",
    npm: "@capawesome/capacitor-app-update",
    importName: "AppUpdate",
    category: "system",
    androidPermissions: [],
    manifestEntries: [],
    gradleDependencies: ["com.google.android.play:app-update:2.1.0"],
    gradlePlugins: [],
    variablesGradle: {},
    filesTouched: ANDROID_ENTRY_FILES,
    codeTemplates: {
      importLine: `import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';`,
      usage: `const info = await AppUpdate.getAppUpdateInfo();\nif (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) await AppUpdate.startFlexibleUpdate();`,
    },
    docsUrl: "https://capawesome.io/plugins/app-update/",
  },
};

export function getPluginKnowledge(pluginId: string): PluginKnowledge | null {
  return PLUGIN_KNOWLEDGE[pluginId] ?? null;
}


/**
 * Renders the knowledge for the enabled plugins as a markdown digest that is
 * injected verbatim into the wiring agent's system prompt.
 */
export function buildKnowledgeDigest(pluginIds: string[]): string {
  const known = pluginIds
    .map((id) => getPluginKnowledge(id))
    .filter((k): k is PluginKnowledge => Boolean(k));

  if (known.length === 0) {
    return "## Plugin knowledge\n(no knowledge entries for the enabled plugins — inspect the project before wiring)";
  }

  const sections = known.map((k) => {
    const lines: string[] = [];
    lines.push(`### ${k.id} (${k.npm})`);
    lines.push(`- category: ${k.category}`);
    lines.push(`- import: ${k.codeTemplates.importLine ?? `import { ${k.importName} } from '${k.npm}';`}`);
    if (k.androidPermissions.length) lines.push(`- android permissions: ${k.androidPermissions.join(", ")}`);
    if (k.manifestEntries.length) lines.push(`- manifest entries:\n${k.manifestEntries.map((e) => `  - ${e}`).join("\n")}`);
    if (k.gradleDependencies.length) lines.push(`- gradle dependencies: ${k.gradleDependencies.join(", ")}`);
    if (k.gradlePlugins.length) lines.push(`- gradle plugins: ${k.gradlePlugins.join(", ")}`);
    const vars = Object.entries(k.variablesGradle);
    if (vars.length) lines.push(`- variables.gradle: ${vars.map(([key, value]) => `${key}=${value}`).join(", ")}`);
    if (k.filesTouched.length) lines.push(`- files typically touched:\n${k.filesTouched.map((f) => `  - ${f}`).join("\n")}`);
    if (k.codeTemplates.usage) lines.push(`- usage template:\n\`\`\`ts\n${k.codeTemplates.usage}\n\`\`\``);
    if (k.codeTemplates.nativeJava) lines.push(`- native template:\n\`\`\`java\n${k.codeTemplates.nativeJava}\n\`\`\``);
    if (k.setupNotes) lines.push(`- setup: ${k.setupNotes}`);
    if (k.pitfalls?.length) lines.push(`- pitfalls:\n${k.pitfalls.map((p) => `  - ${p}`).join("\n")}`);
    if (k.playStoreCompliance?.length) lines.push(`- play store compliance:\n${k.playStoreCompliance.map((p) => `  - ${p}`).join("\n")}`);
    if (k.targetSdkNotes) lines.push(`- target SDK: ${k.targetSdkNotes}`);
    lines.push(`- docs: ${k.docsUrl}`);
    return lines.join("\n");
  });

  return ["## Plugin knowledge (authoritative — follow it exactly)", ...sections].join("\n\n");
}
