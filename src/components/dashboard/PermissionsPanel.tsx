import { useMemo } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { PLUGIN_NPM_MAP } from "@/lib/generators/pluginMapping";
import { Shield, Info } from "lucide-react";

const DEFAULT_PERMISSIONS = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
];

const CORE_PLUGINS = ["app", "splash-screen", "status-bar"];

const PermissionsPanel = () => {
  const { enabledPlugins } = useProjectStore();

  const aggregated = useMemo(() => {
    const permMap = new Map<string, string[]>();

    for (const perm of DEFAULT_PERMISSIONS) {
      permMap.set(perm, ["system"]);
    }

    const allEnabled = new Set([...CORE_PLUGINS, ...enabledPlugins]);
    const seen = new Set<string>();

    for (const pluginId of allEnabled) {
      const entry = PLUGIN_NPM_MAP[pluginId];
      if (!entry || seen.has(entry.npm)) continue;
      seen.add(entry.npm);

      if (entry.permissions) {
        for (const perm of entry.permissions) {
          const sources = permMap.get(perm) || [];
          if (!sources.includes(pluginId)) sources.push(pluginId);
          permMap.set(perm, sources);
        }
      }
    }

    return Array.from(permMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([permission, sources]) => ({
        permission,
        sources,
        shortName: permission.replace("android.permission.", ""),
      }));
  }, [enabledPlugins]);

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">App Permissions</h2>
        <p className="text-sm text-muted-foreground">{aggregated.length} permissions required by enabled plugins.</p>
      </div>

      <div className="rounded-[4px] border border-border divide-y divide-border">
        {aggregated.map(({ permission, sources, shortName }) => (
          <div key={permission} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Shield size={13} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground font-mono truncate">{shortName}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
              {sources.map((s) => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[4px] border border-border bg-muted/30 p-3 flex items-start gap-2">
        <Info size={13} className="text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Permissions are automatically added to AndroidManifest.xml based on enabled plugins. Toggle plugins in the Plugins section to add/remove permissions.
        </p>
      </div>
    </div>
  );
};

export default PermissionsPanel;
