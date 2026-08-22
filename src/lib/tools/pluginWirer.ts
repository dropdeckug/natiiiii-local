/**
 * TOOL 4: Plugin Wirer
 * Maps selected plugins to their required permissions, gradle deps,
 * code injections, and validates against the project structure.
 */

import { PLUGIN_NPM_MAP } from "@/lib/generators/pluginMapping";
import { getPluginInjections, type PluginInjection } from "@/lib/generators/plugins";
import { resolvePluginIds } from "./pluginCodeInjector";

export interface PluginWiringResult {
  npmPackages: string[];
  permissions: string[];
  gradleDeps: string[];
  codeInjections: { file: string; type: "import" | "registration"; code: string }[];
  manifestEntries: string[];
  warnings: string[];
  unsupportedPlugins: string[];
}

export function wirePlugins(
  enabledPluginIds: string[],
  engine: string
): PluginWiringResult {
  const result: PluginWiringResult = {
    npmPackages: [],
    permissions: [],
    gradleDeps: [],
    codeInjections: [],
    manifestEntries: [],
    warnings: [],
    unsupportedPlugins: [],
  };

  if (enabledPluginIds.length === 0) return result;

  // Resolve any npm package names to internal IDs
  const { resolved: resolvedIds, unresolved } = resolvePluginIds(enabledPluginIds);
  for (const u of unresolved) {
    result.unsupportedPlugins.push(u);
    result.warnings.push(`Plugin '${u}' is not in the plugin registry`);
  }

  const permSet = new Set<string>();

  for (const pluginId of resolvedIds) {
    const npmEntry = PLUGIN_NPM_MAP[pluginId];
    if (!npmEntry) {
      result.unsupportedPlugins.push(pluginId);
      result.warnings.push(`Plugin '${pluginId}' is not in the plugin registry`);
      continue;
    }

    // Check engine compatibility
    if (!npmEntry.engines.includes(engine as any)) {
      result.warnings.push(`Plugin '${pluginId}' (${npmEntry.npm}) does not support engine '${engine}'`);
      continue;
    }

    result.npmPackages.push(npmEntry.npm);
  }

  // Get injections for prebuilt mode
  const injections = getPluginInjections(resolvedIds);
  for (const inj of injections) {
    for (const p of inj.permissions) permSet.add(p);
    for (const d of inj.gradleDeps) result.gradleDeps.push(d);
    for (const imp of inj.imports) {
      result.codeInjections.push({ file: "MainActivity.java", type: "import", code: imp });
    }
    for (const reg of inj.registrations) {
      result.codeInjections.push({ file: "MainActivity.java", type: "registration", code: reg });
    }
    for (const p of inj.permissions) {
      result.manifestEntries.push(`<uses-permission android:name="android.permission.${p}" />`);
    }
  }

  result.permissions = [...permSet];

  if (resolvedIds.includes("push")) {
    result.warnings.push("Push Notifications requires a google-services.json file for Firebase Cloud Messaging");
  }
  if (resolvedIds.includes("google-auth")) {
    result.warnings.push("Google Auth requires OAuth client ID configuration in the Google Cloud Console");
  }

  return result;
}

export function pluginWiringToLogs(result: PluginWiringResult): string[] {
  const logs: string[] = [];
  if (result.npmPackages.length > 0) {
    logs.push(`Plugins to install: ${result.npmPackages.length}`);
    for (const p of result.npmPackages) logs.push(`  • ${p}`);
  }
  if (result.permissions.length > 0) {
    logs.push(`Permissions required: ${result.permissions.join(", ")}`);
  }
  if (result.codeInjections.length > 0) {
    logs.push(`Code injections: ${result.codeInjections.length} entries`);
  }
  for (const w of result.warnings) logs.push(`⚠ ${w}`);
  for (const u of result.unsupportedPlugins) logs.push(`✗ Unknown plugin: ${u}`);
  return logs;
}
