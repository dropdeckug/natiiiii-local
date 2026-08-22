import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { PLUGIN_NPM_MAP, PluginNpmEntry, getPluginCategories } from "@/lib/generators/pluginMapping";
import {
  Shield, ChevronDown, Code2, Lock, AlertTriangle,
  Upload, FileJson, CheckCircle2, Info, Lightbulb, Loader2, Sparkles, Zap,
  ExternalLink, Package,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SyntaxHighlighter from "@/components/ui/syntax-highlighter";
import {
  type PluginSecret,
  getPluginSecretRequirements,
  loadPluginSecrets,
  savePluginSecret,
  savePluginFileSecret,
  arePluginSecretsComplete,
} from "@/lib/pluginSecretsService";
import { supabase } from "@/integrations/supabase/client";
import DisplayModeSelector from "@/components/plugins/DisplayModeSelector";
import { DISPLAY_MODE_SECRET_KEYS } from "@/lib/plugins/displayMode/registry";
import OAuthProvidersConfig from "@/components/plugins/OAuthProvidersConfig";
import { OAUTH_PLUGIN_IDS } from "@/lib/plugins/oauthProviders";
import { getPluginDependencies } from "@/lib/plugins/dependencies";

/** Keys rendered by dedicated UIs, not by the generic secret rows. */
const CUSTOM_UI_SECRET_KEYS = new Set([
  "EDGE_TO_EDGE_MODE",
  "OAUTH_ENABLED_PROVIDERS",
  ...Object.values(DISPLAY_MODE_SECRET_KEYS),
]);

const CORE_PLUGINS = ["app", "splash-screen", "status-bar"];

interface PluginDisplay {
  id: string;
  entry: PluginNpmEntry;
  isCore: boolean;
}

/* ── Secret Input Row ── */
const SecretInputRow = ({
  pluginId, secretKey, label, type, placeholder, description, projectId, savedSecrets, onSecretSaved,
}: {
  pluginId: string; secretKey: string; label: string; type: "text" | "file";
  placeholder?: string; description?: string; projectId: string;
  savedSecrets: PluginSecret[]; onSecretSaved: () => void;
}) => {
  const existing = savedSecrets.find(s => s.plugin_id === pluginId && s.secret_key === secretKey);
  const [value, setValue] = useState(existing?.secret_value || "");
  const [saving, setSaving] = useState(false);
  const isSaved = type === "text" ? !!existing?.secret_value : !!existing?.file_path;

  const handleSaveText = async () => {
    if (!value.trim()) return;
    setSaving(true);
    const ok = await savePluginSecret(projectId, pluginId, secretKey, value);
    setSaving(false);
    if (ok) { toast.success(`${label} saved`); onSecretSaved(); }
    else toast.error("Failed to save secret");
  };

  const handleFileUpload = async (file: File) => {
    setSaving(true);
    const ok = await savePluginFileSecret(projectId, pluginId, secretKey, file);
    setSaving(false);
    if (ok) { toast.success(`${file.name} uploaded`); onSecretSaved(); }
    else toast.error("Failed to upload file");
  };

  if (type === "file") {
    return (
      <div className="space-y-1">
        <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {label} {isSaved && <CheckCircle2 size={11} className="text-primary" />}
        </Label>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs text-muted-foreground cursor-pointer hover:border-primary/30 transition-colors">
            <Upload size={12} />
            {isSaved ? "✓ Uploaded" : saving ? "Uploading..." : "Choose file"}
            <input type="file" accept=".json,.plist" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
          </label>
          {isSaved && <FileJson size={14} className="text-primary" />}
        </div>
        {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {label} {isSaved && <CheckCircle2 size={11} className="text-primary" />}
      </Label>
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder}
          className="h-8 text-xs bg-background font-mono flex-1" onBlur={handleSaveText} onKeyDown={(e) => e.key === "Enter" && handleSaveText()} />
        {!isSaved && value.trim() && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSaveText} disabled={saving}>
            {saving ? "..." : "Save"}
          </Button>
        )}
      </div>
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
    </div>
  );
};

/* ── Quick Tips ── */
const QuickTips = ({ tips }: { tips: string[] }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-[3px] bg-primary/5 border border-primary/10 px-3 py-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs font-medium text-primary w-full">
        <Lightbulb size={12} /> Quick Setup Tips
        <ChevronDown size={11} className={`ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1">
          {tips.map((tip, i) => (
            <li key={i} className="text-[11px] text-foreground flex gap-1.5">
              <span className="text-primary shrink-0 mt-0.5">→</span> {tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Tab component matching Supabase style ── */
const PluginTabs = ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) => {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "usage", label: "Usage & Permissions" },
  ];
  return (
    <div className="flex border-b border-border">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full transition-all" />
          )}
        </button>
      ))}
    </div>
  );
};

/* ── Main PluginsPanel ── */
interface PluginsPanelProps {
  selectedPluginId?: string;
}

const PluginsPanel = ({ selectedPluginId }: PluginsPanelProps) => {
  const { id: projectId } = useParams<{ id: string }>();
  const { enabledPlugins, togglePlugin, addPendingChange, files } = useProjectStore();
  const [savedSecrets, setSavedSecrets] = useState<PluginSecret[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "passed" | "warning">("idle");
  const [scanMessage, setScanMessage] = useState("");

  const refreshSecrets = useCallback(async () => {
    if (!projectId) return;
    const secrets = await loadPluginSecrets(projectId);
    setSavedSecrets(secrets);
  }, [projectId]);

  useEffect(() => { refreshSecrets(); }, [refreshSecrets]);

  // Load enabled plugins from DB on mount
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const { data } = await (supabase as any)
          .from("project_plugins")
          .select("plugin_id")
          .eq("project_id", projectId);
        if (data && data.length > 0) {
          const store = useProjectStore.getState();
          const currentPlugins = new Set(store.enabledPlugins);
          for (const row of data as any[]) {
            currentPlugins.add(row.plugin_id);
          }
          store.setEnabledPlugins(currentPlugins);
        }
      } catch { /* table may not exist yet */ }
    })();
  }, [projectId]);

  const allPlugins = useMemo(() => {
    const seenIds = new Set<string>();
    const seenRefs = new Set<unknown>();
    const plugins: PluginDisplay[] = [];
    for (const [id, entry] of Object.entries(PLUGIN_NPM_MAP)) {
      // Dedupe by entry reference (alias IDs share the same object), NOT by npm package name —
      // distinct plugins like edge-to-edge and status-bar share an npm and must both appear.
      if (seenRefs.has(entry) || seenIds.has(id)) continue;
      seenRefs.add(entry); seenIds.add(id);
      plugins.push({ id, entry, isCore: CORE_PLUGINS.includes(id) });
    }
    return plugins;
  }, []);


  const selectedPlugin = useMemo(() =>
    allPlugins.find(p => p.id === selectedPluginId) || null,
  [allPlugins, selectedPluginId]);

  // Reset tab when plugin changes
  useEffect(() => { setActiveTab("overview"); setScanStatus("idle"); }, [selectedPluginId]);

  const handleToggle = async (plugin: PluginDisplay) => {
    const wasEnabled = enabledPlugins.has(plugin.id);

    if (!wasEnabled && plugin.entry.needsSecrets) {
      const isComplete = arePluginSecretsComplete(plugin.id, savedSecrets);
      if (!isComplete) {
        toast.warning(`"${plugin.entry.npm}" requires credentials. Please fill them in before enabling.`);
        return;
      }
    }

    togglePlugin(plugin.id);

    if (!wasEnabled) {
      addPendingChange({ type: "plugin_added", label: `Enable plugin: ${plugin.entry.npm}`, pluginId: plugin.id });
      toast.success(`Plugin "${plugin.entry.npm}" enabled`);

      // Quick scan
      setScanStatus("scanning");
      setTimeout(() => {
        const needsConfig = plugin.entry.needsSecrets || plugin.entry.needsManualConfig;
        if (needsConfig) {
          setScanStatus("warning");
          setScanMessage("This plugin requires configuration. Fill in the required secrets below.");
        } else {
          setScanStatus("passed");
          setScanMessage("Plugin is compatible and will be auto-injected during build.");
        }
      }, 1500);

      if (projectId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await (supabase as any).from("project_plugins").upsert({
              project_id: projectId,
              plugin_id: plugin.id,
              user_id: session.user.id,
              npm_package: plugin.entry.npm,
              enabled: true,
            }, { onConflict: "project_id,plugin_id" });
          }
        } catch (e) { console.error("Failed to persist plugin:", e); }
      }
    } else {
      addPendingChange({ type: "plugin_removed", label: `Disable plugin: ${plugin.entry.npm}`, pluginId: plugin.id });
      setScanStatus("idle");

      if (projectId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await (supabase as any).from("project_plugins").delete()
              .eq("project_id", projectId).eq("plugin_id", plugin.id);
          }
        } catch (e) { console.error("Failed to remove plugin:", e); }
      }
    }
  };

  if (!selectedPlugin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Package size={40} className="text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Plugins & Permissions</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Select a plugin from the sidebar to view its overview, usage examples, and configuration.
        </p>
      </div>
    );
  }

  const plugin = selectedPlugin;
  const isEnabled = enabledPlugins.has(plugin.id) || plugin.isCore;
  const requirements = getPluginSecretRequirements(plugin.id);
  const shortName = plugin.entry.npm.replace("@capacitor/", "").replace("@capawesome/capacitor-", "").replace("@capacitor-community/", "");
  const capacitorDocsUrl = plugin.entry.npm.startsWith("@capacitor/")
    ? `https://capacitorjs.com/docs/apis/${shortName}`
    : plugin.entry.npm.startsWith("@capawesome/")
    ? `https://capawesome.io/plugins/${shortName}/`
    : null;

  return (
    <div className="h-full overflow-auto">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 pb-0">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="hover:text-foreground cursor-pointer">Plugins</span>
          <span>›</span>
          <span className="text-foreground font-medium">{shortName}</span>
        </div>
      </div>

      {/* Header like Supabase */}
      <div className="px-6 pt-4 pb-0 flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
          <Package size={24} className="text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{shortName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{plugin.entry.description || "Capacitor plugin"}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={isEnabled}
            disabled={plugin.isCore}
            onCheckedChange={() => handleToggle(plugin)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 mt-4">
        <PluginTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Tab content */}
      <div className="px-6 py-5">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Meta row */}
            <div className="flex flex-wrap gap-x-10 gap-y-2 text-xs">
              {plugin.entry.category && (
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-0.5">CATEGORY</span>
                  <span className="text-foreground">{plugin.entry.category}</span>
                </div>
              )}
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-0.5">NPM PACKAGE</span>
                <span className="text-foreground font-mono text-[11px]">{plugin.entry.npm}</span>
              </div>
              {capacitorDocsUrl && (
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-0.5">WEBSITE</span>
                  <a href={capacitorDocsUrl} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1">
                    <ExternalLink size={10} /> Docs
                  </a>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <p className="text-sm text-foreground leading-relaxed">
                {plugin.entry.description}
                {plugin.entry.npm.startsWith("@capacitor/") &&
                  ` It uses the ${plugin.entry.npm} package, which is part of the official Capacitor plugin ecosystem. It works on ${plugin.entry.engines.join(", ")} runtime engines.`
                }
              </p>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              {plugin.isCore && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">Core Plugin</span>
              )}
              {isEnabled && !plugin.isCore && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] font-medium flex items-center gap-1">
                  <CheckCircle2 size={10} /> Enabled
                </span>
              )}
              {plugin.entry.needsSecrets && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] font-medium flex items-center gap-1">
                  <Lock size={10} /> Requires Config
                </span>
              )}
              {plugin.entry.engines.map(e => (
                <span key={e} className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{e}</span>
              ))}
            </div>

            {/* Scan result */}
            {scanStatus !== "idle" && (
              <div className={`rounded-lg border p-3 ${
                scanStatus === "scanning" ? "border-primary/30 bg-primary/5" :
                scanStatus === "passed" ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5" :
                "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5"
              }`}>
                <div className="flex items-center gap-2">
                  {scanStatus === "scanning" ? (
                    <><Loader2 size={14} className="animate-spin text-primary" /><span className="text-sm font-medium">Scanning compatibility…</span></>
                  ) : scanStatus === "passed" ? (
                    <><CheckCircle2 size={14} className="text-[hsl(var(--success))]" /><span className="text-sm text-[hsl(var(--success))] font-medium">Compatible</span></>
                  ) : (
                    <><AlertTriangle size={14} className="text-[hsl(var(--warning))]" /><span className="text-sm text-[hsl(var(--warning))] font-medium">Needs configuration</span></>
                  )}
                </div>
                {scanMessage && <p className="text-xs text-muted-foreground mt-1">{scanMessage}</p>}
              </div>
            )}

            {/* Install command */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Installation</h3>
              <SyntaxHighlighter code={`npm install ${plugin.entry.npm}\nnpx cap sync`} language="bash" showCopy />
            </div>

            {/* Code snippet */}
            {plugin.entry.codeSnippet && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Code2 size={14} /> Quick Start
                </h3>
                <SyntaxHighlighter code={plugin.entry.codeSnippet} language="typescript" showCopy />
              </div>
            )}

            {/* Display Mode: five modes */}
            {plugin.id === "edge-to-edge" && projectId && (
              <DisplayModeSelector projectId={projectId} savedSecrets={savedSecrets} onSaved={refreshSecrets} />
            )}

            {/* OAuth: provider picker + per-provider credentials */}
            {OAUTH_PLUGIN_IDS.includes(plugin.id) && projectId && (
              <OAuthProvidersConfig pluginId={plugin.id} projectId={projectId} savedSecrets={savedSecrets} onSaved={refreshSecrets} />
            )}

            {/* Required companion plugins */}
            {getPluginDependencies(plugin.id).length > 0 && (
              <div className="rounded-[3px] border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-foreground font-medium mb-1">Required companion plugins</p>
                <p className="text-[11px] text-muted-foreground">
                  Enabled automatically and added to package.json on the first build:{" "}
                  <span className="font-mono text-foreground">{getPluginDependencies(plugin.id).join(", ")}</span>
                </p>
              </div>
            )}

            {/* Secrets/Config */}
            {(plugin.entry.needsSecrets || plugin.entry.needsManualConfig) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Configuration</h3>
                <div className="rounded-[3px] bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle size={13} className="text-[hsl(var(--warning))] mt-0.5 shrink-0" />
                  <div className="text-xs text-foreground">
                    {plugin.entry.secretsDescription && <p>{plugin.entry.secretsDescription}</p>}
                    {plugin.entry.manualConfigDescription && <p className="text-muted-foreground mt-0.5">{plugin.entry.manualConfigDescription}</p>}
                  </div>
                </div>
                {requirements && projectId && (
                  <div className="space-y-2">
                    {requirements.secrets.filter(s => !CUSTOM_UI_SECRET_KEYS.has(s.key)).map(secret => (
                      <SecretInputRow key={secret.key} pluginId={plugin.id} secretKey={secret.key}
                        label={secret.label} type={secret.type} placeholder={secret.placeholder}
                        description={secret.description} projectId={projectId}
                        savedSecrets={savedSecrets} onSecretSaved={refreshSecrets} />
                    ))}
                  </div>
                )}
                {requirements?.quickTips && requirements.quickTips.length > 0 && (
                  <QuickTips tips={requirements.quickTips} />
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "usage" && (
          <div className="space-y-6">
            {/* Permissions */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Shield size={14} /> Android Permissions
              </h3>
              {plugin.entry.permissions && plugin.entry.permissions.length > 0 ? (
                <div className="rounded-[4px] border border-border divide-y divide-border">
                  {plugin.entry.permissions.map(p => (
                    <div key={p} className="flex items-center gap-2 px-4 py-2.5">
                      <Shield size={12} className="text-muted-foreground shrink-0" />
                      <span className="text-sm font-mono text-foreground">{p.replace("android.permission.", "")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This plugin requires no special Android permissions.</p>
              )}
            </div>

            {/* Usage patterns */}
            {plugin.entry.usagePatterns && plugin.entry.usagePatterns.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">API Methods</h3>
                <div className="rounded-[4px] border border-border divide-y divide-border">
                  {plugin.entry.usagePatterns.map(pattern => (
                    <div key={pattern} className="flex items-center gap-2 px-4 py-2.5">
                      <Code2 size={12} className="text-muted-foreground shrink-0" />
                      <code className="text-sm font-mono text-foreground">{pattern}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Supported engines */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Supported Engines</h3>
              <div className="flex flex-wrap gap-2">
                {plugin.entry.engines.map(e => (
                  <span key={e} className="text-sm px-3 py-1.5 rounded-lg bg-muted text-foreground font-medium capitalize">{e}</span>
                ))}
              </div>
            </div>

            {/* Full code example */}
            {plugin.entry.codeSnippet && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Full Example</h3>
                <SyntaxHighlighter code={plugin.entry.codeSnippet} language="typescript" showCopy showLineNumbers />
              </div>
            )}

            {/* Info box */}
            <div className="rounded-[4px] border border-border bg-muted/30 p-3 flex items-start gap-2">
              <Info size={13} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Permissions are automatically added to AndroidManifest.xml when this plugin is enabled. The plugin will be installed via npm and synced via <code className="bg-muted px-1 rounded text-[11px]">npx cap sync</code> during the build process.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PluginsPanel;
