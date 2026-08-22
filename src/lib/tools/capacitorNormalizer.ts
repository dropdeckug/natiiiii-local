/**
 * Capacitor Normalizer
 *
 * Detects pre-existing Capacitor artifacts in an uploaded project and brings
 * them to a known-good baseline BEFORE the build pipeline generates configs.
 *
 * Three states:
 *   - clean             : no Capacitor signals → nothing to do
 *   - partial           : some signals but not a full Android project → strip
 *                         deps + configs + leftover plugin imports
 *   - fully-configured  : has android/ folder + capacitor.config + matching
 *                         deps → preserve user's config, only patch what we
 *                         must during later phases.
 *
 * Operates on the in-memory ProjectFile tree (does not touch disk / the
 * uploaded ZIP), so the build pipeline picks up the normalized tree.
 */

import type { ProjectFile } from "@/stores/projectStore";

export type CapacitorState = "clean" | "partial" | "fully-configured";

export interface NormalizeResult {
  state: CapacitorState;
  removedFiles: string[];
  removedDeps: string[];
  rewrittenFiles: string[];
  preservedVersion: string | null;
  logs: string[];
}

const CAPACITOR_CONFIG_FILES = [
  "capacitor.config.ts",
  "capacitor.config.js",
  "capacitor.config.json",
];

const flatten = (files: ProjectFile[]): ProjectFile[] => {
  const out: ProjectFile[] = [];
  const walk = (nodes: ProjectFile[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(files);
  return out;
};

const isCapacitorDep = (name: string) =>
  name === "@capacitor/core" ||
  name === "@capacitor/cli" ||
  name === "@capacitor/android" ||
  name === "@capacitor/ios" ||
  name.startsWith("@capacitor/") ||
  name.startsWith("@capacitor-community/") ||
  name.startsWith("@capawesome/capacitor-");

/**
 * Files WE generate (grounding, Phase 1 sync, appearance). The normalizer must
 * never delete or rewrite these — doing so wiped the config we just injected.
 */
const generatedFiles = new Set<string>();

export function markGeneratedFile(path: string) {
  generatedFiles.add(path);
}

export function markGeneratedFiles(paths: string[]) {
  for (const p of paths) generatedFiles.add(p);
}

export function isGeneratedFile(path: string): boolean {
  return generatedFiles.has(path);
}

export function clearGeneratedManifest() {
  generatedFiles.clear();
}

export interface NormalizerHooks {
  removeFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
}


export function detectCapacitorState(files: ProjectFile[]): CapacitorState {
  const flat = flatten(files);
  const paths = new Set(flat.filter(f => f.type === "file").map(f => f.path));

  const hasAndroidProject = [...paths].some(
    p => p === "android/build.gradle" || p === "android/app/build.gradle",
  );
  const hasCapacitorConfig = CAPACITOR_CONFIG_FILES.some(c =>
    [...paths].some(p => p === c || p.endsWith(`/${c}`)),
  );

  const pkg = flat.find(f => f.path === "package.json" || f.path.endsWith("/package.json"));
  let hasCapacitorDep = false;
  if (pkg?.content) {
    try {
      const parsed = JSON.parse(pkg.content);
      const all = { ...parsed.dependencies, ...parsed.devDependencies };
      hasCapacitorDep = Object.keys(all).some(isCapacitorDep);
    } catch { /* ignore */ }
  }

  if (hasAndroidProject && hasCapacitorConfig && hasCapacitorDep) return "fully-configured";
  if (hasCapacitorDep || hasCapacitorConfig || hasAndroidProject) return "partial";
  return "clean";
}

/**
 * Ensure Vite is configured with a relative base path so assets load when
 * Capacitor serves the bundle from `https://localhost/` inside the WebView.
 * Without `base: './'`, paths like `/assets/index-xxx.js` 404 silently and
 * the screen stays blank after the splash hides.
 */
export function ensureRelativeViteBase(
  files: ProjectFile[],
  hooks: NormalizerHooks,
): string[] {
  const logs: string[] = [];
  const flat = flatten(files);
  const viteCfg = flat.find(
    f => f.type === "file" && (f.path === "vite.config.ts" || f.path === "vite.config.js" || f.path.endsWith("/vite.config.ts") || f.path.endsWith("/vite.config.js")),
  );
  if (!viteCfg?.content) return logs;
  if (/base\s*:\s*['"`]/.test(viteCfg.content)) {
    // base already declared somewhere — leave it
    return logs;
  }
  // Insert `base: './'` into the first top-level config object literal
  // (works for `defineConfig({...})` and `defineConfig(({mode}) => ({...}))`).
  const patched = viteCfg.content.replace(
    /defineConfig\(\s*(\([^)]*\)\s*=>\s*\(?\s*)?\{/,
    (m) => `${m}\n  base: './',`,
  );
  if (patched !== viteCfg.content) {
    hooks.updateFileContent(viteCfg.path, patched);
    logs.push(`Patched ${viteCfg.path} with base: './' for Capacitor WebView`);
  }
  return logs;
}

/**
 * Strip a stale partial Capacitor install down to a clean web project.
 * Does NOT modify the user's source business logic — only removes
 * Capacitor-specific imports / registrations that would dangle.
 */
export function normalizeCapacitor(
  files: ProjectFile[],
  hooks: NormalizerHooks,
  enabledPlugins: string[] = [],
): NormalizeResult {
  const result: NormalizeResult = {
    state: detectCapacitorState(files),
    removedFiles: [],
    removedDeps: [],
    rewrittenFiles: [],
    preservedVersion: null,
    logs: [],
  };

  // Always patch Vite base — applies in every state (clean, partial, fully-configured)
  result.logs.push(...ensureRelativeViteBase(files, hooks));

  if (result.state === "clean") {
    result.logs.push("No prior Capacitor artifacts detected — clean project.");
    return result;
  }

  if (result.state === "fully-configured") {
    // Record the version so the build phase can decide whether to bump
    const pkgFile = flatten(files).find(
      f => f.path === "package.json" || f.path.endsWith("/package.json"),
    );
    try {
      const pkg = JSON.parse(pkgFile?.content || "{}");
      result.preservedVersion =
        pkg.dependencies?.["@capacitor/core"] ||
        pkg.devDependencies?.["@capacitor/core"] ||
        null;
    } catch { /* ignore */ }
    result.logs.push(
      `Detected fully-configured Capacitor (core ${result.preservedVersion || "?"}) — preserving user config.`,
    );
    return result;
  }

  // ── PARTIAL ── reconcile (do NOT nuke) so grounding/sync output survives
  result.logs.push("Detected partial Capacitor install — reconciling.");

  const flat = flatten(files);

  // Preserve the user's dependency graph. Existing Capacitor versions and
  // plugins may be private, patched, or intentionally pinned.
  const pkgEntry = flat.find(
    f => f.path === "package.json" || f.path.endsWith("/package.json"),
  );
  if (pkgEntry?.content && !isGeneratedFile(pkgEntry.path)) {
    try {
      const pkg = JSON.parse(pkgEntry.content);
      const coreVersion = pkg.dependencies?.["@capacitor/core"] || pkg.devDependencies?.["@capacitor/core"] || null;
      result.preservedVersion = coreVersion;
      result.logs.push(`Preserved existing Capacitor dependency ranges${coreVersion ? ` (core ${coreVersion})` : ""}.`);
    } catch (e) {
      result.logs.push(`⚠ Could not parse package.json: ${(e as Error).message}`);
    }
  }

  // Ownership cannot be inferred from a partial install. Preserve native
  // folders and configuration rather than destroying valid user work.
  result.logs.push("Preserved existing native folders and Capacitor configuration.");

  // Source imports are user-owned too. Resolver failures are handled as
  // explicit repairs instead of silently altering application behavior.
  if (enabledPlugins.length > 0) result.logs.push(`Enabled plugin set recorded (${enabledPlugins.length}); existing imports preserved.`);


  result.logs.push(
    `Normalized: ${result.removedFiles.length} files, ${result.removedDeps.length} deps, ${result.rewrittenFiles.length} rewrites`,
  );
  return result;
}

export function normalizeResultToLogs(r: NormalizeResult): string[] {
  const out = [`Capacitor state: ${r.state}`, ...r.logs];
  if (r.removedDeps.length > 0) out.push(`  Removed deps: ${r.removedDeps.join(", ")}`);
  return out;
}
