/**
 * Plugin dependency graph.
 *
 * Many Capacitor plugins only work when a companion plugin is also installed
 * and synced. Historically builds failed with "StatusBar plugin is not
 * installed" after enabling Edge-to-Edge, or OAuth flows silently no-ops
 * because the in-app browser was never installed.
 *
 * This module is the single source of truth: every place that turns an
 * enabled plugin id list into npm packages, workflow steps or AI wiring
 * context MUST expand the list through `resolvePluginDependencies` first.
 */

/** pluginId -> plugin ids that MUST also be enabled for it to work. */
export const PLUGIN_DEPENDENCIES: Record<string, string[]> = {
  // Edge-to-edge drives the native window + status bar styling.
  "edge-to-edge": ["status-bar", "app"],

  // Every OAuth-style login opens a system/in-app browser and needs the app
  // to receive the redirect back (appUrlOpen listener).
  "capawesome-oauth": ["browser", "app"],
  oauth: ["browser", "app"],
  "capawesome-google-sign-in": ["browser", "app"],
  "google-auth": ["browser", "app"],
  "capawesome-apple-sign-in": ["browser", "app"],
  "apple-sign-in": ["browser", "app"],
  "facebook-login": ["browser", "app"],
  "capawesome-firebase-authentication": ["browser", "app"],

  // Push registration needs app lifecycle to refresh tokens on resume.
  push: ["app"],
  "push-notifications": ["app"],
};

/**
 * Expand a list of plugin ids with every transitive dependency.
 * Returns the full list plus the ids that were added implicitly so the UI /
 * action panel can tell the user what NativeBridge switched on for them.
 */
export function resolvePluginDependencies(pluginIds: Iterable<string>): {
  ids: string[];
  added: string[];
} {
  const out = new Set<string>();
  const added = new Set<string>();
  const requested = new Set(pluginIds);

  const visit = (id: string, isRoot: boolean) => {
    if (out.has(id)) return;
    out.add(id);
    if (!isRoot && !requested.has(id)) added.add(id);
    for (const dep of PLUGIN_DEPENDENCIES[id] ?? []) visit(dep, false);
  };

  for (const id of requested) visit(id, true);
  return { ids: [...out], added: [...added] };
}

/** Direct dependencies of a single plugin (for UI display). */
export function getPluginDependencies(pluginId: string): string[] {
  return PLUGIN_DEPENDENCIES[pluginId] ?? [];
}
