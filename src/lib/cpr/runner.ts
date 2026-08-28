/**
 * CPR Runner — orchestrates the Canonical Project Representation pipeline.
 *
 * The `cpr/` folder holds runtime-agnostic phase modules. This runner is the
 * browser-side conductor: it sequences the phases over an in-memory file tree,
 * streams progress events to the UI, and emits the canonical workspace plus the
 * blueprint that the GitHub Actions workflow later consumes verbatim.
 */

import { quickScan } from "../../../cpr/phase-1-detect/index.ts";
import { auditDependencies, gradleResolutionSnippet, installCommandFor } from "../../../cpr/phase-2-validate/index.ts";
import { transformSource, isExcluded } from "../../../cpr/phase-3-transform/index.ts";
import { ensureTypescriptConfig, emptyTsconfigResult } from "../../../cpr/phase-3-transform/tsconfig.ts";
import { normalizeModuleSystem, emptyModuleSystemResult } from "../../../cpr/phase-3-transform/module-system.ts";
import { harmonizeProjectStructure } from "@/lib/tools/intelligentTransformer";
import { analyzeCprFilesWithAI } from "@/lib/tools/aiProjectAnalyzer";
import { buildPreflightReport } from "../../../cpr/phase-5-report/index.ts";
import { emptyVerifyResult, MAX_AUTO_BUILD_RETRIES } from "../../../cpr/phase-4-verify/index.ts";
import { PLATFORM_CAPACITOR_MAJOR, PLATFORM_NODE_VERSION, PLATFORM_RELEASE } from "../../../cpr/versions/index.ts";
import {
  CAPACITOR_DEPENDENCIES,
  CAPACITOR_DEV_DEPENDENCIES,
  NATIVE_FLAG_PATH,
  canonicalReadme,
  capacitorConfig,
  nativeFlagFile,
} from "../../../cpr/templates/index.ts";
import type {
  CprBlueprint,
  CprFile,
  CprMetadata,
  PostInstallResult,
  PreflightReport,
  QuickScanResult,
} from "../../../cpr/types/index.ts";

export type CprStepId =
  | "ingest"
  | "detect"
  | "gate"
  | "dependencies"
  | "transform"
  | "canonicalize"
  | "blueprint"
  | "report"
  | "persist";

export interface CprStepDef {
  id: CprStepId;
  label: string;
  /** Relative weight used for the determinate progress ring. */
  weight: number;
  /** Advanced assurance copy, rotated while the step is in flight. */
  assurance: string[];
}

/**
 * Deliberately elevated vocabulary — this screen is the only thing the user
 * watches while the pipeline runs, so each line has to read as considered work.
 */
export const CPR_STEPS: CprStepDef[] = [
  {
    id: "ingest",
    label: "Ingesting source archive",
    weight: 6,
    assurance: [
      "Enumerating the source tree and quarantining ephemeral artefacts…",
      "Discriminating authored code from vendored and generated output…",
      "Establishing an immutable baseline of your original workspace…",
    ],
  },
  {
    id: "detect",
    label: "Deriving project topology",
    weight: 14,
    assurance: [
      "Deploying CPR Intelligence AI model to scan files and entrypoints…",
      "Interrogating manifests to infer the authoritative toolchain…",
      "Triangulating framework, bundler and package-manager provenance…",
      "Auditing project topology for self-contained execution…",
      "Resolving the emitted output directory with corroborating evidence…",
    ],
  },
  {
    id: "gate",
    label: "Adjudicating compatibility",
    weight: 6,
    assurance: [
      "Adjudicating your project shape against the CPR capability matrix…",
      "Verifying application self-containment and dev server isolation…",
      "Screening for server-rendered surfaces incompatible with a WebView…",
    ],
  },
  {
    id: "dependencies",
    label: "Reconciling the dependency graph",
    weight: 18,
    assurance: [
      "Traversing module specifiers to reconstruct the true dependency closure…",
      "Arbitrating version incompatibilities against the platform baseline…",
      "Harmonising Capacitor packages onto a single major lineage…",
      "Demoting unreferenced packages rather than deleting them — nothing is lost…",
    ],
  },
  {
    id: "transform",
    label: "Neutralising blank-screen vectors",
    weight: 22,
    assurance: [
      "Eliminating external / Laravel server redirects and decoupling dev servers…",
      "Harmonizing entry scripts and ensuring dev server points inside the app itself…",
      "Converting history-mode routing to hash routing for file:// resolution…",
      "Rewriting absolute asset references into relative, WebView-safe paths…",
      "Auditing for localhost endpoints and undefined environment bindings…",
    ],
  },
  {
    id: "canonicalize",
    label: "Materialising canonical workspace",
    weight: 16,
    assurance: [
      "Synthesising a deterministic Capacitor configuration…",
      "Emitting the native capability flag consumed at runtime…",
      "Committing the canonical manifest that CI will install verbatim…",
    ],
  },
  {
    id: "blueprint",
    label: "Sealing the build blueprint",
    weight: 8,
    assurance: [
      "Pinning Node, Capacitor and package-manager versions for reproducibility…",
      "Encoding install and build invocations the runner will execute unmodified…",
    ],
  },
  {
    id: "report",
    label: "Compiling the pre-flight report",
    weight: 5,
    assurance: [
      "Collating remediations into a reviewable pre-flight dossier…",
      "Classifying residual risks by severity…",
    ],
  },
  {
    id: "persist",
    label: "Provisioning your project",
    weight: 5,
    assurance: [
      "Registering the canonical representation against your workspace…",
      "Publishing the blueprint to the build orchestrator…",
    ],
  },
];

export const CPR_TOTAL_WEIGHT = CPR_STEPS.reduce((s, x) => s + x.weight, 0);
export const CPR_MINIMUM_RUNTIME_MS = 8_000;

export type CprStepStatus = "pending" | "active" | "done" | "error";

export interface CprProgressState {
  steps: { id: CprStepId; label: string; status: CprStepStatus; detail?: string; elapsed?: number }[];
  activeStep: CprStepId | null;
  assurance: string;
  percent: number;
  error: string | null;
}

export interface CprRunOptions {
  appId: string;
  appName: string;
  /** Plugin npm packages the user enabled: name → semver range. */
  requiredPackages?: Record<string, string>;
  /** Plugin ids or npm names the user switched on in the platform UI. */
  enabledPlugins?: string[];
  apiBaseUrl?: string;
  providedEnv?: Record<string, string>;
  /**
   * Post-install verification result reported by the runner (cpr-post-install.json)
   * on a previous attempt. Folded into the preflight report when present.
   */
  postInstall?: PostInstallResult | null;
}


export interface CprRunResult {
  scan: QuickScanResult;
  blueprint: CprBlueprint;
  report: PreflightReport;
  metadata: CprMetadata;
  /** Patches to apply on top of the uploaded archive to reach canonical form. */
  patches: { path: string; content: string; reason: string }[];
  deletions: string[];
}

export type CprEventHandler = (state: CprProgressState) => void;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function checksum(input: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

/** Drives the pipeline and streams a fully-formed progress state on every tick. */
export async function runCpr(
  files: CprFile[],
  opts: CprRunOptions,
  onEvent?: CprEventHandler,
): Promise<CprRunResult> {
  const runStartedAt = Date.now();
  const statuses = new Map<CprStepId, CprStepStatus>(CPR_STEPS.map((s) => [s.id, "pending"]));
  const details = new Map<CprStepId, string>();
  const elapsed = new Map<CprStepId, number>();
  let assurance = CPR_STEPS[0].assurance[0];
  let error: string | null = null;

  const emit = () =>
    onEvent?.({
      steps: CPR_STEPS.map((s) => ({
        id: s.id,
        label: s.label,
        status: statuses.get(s.id)!,
        detail: details.get(s.id),
        elapsed: elapsed.get(s.id),
      })),
      activeStep: CPR_STEPS.find((s) => statuses.get(s.id) === "active")?.id ?? null,
      assurance,
      percent: Math.min(
        99,
        Math.round(
          (CPR_STEPS.filter((s) => statuses.get(s.id) === "done").reduce((a, s) => a + s.weight, 0) /
            CPR_TOTAL_WEIGHT) *
            100,
        ),
      ),
      error,
    });

  let rotation: ReturnType<typeof setInterval> | null = null;

  const begin = async (id: CprStepId) => {
    statuses.set(id, "active");
    const def = CPR_STEPS.find((s) => s.id === id)!;
    let i = 0;
    assurance = def.assurance[0];
    emit();
    if (rotation) clearInterval(rotation);
    rotation = setInterval(() => {
      i = (i + 1) % def.assurance.length;
      assurance = def.assurance[i];
      emit();
    }, 1600);
    // Deliberate minimum dwell: the phases are fast, the reassurance is the point.
    await wait(420);
  };

  const finish = (id: CprStepId, detail?: string) => {
    if (rotation) { clearInterval(rotation); rotation = null; }
    statuses.set(id, "done");
    if (detail) details.set(id, detail);
    emit();
  };

  const fail = (id: CprStepId, message: string) => {
    if (rotation) { clearInterval(rotation); rotation = null; }
    statuses.set(id, "error");
    error = message;
    emit();
  };

  try {
    /* ---------------------------------------------------------- 1. ingest */
    await begin("ingest");
    const usable = files.filter((f) => f.path && !isExcluded(f.path));
    if (usable.length === 0) throw new Error("The uploaded source contains no usable files.");
    finish("ingest", `${usable.length} files admitted to the canonical workspace`);

    /* ---------------------------------------------------------- 2. detect */
    await begin("detect");
    const scan = quickScan(usable);

    // AI-powered CPR intelligence pass
    let aiMetadata: any = null;
    try {
      aiMetadata = await analyzeCprFilesWithAI(usable);
      if (aiMetadata?.assuranceMessage) {
        scan.notes.push(`CPR AI Model: ${aiMetadata.assuranceMessage}`);
      }
      if (aiMetadata?.devServerRedirectIssues?.length) {
        for (const issue of aiMetadata.devServerRedirectIssues) {
          scan.notes.push(`AI Flag: ${issue}`);
        }
      }
    } catch {
      // Non-blocking fallback to heuristic CPR detection
    }

    finish(
      "detect",
      `${scan.frameworkLabel} · ${scan.buildToolLabel} · output \`${scan.outputDir}\` (${scan.outputConfidence} confidence)` +
        (aiMetadata ? " · AI Verified" : ""),
    );

    /* ------------------------------------------------------------ 3. gate */
    await begin("gate");
    if (scan.compatibility === "unsupported") {
      throw new Error(scan.compatibilityMessage);
    }
    if (scan.serverSideFlags.length > 0 && scan.compatibility !== "supported") {
      throw new Error(scan.compatibilityMessage);
    }
    finish(
      "gate",
      scan.compatibility === "supported"
        ? `CPR v${scan.cprVersion} accepted this project`
        : scan.compatibilityMessage,
    );

    /* ---------------------------------------------------- 4. dependencies */
    await begin("dependencies");
    const root = scan.monorepo.appRoot || "";
    const audit = auditDependencies(usable, {
      root,
      packageManager: scan.packageManager,
      requiredPackages: { ...CAPACITOR_DEPENDENCIES, ...(opts.requiredPackages ?? {}) },
      enabledPlugins: opts.enabledPlugins ?? [],
      platformMinSdk: PLATFORM_RELEASE.minSdk,
    });
    const pluginResolution = audit.pluginResolution;
    const pluginBlockers = pluginResolution
      ? pluginResolution.blocking.length + pluginResolution.permissionConflicts.length
      : 0;
    finish(
      "dependencies",
      `${audit.added.length} added · ${audit.conflicts.length} conflicts resolved · ${audit.demoted.length} demoted` +
        (pluginResolution
          ? ` · ${pluginResolution.resolved.length} plugins vetted${pluginBlockers ? `, ${pluginBlockers} unresolved` : ""}`
          : ""),
    );

    /* -------------------------------------------------------- 5. transform */
    await begin("transform");
    const transform = transformSource(usable, {
      root,
      framework: scan.framework,
      apiBaseUrl: opts.apiBaseUrl,
      providedEnv: opts.providedEnv,
    });

    // Intelligent project harmonization: normalizes Vite base URLs, fixes mobile HTML viewports,
    // removes dev-only Lovable/v0 plugins, and ensures webDir alignment
    const harmonization = harmonizeProjectStructure(usable, root, scan.framework);

    const autoFixed = transform.findings.filter((f) => f.autoFixed).length + harmonization.patches.length;
    finish(
      "transform",
      `${transform.findings.length + harmonization.logs.length} findings · ${autoFixed} auto-remediated`,
    );

    /* ----------------------------------------------------- 6. canonicalize */
    await begin("canonicalize");
    const prefix = root ? `${root}/` : "";
    const webDir = harmonization.detectedWebDir || scan.outputDir;
    const patches = [...transform.patches, ...harmonization.patches];
    const canonicalDeletions = Array.from(new Set([
      ...transform.deletions,
      ...audit.lockFilesRemoved,
    ]));

    const upsert = (path: string, content: string, reason: string) => {
      const existing = patches.find((p) => p.path === path);
      if (existing) existing.content = content;
      else patches.push({ path, content, reason });
    };

    // Canonical manifest — CI installs exactly this, never a resolved "latest".
    const canonicalPackageJson: Record<string, unknown> = {
      ...audit.packageJson,
      devDependencies: {
        ...(audit.packageJson.devDependencies as Record<string, string> ?? {}),
        ...CAPACITOR_DEV_DEPENDENCIES,
      },
    };
    upsert(
      `${prefix}package.json`,
      JSON.stringify(canonicalPackageJson, null, 2) + "\n",
      "Canonical manifest with reconciled dependency graph",
    );
    upsert(
      `${prefix}capacitor.config.ts`,
      capacitorConfig({ appId: opts.appId, appName: opts.appName, webDir }),
      "Deterministic Capacitor configuration",
    );
    upsert(
      `${prefix}${NATIVE_FLAG_PATH}`,
      nativeFlagFile(),
      "Runtime native-capability flag",
    );
    const gradleSnippet = pluginResolution ? gradleResolutionSnippet(pluginResolution) : "";
    if (gradleSnippet) {
      upsert(
        `${prefix}cpr-plugin-resolutions.gradle`,
        `// Generated by CPR — forces a single version of every clashing native library.\n// Applied from android/build.gradle by the build runner.\n${gradleSnippet}`,
        "Gradle resolution strategy for clashing plugin native dependencies",
      );
    }
    upsert(
      `${prefix}CPR.md`,
      canonicalReadme({ framework: scan.frameworkLabel, buildTool: scan.buildToolLabel }),
      "Canonical workspace README",
    );

    // TypeScript configuration validation / generation — never throws.
    let tsconfig = emptyTsconfigResult();
    try {
      tsconfig = ensureTypescriptConfig(usable, canonicalPackageJson, {
        root,
        react: ["react", "next", "preact", "remix"].includes(scan.framework),
        declaredPackages: {
          ...(canonicalPackageJson.dependencies as Record<string, string> ?? {}),
          ...(canonicalPackageJson.devDependencies as Record<string, string> ?? {}),
        },
      });
    } catch {
      tsconfig = emptyTsconfigResult();
    }
    for (const patch of tsconfig.patches) upsert(patch.path, patch.content, patch.reason);

    // Module System Normalization — runs after dependency reconciliation and
    // after the TypeScript validation, before the build command is ever run.
    let moduleSystem = emptyModuleSystemResult();
    try {
      const canonicalFiles: CprFile[] = [
        ...usable.filter((f) => !patches.some((p) => p.path === f.path)),
        ...patches.map((p) => ({ path: p.path, content: p.content })),
      ];
      moduleSystem = normalizeModuleSystem(canonicalFiles, canonicalPackageJson, { root });
    } catch {
      moduleSystem = emptyModuleSystemResult();
    }
    for (const patch of moduleSystem.patches) upsert(patch.path, patch.content, patch.reason);
    for (const deletion of moduleSystem.deletions) {
      if (!canonicalDeletions.includes(deletion)) canonicalDeletions.push(deletion);
    }
    if (moduleSystem.typeModuleRemoved) {
      // package.json was mutated in place by the step — re-emit it.
      upsert(
        `${prefix}package.json`,
        JSON.stringify(canonicalPackageJson, null, 2) + "\n",
        "Canonical manifest with reconciled dependency graph",
      );
    }

    finish("canonicalize", `${patches.length} canonical files materialised`);

    /* -------------------------------------------------------- 7. blueprint */
    await begin("blueprint");
    const installCommand = installCommandFor(scan.packageManager);
    const originalManifest = usable.find((file) => file.path === `${prefix}package.json`)?.content ?? "";
    const canonicalManifest = JSON.stringify(canonicalPackageJson, null, 2) + "\n";
    const manifestChanged = originalManifest !== canonicalManifest;
    const manifestChecksum = await checksum(canonicalManifest);
    const lockfileNames = ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"];
    const selectedLockfile = usable.find((file) => {
      if (!file.content || !lockfileNames.some((name) => file.path === `${prefix}${name}`)) return false;
      if (scan.packageManager === "npm") return /(?:package-lock\.json|npm-shrinkwrap\.json)$/.test(file.path);
      if (scan.packageManager === "pnpm") return file.path.endsWith("pnpm-lock.yaml");
      if (scan.packageManager === "yarn") return file.path.endsWith("yarn.lock");
      return /bun\.lockb?$/.test(file.path);
    });
    const lockfilePolicy = manifestChanged || !selectedLockfile ? "regenerate" : "preserved";
    const lockfilePath = selectedLockfile?.path.slice(prefix.length) ?? null;
    const lockfileChecksum = lockfilePolicy === "preserved" && selectedLockfile?.content
      ? await checksum(selectedLockfile.content)
      : null;
    const blueprint: CprBlueprint = {
      cprProjectBlueprint: {
        releaseId: PLATFORM_RELEASE.id,
        cprVersion: scan.cprVersion,
        detectedFramework: scan.framework,
        detectedToolchain: scan.buildTool,
        packageManager: scan.packageManager,
        requiredNodeVersion: scan.nodeVersionPlatform || PLATFORM_NODE_VERSION,
        capacitorMajor: PLATFORM_CAPACITOR_MAJOR,
        capacitorVersion: PLATFORM_RELEASE.capacitorVersion,
        packageManagerVersion: scan.packageManager === "npm" ? PLATFORM_RELEASE.npmVersion : "project-declared",
        manifestChecksum,
        lockfilePath,
        lockfileChecksum,
        lockfilePolicy,
        appRoot: root,
        buildCommand: scan.buildCommand,
        installCommand,
        outputDir: webDir,
        outputCandidates: scan.outputCandidates,
        outputConfidence: scan.outputConfidence,
        expectedTargetsMap: {
          android: {
            requiresScheme: "https",
            injectedPermissions: Array.from(
              new Set(["android.permission.INTERNET", ...(pluginResolution?.permissions ?? [])]),
            ),
            webDir,
          },
          ios: { requiresScheme: "capacitor", injectedPermissions: [], webDir },
        },
        androidMinSdk: pluginResolution?.minSdk ?? PLATFORM_RELEASE.minSdk,
        gradleResolutions: pluginResolution?.gradleResolutions ?? [],
        gradleDependencies: pluginResolution?.gradleDependencies ?? [],
        iosDeploymentTarget: pluginResolution?.iosDeploymentTarget ?? "13.0",
        generatedAt: new Date().toISOString(),
      },
    };
    finish(
      "blueprint",
      `Node ${blueprint.cprProjectBlueprint.requiredNodeVersion} · Capacitor ${PLATFORM_CAPACITOR_MAJOR} · \`${installCommand}\``,
    );

    /* ----------------------------------------------------------- 8. report */
    await begin("report");
    const report = buildPreflightReport({
      scan,
      audit,
      transform,
      verify: emptyVerifyResult(),
      tsconfig,
      moduleSystem,
      postInstall: opts.postInstall ?? null,
      absolutePathsFixed: transform.findings.filter((f) => f.kind === "absolute-path").length,
      fontsBundled: transform.findings.filter((f) => f.kind === "cdn").length,
    });
    finish(
      "report",
      `${report.green.length} clear · ${report.amber.length} advisory · ${report.red.length} blocking`,
    );

    const metadata: CprMetadata = {
      cprVersion: scan.cprVersion,
      status: report.blocking ? "blocked" : "ready",
      quickScan: scan,
      dependencyAudit: {
        added: audit.added,
        demoted: audit.demoted,
        removed: audit.removed,
        conflicts: audit.conflicts,
        pluginResolution: audit.pluginResolution,
        lockFilesRemoved: audit.lockFilesRemoved,
        policy: audit.policy,
        policyPatches: audit.policyPatches,
        notes: audit.notes,
      },
      transform: {
        deletions: canonicalDeletions,
        findings: transform.findings,
        envReferenced: transform.envReferenced,
        envUndefined: transform.envUndefined,
        notes: transform.notes,
      },
      verify: null,
      report,
      blueprint,
      originalPackageJson: audit.originalPackageJson,
      canonicalPackageJson,
      originalPath: null,
      canonicalPath: null,
      canonicalChecksum: await checksum(
        patches.map((p) => `${p.path}:${p.content.length}`).join("|"),
      ),
      previewScreenshotUrl: null,
      peer_deps_added: [],
      build_retries: 0,
      tsconfig_generated: tsconfig.generated,
      tsconfig_fixed: tsconfig.fixed,
      tsconfig_issues_found: tsconfig.issues,
      type_module_removed: moduleSystem.typeModuleRemoved,
      cra_artifacts_removed: moduleSystem.craArtifactsRemoved,
      extensionless_imports_fixed: moduleSystem.extensionlessImportsFixed,
      module_errors_auto_fixed: [],
      wrong_dependency_resolved: [],
      scope_reresolutions: [],
      capacitor_plugin_corrections: [],
      critical_packages_pinned: audit.policy.critical_packages_pinned,
      dependencies_placement_corrected: [],
      build_script_normalized_to_production: audit.policy.build_script_normalized_to_production.changed,
      build_script_original: audit.policy.build_script_normalized_to_production.original,
      bundle_leaked_localhost_reference: [],
      production_mode_verified: false,
      env_substitution_verified: false,
      env_substitution_failed: [],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };

    const remainingBaseline = CPR_MINIMUM_RUNTIME_MS - (Date.now() - runStartedAt);
    if (remainingBaseline > 0) await wait(remainingBaseline);
    return { scan, blueprint, report, metadata, patches, deletions: canonicalDeletions };
  } catch (e) {
    const message = e instanceof Error ? e.message : "CPR failed";
    const active = CPR_STEPS.find((s) => statuses.get(s.id) === "active")?.id ?? "ingest";
    fail(active, message);
    throw e;
  } finally {
    if (rotation) clearInterval(rotation);
  }
}

/** Marks the terminal persistence step, driven by the caller once creation lands. */
export function persistStepState(
  state: CprProgressState,
  status: CprStepStatus,
  detail?: string,
): CprProgressState {
  return {
    ...state,
    steps: state.steps.map((s) => (s.id === "persist" ? { ...s, status, detail } : s)),
    activeStep: status === "active" ? "persist" : null,
    percent: status === "done" ? 100 : 96,
    assurance:
      status === "active"
        ? "Registering the canonical representation against your workspace…"
        : "Canonical representation sealed.",
  };
}
