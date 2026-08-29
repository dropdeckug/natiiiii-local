import { useState } from "react";
import { Settings, FileJson, Settings2, Database } from "lucide-react";
import { SettingsHeader, Tabs } from "./settings/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const AppConfig = () => {
  const [config, setConfig] = useState(JSON.stringify({
    name: "NativeBridgeApp",
    version: "1.0.0",
    description: "A native app built with NativeBridge"
  }, null, 2));

  const handleSave = () => {
    try {
      JSON.parse(config);
      toast.success("App configuration saved successfully");
    } catch (e) {
      toast.error("Invalid JSON format");
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium mb-2">NativeBridge Configuration</h3>
        <p className="text-xs text-muted-foreground mb-4">Settings for the NativeBridge build pipeline and orchestrator.</p>
        <Textarea 
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          className="font-mono text-xs min-h-[250px] bg-background"
        />
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={handleSave}>Save App Config</Button>
        </div>
      </div>
    </div>
  );
};

const CapacitorConfig = () => {
  const [config, setConfig] = useState(`import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nativebridge.app',
  appName: 'NativeBridgeApp',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffffff"
    }
  }
};

export default config;`);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium mb-2">Capacitor Config (capacitor.config.ts)</h3>
        <p className="text-xs text-muted-foreground mb-4">Directly edit the native shell configuration for iOS and Android.</p>
        <Textarea 
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          className="font-mono text-xs min-h-[300px] bg-background"
        />
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => toast.success("Capacitor config saved")}>Save Config</Button>
        </div>
      </div>
    </div>
  );
};

const EnvVariables = () => {
  const [vars, setVars] = useState([{ key: "API_URL", value: "https://api.example.com" }, { key: "ENABLE_ANALYTICS", value: "true" }]);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  const addVar = () => {
    if (!newKey.trim()) return;
    setVars([...vars, { key: newKey.trim(), value: newVal.trim() }]);
    setNewKey("");
    setNewVal("");
  };

  const removeVar = (index: number) => {
    setVars(vars.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium mb-2">Environment Variables</h3>
        <p className="text-xs text-muted-foreground mb-4">Variables injected during the native build step (.env format).</p>
        
        <div className="space-y-2 mb-6">
          {vars.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={v.key} readOnly className="font-mono text-xs bg-muted/30" />
              <Input value={v.value} readOnly className="font-mono text-xs bg-muted/30" />
              <Button variant="ghost" size="sm" onClick={() => removeVar(i)} className="text-destructive hover:text-destructive">Remove</Button>
            </div>
          ))}
          {vars.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No environment variables defined.</div>}
        </div>

        <div className="flex items-center gap-2 border-t pt-4">
          <Input placeholder="KEY (e.g. VITE_API_KEY)" value={newKey} onChange={e => setNewKey(e.target.value)} className="font-mono text-xs" />
          <Input placeholder="Value" value={newVal} onChange={e => setNewVal(e.target.value)} className="font-mono text-xs" />
          <Button size="sm" onClick={addVar}>Add</Button>
        </div>
        <div className="mt-6 flex justify-end">
          <Button size="sm" onClick={() => toast.success("Environment variables saved")}>Save Variables</Button>
        </div>
      </div>
    </div>
  );
};

const ConfigurationPanel = () => {
  const [tab, setTab] = useState("app-config");

  return (
    <div className="p-8 h-full overflow-y-auto">
      <SettingsHeader 
        icon={Settings} 
        title="Project Configuration" 
        description="Directly manage raw configuration files and build environment variables."
      />
      <Tabs
        tabs={[
          { id: "app-config", label: "App Config" },
          { id: "capacitor-config", label: "Capacitor Config" },
          { id: "env-vars", label: "Environment Variables" }
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="mt-6">
        {tab === "app-config" && <AppConfig />}
        {tab === "capacitor-config" && <CapacitorConfig />}
        {tab === "env-vars" && <EnvVariables />}
      </div>
    </div>
  );
};

export default ConfigurationPanel;
