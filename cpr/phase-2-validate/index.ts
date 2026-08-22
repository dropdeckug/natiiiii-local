import type { CprFile, DependencyAudit, DependencyConflict, PackageManager, PluginResolution } from "../types/index.ts";
import { PLATFORM_CAPACITOR_MAJOR, PLATFORM_NODE_VERSION, PLATFORM_RELEASE } from "../versions/index.ts";
import { readJson, sourceFiles } from "../phase-1-detect/index.ts";
import { CAPACITOR_DEPENDENCIES, CAPACITOR_DEV_DEPENDENCIES } from "../templates/index.ts";
import { parseConfigReferencedPackages, parseModuleSpecifiers } from "../parse/index.ts";
import { resolvePlugins } from "./plugin-conflicts.ts";
import {
  alignCapacitorVersions,
  applyBufferPolyfill,
  emptyDependencyPolicy,
  normalizePackageManagerFields,
  pinBuildTools,
  scanNodeBuiltins,
  scanServerOnlyPackages,
} from "./dependency-policy.ts";

export { resolvePlugins, gradleResolutionSnippet } from "./plugin-conflicts.ts";
export * from "./dependency-policy.ts";
export {
  auditPeerDependencies,
  emptyPeerAudit,
  missingPeerDependencies,
  type PeerAuditIO,
  type InstalledPackage,
} from "./peer-deps.ts";


/**
 * Phase 2 — deep validation and conflict resolution.
 *
 * Runs entirely on metadata: no install, no network. Everything that would
 * blow up during `npm install` is decided here, before a single byte is
 * downloaded.
 */

/** Packages known to break on the platform's Node/toolchain, with safe pins. */
const KNOWN_INCOMPATIBILITIES: {
  name: string;
  test: (version: string) => boolean;
  to: string;
  reason: string;
}[] = [
  {
    name: "vite",
    test: (v) => /^\D*[0-2]\./.test(v),
    to: "^5.4.0",
    reason: "Vite < 3 cannot build with the platform Node runtime.",
  },
  {
    name: "typescript",
    test: (v) => /^\D*[0-3]\./.test(v),
    to: "^5.5.0",
    reason: "TypeScript < 4 is incompatible with modern Vite plugins.",
  },
  {
    name: "node-sass",
    test: () => true,
    to: "sass@^1.77.0",
    reason: "node-sass requires native compilation that is unavailable on the runner.",
  },
];

const IGNORED_IMPORT_PREFIXES = ["@/", "~/", ".", "/", "node:", "virtual:", "data:", "http"];

const NODE_BUILTINS = new Set([
  "fs", "path", "os", "crypto", "http", "https", "stream", "util", "events", "url", "buffer", "child_process",
]);

export function extractImports(content: string, filename = "file.ts"): string[] {
  return parseModuleSpecifiers(content, filename);
}


export function packageNameOf(spec: string): string | null {
  if (IGNORED_IMPORT_PREFIXES.some((p) => spec.startsWith(p))) return null;
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  if (!name || NODE_BUILTINS.has(name)) return null;
  return name;
}

export const LOCK_FILES: Record<PackageManager, string> = {
  npm: "package-lock.json",
  yarn: "yarn.lock",
  pnpm: "pnpm-lock.yaml",
  bun: "bun.lockb",
};

export function installCommandFor(pm: PackageManager): string {
  switch (pm) {
    case "yarn":
      return "yarn install";
    case "pnpm":
      return "pnpm install";
    case "bun":
      return "bun install";
    default:
      return "npm install";
  }
}

export function runCommandFor(pm: PackageManager, script: string): string {
  switch (pm) {
    case "yarn":
      return `yarn ${script}`;
    case "pnpm":
      return `pnpm run ${script}`;
    case "bun":
      return `bun run ${script}`;
    default:
      return `npm run ${script}`;
  }
}

/** Config files whose bare string values name real build-time packages. */
const CONFIG_FILE =
  /(package\.json|angular\.json|nx\.json|tailwind\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s|vite\.config\.[^/]*\.?[cm]?[jt]s|webpack\.config\.[cm]?[jt]s|rollup\.config\.[cm]?[jt]s|svelte\.config\.[cm]?[jt]s|nuxt\.config\.[cm]?[jt]s|astro\.config\.[cm]?[jt]s|next\.config\.[cm]?[jt]s|\.babelrc|babel\.config\.[cm]?[jt]s|\.eslintrc[^/]*|capacitor\.config\.[cm]?[jt]s)$/;

/**
 * Packages a framework toolchain resolves internally — never demote these even
 * when no source file imports them by name.
 */
const RUNTIME_PROTECTED =
  /^(@capacitor|@capawesome|@angular|@nrwl|@nx|@sveltejs|@vitejs|@vue|@babel|@types|@testing-library|@tanstack|@ionic|vite|typescript|eslint|sass|less|stylus|postcss|tailwindcss|autoprefixer|react|react-dom|react-scripts|vue|svelte|solid-js|preact|next|nuxt|astro|core-js|regenerator-runtime|zone\.js|rxjs|tslib|@emotion|@mui|@chakra-ui|@radix-ui|@shadcn|bootstrap|normalize\.css|@fontsource)/;

const VALID_PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/[a-z0-9][a-z0-9._~-]*|[a-z0-9][a-z0-9._~-]*)$/;

function sanitizeDependencyBucket(bucket: Record<string, unknown>, notes: string[], bucketName: string): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [name, version] of Object.entries(bucket)) {
    if (!VALID_PACKAGE_NAME.test(name) || typeof version !== "string" || !version.trim() || /[\u0000-\u001f]/.test(version)) {
      notes.push(`Removed invalid ${bucketName} entry \"${name}\" before install.`);
      continue;
    }
    clean[name] = version.trim();
  }
  return clean;
}


export interface AuditOptions {
  root?: string;
  packageManager: PackageManager;
  /** Plugins the user enabled — their npm packages must be present. */
  requiredPackages?: Record<string, string>;
  /** Plugin ids or npm names switched on in the platform UI. */
  enabledPlugins?: string[];
  /** Platform Android minSdk floor; the matrix may raise it per project. */
  platformMinSdk?: number;
}

export function auditDependencies(files: CprFile[], opts: AuditOptions): DependencyAudit {
  const root = opts.root ?? "";
  const pkgPath = root ? `${root}/package.json` : "package.json";
  const pkg = readJson(files, pkgPath) ?? { name: "app", version: "0.0.0", private: true };

  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = {};
  const conflicts: DependencyConflict[] = [];
  const added: DependencyAudit["added"] = [];
  const demoted: DependencyAudit["demoted"] = [];
  const notes: string[] = [];
  const policy = emptyDependencyPolicy();
  const policyPatches: DependencyAudit["policyPatches"] = [];

  Object.assign(deps, sanitizeDependencyBucket(pkg.dependencies ?? {}, notes, "dependency"));
  Object.assign(devDeps, sanitizeDependencyBucket(pkg.devDependencies ?? {}, notes, "devDependency"));

  /* --- category 1 — packageManager field + script rewrites ------------- */
  const scripts: Record<string, string> = { ...(pkg.scripts ?? {}) };
  const { packageManagerField } = normalizePackageManagerFields(
    pkg,
    scripts,
    opts.packageManager,
    policy,
  );

  /* --- plugin compatibility matrix (before anything installs) ---------- */
  // Enabled plugins are resolved against the platform Capacitor major, the
  // user's own dependencies and each other, all at once. Nothing below may
  // introduce a plugin package the matrix has not already vetted.
  let pluginResolution: PluginResolution | null = null;
  const enabledPlugins = opts.enabledPlugins ?? [];
  if (enabledPlugins.length || Object.keys(deps).some((n) => n.startsWith("@capacitor/"))) {
    pluginResolution = resolvePlugins({
      enabledPlugins,
      existingDependencies: { ...deps, ...devDeps },
      capacitorMajor: PLATFORM_CAPACITOR_MAJOR,
      platformMinSdk: opts.platformMinSdk ?? PLATFORM_RELEASE.minSdk,
    });
    for (const [name, version] of Object.entries(pluginResolution.packages)) {
      const current = deps[name] ?? devDeps[name];
      if (current === version) continue;
      if (current) {
        (deps[name] ? deps : devDeps)[name] = version;
        conflicts.push({
          package: name,
          from: current,
          to: version,
          reason:
            pluginResolution.dependencyUpgrades.find((u) => u.name === name)?.reason ??
            "Aligned by the plugin compatibility matrix.",
        });
      } else {
        deps[name] = version;
        added.push({ name, version, dev: false, reason: "Required by an enabled plugin." });
      }
    }
    for (const gone of pluginResolution.removed) {
      delete deps[gone.npm];
      delete devDeps[gone.npm];
    }
    notes.push(...pluginResolution.notes);
  }


  /* --- version incompatibilities ------------------------------------- */
  for (const rule of KNOWN_INCOMPATIBILITIES) {
    for (const bucket of [deps, devDeps]) {
      const current = bucket[rule.name];
      if (!current || !rule.test(current)) continue;
      if (rule.to.includes("@")) {
        const [replName, replVer] = rule.to.split("@");
        delete bucket[rule.name];
        bucket[replName] = replVer;
        conflicts.push({ package: rule.name, from: current, to: rule.to, reason: rule.reason });
      } else {
        bucket[rule.name] = rule.to;
        conflicts.push({ package: rule.name, from: current, to: rule.to, reason: rule.reason });
      }
    }
  }

  /* --- Capacitor major alignment -------------------------------------- */
  // Category 5 — exact known-good versions from the compatibility table.
  alignCapacitorVersions(deps, devDeps, policy);
  // Category 6 — build tools pinned to the platform standard.
  pinBuildTools(deps, devDeps, policy);
  for (const name of ["react", "react-dom", "@capacitor/core", "@capacitor/cli", "@capacitor/android", "@capacitor/ios"]) {
    const bucket = deps[name] ? deps : devDeps[name] ? devDeps : null;
    if (!bucket || /^(workspace:|file:|link:)/.test(bucket[name])) continue;
    const current = bucket[name];
    const version = name.startsWith("@capacitor/") ? `${PLATFORM_CAPACITOR_MAJOR}.4.3` : "18.3.1";
    if (current !== version) {
      bucket[name] = version;
      policy.critical_packages_pinned.push({ name, version });
    }
  }
  for (const bucket of [deps, devDeps]) {
    for (const name of Object.keys(bucket)) {
      if (!name.startsWith("@capacitor/") && !name.startsWith("@capawesome/")) continue;
      const current = bucket[name];
      const major = current.match(/(\d+)/)?.[1];
      if (major && Number(major) !== PLATFORM_CAPACITOR_MAJOR) {
        const next = ["@capacitor/core", "@capacitor/cli", "@capacitor/android", "@capacitor/ios"].includes(name)
          ? PLATFORM_RELEASE.capacitorVersion
          : `^${PLATFORM_CAPACITOR_MAJOR}.0.0`;
        bucket[name] = next;
        conflicts.push({
          package: name,
          from: current,
          to: next,
          reason: `Aligned with the platform Capacitor ${PLATFORM_CAPACITOR_MAJOR}.x runtime.`,
        });
      }
    }
  }

  /* --- required platform packages ------------------------------------- */
  const required = { ...CAPACITOR_DEPENDENCIES, ...(opts.requiredPackages ?? {}) };
  for (const [name, version] of Object.entries(required)) {
    if (deps[name] || devDeps[name]) continue;
    deps[name] = version;
    added.push({ name, version, dev: false, reason: "Required by the NativeForge native runtime." });
  }
  for (const [name, version] of Object.entries(CAPACITOR_DEV_DEPENDENCIES)) {
    if (deps[name] || devDeps[name]) continue;
    devDeps[name] = version;
    added.push({ name, version, dev: true, reason: "Required by the NativeForge native runtime." });
  }

  /* --- module graph (AST when available, resilient scan otherwise) ----- */
  const srcs = sourceFiles(files, root);
  const imported = new Set<string>();
  for (const f of srcs) {
    for (const spec of extractImports(f.content ?? "", f.path)) {
      const name = packageNameOf(spec);
      if (name) imported.add(name);
    }
  }

  // Config files reference packages as bare strings (PostCSS/Tailwind plugin
  // arrays, Angular builders, Vite plugin names). Those are real build inputs.
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  const configReferenced = new Set<string>();
  for (const f of files) {
    if (!f.content || f.path.includes("node_modules/")) continue;
    if (!f.path.startsWith(prefix)) continue;
    if (!CONFIG_FILE.test(f.path)) continue;
    for (const name of parseConfigReferencedPackages(f.content)) configReferenced.add(name);
  }

  for (const name of imported) {
    if (deps[name] || devDeps[name]) continue;
    if (name.startsWith("@types/")) continue;
    deps[name] = "latest";
    added.push({
      name,
      version: "latest",
      dev: false,
      reason: "Imported in source but missing from package.json.",
    });
  }

  /* --- categories 3 & 4 — frontend-hostile code and packages ----------- */
  scanNodeBuiltins(srcs, policy);
  scanServerOnlyPackages(deps, devDeps, imported, policy);
  if (policy.buffer_polyfill_added) {
    const { patch, added: bufferAdded } = applyBufferPolyfill(deps, files, root);
    if (patch) policyPatches.push(patch);
    if (bufferAdded) {
      added.push({
        name: "buffer",
        version: deps.buffer,
        dev: false,
        reason: "Browser polyfill for the Node.js `buffer` built-in used in frontend source.",
      });
    }
  }

  /* --- safe-move instead of deletion ----------------------------------- */
  // Deleting an untracked package breaks framework runtimes that resolve
  // modules internally. CPR demotes them to devDependencies: still installed,
  // still resolvable, but out of the production dependency surface.
  for (const name of Object.keys(deps)) {
    if (imported.has(name) || configReferenced.has(name)) continue;
    if (RUNTIME_PROTECTED.test(name)) continue;
    // Plugin packages the matrix resolved are runtime-resolved by Capacitor.
    if (pluginResolution && pluginResolution.packages[name]) continue;
    if (Object.keys(required).includes(name)) continue;
    devDeps[name] = deps[name];
    delete deps[name];
    demoted.push({
      name,
      reason: "No direct import found — moved to devDependencies so the toolchain can still resolve it.",
    });
  }

  /* --- lock file normalization ---------------------------------------- */
  const keep = LOCK_FILES[opts.packageManager];
  const lockFilesRemoved = files
    .filter((f) => Object.values(LOCK_FILES).some((l) => f.path.endsWith(l)) && !f.path.endsWith(keep))
    .map((f) => f.path);

  /* --- canonical package.json ----------------------------------------- */
  if (!scripts.build) {
    scripts.build = "vite build";
    notes.push("No build script found — added `vite build`.");
  }

  const canonical: Record<string, unknown> = {
    ...pkg,
    private: true,
    type: pkg.type ?? "module",
    scripts,
    dependencies: sortKeys(deps),
    devDependencies: sortKeys(devDeps),
    engines: { node: `>=${PLATFORM_NODE_VERSION}` },
  };
  if (packageManagerField) {
    canonical.packageManager = packageManagerField;
  } else if (opts.packageManager === "npm") {
    canonical.packageManager = `npm@${PLATFORM_RELEASE.npmVersion}`;
  } else {
    delete (canonical as Record<string, unknown>).packageManager;
  }
  notes.push(...policy.notes);

  if (demoted.length) {
    notes.push(
      `${demoted.length} untracked package${demoted.length === 1 ? " was" : "s were"} moved to devDependencies instead of being removed.`,
    );
  }

  return {
    added,
    demoted,
    removed: [],
    conflicts,
    pluginResolution,
    lockFilesRemoved,
    packageJson: canonical,
    originalPackageJson: JSON.parse(JSON.stringify(pkg)),
    notes,
    policy,
    policyPatches,
  };
}


function sortKeys(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}
