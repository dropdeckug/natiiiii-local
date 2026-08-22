/**
 * CPR Plugin Registry.
 *
 * Every plugin the platform offers must have a complete entry here before the
 * compatibility matrix can reason about it. An entry declares everything CPR
 * needs to know *before* an install ever runs: the Capacitor core range it
 * works against, the Android/iOS floors it raises, the manifest permissions it
 * writes, the native Gradle libraries it drags in, the plugins or user
 * dependencies it is known to fight with, and the deterministic wiring
 * templates the AI wiring step must use verbatim.
 *
 * A plugin with no entry is treated as EXPERIMENTAL: it is installed, every
 * compatibility check is skipped, and the pre-flight report says so plainly.
 *
 * Runtime-agnostic: no DOM, no Deno, no Node built-ins.
 */

export type PluginCategory =
  | "core"
  | "display"
  | "auth"
  | "device"
  | "storage"
  | "notifications"
  | "media"
  | "monetization";

export interface PluginConfigField {
  key: string;
  label: string;
  kind: "text" | "file" | "secret" | "color" | "enum" | "array";
  required: boolean;
  /** Regex source validating the value (text/secret only). */
  pattern?: string;
  hint?: string;
  /** Allowed values for `enum` fields. */
  options?: string[];
  /** Default applied when the user leaves the field empty. */
  defaultValue?: string | string[];
  /** Restricts the requirement to one platform. */
  platform?: "android" | "ios";
}

export interface PluginIosPermission {
  key: string;
  value: string;
}

export interface PluginRegistryEntry {
  /** Stable internal id used by the platform UI. */
  id: string;
  /** Display name shown in the UI. */
  name: string;
  /** npm package installed for this plugin. */
  npm: string;
  /** Second package installed alongside the primary one. */
  secondaryPackages?: string[];
  /** Community fork that also provides this capability — never installed together. */
  alternativePackage?: string;
  /** Packages that must be uninstalled when this plugin is the canonical choice. */
  supersedes?: string[];
  /** Human readable Capacitor range, e.g. ">=6.0.0". */
  capacitorVersionRange: string;
  /** Inclusive Capacitor core major floor. */
  capacitorMin: number;
  /** Inclusive Capacitor core major ceiling. */
  capacitorMax: number;
  /** Version of the plugin package to install for the platform Capacitor major. */
  versionForMajor: Record<number, string>;
  androidMinSdk: number;
  iosDeploymentTarget: string;
  /** Installed on every project regardless of user selection. */
  alwaysInstall: boolean;
  category: PluginCategory;
  requiresConfig: boolean;
  /** Fully-qualified Android permissions written into the manifest. */
  permissions: string[];
  /** Extra AndroidManifest entries (meta-data, activities, queries). */
  androidManifestEntries: string[];
  /** Info.plist keys the iOS build needs. */
  iosPermissions: PluginIosPermission[];
  iosCapabilities?: string[];
  /** Android Gradle coordinates as `group:artifact:version`. */
  gradleDependencies: string[];
  /** iOS CocoaPods this plugin requires. */
  iosPods: string[];
  /** npm names of plugins this plugin cannot coexist with. */
  conflictsWithPlugins: string[];
  /** npm names of user dependencies this plugin fights with, plus the version it needs. */
  conflictsWithDependencies: { name: string; requires: string; reason: string }[];
  /** Deterministic import line the wiring step injects. */
  importTemplate: string;
  /** Deterministic initialisation snippet, empty when the plugin is used on demand. */
  initTemplate: string;
  /** Where the init snippet belongs. */
  initLocation: "app-mount" | "on-demand";
  /** True when the SHA-1 of the signing key must be registered with the provider. */
  requiresSha1Registration?: boolean;
  /** Display-mode plugin only — the four Android resource folders. */
  requiresAndroidResourceFolders?: boolean;
  androidResourceFolders?: string[];
  /** Fields the user must supply before the plugin can be enabled. */
  configFields: PluginConfigField[];
}

const CAP6 = (v: string) => ({ 5: v, 6: v, 7: v });

type EntryInput = Partial<PluginRegistryEntry> &
  Pick<PluginRegistryEntry, "id" | "name" | "npm" | "category">;

/** Fills the boilerplate so each entry below only states what is special. */
function entry(input: EntryInput): PluginRegistryEntry {
  return {
    capacitorVersionRange: ">=6.0.0",
    capacitorMin: 5,
    capacitorMax: 7,
    versionForMajor: { 5: "^5.0.0", 6: "^6.0.0", 7: "^7.0.0" },
    androidMinSdk: 22,
    iosDeploymentTarget: "13.0",
    alwaysInstall: false,
    requiresConfig: false,
    permissions: [],
    androidManifestEntries: [],
    iosPermissions: [],
    gradleDependencies: [],
    iosPods: [],
    conflictsWithPlugins: [],
    conflictsWithDependencies: [],
    importTemplate: "",
    initTemplate: "",
    initLocation: "on-demand",
    configFields: [],
    ...input,
  } as PluginRegistryEntry;
}

/** Keyed by npm package name — the only stable identifier across the pipeline. */
export const PLUGIN_REGISTRY: Record<string, PluginRegistryEntry> = {
  /* ---------------------------------------------------------- core set */
  "@capacitor/app": entry({
    id: "app",
    name: "App",
    npm: "@capacitor/app",
    category: "core",
    alwaysInstall: true,
    importTemplate: `import { App } from '@capacitor/app';`,
    initTemplate: `App.addListener('appStateChange', ({ isActive }) => console.log('active', isActive));`,
    initLocation: "app-mount",
  }),
  "@capacitor/status-bar": entry({
    id: "status-bar",
    name: "Status Bar",
    npm: "@capacitor/status-bar",
    category: "core",
    alwaysInstall: true,
    importTemplate: `import { StatusBar, Style } from '@capacitor/status-bar';`,
    initTemplate: `await StatusBar.setStyle({ style: Style.Default });`,
    initLocation: "app-mount",
  }),
  "@capacitor/keyboard": entry({
    id: "keyboard",
    name: "Keyboard",
    npm: "@capacitor/keyboard",
    category: "core",
    alwaysInstall: true,
    importTemplate: `import { Keyboard } from '@capacitor/keyboard';`,
    initTemplate: `Keyboard.addListener('keyboardWillShow', (info) => console.log(info.keyboardHeight));`,
    initLocation: "app-mount",
  }),
  "@capacitor/splash-screen": entry({
    id: "splash-screen",
    name: "Splash Screen",
    npm: "@capacitor/splash-screen",
    category: "core",
    alwaysInstall: true,
    importTemplate: `import { SplashScreen } from '@capacitor/splash-screen';`,
    initTemplate: `await SplashScreen.hide();`,
    initLocation: "app-mount",
  }),
  "@capacitor/haptics": entry({
    id: "haptics",
    name: "Haptics",
    npm: "@capacitor/haptics",
    category: "core",
    alwaysInstall: true,
    permissions: ["android.permission.VIBRATE"],
    importTemplate: `import { Haptics, ImpactStyle } from '@capacitor/haptics';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),

  /* ----------------------------------------------------- display mode */
  "nativeforge-display-mode": entry({
    id: "display-mode",
    name: "NativeForge Display Mode",
    npm: "@capacitor/status-bar",
    secondaryPackages: ["@capacitor/navigation-bar"],
    category: "display",
    requiresConfig: true,
    requiresAndroidResourceFolders: true,
    androidResourceFolders: ["values", "values-night", "values-v31", "values-night-v31"],
    importTemplate: `import { initDisplayMode } from './capacitor/display-mode';`,
    initTemplate: `initDisplayMode();`,
    initLocation: "app-mount",
    configFields: [
      {
        key: "displayMode",
        label: "Display mode",
        kind: "enum",
        required: true,
        options: ["classic", "themed", "edgeToEdge", "glassmorphism", "perPage"],
        defaultValue: "edgeToEdge",
      },
      { key: "lightModeStatusBarColor", label: "Status bar colour (light)", kind: "color", required: true, defaultValue: "#FFFFFF" },
      { key: "darkModeStatusBarColor", label: "Status bar colour (dark)", kind: "color", required: true, defaultValue: "#000000" },
      { key: "lightModeNavBarColor", label: "Navigation bar colour (light)", kind: "color", required: true, defaultValue: "#FFFFFF" },
      { key: "darkModeNavBarColor", label: "Navigation bar colour (dark)", kind: "color", required: true, defaultValue: "#000000" },
      {
        key: "statusBarIconStyleLight",
        label: "Status bar icon style (light mode)",
        kind: "enum",
        required: true,
        options: ["DARK", "LIGHT"],
        defaultValue: "DARK",
      },
    ],
  }),
  "@capacitor/navigation-bar": entry({
    id: "navigation-bar",
    name: "Navigation Bar",
    npm: "@capacitor/navigation-bar",
    category: "display",
    versionForMajor: { 5: "^1.0.0", 6: "^1.0.0", 7: "^1.0.0" },
    importTemplate: `import { NavigationBar } from '@capacitor/navigation-bar';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),

  /* ------------------------------------------------------------- auth */
  "@codetrix-studio/capacitor-google-auth": entry({
    id: "google-auth",
    name: "Google Sign-In",
    npm: "@codetrix-studio/capacitor-google-auth",
    alternativePackage: "@capawesome/capacitor-google-auth",
    supersedes: ["@capawesome/capacitor-google-auth", "@capacitor/google-auth"],
    category: "auth",
    capacitorVersionRange: ">=5.0.0",
    capacitorMin: 5,
    versionForMajor: { 5: "^3.4.0", 6: "^3.4.0", 7: "^3.4.0" },
    androidMinSdk: 24,
    requiresConfig: true,
    requiresSha1Registration: true,
    permissions: ["android.permission.INTERNET", "android.permission.GET_ACCOUNTS"],
    gradleDependencies: ["com.google.android.gms:play-services-auth:21.2.0"],
    iosPods: ["GoogleSignIn"],
    conflictsWithPlugins: ["@capacitor-firebase/authentication", "@capawesome/capacitor-google-auth"],
    importTemplate: `import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';`,
    initTemplate: `GoogleAuth.initialize({\n  clientId: USER_CONFIG.webClientId,\n  scopes: USER_CONFIG.scopes,\n  grantOfflineAccess: true\n});`,
    initLocation: "app-mount",
    configFields: [
      { key: "googleServicesJson", label: "google-services.json", kind: "file", required: true, platform: "android", hint: "Firebase console → Project settings → Android app" },
      { key: "googleServiceInfoPlist", label: "GoogleService-Info.plist", kind: "file", required: true, platform: "ios" },
      { key: "webClientId", label: "OAuth Web Client ID", kind: "text", required: true, pattern: "^[0-9]+-[a-z0-9]+\\.apps\\.googleusercontent\\.com$", hint: "OAuth Web Client ID from the Google Cloud Console" },
      { key: "scopes", label: "Scopes", kind: "array", required: false, defaultValue: ["profile", "email"] },
    ],
  }),
  "@capacitor-community/apple-sign-in": entry({
    id: "apple-sign-in",
    name: "Sign In with Apple",
    npm: "@capacitor-community/apple-sign-in",
    category: "auth",
    capacitorVersionRange: ">=5.0.0",
    capacitorMin: 5,
    versionForMajor: { 5: "^5.0.0", 6: "^6.0.0", 7: "^7.0.0" },
    androidMinSdk: 24,
    requiresConfig: true,
    permissions: ["android.permission.INTERNET"],
    iosCapabilities: ["Sign In with Apple"],
    importTemplate: `import { SignInWithApple } from '@capacitor-community/apple-sign-in';`,
    initTemplate: "",
    initLocation: "on-demand",
    configFields: [
      { key: "appleServiceId", label: "Apple Service ID", kind: "text", required: true, platform: "android", hint: "Apple Service ID used by the Android web flow" },
      { key: "appleRedirectUri", label: "Redirect URI", kind: "text", required: true, platform: "android" },
      { key: "appleTeamId", label: "Apple Team ID", kind: "text", required: true, platform: "ios" },
    ],
  }),
  "@capacitor-community/facebook-login": entry({
    id: "facebook-login",
    name: "Facebook Login",
    npm: "@capacitor-community/facebook-login",
    category: "auth",
    capacitorVersionRange: ">=5.0.0",
    capacitorMin: 5,
    versionForMajor: { 5: "^5.0.0", 6: "^6.0.0", 7: "^7.0.0" },
    androidMinSdk: 24,
    requiresConfig: true,
    permissions: ["android.permission.INTERNET", "android.permission.AD_ID"],
    androidManifestEntries: [
      "meta-data: com.facebook.sdk.ApplicationId",
      "meta-data: com.facebook.sdk.ClientToken",
    ],
    gradleDependencies: [
      "com.facebook.android:facebook-login:17.0.0",
      "com.google.android.gms:play-services-ads-identifier:18.1.0",
    ],
    iosPods: ["FBSDKLoginKit"],
    importTemplate: `import { FacebookLogin } from '@capacitor-community/facebook-login';`,
    initTemplate: `FacebookLogin.initialize({ appId: USER_CONFIG.facebookAppId });`,
    initLocation: "app-mount",
    configFields: [
      { key: "facebookAppId", label: "Facebook App ID", kind: "text", required: true, pattern: "^[0-9]{10,20}$" },
      { key: "facebookClientToken", label: "Client token", kind: "secret", required: true },
      { key: "facebookAppName", label: "App name", kind: "text", required: true },
    ],
  }),
  "@aparajita/capacitor-biometric-auth": entry({
    id: "biometrics",
    name: "Biometric Authentication",
    npm: "@aparajita/capacitor-biometric-auth",
    supersedes: ["@capgo/capacitor-native-biometric"],
    category: "auth",
    capacitorVersionRange: ">=5.0.0",
    capacitorMin: 5,
    versionForMajor: { 5: "^7.0.0", 6: "^8.0.0", 7: "^9.0.0" },
    androidMinSdk: 23,
    permissions: [
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
    ],
    gradleDependencies: ["androidx.biometric:biometric:1.1.0"],
    importTemplate: `import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor-firebase/authentication": entry({
    id: "firebase-auth",
    name: "Firebase Authentication",
    npm: "@capacitor-firebase/authentication",
    category: "auth",
    capacitorMin: 6,
    versionForMajor: { 6: "^6.3.0", 7: "^7.2.0" },
    androidMinSdk: 24,
    requiresConfig: true,
    permissions: ["android.permission.INTERNET"],
    gradleDependencies: [
      "com.google.firebase:firebase-auth:23.0.0",
      "com.google.android.gms:play-services-auth:21.2.0",
    ],
    iosPods: ["FirebaseAuth"],
    conflictsWithPlugins: ["@codetrix-studio/capacitor-google-auth"],
    conflictsWithDependencies: [
      {
        name: "firebase",
        requires: "^10.12.0",
        reason: "The native Firebase Auth SDK 23 expects the Firebase JS SDK 10 token format.",
      },
    ],
    importTemplate: `import { FirebaseAuthentication } from '@capacitor-firebase/authentication';`,
    initTemplate: "",
    initLocation: "on-demand",
    configFields: [
      { key: "googleServicesJson", label: "google-services.json", kind: "file", required: true, platform: "android" },
    ],
  }),

  /* ----------------------------------------------------------- device */
  "@capacitor/camera": entry({
    id: "camera",
    name: "Camera",
    npm: "@capacitor/camera",
    category: "device",
    permissions: ["android.permission.CAMERA", "android.permission.READ_MEDIA_IMAGES"],
    iosPermissions: [
      { key: "NSCameraUsageDescription", value: "This app needs camera access to take photos." },
      { key: "NSPhotoLibraryUsageDescription", value: "This app needs photo library access." },
    ],
    gradleDependencies: ["androidx.exifinterface:exifinterface:1.3.7"],
    importTemplate: `import { Camera, CameraResultType } from '@capacitor/camera';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor/geolocation": entry({
    id: "geolocation",
    name: "Geolocation",
    npm: "@capacitor/geolocation",
    category: "device",
    permissions: [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
    ],
    iosPermissions: [
      { key: "NSLocationWhenInUseUsageDescription", value: "This app needs location access." },
    ],
    gradleDependencies: ["com.google.android.gms:play-services-location:21.3.0"],
    importTemplate: `import { Geolocation } from '@capacitor/geolocation';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor/filesystem": entry({
    id: "filesystem",
    name: "Filesystem",
    npm: "@capacitor/filesystem",
    category: "device",
    permissions: [
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
    ],
    importTemplate: `import { Filesystem, Directory } from '@capacitor/filesystem';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor/network": entry({
    id: "network",
    name: "Network",
    npm: "@capacitor/network",
    category: "device",
    permissions: ["android.permission.ACCESS_NETWORK_STATE"],
    importTemplate: `import { Network } from '@capacitor/network';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor/device": entry({
    id: "device",
    name: "Device",
    npm: "@capacitor/device",
    category: "device",
    importTemplate: `import { Device } from '@capacitor/device';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor/clipboard": entry({
    id: "clipboard",
    name: "Clipboard",
    npm: "@capacitor/clipboard",
    category: "device",
    importTemplate: `import { Clipboard } from '@capacitor/clipboard';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor/share": entry({
    id: "share",
    name: "Share",
    npm: "@capacitor/share",
    category: "device",
    importTemplate: `import { Share } from '@capacitor/share';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor/browser": entry({
    id: "browser",
    name: "Browser",
    npm: "@capacitor/browser",
    category: "device",
    permissions: ["android.permission.INTERNET"],
    gradleDependencies: ["androidx.browser:browser:1.8.0"],
    versionForMajor: CAP6("^6.0.0"),
    importTemplate: `import { Browser } from '@capacitor/browser';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor/preferences": entry({
    id: "preferences",
    name: "Preferences",
    npm: "@capacitor/preferences",
    category: "storage",
    importTemplate: `import { Preferences } from '@capacitor/preferences';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),
  "@capacitor-community/sqlite": entry({
    id: "sqlite",
    name: "SQLite",
    npm: "@capacitor-community/sqlite",
    category: "storage",
    capacitorMin: 6,
    versionForMajor: { 6: "^6.0.0", 7: "^7.0.0" },
    androidMinSdk: 24,
    gradleDependencies: ["net.zetetic:android-database-sqlcipher:4.5.4"],
    iosPods: ["SQLCipher"],
    importTemplate: `import { CapacitorSQLite } from '@capacitor-community/sqlite';`,
    initTemplate: "",
    initLocation: "on-demand",
  }),

  /* ---------------------------------------------------- notifications */
  "@capacitor/push-notifications": entry({
    id: "push-notifications",
    name: "Push Notifications",
    npm: "@capacitor/push-notifications",
    category: "notifications",
    androidMinSdk: 24,
    requiresConfig: true,
    permissions: [
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.RECEIVE_BOOT_COMPLETED",
    ],
    gradleDependencies: ["com.google.firebase:firebase-messaging:24.0.0"],
    iosPods: ["FirebaseMessaging"],
    conflictsWithDependencies: [
      {
        name: "firebase",
        requires: "^10.12.0",
        reason:
          "The plugin ships Firebase Messaging 24 (BoM 33). A Firebase JS SDK below 10 resolves an older messaging transport and Gradle fails during manifest merge.",
      },
    ],
    importTemplate: `import { PushNotifications } from '@capacitor/push-notifications';`,
    initTemplate: `await PushNotifications.requestPermissions();\nawait PushNotifications.register();`,
    initLocation: "app-mount",
    configFields: [
      { key: "googleServicesJson", label: "google-services.json", kind: "file", required: true, platform: "android", hint: "Firebase console → Project settings → Android app" },
      { key: "googleServiceInfoPlist", label: "GoogleService-Info.plist", kind: "file", required: true, platform: "ios" },
    ],
  }),
  "@capacitor/local-notifications": entry({
    id: "local-notifications",
    name: "Local Notifications",
    npm: "@capacitor/local-notifications",
    category: "notifications",
    androidMinSdk: 24,
    permissions: [
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.RECEIVE_BOOT_COMPLETED",
    ],
    importTemplate: `import { LocalNotifications } from '@capacitor/local-notifications';`,
    initTemplate: `await LocalNotifications.requestPermissions();`,
    initLocation: "app-mount",
  }),

  /* ------------------------------------------------------------ media */
  "@capacitor/google-maps": entry({
    id: "google-maps",
    name: "Google Maps",
    npm: "@capacitor/google-maps",
    category: "media",
    androidMinSdk: 24,
    iosDeploymentTarget: "14.0",
    requiresConfig: true,
    permissions: [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
    ],
    gradleDependencies: [
      "com.google.android.gms:play-services-maps:19.0.0",
      "com.google.android.gms:play-services-location:21.3.0",
    ],
    iosPods: ["GoogleMaps"],
    importTemplate: `import { GoogleMap } from '@capacitor/google-maps';`,
    initTemplate: "",
    initLocation: "on-demand",
    configFields: [
      { key: "mapsApiKey", label: "Google Maps API key", kind: "secret", required: true, pattern: "^AIza[0-9A-Za-z_\\-]{30,}$" },
    ],
  }),
  "@capacitor-community/admob": entry({
    id: "admob",
    name: "AdMob",
    npm: "@capacitor-community/admob",
    category: "monetization",
    capacitorMin: 6,
    versionForMajor: { 6: "^6.2.0", 7: "^7.0.0" },
    androidMinSdk: 24,
    requiresConfig: true,
    permissions: ["android.permission.INTERNET", "android.permission.AD_ID"],
    gradleDependencies: [
      "com.google.android.gms:play-services-ads:23.3.0",
      "com.google.android.gms:play-services-ads-identifier:18.0.1",
    ],
    iosPods: ["Google-Mobile-Ads-SDK"],
    importTemplate: `import { AdMob } from '@capacitor-community/admob';`,
    initTemplate: `await AdMob.initialize({});`,
    initLocation: "app-mount",
    configFields: [
      { key: "admobAppId", label: "AdMob App ID", kind: "text", required: true, pattern: "^ca-app-pub-[0-9]+~[0-9]+$" },
    ],
  }),
};

/** Plugins the platform always installs — every other plugin must fit around these. */
export const CORE_PLUGIN_NPMS = Object.values(PLUGIN_REGISTRY)
  .filter((p) => p.alwaysInstall)
  .map((p) => p.npm);

/** Alias for readability at the call sites that mean "always install". */
export const ALWAYS_INSTALL_NPMS = CORE_PLUGIN_NPMS;

/**
 * Packages that must never be installed. `@capacitor/google-auth` does not
 * exist on npm and every install attempt 404s the whole workflow.
 */
export const FORBIDDEN_PACKAGES = new Set<string>([
  "@capacitor/google-auth",
]);

/**
 * Only one implementation per capability may be installed. The first entry of
 * each group is canonical; the rest are removed from package.json.
 */
export const EXCLUSIVE_PACKAGE_GROUPS: { capability: string; canonical: string; duplicates: string[] }[] = [
  {
    capability: "Google authentication",
    canonical: "@codetrix-studio/capacitor-google-auth",
    duplicates: ["@capawesome/capacitor-google-auth", "@capacitor/google-auth"],
  },
  {
    capability: "Biometric authentication",
    canonical: "@aparajita/capacitor-biometric-auth",
    duplicates: ["@capgo/capacitor-native-biometric"],
  },
];

const ID_ALIASES: Record<string, string> = {
  app: "@capacitor/app",
  "status-bar": "@capacitor/status-bar",
  keyboard: "@capacitor/keyboard",
  "splash-screen": "@capacitor/splash-screen",
  splash: "@capacitor/splash-screen",
  haptics: "@capacitor/haptics",
  "display-mode": "nativeforge-display-mode",
  "edge-to-edge": "nativeforge-display-mode",
  "navigation-bar": "@capacitor/navigation-bar",
  camera: "@capacitor/camera",
  geolocation: "@capacitor/geolocation",
  push: "@capacitor/push-notifications",
  "push-notifications": "@capacitor/push-notifications",
  "local-notifications": "@capacitor/local-notifications",
  "google-maps": "@capacitor/google-maps",
  "google-auth": "@codetrix-studio/capacitor-google-auth",
  "capawesome-google-sign-in": "@codetrix-studio/capacitor-google-auth",
  "apple-sign-in": "@capacitor-community/apple-sign-in",
  "capawesome-apple-sign-in": "@capacitor-community/apple-sign-in",
  "firebase-auth": "@capacitor-firebase/authentication",
  "facebook-login": "@capacitor-community/facebook-login",
  admob: "@capacitor-community/admob",
  biometrics: "@aparajita/capacitor-biometric-auth",
  sqlite: "@capacitor-community/sqlite",
  filesystem: "@capacitor/filesystem",
  browser: "@capacitor/browser",
  network: "@capacitor/network",
  device: "@capacitor/device",
  clipboard: "@capacitor/clipboard",
  share: "@capacitor/share",
  preferences: "@capacitor/preferences",
  storage: "@capacitor/preferences",
};

/** Accepts either an internal plugin id or an npm package name. */
export function resolveRegistryKey(idOrNpm: string): string {
  if (PLUGIN_REGISTRY[idOrNpm]) return idOrNpm;
  return ID_ALIASES[idOrNpm] ?? idOrNpm;
}

export function lookupPlugin(idOrNpm: string): PluginRegistryEntry | null {
  return PLUGIN_REGISTRY[resolveRegistryKey(idOrNpm)] ?? null;
}

/** Every npm package a plugin drags in (primary + secondary). */
export function packagesFor(entry: PluginRegistryEntry): string[] {
  return [entry.npm, ...(entry.secondaryPackages ?? [])];
}

/** True when the package is required by at least one of the given plugins. */
export function packageRequiredBy(pkg: string, pluginKeys: Iterable<string>): boolean {
  for (const key of pluginKeys) {
    const e = lookupPlugin(key);
    if (e && packagesFor(e).includes(pkg)) return true;
  }
  return ALWAYS_INSTALL_NPMS.includes(pkg);
}
