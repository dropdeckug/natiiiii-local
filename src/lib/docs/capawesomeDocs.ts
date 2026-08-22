/**
 * Curated Capawesome + Capacitor docs index.
 * The agent uses these to ground plugin wiring with stable, tested metadata
 * instead of hallucinating package names or APIs.
 *
 * Each entry includes: npm package, primary import, install command,
 * required Android permissions, manifest additions, gradle changes,
 * usage snippet, and known pitfalls.
 */

export interface CapawesomeDoc {
  id: string;
  pluginName: string;
  npm: string;
  importName: string;
  capacitorVersions: string[];
  androidPermissions: string[];
  manifestEntries?: string[];
  gradleDependencies?: string[];
  setupNotes?: string;
  usageSnippet?: string;
  pitfalls?: string[];
  docsUrl: string;
  source: "capawesome" | "capacitor" | "community";
}

export const CAPAWESOME_DOCS: CapawesomeDoc[] = [
  {
    id: "app-update",
    pluginName: "App Update",
    npm: "@capawesome/capacitor-app-update",
    importName: "AppUpdate",
    capacitorVersions: ["6", "7"],
    androidPermissions: [],
    setupNotes: "On Android, AppUpdate uses the Play Core in-app update flow. The host app must be installed from Google Play for updates to be detected.",
    usageSnippet: `import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';\n\nconst { updateAvailability } = await AppUpdate.getAppUpdateInfo();\nif (updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {\n  await AppUpdate.startFlexibleUpdate();\n}`,
    pitfalls: [
      "Will report UPDATE_NOT_AVAILABLE when the app is sideloaded.",
      "Requires the device to have Play Store installed.",
    ],
    docsUrl: "https://capawesome.io/plugins/app-update/",
    source: "capawesome",
  },
  {
    id: "file-picker",
    pluginName: "File Picker",
    npm: "@capawesome/capacitor-file-picker",
    importName: "FilePicker",
    capacitorVersions: ["6", "7"],
    androidPermissions: ["android.permission.READ_EXTERNAL_STORAGE"],
    setupNotes: "Uses scoped storage on Android 11+. No special manifest changes needed beyond the read permission for legacy devices.",
    usageSnippet: `import { FilePicker } from '@capawesome/capacitor-file-picker';\n\nconst result = await FilePicker.pickFiles({ types: ['image/png'] });\nconsole.log(result.files[0].path);`,
    docsUrl: "https://capawesome.io/plugins/file-picker/",
    source: "capawesome",
  },
  {
    id: "android-edge-to-edge",
    pluginName: "True Android Edge-to-Edge",
    npm: "@capacitor/status-bar",
    importName: "StatusBar",
    capacitorVersions: ["6", "7"],
    androidPermissions: [],
    setupNotes: "Required for Android 15+ (targetSdk 35). NativeBridge patches MainActivity.java directly with WindowCompat.setDecorFitsSystemWindows(getWindow(), false) after super.onCreate(savedInstanceState).",
    usageSnippet: `import { StatusBar } from '@capacitor/status-bar';\n\nawait StatusBar.setOverlaysWebView({ overlay: true });`,
    pitfalls: [
      "Do not install @capacitor/edge-to-edge or @capawesome/capacitor-android-edge-to-edge-support for true edge-to-edge; patch MainActivity directly.",
      "If you still see edge-to-edge warnings, ensure targetSdk >= 35 in variables.gradle.",
    ],
    docsUrl: "https://developer.android.com/develop/ui/views/layout/edge-to-edge",
    source: "capacitor",
  },
  {
    id: "background-task",
    pluginName: "Background Task",
    npm: "@capawesome/capacitor-background-task",
    importName: "BackgroundTask",
    capacitorVersions: ["6", "7"],
    androidPermissions: [],
    usageSnippet: `import { BackgroundTask } from '@capawesome/capacitor-background-task';\n\nconst taskId = await BackgroundTask.beforeExit(async () => {\n  // do background work\n  BackgroundTask.finish({ taskId });\n});`,
    docsUrl: "https://capawesome.io/plugins/background-task/",
    source: "capawesome",
  },
  {
    id: "screen-orientation",
    pluginName: "Screen Orientation",
    npm: "@capacitor/screen-orientation",
    importName: "ScreenOrientation",
    capacitorVersions: ["6", "7"],
    androidPermissions: [],
    usageSnippet: `import { ScreenOrientation } from '@capacitor/screen-orientation';\n\nawait ScreenOrientation.lock({ orientation: 'portrait' });`,
    docsUrl: "https://capacitorjs.com/docs/apis/screen-orientation",
    source: "capacitor",
  },
  {
    id: "geolocation",
    pluginName: "Geolocation",
    npm: "@capacitor/geolocation",
    importName: "Geolocation",
    capacitorVersions: ["6", "7"],
    androidPermissions: [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
    ],
    usageSnippet: `import { Geolocation } from '@capacitor/geolocation';\n\nconst pos = await Geolocation.getCurrentPosition();`,
    docsUrl: "https://capacitorjs.com/docs/apis/geolocation",
    source: "capacitor",
  },
  {
    id: "camera",
    pluginName: "Camera",
    npm: "@capacitor/camera",
    importName: "Camera",
    capacitorVersions: ["6", "7"],
    androidPermissions: [
      "android.permission.CAMERA",
      "android.permission.READ_MEDIA_IMAGES",
    ],
    usageSnippet: `import { Camera, CameraResultType } from '@capacitor/camera';\n\nconst photo = await Camera.getPhoto({ quality: 90, resultType: CameraResultType.Uri });`,
    docsUrl: "https://capacitorjs.com/docs/apis/camera",
    source: "capacitor",
  },
  {
    id: "push-notifications",
    pluginName: "Push Notifications",
    npm: "@capacitor/push-notifications",
    importName: "PushNotifications",
    capacitorVersions: ["6", "7"],
    androidPermissions: ["android.permission.POST_NOTIFICATIONS"],
    gradleDependencies: ["com.google.gms:google-services:4.4.2"],
    setupNotes: "Requires google-services.json in android/app/. Must apply 'com.google.gms.google-services' Gradle plugin in android/app/build.gradle.",
    usageSnippet: `import { PushNotifications } from '@capacitor/push-notifications';\n\nawait PushNotifications.requestPermissions();\nawait PushNotifications.register();`,
    pitfalls: [
      "Build will fail if google-services.json is missing.",
      "POST_NOTIFICATIONS is required on Android 13+.",
    ],
    docsUrl: "https://capacitorjs.com/docs/apis/push-notifications",
    source: "capacitor",
  },
  {
    id: "filesystem",
    pluginName: "Filesystem",
    npm: "@capacitor/filesystem",
    importName: "Filesystem",
    capacitorVersions: ["6", "7"],
    androidPermissions: [],
    setupNotes: "Modern Capacitor uses scoped storage; no READ/WRITE_EXTERNAL_STORAGE needed for app-private dirs.",
    usageSnippet: `import { Filesystem, Directory } from '@capacitor/filesystem';\n\nawait Filesystem.writeFile({ path: 'data.txt', data: 'hi', directory: Directory.Documents });`,
    docsUrl: "https://capacitorjs.com/docs/apis/filesystem",
    source: "capacitor",
  },
  {
    id: "haptics",
    pluginName: "Haptics",
    npm: "@capacitor/haptics",
    importName: "Haptics",
    capacitorVersions: ["6", "7"],
    androidPermissions: ["android.permission.VIBRATE"],
    usageSnippet: `import { Haptics, ImpactStyle } from '@capacitor/haptics';\n\nawait Haptics.impact({ style: ImpactStyle.Medium });`,
    docsUrl: "https://capacitorjs.com/docs/apis/haptics",
    source: "capacitor",
  },
  {
    id: "share",
    pluginName: "Share",
    npm: "@capacitor/share",
    importName: "Share",
    capacitorVersions: ["6", "7"],
    androidPermissions: [],
    usageSnippet: `import { Share } from '@capacitor/share';\n\nawait Share.share({ title: 'Hi', text: 'check this out', url: 'https://example.com' });`,
    docsUrl: "https://capacitorjs.com/docs/apis/share",
    source: "capacitor",
  },
];

export function searchCapawesomeDocs(query: string, limit = 5): CapawesomeDoc[] {
  const q = query.toLowerCase();
  return CAPAWESOME_DOCS
    .map(doc => {
      let score = 0;
      if (doc.id.includes(q)) score += 5;
      if (doc.pluginName.toLowerCase().includes(q)) score += 4;
      if (doc.npm.includes(q)) score += 4;
      if (doc.importName.toLowerCase().includes(q)) score += 3;
      if ((doc.setupNotes || "").toLowerCase().includes(q)) score += 1;
      if ((doc.usageSnippet || "").toLowerCase().includes(q)) score += 1;
      return { doc, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.doc);
}

export function readCapawesomeDoc(pluginId: string): CapawesomeDoc | null {
  return CAPAWESOME_DOCS.find(d => d.id === pluginId || d.npm === pluginId) || null;
}
