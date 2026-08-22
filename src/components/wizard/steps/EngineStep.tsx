import EngineSelector, { type EngineType } from "@/components/converter/EngineSelector";

interface EngineStepProps {
  selected: EngineType;
  onSelect: (engine: EngineType) => void;
  hasUrl: boolean;
}

const EngineStep = ({ selected, onSelect, hasUrl }: EngineStepProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Runtime Engine</h2>
        <p className="text-sm text-muted-foreground">
          Choose how your web app runs on Android
        </p>
      </div>

      {hasUrl && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--info))]/10 border border-[hsl(var(--info))]/20">
          <span className="text-xs text-[hsl(var(--info))]">
            💡 Recommended: <strong>WebView</strong> or <strong>TWA</strong> for URL-based apps
          </span>
        </div>
      )}

      <EngineSelector selected={selected} onSelect={onSelect} />

      <div className="rounded-lg bg-secondary/50 p-3 border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {selected === "webview" && "WebView wraps your URL in an Android WebView. No source code needed. Fastest to build but limited native API access."}
          {selected === "capacitor" && "Capacitor provides a full native bridge. Upload your source code to access native APIs like camera, filesystem, and push notifications."}
          {selected === "ionic" && "Ionic + Capacitor adds native-feeling UI components on top of Capacitor's bridge. Best for apps that need platform-native look and feel."}
          {selected === "twa" && "Trusted Web Activity runs your PWA inside Chrome. Best performance and rendering, but requires a valid PWA with Lighthouse score 90+."}
          {selected === "electron" && "Electron builds desktop apps for Windows, macOS, and Linux. Wraps your web app with full Node.js access, native menus, and system tray."}
        </p>
      </div>
    </div>
  );
};

export default EngineStep;
