import { useState } from "react";
import {
  Bell, Camera, FolderOpen, MapPin, Fingerprint, ShieldCheck,
  Globe, Share2, Clipboard, Palette, Keyboard, Link2,
  RefreshCw, Wifi, Smartphone, Vibrate, RotateCcw, Sparkles,
  Lock, CreditCard, MessageSquare, Mic, QrCode, Bluetooth,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useProjectStore } from "@/stores/projectStore";
import CodeBlock from "@/components/docs/CodeBlock";
import type { EngineType } from "@/components/converter/EngineSelector";

interface Plugin {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  permissions: string[];
  needsConfig: boolean;
  engines: EngineType[];
  category: "core" | "media" | "device" | "auth" | "ui" | "communication";
  npmPackage?: string;
  codeSnippet?: string;
}

const plugins: Plugin[] = [
  // === Core ===
  { id: "network", name: "Network Info", icon: Wifi, description: "Online/offline detection", permissions: ["ACCESS_NETWORK_STATE"], needsConfig: false, engines: ["capacitor", "ionic", "electron"], category: "core", npmPackage: "@capacitor/network", codeSnippet: `import { Network } from '@capacitor/network';\n\nconst status = await Network.getStatus();\nconsole.log('Connected:', status.connected);` },
  { id: "device", name: "Device Info", icon: Smartphone, description: "Hardware/OS info", permissions: [], needsConfig: false, engines: ["capacitor", "ionic", "electron"], category: "core", npmPackage: "@capacitor/device", codeSnippet: `import { Device } from '@capacitor/device';\n\nconst info = await Device.getInfo();\nconsole.log('Platform:', info.platform);` },
  { id: "storage", name: "Preferences", icon: FolderOpen, description: "Key-value storage", permissions: [], needsConfig: false, engines: ["capacitor", "ionic", "electron"], category: "core", npmPackage: "@capacitor/preferences", codeSnippet: `import { Preferences } from '@capacitor/preferences';\n\nawait Preferences.set({ key: 'name', value: 'Max' });\nconst { value } = await Preferences.get({ key: 'name' });` },
  { id: "deeplinks", name: "Deep Links", icon: Link2, description: "Custom URL schemes", permissions: [], needsConfig: true, engines: ["capacitor", "ionic", "webview", "twa"], category: "core" },
  { id: "updates", name: "App Updates", icon: RefreshCw, description: "In-app update prompts", permissions: [], needsConfig: false, engines: ["capacitor", "ionic"], category: "core" },

  // === Media ===
  { id: "camera", name: "Camera", icon: Camera, description: "Camera & gallery access", permissions: ["CAMERA", "READ_MEDIA_IMAGES"], needsConfig: false, engines: ["capacitor", "ionic"], category: "media", npmPackage: "@capacitor/camera", codeSnippet: `import { Camera, CameraResultType } from '@capacitor/camera';\n\nconst image = await Camera.getPhoto({\n  quality: 90,\n  resultType: CameraResultType.Uri\n});` },
  { id: "files", name: "File Access", icon: FolderOpen, description: "Read/write filesystem", permissions: ["READ_EXTERNAL_STORAGE"], needsConfig: false, engines: ["capacitor", "ionic", "electron"], category: "media", npmPackage: "@capacitor/filesystem", codeSnippet: `import { Filesystem, Directory } from '@capacitor/filesystem';\n\nawait Filesystem.writeFile({\n  path: 'test.txt',\n  data: 'Hello!',\n  directory: Directory.Documents\n});` },
  { id: "microphone", name: "Microphone", icon: Mic, description: "Audio recording", permissions: ["RECORD_AUDIO"], needsConfig: false, engines: ["capacitor", "ionic", "webview"], category: "media" },
  { id: "barcode", name: "Barcode Scanner", icon: QrCode, description: "QR/barcode scanning", permissions: ["CAMERA"], needsConfig: false, engines: ["capacitor", "ionic"], category: "media" },

  // === Device ===
  { id: "geo", name: "Geolocation", icon: MapPin, description: "GPS location", permissions: ["ACCESS_FINE_LOCATION"], needsConfig: false, engines: ["capacitor", "ionic", "webview"], category: "device", npmPackage: "@capacitor/geolocation", codeSnippet: `import { Geolocation } from '@capacitor/geolocation';\n\nconst pos = await Geolocation.getCurrentPosition();\nconsole.log('Lat:', pos.coords.latitude);` },
  { id: "haptics", name: "Haptics", icon: Vibrate, description: "Vibration feedback", permissions: ["VIBRATE"], needsConfig: false, engines: ["capacitor", "ionic"], category: "device", npmPackage: "@capacitor/haptics", codeSnippet: `import { Haptics, ImpactStyle } from '@capacitor/haptics';\n\nawait Haptics.impact({ style: ImpactStyle.Medium });` },
  { id: "orientation", name: "Screen Lock", icon: RotateCcw, description: "Lock orientation", permissions: [], needsConfig: false, engines: ["capacitor", "ionic", "webview"], category: "device" },
  { id: "bluetooth", name: "Bluetooth", icon: Bluetooth, description: "BLE communication", permissions: ["BLUETOOTH", "BLUETOOTH_ADMIN"], needsConfig: false, engines: ["capacitor", "ionic"], category: "device" },

  // === Auth ===
  { id: "biometrics", name: "Biometrics", icon: Fingerprint, description: "Fingerprint/Face unlock", permissions: ["USE_BIOMETRIC"], needsConfig: false, engines: ["capacitor", "ionic"], category: "auth" },
  { id: "google-auth", name: "Google Sign-In", icon: ShieldCheck, description: "OAuth with Google", permissions: ["INTERNET"], needsConfig: true, engines: ["capacitor", "ionic", "webview"], category: "auth" },
  { id: "apple-auth", name: "Apple Sign-In", icon: Lock, description: "Sign in with Apple", permissions: ["INTERNET"], needsConfig: true, engines: ["capacitor", "ionic"], category: "auth" },

  // === UI ===
  { id: "splash", name: "Splash Screen", icon: Sparkles, description: "Launch screen", permissions: [], needsConfig: true, engines: ["capacitor", "ionic", "webview"], category: "ui", npmPackage: "@capacitor/splash-screen", codeSnippet: `import { SplashScreen } from '@capacitor/splash-screen';\n\nawait SplashScreen.hide();` },
  { id: "statusbar", name: "Status Bar", icon: Palette, description: "Color & style control", permissions: [], needsConfig: false, engines: ["capacitor", "ionic", "webview"], category: "ui", npmPackage: "@capacitor/status-bar", codeSnippet: `import { StatusBar, Style } from '@capacitor/status-bar';\n\nawait StatusBar.setStyle({ style: Style.Dark });` },
  { id: "edge-to-edge", name: "Display Mode", icon: Smartphone, description: "Five display modes · all four Android resource folders · safe-area CSS · runtime colour matching", permissions: [], needsConfig: false, engines: ["capacitor", "ionic"], category: "ui", npmPackage: "@capacitor/status-bar", codeSnippet: `// Auto-wired by NativeForge Display Mode.\n// Pick one of: CLASSIC | THEMED | EDGE_TO_EDGE | GLASSMORPHISM | PER_PAGE.\n// The wiring step writes the Android resources, capacitor.config, safe-area CSS\n// and src/capacitor/display-mode.ts, then imports it from your entry point.` },
  { id: "keyboard", name: "Keyboard", icon: Keyboard, description: "Show/hide control", permissions: [], needsConfig: false, engines: ["capacitor", "ionic"], category: "ui", npmPackage: "@capacitor/keyboard" },

  // === Communication ===
  { id: "push", name: "Push Notifications", icon: Bell, description: "Firebase Cloud Messaging", permissions: ["INTERNET", "WAKE_LOCK"], needsConfig: true, engines: ["capacitor", "ionic"], category: "communication", npmPackage: "@capacitor/push-notifications", codeSnippet: `import { PushNotifications } from '@capacitor/push-notifications';\n\nawait PushNotifications.requestPermissions();\nawait PushNotifications.register();\n\nPushNotifications.addListener('pushNotificationReceived', (notification) => {\n  console.log('Push received:', notification);\n});` },
  { id: "local-notif", name: "Local Notifications", icon: Bell, description: "Scheduled alerts", permissions: ["POST_NOTIFICATIONS"], needsConfig: false, engines: ["capacitor", "ionic", "electron"], category: "communication", npmPackage: "@capacitor/local-notifications", codeSnippet: `import { LocalNotifications } from '@capacitor/local-notifications';\n\nawait LocalNotifications.schedule({\n  notifications: [{\n    title: 'Reminder',\n    body: 'Check your app!',\n    id: 1,\n    schedule: { at: new Date(Date.now() + 5000) }\n  }]\n});` },
  { id: "in-app-browser", name: "In-App Browser", icon: Globe, description: "Open links inside app", permissions: ["INTERNET"], needsConfig: false, engines: ["capacitor", "ionic", "webview", "electron"], category: "communication", npmPackage: "@capacitor/browser" },
  { id: "share", name: "Share", icon: Share2, description: "Native share sheet", permissions: [], needsConfig: false, engines: ["capacitor", "ionic"], category: "communication", npmPackage: "@capacitor/share", codeSnippet: `import { Share } from '@capacitor/share';\n\nawait Share.share({\n  title: 'Check this out',\n  text: 'Amazing app!',\n  url: 'https://example.com'\n});` },
  { id: "clipboard", name: "Clipboard", icon: Clipboard, description: "Copy/paste access", permissions: [], needsConfig: false, engines: ["capacitor", "ionic", "electron"], category: "communication", npmPackage: "@capacitor/clipboard" },
  { id: "sms", name: "SMS", icon: MessageSquare, description: "Send SMS messages", permissions: ["SEND_SMS"], needsConfig: false, engines: ["capacitor", "ionic"], category: "communication" },
  { id: "iap", name: "In-App Purchases", icon: CreditCard, description: "Play Store / App Store billing", permissions: ["BILLING"], needsConfig: true, engines: ["capacitor", "ionic"], category: "communication" },
];

const CATEGORY_LABELS: Record<string, string> = {
  core: "Core",
  media: "Media & Files",
  device: "Device & Sensors",
  auth: "Authentication",
  ui: "UI Controls",
  communication: "Communication",
};

const ENGINE_LABELS: Record<string, string> = {
  webview: "WebView",
  capacitor: "Capacitor",
  ionic: "Ionic",
  twa: "TWA",
  electron: "Electron",
};

interface PluginManagerProps {
  currentEngine?: EngineType;
}

const PluginManager = ({ currentEngine }: PluginManagerProps) => {
  const { enabledPlugins, togglePlugin, selectedEngine } = useProjectStore();
  const engine = currentEngine || selectedEngine as EngineType || "capacitor";
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);

  // Group plugins by category
  const categories = Array.from(new Set(plugins.map(p => p.category)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {enabledPlugins.size} plugin{enabledPlugins.size !== 1 ? "s" : ""} enabled
          {engine && <span className="ml-1">· Engine: <strong>{ENGINE_LABELS[engine] || engine}</strong></span>}
        </p>
      </div>

      {categories.map(cat => {
        const catPlugins = plugins.filter(p => p.category === cat);
        return (
          <div key={cat}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {CATEGORY_LABELS[cat] || cat}
            </h3>
            <div className="grid grid-cols-1 gap-1">
              {catPlugins.map((plugin) => {
                const Icon = plugin.icon;
                const isOn = enabledPlugins.has(plugin.id);
                const isSupported = plugin.engines.includes(engine);

                return (
                  <div key={plugin.id}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        !isSupported ? "opacity-40" :
                        isOn ? "bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isOn && isSupported ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{plugin.name}</span>
                          {plugin.needsConfig && isOn && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]">
                              config needed
                            </span>
                          )}
                          {!isSupported && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              not for {ENGINE_LABELS[engine]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-muted-foreground truncate">{plugin.description}</p>
                          <div className="flex gap-0.5 shrink-0">
                            {plugin.engines.map(e => (
                              <span
                                key={e}
                                className={`text-[8px] px-1 py-0 rounded ${
                                  e === engine ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
                                }`}
                              >
                                {e === "capacitor" ? "Cap" : e === "ionic" ? "Ion" : e === "electron" ? "Elc" : e === "webview" ? "WV" : "TWA"}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={isOn}
                        disabled={!isSupported}
                        onCheckedChange={() => isSupported && togglePlugin(plugin.id)}
                      />
                      {plugin.codeSnippet && isOn && (
                        <button
                          onClick={() => setExpandedPlugin(expandedPlugin === plugin.id ? null : plugin.id)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                        >
                          {expandedPlugin === plugin.id ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                        </button>
                      )}
                    </div>
                    {expandedPlugin === plugin.id && plugin.codeSnippet && (
                      <div className="mt-1 mb-2 ml-11">
                        {plugin.npmPackage && (
                          <p className="text-[10px] text-muted-foreground mb-1 font-mono">npm install {plugin.npmPackage}</p>
                        )}
                        <CodeBlock code={plugin.codeSnippet} language="typescript" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PluginManager;
export { plugins };
export type { Plugin };
