import { useState } from "react";
import { Globe, Link2, Server, Smartphone } from "lucide-react";
import { SettingsHeader, Tabs } from "./settings/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Deeplinking = () => {
  const [scheme, setScheme] = useState("myapp");
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium mb-1">Custom URL Scheme</h3>
            <p className="text-xs text-muted-foreground mb-4">Launch your app directly from a custom protocol link.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Scheme Name</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Input 
                value={scheme} 
                onChange={e => setScheme(e.target.value)} 
                disabled={!enabled}
                className="font-mono text-xs max-w-[200px]" 
              />
              <span className="text-xs text-muted-foreground font-mono">://path/to/content</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Example: {scheme}://profile/123</p>
          </div>
          <div className="flex justify-end pt-2 border-t border-border">
            <Button size="sm" onClick={() => toast.success("Deep linking settings saved")}>Save Configuration</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Domains = () => {
  const [domain, setDomain] = useState("app.nativebridge.dev");
  const [appLinks, setAppLinks] = useState(true);
  const [universalLinks, setUniversalLinks] = useState(true);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium mb-1">App Links & Universal Links</h3>
        <p className="text-xs text-muted-foreground mb-4">Associate your native application with a verified web domain.</p>
        
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Primary Domain</Label>
            <Input 
              value={domain} 
              onChange={e => setDomain(e.target.value)} 
              className="font-mono text-xs mt-1.5" 
              placeholder="e.g. your-app.com"
            />
          </div>
          
          <div className="flex items-center justify-between p-3 border border-border rounded bg-background/50">
            <div>
              <p className="text-sm font-medium">Android App Links</p>
              <p className="text-xs text-muted-foreground">Generates assetlinks.json for Android OS</p>
            </div>
            <Switch checked={appLinks} onCheckedChange={setAppLinks} />
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded bg-background/50">
            <div>
              <p className="text-sm font-medium">iOS Universal Links</p>
              <p className="text-xs text-muted-foreground">Generates apple-app-site-association (AASA)</p>
            </div>
            <Switch checked={universalLinks} onCheckedChange={setUniversalLinks} />
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button size="sm" onClick={() => toast.success("Domain associations updated")}>Save Domains</Button>
          </div>
        </div>
      </div>
      
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium mb-1">Asset Verification</h3>
        <p className="text-xs text-muted-foreground mb-3">Host these files at the root of your domain (.well-known/)</p>
        
        <div className="bg-muted/30 p-3 rounded font-mono text-[10px] text-muted-foreground overflow-x-auto whitespace-pre">
{`[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.nativebridge.app",
    "sha256_cert_fingerprints": ["XX:XX:XX..."]
  }
}]`}
        </div>
      </div>
    </div>
  );
};

const Uplinks = () => {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Server className="text-primary w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1">Backend Uplinks</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure CORS rules, CSP, and allowed network endpoints for the native WebViews to communicate with external APIs securely.</p>
            
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Allowed Origins (CORS)</Label>
                <Textarea 
                  defaultValue={"https://api.supabase.com\nhttps://api.stripe.com"} 
                  className="font-mono text-xs mt-1.5 h-20"
                />
              </div>
              <div>
                <Label className="text-xs">Navigation Scope (Allow-List)</Label>
                <Textarea 
                  defaultValue={"https://auth.example.com/*"} 
                  className="font-mono text-xs mt-1.5 h-20"
                />
                <p className="text-[10px] text-muted-foreground mt-1">URLs the webview is allowed to navigate to without opening the external browser.</p>
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => toast.success("Uplink security policies saved")}>Save Policies</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const NetworkingPanel = () => {
  const [tab, setTab] = useState("deeplinking");

  return (
    <div className="p-8 h-full overflow-y-auto">
      <SettingsHeader 
        icon={Globe} 
        title="Networking & Links" 
        description="Configure deep links, URL schemes, domain associations, and network security policies."
      />
      <Tabs
        tabs={[
          { id: "deeplinking", label: "Deep Linking" },
          { id: "domains", label: "Domains & App Links" },
          { id: "uplinks", label: "Uplinks & Security" }
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="mt-6">
        {tab === "deeplinking" && <Deeplinking />}
        {tab === "domains" && <Domains />}
        {tab === "uplinks" && <Uplinks />}
      </div>
    </div>
  );
};

export default NetworkingPanel;
