/**
 * CPR — Plugin conflict resolution.
 *
 * Runs after the user's package.json is read and after the enabled-plugin list
 * arrives from platform settings, but BEFORE any install command is written.
 * Everything that would explode on the runner — npm resolution, Gradle native
 * dependency clashes, manifest merger errors, minSdk violations — is decided
 * here on metadata alone.
 *
 * Resolution order (deliberate, see spec):
 *   1. Core platform plugins       — fixed at the platform standard.
 *   2. The user's existing plugins — upgraded to fit the platform core.
 *   3. Newly enabled plugins       — added on top; existing code wins ties.
 *   4. Full N×N compatibility matrix across everything at once.
 */

import {
  CORE_PLUGIN_NPMS,
  lookupPlugin,
  resolveRegistryKey,
  type PluginRegistryEntry,
} from "../plugins/registry.ts";
import type {
  PluginBlockingConflict,
  PluginResolution,
  ResolvedPlugin,
} from "../types/index.ts";

export interface PluginResolveOptions {
  /** Plugin ids or npm names the user switched on in the platform UI. */
  enabledPlugins: string[];
  /** The user's original dependencies (prod + dev merged). */
  existingDependencies: Record<string, string>;
  /** Platform standard Capacitor major. */
  capacitorMajor: number;
  /** Platform standard Android minSdk. */
  platformMinSdk: number;
  /** Platform standard iOS deployment target. */
  platformIosTarget?: string;
}

/* --------------------------------------------------------------- semver */

function majorOf(range: string): number | null {
  const m = String(range).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function parts(version: string): number[] {
  return (String(version).match(/\d+/g) ?? []).map(Number);
}

/** -1 | 0 | 1 */
function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function coordinateOf(gradleDep: string): { ga: string; version: string } {
  const idx = gradleDep.lastIndexOf(":");
  return { ga: gradleDep.slice(0, idx), version: gradleDep.slice(idx + 1) };
}

function permissionName(entry: string): string {
  return entry.split(/\s+/)[0];
}

function permissionAttrs(entry: string): string {
  return entry.split(/\s+/).slice(1).sort().join(" ");
}

/* ------------------------------------------------------------- resolver */

export function resolvePlugins(opts: PluginResolveOptions): PluginResolution {
  const capMajor = opts.capacitorMajor;
  const notes: string[] = [];
  const blocking: PluginBlockingConflict[] = [];
  const experimental: { npm: string; reason: string }[] = [];
  const removed: { npm: string; reason: string }[] = [];
  const dependencyUpgrades: PluginResolution["dependencyUpgrades"] = [];
  const permissionConflicts: PluginResolution["permissionConflicts"] = [];
  const gradleResolutions: PluginResolution["gradleResolutions"] = [];

  /* -- ordering: core → existing → newly enabled ------------------------- */
  const ordered: { key: string; source: ResolvedPlugin["source"] }[] = [];
  const seen = new Set<string>();
  const push = (key: string, source: ResolvedPlugin["source"]) => {
    const k = resolveRegistryKey(key);
    if (seen.has(k)) return;
    seen.add(k);
    ordered.push({ key: k, source });
  };

  for (const npm of CORE_PLUGIN_NPMS) push(npm, "core");
  for (const name of Object.keys(opts.existingDependencies)) {
    if (/^(@capacitor\/|@capacitor-community\/|@capacitor-firebase\/|@capawesome\/|@capgo\/|@codetrix-studio\/)/.test(name)) {
      if (name === "@capacitor/core" || name === "@capacitor/cli" || name === "@capacitor/android" || name === "@capacitor/ios") continue;
      push(name, "existing");
    }
  }
  for (const id of opts.enabledPlugins) push(id, "enabled");

  /* -- pass 1: per-plugin checks ---------------------------------------- */
  const resolved: ResolvedPlugin[] = [];
  const entries = new Map<string, PluginRegistryEntry>();

  for (const { key, source } of ordered) {
    const entry = lookupPlugin(key);

    if (!entry) {
      experimental.push({
        npm: key,
        reason: "No registry entry — installed without compatibility guarantees.",
      });
      resolved.push({
        npm: key,
        name: key,
        version: opts.existingDependencies[key] ?? "latest",
        source,
        status: "experimental",
        detail: "Experimental plugin: compatibility checks skipped.",
      });
      continue;
    }

    const current = opts.existingDependencies[entry.npm] ?? null;
    const compatible = capMajor >= entry.capacitorMin && capMajor <= entry.capacitorMax;
    const targetVersion = entry.versionForMajor[capMajor];

    if (!compatible && !targetVersion) {
      removed.push({
        npm: entry.npm,
        reason: `${entry.name} supports Capacitor ${entry.capacitorMin}–${entry.capacitorMax} only; the platform runs Capacitor ${capMajor}. No compatible release exists.`,
      });
      blocking.push({
        id: `cap-${entry.npm}`,
        kind: "capacitor-version",
        plugins: [entry.npm],
        detail: `${entry.name} cannot run on Capacitor ${capMajor}.`,
        choices: [`Remove ${entry.name}`, "Wait for an upstream release"],
      });
      continue;
    }

    const version = targetVersion ?? current ?? "latest";
    let status: ResolvedPlugin["status"] = "ok";
    let detail = `Resolved at ${version}.`;

    if (current && majorOf(current) !== majorOf(version)) {
      status = "upgraded";
      detail = `Upgraded ${current} → ${version} to match the platform Capacitor ${capMajor} runtime.`;
    } else if (!compatible) {
      status = "upgraded";
      detail = `Pinned to ${version}, the release compatible with Capacitor ${capMajor}.`;
    }

    entries.set(entry.npm, entry);
    resolved.push({ npm: entry.npm, name: entry.name, version, source, status, detail });

    /* -- existing user dependency conflicts ----------------------------- */
    for (const dep of entry.conflictsWithDependencies) {
      const existing = opts.existingDependencies[dep.name];
      if (!existing) continue;
      if ((majorOf(existing) ?? 0) >= (majorOf(dep.requires) ?? 0)) continue;
      dependencyUpgrades.push({
        name: dep.name,
        from: existing,
        to: dep.requires,
        plugin: entry.npm,
        reason: dep.reason,
      });
    }
  }

  /* -- pass 2: full compatibility matrix -------------------------------- */
  const active = resolved.filter((p) => p.status !== "experimental" && entries.has(p.npm));

  // Explicit pairwise plugin conflicts.
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = entries.get(active[i].npm)!;
      const b = entries.get(active[j].npm)!;
      if (!a.conflictsWithPlugins.includes(b.npm) && !b.conflictsWithPlugins.includes(a.npm)) continue;
      blocking.push({
        id: `pair-${a.npm}-${b.npm}`,
        kind: "plugin-pair",
        plugins: [a.npm, b.npm],
        detail: `${a.name} and ${b.name} both own the native sign-in flow and register the same activity result handler. Only one can be installed.`,
        choices: [`Keep ${a.name}`, `Keep ${b.name}`],
      });
    }
  }

  // Cross-plugin native Gradle dependency clashes.
  const gradleOwners = new Map<string, { version: string; plugin: string }[]>();
  for (const p of active) {
    for (const dep of entries.get(p.npm)!.gradleDependencies) {
      const { ga, version } = coordinateOf(dep);
      const list = gradleOwners.get(ga) ?? [];
      list.push({ version, plugin: p.npm });
      gradleOwners.set(ga, list);
    }
  }
  for (const [ga, owners] of gradleOwners) {
    const distinct = Array.from(new Set(owners.map((o) => o.version)));
    if (distinct.length < 2) continue;
    const sorted = distinct.slice().sort(compareVersions);
    const highest = sorted[sorted.length - 1];
    const lowest = sorted[0];
    const satisfiable = majorOf(highest) === majorOf(lowest);
    if (satisfiable) {
      gradleResolutions.push({
        coordinate: ga,
        version: highest,
        reason: `${owners.map((o) => o.plugin).join(" and ")} request ${distinct.join(" / ")}. Forced to ${highest} via a Gradle resolution strategy.`,
      });
    } else {
      blocking.push({
        id: `native-${ga}`,
        kind: "native-dependency",
        plugins: Array.from(new Set(owners.map((o) => o.plugin))),
        detail: `Both plugins require ${ga} at incompatible majors (${distinct.join(" vs ")}). Android cannot link two majors of the same native library.`,
        choices: Array.from(new Set(owners.map((o) => `Keep ${o.plugin}`))),
      });
    }
  }

  const gradleDependencies = Array.from(
    new Set(
      active.flatMap((p) =>
        entries.get(p.npm)!.gradleDependencies.map((dep) => {
          const { ga } = coordinateOf(dep);
          const forced = gradleResolutions.find((r) => r.coordinate === ga);
          return forced ? `${ga}:${forced.version}` : dep;
        }),
      ),
    ),
  );

  // Permission merge + attribute conflicts.
  const permissionMap = new Map<string, { attrs: string; plugin: string }[]>();
  for (const p of active) {
    for (const perm of entries.get(p.npm)!.permissions) {
      const name = permissionName(perm);
      const list = permissionMap.get(name) ?? [];
      list.push({ attrs: permissionAttrs(perm), plugin: p.npm });
      permissionMap.set(name, list);
    }
  }
  const permissions: string[] = [];
  for (const [name, uses] of permissionMap) {
    const distinct = Array.from(new Set(uses.map((u) => u.attrs)));
    if (distinct.length > 1) {
      permissionConflicts.push({
        permission: name,
        plugins: Array.from(new Set(uses.map((u) => u.plugin))),
        detail: `Declared with differing attributes (${distinct.map((d) => d || "no attributes").join(" vs ")}). The manifest merger will fail unless one form is chosen.`,
      });
      continue;
    }
    permissions.push(distinct[0] ? `${name} ${distinct[0]}` : name);
  }
  permissions.sort();

  // minSdk floor across every plugin.
  let minSdk = opts.platformMinSdk;
  let minSdkRaisedBy: string | null = null;
  for (const p of active) {
    const entry = entries.get(p.npm)!;
    if (entry.androidMinSdk > minSdk) {
      minSdk = entry.androidMinSdk;
      minSdkRaisedBy = entry.name;
    }
  }
  if (minSdkRaisedBy) {
    notes.push(
      `${minSdkRaisedBy} raised the Android minimum SDK to ${minSdk} for this project. Devices below Android API ${minSdk} will not be able to install the app.`,
    );
  }

  // iOS deployment floor.
  let iosDeploymentTarget = opts.platformIosTarget ?? "13.0";
  for (const p of active) {
    const t = entries.get(p.npm)!.iosDeploymentTarget;
    if (compareVersions(t, iosDeploymentTarget) > 0) iosDeploymentTarget = t;
  }

  /* -- outputs ----------------------------------------------------------- */
  const packages: Record<string, string> = {};
  for (const p of resolved) {
    if (removed.some((r) => r.npm === p.npm)) continue;
    packages[p.npm] = p.version;
  }
  for (const up of dependencyUpgrades) packages[up.name] = up.to;

  if (gradleResolutions.length) {
    notes.push(`${gradleResolutions.length} native dependency clash${gradleResolutions.length === 1 ? "" : "es"} pinned via Gradle resolution strategies.`);
  }
  if (experimental.length) {
    notes.push(`${experimental.length} experimental plugin${experimental.length === 1 ? "" : "s"} installed without compatibility guarantees.`);
  }

  return {
    resolved,
    experimental,
    removed,
    packages,
    dependencyUpgrades,
    gradleResolutions,
    gradleDependencies,
    permissions,
    permissionConflicts,
    minSdk,
    minSdkRaisedBy,
    iosDeploymentTarget,
    blocking,
    notes,
  };
}

/**
 * The Gradle snippet CPR writes into `android/build.gradle` so the forced
 * native versions survive the transitive graph.
 */
export function gradleResolutionSnippet(resolution: PluginResolution): string {
  if (!resolution.gradleResolutions.length) return "";
  const lines = resolution.gradleResolutions.map(
    (r) => `            force '${r.coordinate}:${r.version}'`,
  );
  return [
    "subprojects {",
    "    configurations.all {",
    "        resolutionStrategy {",
    ...lines,
    "        }",
    "    }",
    "}",
    "",
  ].join("\n");
}
