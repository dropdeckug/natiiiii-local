/**
 * Peer Dependency Audit — runs after a successful install.
 *
 * Modern npm does not install peer dependencies. A package such as `recharts`
 * declares `react-is` as a peer; nothing installs it; Rollup then fails with
 * "failed to resolve import react-is". This module walks the *installed* tree,
 * collects every declared peer dependency, and reports the ones that are not
 * present so CPR can add them to the canonical manifest and re-install.
 *
 * Runtime-agnostic: all filesystem and process access is injected.
 */

import type { PeerDependencyAudit, PeerDependencyAddition } from "../types/index.ts";

export interface InstalledPackage {
  name: string;
  version?: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

/** Peers that are intentionally absent — never install these. */
const IGNORED_PEERS = new Set([
  "react-native",
  "@types/react",
  "@types/react-dom",
  "webpack",
  "eslint",
]);

/**
 * Pure core: given every installed package manifest, return the peers that are
 * required but not installed and not already declared in package.json.
 */
export function missingPeerDependencies(
  installed: InstalledPackage[],
  declared: Record<string, string> = {},
): { name: string; requiredBy: string[]; range: string }[] {
  const present = new Set(installed.map((p) => p.name));
  const wanted = new Map<string, { requiredBy: string[]; range: string }>();

  for (const pkg of installed) {
    for (const [peer, range] of Object.entries(pkg.peerDependencies ?? {})) {
      if (pkg.peerDependenciesMeta?.[peer]?.optional) continue;
      if (IGNORED_PEERS.has(peer)) continue;
      if (present.has(peer)) continue;
      if (declared[peer]) continue;
      const entry = wanted.get(peer);
      if (entry) entry.requiredBy.push(pkg.name);
      else wanted.set(peer, { requiredBy: [pkg.name], range });
    }
  }

  return Array.from(wanted.entries())
    .map(([name, v]) => ({ name, requiredBy: v.requiredBy.sort(), range: v.range }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PeerAuditIO {
  /** Every directory name inside node_modules, scopes expanded (`@scope/name`). */
  listInstalled(): Promise<string[]>;
  /** Parsed package.json of an installed package, or null when unreadable. */
  readInstalledManifest(name: string): Promise<InstalledPackage | null>;
  /** Latest stable version specifier for a package, e.g. "^18.3.1". */
  resolveLatest(name: string): Promise<string | null>;
  /** Re-run the package manager install after the manifest was amended. */
  runInstall(): Promise<{ ok: boolean; output: string }>;
}

export function emptyPeerAudit(): PeerDependencyAudit {
  return { ran: false, added: [], missingUnresolved: [], installReran: false, notes: [] };
}

/**
 * Full audit. Never throws — a failed audit must not block the pipeline, so
 * any error is captured as a note and the caller continues to the build.
 */
export async function auditPeerDependencies(
  io: PeerAuditIO,
  packageJson: Record<string, unknown>,
): Promise<PeerDependencyAudit> {
  const result = emptyPeerAudit();
  try {
    const deps = { ...(packageJson.dependencies as Record<string, string> ?? {}) };
    const devDeps = { ...(packageJson.devDependencies as Record<string, string> ?? {}) };
    const declared = { ...deps, ...devDeps };

    const names = await io.listInstalled();
    const installed: InstalledPackage[] = [];
    for (const name of names) {
      try {
        const manifest = await io.readInstalledManifest(name);
        if (manifest) installed.push({ ...manifest, name: manifest.name || name });
      } catch {
        /* an unreadable package manifest is not a reason to fail the audit */
      }
    }
    result.ran = true;

    const missing = missingPeerDependencies(installed, declared);
    if (!missing.length) {
      result.notes.push("Every peer dependency across the installed tree is present.");
      return result;
    }

    const added: PeerDependencyAddition[] = [];
    for (const peer of missing) {
      let version: string | null = null;
      try {
        version = await io.resolveLatest(peer.name);
      } catch {
        version = null;
      }
      if (!version) {
        result.missingUnresolved.push(peer.name);
        continue;
      }
      deps[peer.name] = version;
      added.push({
        name: peer.name,
        version,
        source: "peer",
        reason: `Peer dependency of ${peer.requiredBy.join(", ")}.`,
      });
    }

    if (added.length) {
      (packageJson as { dependencies: Record<string, string> }).dependencies = sortKeys(deps);
      const install = await io.runInstall();
      result.installReran = true;
      if (!install.ok) {
        result.notes.push(`Re-install after adding peer dependencies reported errors: ${install.output.slice(-400)}`);
      }
    }
    result.added = added;
    return result;
  } catch (err) {
    result.notes.push(
      `Peer dependency audit could not complete: ${err instanceof Error ? err.message : String(err)}. CPR continued to the build.`,
    );
    return result;
  }
}

function sortKeys(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}
