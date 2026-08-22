import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Image as ImageIcon } from "lucide-react";
import { ICON_DENSITIES } from "@/lib/iconGenerator";

interface AppIdentityData {
  appName: string;
  packageName: string;
  versionCode: string;
  versionName: string;
  iconDataUrl: string | null;
}

interface AppIdentityStepProps {
  data: AppIdentityData;
  onChange: (data: Partial<AppIdentityData>) => void;
}

const AppIdentityStep = ({ data, onChange }: AppIdentityStepProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [packageEdited, setPackageEdited] = useState(false);

  const handleAppNameChange = (name: string) => {
    onChange({ appName: name });
    if (!packageEdited) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 30);
      onChange({ appName: name, packageName: `com.app.${slug || "myapp"}` });
    }
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ iconDataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">App Identity</h2>
        <p className="text-sm text-muted-foreground">
          Define your app's name, package, and icon
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="appName">App Name</Label>
          <Input
            id="appName"
            placeholder="My Awesome App"
            value={data.appName}
            onChange={(e) => handleAppNameChange(e.target.value)}
            className="bg-secondary border-border"
          />
          <p className="text-xs text-muted-foreground">Shown on the launcher</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="packageName">Package Name</Label>
          <Input
            id="packageName"
            placeholder="com.example.myapp"
            value={data.packageName}
            onChange={(e) => {
              setPackageEdited(true);
              onChange({ packageName: e.target.value });
            }}
            className="bg-secondary border-border font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">Unique app identifier</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="versionName">Version Name</Label>
          <Input
            id="versionName"
            placeholder="1.0.0"
            value={data.versionName}
            onChange={(e) => onChange({ versionName: e.target.value })}
            className="bg-secondary border-border"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="versionCode">Version Code</Label>
          <Input
            id="versionCode"
            type="number"
            min="1"
            placeholder="1"
            value={data.versionCode}
            onChange={(e) => onChange({ versionCode: e.target.value })}
            className="bg-secondary border-border"
          />
          <p className="text-xs text-muted-foreground">Incremental integer for Play Store</p>
        </div>
      </div>

      {/* Icon Upload */}
      <div className="space-y-3">
        <Label>App Icon</Label>
        <div className="flex items-start gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-secondary flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {data.iconDataUrl ? (
              <img
                src={data.iconDataUrl}
                alt="App icon"
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              <>
                <Upload size={20} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Upload</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleIconUpload}
            className="hidden"
          />

          {data.iconDataUrl && (
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-2">Generated density icons:</p>
              <div className="flex items-end gap-3">
                {ICON_DENSITIES.map((d) => (
                  <div key={d.name} className="flex flex-col items-center gap-1">
                    <img
                      src={data.iconDataUrl!}
                      alt={d.name}
                      style={{ width: Math.max(d.size * 0.35, 16), height: Math.max(d.size * 0.35, 16) }}
                      className="rounded-md"
                    />
                    <span className="text-[9px] text-muted-foreground">{d.name}</span>
                    <span className="text-[9px] text-muted-foreground/60">{d.size}px</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data.iconDataUrl && (
            <div className="flex-1 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon size={14} />
                <span>512×512 PNG recommended</span>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Auto-generates all 5 Android density icons. If skipped, a default letter icon is used.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppIdentityStep;
