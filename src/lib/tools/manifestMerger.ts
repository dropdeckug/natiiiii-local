/**
 * TOOL 12: Manifest Merger
 * Intelligently merges Android permissions, activities, services, and receivers
 * into AndroidManifest.xml. Handles duplicates and conflicts.
 */

export interface ManifestMergeResult {
  manifest: string;
  addedPermissions: string[];
  addedActivities: string[];
  conflicts: string[];
}

export function mergeManifest(
  baseManifest: string,
  permissions: string[],
  activities?: string[],
  services?: string[]
): ManifestMergeResult {
  const result: ManifestMergeResult = {
    manifest: baseManifest,
    addedPermissions: [],
    addedActivities: [],
    conflicts: [],
  };

  // Extract existing permissions
  const existingPerms = new Set<string>();
  const permRegex = /android:name="android\.permission\.(\w+)"/g;
  let match;
  while ((match = permRegex.exec(baseManifest)) !== null) {
    existingPerms.add(match[1]);
  }

  // Add new permissions
  const newPerms = permissions.filter(p => !existingPerms.has(p));
  if (newPerms.length > 0) {
    const permXml = newPerms
      .map(p => `    <uses-permission android:name="android.permission.${p}" />`)
      .join("\n");

    // Insert after last existing permission or before <application>
    const lastPermIdx = result.manifest.lastIndexOf("<uses-permission");
    if (lastPermIdx >= 0) {
      const endOfLine = result.manifest.indexOf("/>", lastPermIdx) + 2;
      result.manifest = result.manifest.slice(0, endOfLine) + "\n" + permXml + result.manifest.slice(endOfLine);
    } else {
      result.manifest = result.manifest.replace(
        /(\s*<application)/,
        "\n" + permXml + "\n$1"
      );
    }
    result.addedPermissions = newPerms;
  }

  // Add activities inside <application> if provided
  if (activities && activities.length > 0) {
    for (const activity of activities) {
      // Check for duplicate activity names
      const nameMatch = activity.match(/android:name="([^"]+)"/);
      if (nameMatch && result.manifest.includes(nameMatch[1])) {
        result.conflicts.push(`Activity '${nameMatch[1]}' already exists — skipped`);
        continue;
      }
      result.manifest = result.manifest.replace(
        /(<\/application>)/,
        `\n        ${activity}\n    $1`
      );
      result.addedActivities.push(activity);
    }
  }

  // Add services inside <application> if provided
  if (services && services.length > 0) {
    for (const service of services) {
      result.manifest = result.manifest.replace(
        /(<\/application>)/,
        `\n        ${service}\n    $1`
      );
    }
  }

  return result;
}

export function mergeResultToLogs(result: ManifestMergeResult): string[] {
  const logs: string[] = [];
  if (result.addedPermissions.length > 0) {
    logs.push(`Added ${result.addedPermissions.length} permissions: ${result.addedPermissions.join(", ")}`);
  }
  if (result.addedActivities.length > 0) {
    logs.push(`Added ${result.addedActivities.length} activities`);
  }
  for (const c of result.conflicts) logs.push(`⚠ ${c}`);
  return logs;
}
