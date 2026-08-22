// Plugin injection layer: adds permissions, dependencies, and registrations
// Used for prebuilt-project mode where we generate the Android project client-side

export interface PluginInjection {
  id: string;
  permissions: string[];
  gradleDeps: string[];
  imports: string[];
  registrations: string[];
}

const pluginDefinitions: Record<string, PluginInjection> = {
  push: {
    id: "push",
    permissions: ["INTERNET", "WAKE_LOCK", "POST_NOTIFICATIONS"],
    gradleDeps: [
      "implementation 'com.google.firebase:firebase-messaging:24.1.0'",
      "implementation '@capacitor/push-notifications:6.0.0'",
    ],
    imports: ["import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;"],
    registrations: ["registerPlugin(PushNotificationsPlugin.class);"],
  },
  camera: {
    id: "camera",
    permissions: ["CAMERA", "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO"],
    gradleDeps: ["implementation '@capacitor/camera:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.camera.CameraPlugin;"],
    registrations: ["registerPlugin(CameraPlugin.class);"],
  },
  files: {
    id: "files",
    permissions: ["READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "READ_MEDIA_IMAGES"],
    gradleDeps: ["implementation '@capacitor/filesystem:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.filesystem.FilesystemPlugin;"],
    registrations: ["registerPlugin(FilesystemPlugin.class);"],
  },
  geo: {
    id: "geo",
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    gradleDeps: ["implementation '@capacitor/geolocation:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.geolocation.GeolocationPlugin;"],
    registrations: ["registerPlugin(GeolocationPlugin.class);"],
  },
  biometrics: {
    id: "biometrics",
    permissions: ["USE_BIOMETRIC", "USE_FINGERPRINT"],
    gradleDeps: [],
    imports: [],
    registrations: [],
  },
  "local-notif": {
    id: "local-notif",
    permissions: ["POST_NOTIFICATIONS", "SCHEDULE_EXACT_ALARM"],
    gradleDeps: ["implementation '@capacitor/local-notifications:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin;"],
    registrations: ["registerPlugin(LocalNotificationsPlugin.class);"],
  },
  "in-app-browser": {
    id: "in-app-browser",
    permissions: ["INTERNET"],
    gradleDeps: ["implementation '@capacitor/browser:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.browser.BrowserPlugin;"],
    registrations: ["registerPlugin(BrowserPlugin.class);"],
  },
  share: {
    id: "share",
    permissions: [],
    gradleDeps: ["implementation '@capacitor/share:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.share.SharePlugin;"],
    registrations: ["registerPlugin(SharePlugin.class);"],
  },
  haptics: {
    id: "haptics",
    permissions: ["VIBRATE"],
    gradleDeps: ["implementation '@capacitor/haptics:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.haptics.HapticsPlugin;"],
    registrations: ["registerPlugin(HapticsPlugin.class);"],
  },
  clipboard: {
    id: "clipboard",
    permissions: [],
    gradleDeps: ["implementation '@capacitor/clipboard:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.clipboard.ClipboardPlugin;"],
    registrations: ["registerPlugin(ClipboardPlugin.class);"],
  },
  network: {
    id: "network",
    permissions: ["ACCESS_NETWORK_STATE"],
    gradleDeps: ["implementation '@capacitor/network:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.network.NetworkPlugin;"],
    registrations: ["registerPlugin(NetworkPlugin.class);"],
  },
  device: {
    id: "device",
    permissions: [],
    gradleDeps: ["implementation '@capacitor/device:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.device.DevicePlugin;"],
    registrations: ["registerPlugin(DevicePlugin.class);"],
  },
  statusbar: {
    id: "statusbar",
    permissions: [],
    gradleDeps: ["implementation '@capacitor/status-bar:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.statusbar.StatusBarPlugin;"],
    registrations: ["registerPlugin(StatusBarPlugin.class);"],
  },
  keyboard: {
    id: "keyboard",
    permissions: [],
    gradleDeps: ["implementation '@capacitor/keyboard:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.keyboard.KeyboardPlugin;"],
    registrations: ["registerPlugin(KeyboardPlugin.class);"],
  },
  splash: {
    id: "splash",
    permissions: [],
    gradleDeps: ["implementation '@capacitor/splash-screen:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.splashscreen.SplashScreenPlugin;"],
    registrations: ["registerPlugin(SplashScreenPlugin.class);"],
  },
  "edge-to-edge": {
    id: "edge-to-edge",
    permissions: [],
    gradleDeps: ["implementation \"androidx.core:core:$androidxCoreVersion\""],
    imports: ["import androidx.core.view.WindowCompat;"],
    registrations: ["WindowCompat.setDecorFitsSystemWindows(getWindow(), false);"],
  },
  storage: {
    id: "storage",
    permissions: [],
    gradleDeps: ["implementation '@capacitor/preferences:6.0.0'"],
    imports: ["import com.capacitorjs.plugins.preferences.PreferencesPlugin;"],
    registrations: ["registerPlugin(PreferencesPlugin.class);"],
  },
  "google-auth": {
    id: "google-auth",
    permissions: ["INTERNET"],
    gradleDeps: ["implementation 'com.google.android.gms:play-services-auth:21.0.0'"],
    imports: [],
    registrations: [],
  },
  "apple-auth": {
    id: "apple-auth",
    permissions: ["INTERNET"],
    gradleDeps: [],
    imports: [],
    registrations: [],
  },
  microphone: {
    id: "microphone",
    permissions: ["RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"],
    gradleDeps: [],
    imports: [],
    registrations: [],
  },
  barcode: {
    id: "barcode",
    permissions: ["CAMERA"],
    gradleDeps: ["implementation 'com.google.mlkit:barcode-scanning:17.3.0'"],
    imports: [],
    registrations: [],
  },
  bluetooth: {
    id: "bluetooth",
    permissions: ["BLUETOOTH", "BLUETOOTH_ADMIN", "BLUETOOTH_SCAN", "BLUETOOTH_CONNECT"],
    gradleDeps: [],
    imports: [],
    registrations: [],
  },
  sms: {
    id: "sms",
    permissions: ["SEND_SMS"],
    gradleDeps: [],
    imports: [],
    registrations: [],
  },
  iap: {
    id: "iap",
    permissions: ["BILLING"],
    gradleDeps: ["implementation 'com.android.billingclient:billing:7.0.0'"],
    imports: [],
    registrations: [],
  },
  // ── New official plugins (zero config) ──
  "action-sheet": { id: "action-sheet", permissions: [], gradleDeps: [], imports: [], registrations: [] },
  "app-launcher": { id: "app-launcher", permissions: [], gradleDeps: [], imports: [], registrations: [] },
  cookies: { id: "cookies", permissions: ["INTERNET"], gradleDeps: [], imports: [], registrations: [] },
  dialog: { id: "dialog", permissions: [], gradleDeps: [], imports: [], registrations: [] },
  motion: { id: "motion", permissions: [], gradleDeps: [], imports: [], registrations: [] },
  "screen-orientation": { id: "screen-orientation", permissions: [], gradleDeps: [], imports: [], registrations: [] },
  "screen-reader": { id: "screen-reader", permissions: [], gradleDeps: [], imports: [], registrations: [] },
  toast: { id: "toast", permissions: [], gradleDeps: [], imports: [], registrations: [] },
  "text-zoom": { id: "text-zoom", permissions: [], gradleDeps: [], imports: [], registrations: [] },
  "privacy-screen": { id: "privacy-screen", permissions: [], gradleDeps: [], imports: [], registrations: [] },
  "google-maps": {
    id: "google-maps",
    permissions: ["INTERNET", "ACCESS_FINE_LOCATION"],
    gradleDeps: ["implementation 'com.google.android.gms:play-services-maps:19.0.0'"],
    imports: [],
    registrations: [],
  },
  "facebook-login": {
    id: "facebook-login",
    permissions: ["INTERNET"],
    gradleDeps: ["implementation 'com.facebook.android:facebook-login:17.0.0'"],
    imports: [],
    registrations: [],
  },
};

export const getPluginInjections = (enabledPluginIds: string[]): PluginInjection[] => {
  return enabledPluginIds
    .map(id => pluginDefinitions[id])
    .filter(Boolean);
};

export const getPluginPermissions = (enabledPluginIds: string[]): string[] => {
  const perms = new Set<string>();
  for (const injection of getPluginInjections(enabledPluginIds)) {
    injection.permissions.forEach(p => perms.add(p));
  }
  return [...perms];
};

export const injectPermissions = (manifest: string, enabledPluginIds: string[]): string => {
  const perms = getPluginPermissions(enabledPluginIds);
  const existing = manifest.match(/android:name="android\.permission\.(\w+)"/g) || [];
  const existingNames = new Set(existing.map(m => m.match(/\.(\w+)"/)![1]));

  const newPerms = perms
    .filter(p => !existingNames.has(p))
    .map(p => `    <uses-permission android:name="android.permission.${p}" />`)
    .join("\n");

  if (!newPerms) return manifest;

  return manifest.replace(
    /(<uses-permission[^/]*\/>)\s*\n(\s*<application)/,
    `$1\n${newPerms}\n\n$2`
  );
};

export const injectGradleDeps = (buildGradle: string, enabledPluginIds: string[]): string => {
  const deps = getPluginInjections(enabledPluginIds)
    .flatMap(p => p.gradleDeps)
    .filter(Boolean);

  if (deps.length === 0) return buildGradle;

  const depLines = deps.map(d => `    ${d}`).join("\n");
  const comment = "\n    // NativeBridge Plugin Dependencies";

  return buildGradle.replace(
    /(dependencies\s*\{[^}]*)(})/,
    `$1${comment}\n${depLines}\n$2`
  );
};

export const injectMainActivityPlugins = (
  mainActivity: string,
  enabledPluginIds: string[]
): string => {
  const injections = getPluginInjections(enabledPluginIds);
  if (injections.length === 0) return mainActivity;

  const imports = injections.flatMap(p => p.imports).filter(Boolean);
  const regs = injections.flatMap(p => p.registrations).filter(Boolean);

  let result = mainActivity;
  if (imports.length > 0) {
    const importBlock = "\n" + imports.join("\n");
    result = result.replace(
      /(import com\.getcapacitor\.BridgeActivity;)/,
      `$1${importBlock}`
    );
  }

  if (regs.length > 0) {
    const regBlock = regs.map(r => `        ${r}`).join("\n");
    result = result.replace(
      /(super\.onCreate\(savedInstanceState\);)/,
      `$1\n\n        // Plugins\n${regBlock}`
    );
  }

  return result;
};
