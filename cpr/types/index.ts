/**
 * CPR — Canonical Project Representation
 * Shared type surface. Every phase reads and writes these shapes only.
 *
 * This folder is runtime-agnostic pure TypeScript (no DOM, no Deno, no Node
 * built-ins) so the exact same code runs in the browser wizard, in a Supabase
 * edge function and inside the GitHub Actions verification runner.
 */

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export type FrameworkId =
  | "react"
  | "vue"
  | "svelte"
  | "solid"
  | "angular"
  | "next"
  | "nuxt"
  | "astro"
  | "sveltekit"
  | "remix"
  | "preact"
  | "plain-html"
  | "unknown";

export type BuildToolId =
  | "vite"
  | "cra"
  | "angular-cli"
  | "next"
  | "nuxt"
  | "astro"
  | "sveltekit"
  | "webpack"
  | "rollup"
  | "parcel"
  | "static-html"
  | "unknown";

export type CprVersion = 1 | 2 | 3 | 4;

export type CprCompatibility = "supported" | "coming-soon" | "unsupported";

export type CprStatus =
  | "pending"
  | "scanning"
  | "transforming"
  | "verifying"
  | "ready"
  | "blocked"
  | "failed";

/** A file in the CPR workspace. Binary payloads are referenced, never inlined. */
export interface CprFile {
  path: string;
  content?: string;
  isBinary?: boolean;
  size?: number;
}

export interface MonorepoInfo {
  isMonorepo: boolean;
  /** pnpm-workspaces | turborepo | nx | lerna | npm-workspaces */
  tool: string | null;
  /** Relative path from the ZIP root to the chosen app root ("" = root). */
  appRoot: string;
  /** Every package.json found, at any depth. */
  packages: {
    path: string;
    name: string | null;
    mobileScore: number;
    /** True when this package is the web app (bundler, framework or index.html). */
    isFrontend?: boolean;
    /** True when this package only runs on a server (Express/Nest/Fastify…). */
    isBackend?: boolean;
    /** Human-readable justification for the score. */
    reason?: string;
  }[];
  evidence: string[];

}

export interface ServerSideFlag {
  reason: string;
  /** Exactly what the user must change to unblock. */
  remedy: string;
  file?: string;
}

export interface QuickScanResult {
  cprVersion: CprVersion;
  compatibility: CprCompatibility;
  /** Shown when compatibility !== "supported". */
  compatibilityMessage: string;
  /** ISO month string for coming-soon versions, e.g. "2026-10". */
  estimatedAvailability: string | null;

  packageManager: PackageManager;
  packageManagerEvidence: string;
  framework: FrameworkId;
  frameworkLabel: string;
  buildTool: BuildToolId;
  buildToolLabel: string;
  buildCommand: string;
  outputDir: string;
  outputSource: string;
  /** Every plausible output directory, best first — the runner probes in order. */
  outputCandidates: string[];
  /** How certain the output resolution is. Low = runner must probe candidates. */
  outputConfidence: "high" | "medium" | "low";


  nodeVersionRequested: string | null;
  nodeVersionPlatform: string;
  nodeVersionNote: string | null;

  monorepo: MonorepoInfo;
  serverSideFlags: ServerSideFlag[];
  /** TypeScript readiness row shown before the user clicks Create Project. */
  typescript: TypeScriptScan;
  /** Hard stops — creation is disabled until resolved or acknowledged. */
  fixRequired: boolean;
  /** Wall-clock estimate for the full pipeline, in seconds. */
  estimatedSeconds: number;
  notes: string[];
  scannedAt: string;
}

/* ---------------------------------------------------------------- phase 2 */

export interface DependencyConflict {
  package: string;
  from: string;
  to: string;
  reason: string;
}

/* ------------------------------------------- peer deps / build retry / ts */

export interface PeerDependencyAddition {
  name: string;
  version: string;
  source: "peer" | "build-retry";
  reason: string;
}

export interface PeerDependencyAudit {
  /** false when the audit could not run (no node_modules, IO failure). */
  ran: boolean;
  added: PeerDependencyAddition[];
  /** Peers that are missing but whose latest version could not be resolved. */
  missingUnresolved: string[];
  installReran: boolean;
  notes: string[];
}

export interface BuildRetryResult {
  attempts: number;
  succeeded: boolean;
  added: PeerDependencyAddition[];
  attemptedPackages: string[];
  finalError: string | null;
}

export interface TsconfigResult {
  typescriptDetected: boolean;
  generated: boolean;
  fixed: boolean;
  nodeConfigGenerated: boolean;
  /** Human-readable description of every correction applied. */
  issues: string[];
  patches: { path: string; content: string; reason: string }[];
}

/** Result of the Module System Normalization step. */
export interface ModuleSystemResult {
  ran: boolean;
  typeModuleRemoved: boolean;
  /** CRA-only imports stripped from the entry point. */
  craArtifactsRemoved: string[];
  extensionlessImportsFixed: number;
  filesModified: string[];
  unresolvableImports: string[];
  /** Config files converted from CommonJS to ES Module syntax. */
  configsConverted: string[];
  patches: { path: string; content: string; reason: string }[];
  deletions: string[];
  notes: string[];
}

/** One auto-repaired module error from the build retry loop. */
export interface ModuleErrorAutoFix {
  pattern: string;
  fix: string;
  file?: string;
  specifier?: string;
}

export interface TypeScriptScan {
  detected: boolean;
  tsconfigPresent: boolean;
  status: "none" | "valid" | "missing" | "issues";
  indicator: "green" | "amber";
  message: string;
  issues: string[];
}

/* ------------------------------------------------- plugin conflict model */

export interface ResolvedPlugin {
  npm: string;
  name: string;
  version: string;
  source: "core" | "existing" | "enabled";
  status: "ok" | "upgraded" | "experimental";
  detail: string;
}

export interface PluginBlockingConflict {
  id: string;
  kind: "capacitor-version" | "plugin-pair" | "native-dependency" | "permission";
  plugins: string[];
  detail: string;
  /** The mutually exclusive options the user must pick between. */
  choices: string[];
}

export interface PluginResolution {
  resolved: ResolvedPlugin[];
  experimental: { npm: string; reason: string }[];
  removed: { npm: string; reason: string }[];
  /** npm name → version, ready to merge into the canonical manifest. */
  packages: Record<string, string>;
  dependencyUpgrades: { name: string; from: string; to: string; plugin: string; reason: string }[];
  gradleResolutions: { coordinate: string; version: string; reason: string }[];
  gradleDependencies: string[];
  permissions: string[];
  permissionConflicts: { permission: string; plugins: string[]; detail: string }[];
  minSdk: number;
  minSdkRaisedBy: string | null;
  iosDeploymentTarget: string;
  blocking: PluginBlockingConflict[];
  notes: string[];
}

export interface DependencyAudit {
  added: { name: string; version: string; dev: boolean; reason: string }[];
  /**
   * Packages that no source file imports. CPR never deletes them — they are
   * moved into devDependencies so framework runtimes and toolchain plugins
   * still resolve during the build.
   */
  demoted: { name: string; reason: string }[];
  /** Retained for reporting compatibility; always empty (CPR does not delete). */
  removed: { name: string; reason: string }[];
  conflicts: DependencyConflict[];
  /** Result of the plugin compatibility matrix, null when no plugins are in play. */
  pluginResolution: PluginResolution | null;
  lockFilesRemoved: string[];
  packageJson: Record<string, unknown>;
  /** The developer's untouched package.json — the auto-repair safe house. */
  originalPackageJson: Record<string, unknown>;
  notes: string[];
  /** Categories 1, 3, 4, 5, 6 — resolved before the install command runs. */
  policy: DependencyPolicyResult;
  /** Full-file patches the policy produced (e.g. the Buffer/global shim). */
  policyPatches: { path: string; content: string; reason: string }[];
}

/** Result of the pre-install dependency policy pass. */
export interface DependencyPolicyResult {
  package_manager_field_removed: boolean;
  package_manager_field_value: string | null;
  scripts_rewritten: { script: string; from: string; to: string }[];
  capacitor_versions_aligned: { name: string; from: string; to: string }[];
  build_tool_versions_pinned: { name: string; from: string; to: string }[];
  critical_packages_pinned: { name: string; version: string }[];
  build_script_normalized_to_production: { changed: boolean; original?: string };
  node_builtin_imports: { file: string; line: number; module: string; guidance: string }[];
  buffer_polyfill_added: boolean;
  server_only_packages: { name: string; detail: string; imported: boolean; production: boolean }[];
  notes: string[];
}

/** Categories 2, 7, 8 — reported by the runner after install. */
export interface PostInstallResult {
  duplicate_react_detected: boolean;
  duplicate_react_resolved: boolean;
  dedupe_packages_collapsed: number;
  post_install_verification: { check: string; passed: boolean; detail: string }[];
  wrong_dependency_resolved: { importName: string; file: string; package: string }[];
  scope_reresolutions: { scope: string; original: string; corrected: string }[];
  capacitor_plugin_corrections: { invalid: string; corrected: string }[];
  critical_packages_pinned: { name: string; version: string }[];
  dependencies_placement_corrected: string[];
  blocking: boolean;
  notes: string[];
}

/* ------------------------------------------------------------- blueprint */

export interface TargetBlueprint {
  requiresScheme: string;
  injectedPermissions: string[];
  webDir: string;
}

export interface CprBlueprint {
  cprProjectBlueprint: {
    releaseId: string;
    cprVersion: CprVersion;
    detectedFramework: FrameworkId;
    detectedToolchain: BuildToolId;
    packageManager: PackageManager;
    requiredNodeVersion: string;
    capacitorMajor: number;
    capacitorVersion: string;
    packageManagerVersion: string;
    manifestChecksum: string;
    lockfilePath: string | null;
    lockfileChecksum: string | null;
    lockfilePolicy: "preserved" | "regenerate";
    appRoot: string;
    buildCommand: string;
    installCommand: string;
    outputDir: string;
    outputCandidates: string[];
    outputConfidence: "high" | "medium" | "low";
    expectedTargetsMap: Record<string, TargetBlueprint>;
    /** Project-level Android floor after the plugin matrix ran. */
    androidMinSdk: number;
    /** Gradle `force` directives that keep clashing native libraries linkable. */
    gradleResolutions: { coordinate: string; version: string; reason: string }[];
    /** Native Gradle dependencies every enabled plugin needs. */
    gradleDependencies: string[];
    /** iOS deployment floor after the plugin matrix ran. */
    iosDeploymentTarget: string;
    generatedAt: string;
  };
}


export interface SourceFinding {
  kind:
    | "router-mode"
    | "localhost"
    | "absolute-path"
    | "env-undefined"
    | "service-worker"
    | "cdn"
    | "large-image"
    | "window-open"
    | "target-blank"
    | "web-only-ui";
  file: string;
  line?: number;
  detail: string;
  /** true when CPR already rewrote it, false when the user must act. */
  autoFixed: boolean;
  before?: string;
  after?: string;
}

export interface TransformResult {
  /** Full replacement contents for changed / generated files. */
  patches: { path: string; content: string; reason: string }[];
  /** Paths removed from the canonical output. */
  deletions: string[];
  findings: SourceFinding[];
  /** Env vars referenced in source. */
  envReferenced: string[];
  envUndefined: string[];
  notes: string[];
}

/* ---------------------------------------------------------------- phase 4 */

export interface VerifyRequest {
  projectId: string;
  canonicalPath: string;
  packageManager: PackageManager;
  installCommand: string;
  buildCommand: string;
  outputDir: string;
  nodeVersion: string;
  maxBuildRetries: number;
  headless: boolean;
}

export interface VerifyResult {
  buildStatus: "passed" | "failed" | "skipped";
  buildAttempts: number;
  buildLogExcerpt: string;
  outputChecks: { name: string; passed: boolean; detail: string }[];
  headlessStatus: "passed" | "failed" | "skipped";
  consoleErrors: string[];
  failedRequests: string[];
  screenshotUrl: string | null;
  finishedAt: string | null;
  buildIntegrity?: {
    bundle_leaked_localhost_reference: { file: string; context: string }[];
    production_mode_verified: boolean;
    env_substitution_verified: { verified: boolean; failed: string[] };
  };
}

/* ---------------------------------------------------------------- phase 5 */

export interface ReportItem {
  id: string;
  title: string;
  detail: string;
  /** Present on amber items: what the user must supply. */
  action?: { kind: "input" | "confirm" | "link"; label: string; field?: string };
  occurrences?: { file: string; line?: number; text?: string }[];
}

export interface PreflightReport {
  green: ReportItem[];
  amber: ReportItem[];
  red: ReportItem[];
  blocking: boolean;
  generatedAt: string;
  summary: {
    routerConversions: number;
    pathsFixed: number;
    fontsBundled: number;
    imagesCompressed: number;
    conflictsResolved: number;
    packagesAdded: number;
    packagesRemoved: number;
  };
}

/* --------------------------------------------------------------- metadata */

export interface CprMetadata {
  cprVersion: CprVersion;
  status: CprStatus;
  quickScan: QuickScanResult | null;
  dependencyAudit: Omit<DependencyAudit, "packageJson" | "originalPackageJson"> | null;
  transform: Omit<TransformResult, "patches"> | null;
  verify: VerifyResult | null;
  report: PreflightReport | null;
  blueprint: CprBlueprint | null;
  originalPackageJson: Record<string, unknown> | null;
  canonicalPackageJson: Record<string, unknown> | null;
  originalPath: string | null;
  canonicalPath: string | null;
  canonicalChecksum: string | null;
  previewScreenshotUrl: string | null;

  /* --- automated remediation results (peer deps, retries, tsconfig) ----- */
  /** Package names auto-installed by the peer audit or build retry loop. */
  peer_deps_added: string[];
  build_retries: number;
  tsconfig_generated: boolean;
  tsconfig_fixed: boolean;
  tsconfig_issues_found: string[];

  /* --- module system normalization ------------------------------------- */
  type_module_removed: boolean;
  cra_artifacts_removed: string[];
  extensionless_imports_fixed: number;
  module_errors_auto_fixed: ModuleErrorAutoFix[];
  wrong_dependency_resolved: { importName: string; file: string; package: string }[];
  scope_reresolutions: { scope: string; original: string; corrected: string }[];
  capacitor_plugin_corrections: { invalid: string; corrected: string }[];
  critical_packages_pinned: { name: string; version: string }[];
  dependencies_placement_corrected: string[];
  build_script_normalized_to_production: boolean;
  build_script_original?: string;
  bundle_leaked_localhost_reference: { file: string; context: string }[];
  production_mode_verified: boolean;
  env_substitution_verified: boolean;
  env_substitution_failed: string[];

  startedAt: string;
  finishedAt: string | null;
}

export interface CprStep {
  id: string;
  label: string;
  estimateSeconds: number;
}
