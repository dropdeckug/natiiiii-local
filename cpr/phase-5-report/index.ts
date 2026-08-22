import type {
  BuildRetryResult,
  DependencyAudit,
  ModuleSystemResult,
  PeerDependencyAudit,
  PostInstallResult,
  PreflightReport,
  QuickScanResult,
  ReportItem,
  SourceFinding,
  TransformResult,
  TsconfigResult,
  VerifyResult,
} from "../types/index.ts";

/**
 * Phase 5 — pre-flight report.
 *
 * Green  = handled automatically, no action.
 * Amber  = needs user input before build targets can be created.
 * Red    = prevents CPR from completing.
 */

function group(findings: SourceFinding[], kind: SourceFinding["kind"]): SourceFinding[] {
  return findings.filter((f) => f.kind === kind);
}

function occurrences(items: SourceFinding[]) {
  return items.map((f) => ({ file: f.file, line: f.line, text: f.detail }));
}

export function buildPreflightReport(input: {
  scan: QuickScanResult;
  audit: DependencyAudit | null;
  transform: TransformResult | null;
  verify: VerifyResult | null;
  peerAudit?: PeerDependencyAudit | null;
  buildRetry?: BuildRetryResult | null;
  tsconfig?: TsconfigResult | null;
  moduleSystem?: ModuleSystemResult | null;
  postInstall?: PostInstallResult | null;
  absolutePathsFixed?: number;
  fontsBundled?: number;
}): PreflightReport {
  const green: ReportItem[] = [];
  const amber: ReportItem[] = [];
  const red: ReportItem[] = [];

  const findings = input.transform?.findings ?? [];
  const routerConversions = group(findings, "router-mode").length;
  const imagesCompressed = group(findings, "large-image").length;
  const pathsFixed = input.absolutePathsFixed ?? 0;
  const fontsBundled = input.fontsBundled ?? 0;
  const conflicts = input.audit?.conflicts ?? [];
  const added = input.audit?.added ?? [];
  const removed = input.audit?.removed ?? [];

  /* ------------------------------------------------------------- green */
  green.push({
    id: "detection",
    title: `${input.scan.frameworkLabel} on ${input.scan.buildToolLabel}`,
    detail: `Package manager ${input.scan.packageManager} (${input.scan.packageManagerEvidence}). Build \`${input.scan.buildCommand}\` → \`${input.scan.outputDir}\` (${input.scan.outputSource}).`,
  });

  if (routerConversions) {
    green.push({
      id: "router",
      title: `${routerConversions} router conversion${routerConversions === 1 ? "" : "s"}`,
      detail: "History-mode routing was converted to hash mode so deep links resolve inside a WebView.",
      occurrences: occurrences(group(findings, "router-mode")),
    });
  }
  if (pathsFixed) {
    green.push({
      id: "paths",
      title: `${pathsFixed} absolute path${pathsFixed === 1 ? "" : "s"} made relative`,
      detail: "Root-absolute asset references would 404 under the file:// origin used by native WebViews.",
    });
  }
  if (fontsBundled) {
    green.push({ id: "fonts", title: `${fontsBundled} fonts bundled locally`, detail: "Remote fonts were downloaded so the app renders offline." });
  }
  if (imagesCompressed) {
    green.push({
      id: "images",
      title: `${imagesCompressed} image${imagesCompressed === 1 ? "" : "s"} compressed`,
      detail: "Images over 500 KB were recompressed to keep the bundle small.",
      occurrences: occurrences(group(findings, "large-image")),
    });
  }
  if (conflicts.length) {
    green.push({
      id: "conflicts",
      title: `${conflicts.length} version conflict${conflicts.length === 1 ? "" : "s"} resolved`,
      detail: conflicts.map((c) => `${c.package} ${c.from} → ${c.to} (${c.reason})`).join(" · "),
    });
  }
  if (added.length) {
    green.push({
      id: "packages-added",
      title: `${added.length} package${added.length === 1 ? "" : "s"} added`,
      detail: added.map((a) => `${a.name}@${a.version}`).join(", "),
    });
  }
  if (removed.length) {
    green.push({
      id: "packages-removed",
      title: `${removed.length} ghost dependenc${removed.length === 1 ? "y" : "ies"} removed`,
      detail: removed.map((r) => r.name).join(", "),
    });
  }

  /* --------------------------- dependency policy (categories 1 – 8) --- */
  const policy = input.audit?.policy;
  if (policy?.package_manager_field_removed) {
    green.push({
      id: "package-manager-field",
      title: "packageManager field removed",
      detail: `\`${policy.package_manager_field_value}\` would make Corepack enforce a package manager the build runner does not ship. The canonical manifest installs with npm instead.`,
    });
  }
  if (policy?.scripts_rewritten.length) {
    green.push({
      id: "scripts-rewritten",
      title: `${policy.scripts_rewritten.length} script${policy.scripts_rewritten.length === 1 ? "" : "s"} rewritten to npm`,
      detail: policy.scripts_rewritten.map((s) => `${s.script}: \`${s.from}\` → \`${s.to}\``).join(" · "),
    });
  }
  if (policy?.capacitor_versions_aligned.length) {
    green.push({
      id: "capacitor-aligned",
      title: `${policy.capacitor_versions_aligned.length} Capacitor package${policy.capacitor_versions_aligned.length === 1 ? "" : "s"} aligned`,
      detail: policy.capacitor_versions_aligned.map((c) => `${c.name} ${c.from} → ${c.to}`).join(", "),
    });
  }
  if (policy?.build_tool_versions_pinned.length) {
    green.push({
      id: "build-tools-pinned",
      title: `${policy.build_tool_versions_pinned.length} build tool${policy.build_tool_versions_pinned.length === 1 ? "" : "s"} pinned`,
      detail: `${policy.build_tool_versions_pinned.map((c) => `${c.name} ${c.from} → ${c.to}`).join(", ")}. Build tooling only — app behaviour is unchanged.`,
    });
  }
  if (policy?.critical_packages_pinned.length) {
    green.push({
      id: "critical-packages-pinned",
      title: `${policy.critical_packages_pinned.length} critical package${policy.critical_packages_pinned.length === 1 ? "" : "s"} pinned exactly`,
      detail: policy.critical_packages_pinned.map((p) => `${p.name}@${p.version}`).join(", "),
    });
  }
  if (policy?.build_script_normalized_to_production.changed) {
    green.push({
      id: "production-build-script",
      title: "Build script normalized to production",
      detail: `${policy.build_script_normalized_to_production.original ?? "No build script"} → vite build`,
    });
  }
  if (policy?.buffer_polyfill_added) {
    green.push({
      id: "buffer-polyfill",
      title: "Buffer polyfill wired up",
      detail: "The `buffer` package was added and Vite now defines a browser global so Buffer resolves inside the WebView.",
    });
  }
  if (input.postInstall?.dedupe_packages_collapsed) {
    green.push({
      id: "dedupe",
      title: `${input.postInstall.dedupe_packages_collapsed} duplicate package copies collapsed`,
      detail: "`npm dedupe` ran after install so only one copy of each package ships in the bundle.",
    });
  }
  for (const check of input.postInstall?.post_install_verification ?? []) {
    if (!check.passed) continue;
    green.push({ id: `post-install-${check.check}`, title: `Verified: ${check.check}`, detail: check.detail });
  }
  const corrections = input.postInstall;
  if (corrections?.critical_packages_pinned.length) {
    green.push({ id: "post-install-critical-pins", title: "Critical dependency versions verified", detail: corrections.critical_packages_pinned.map((p) => `${p.name}@${p.version}`).join(", ") });
  }
  if (corrections?.capacitor_plugin_corrections.length) {
    green.push({ id: "capacitor-plugin-corrections", title: "Capacitor plugin resolutions corrected", detail: corrections.capacitor_plugin_corrections.map((p) => `${p.invalid} → ${p.corrected}`).join(", ") });
  }
  for (const issue of corrections?.wrong_dependency_resolved ?? []) {
    amber.push({ id: `wrong-dependency-${issue.file}-${issue.importName}`, title: `No package export for ${issue.importName}`, detail: `${issue.package} was resolved for ${issue.file}, but it does not export the imported name. Confirm the correct package.`, action: { kind: "input", label: "Correct package", field: issue.package } });
  }
  const integrity = input.verify?.buildIntegrity;
  if (integrity) {
    if (integrity.bundle_leaked_localhost_reference.length) {
      red.push({
        id: "bundle-leaked-localhost",
        title: "Production bundle contains a private network reference",
        detail: integrity.bundle_leaked_localhost_reference.map((x) => `${x.file}: ${x.context}`).join("\n"),
      });
    }
    if (!integrity.production_mode_verified) {
      red.push({ id: "production-mode-failed", title: "Production mode was not verified", detail: "The compiled bundle still contains unresolved Vite development mode expressions." });
    }
    if (!integrity.env_substitution_verified.verified) {
      red.push({ id: "env-substitution-failed", title: "Production environment variable substitution failed", detail: integrity.env_substitution_verified.failed.join(", ") });
    } else if (integrity.production_mode_verified) {
      green.push({ id: "production-integrity", title: "Production build integrity verified", detail: "The compiled bundle contains no development mode expressions or leaked local network values." });
    }
  }

  if (policy?.node_builtin_imports.length) {
    const byModule = new Map<string, typeof policy.node_builtin_imports>();
    for (const hit of policy.node_builtin_imports) {
      byModule.set(hit.module, [...(byModule.get(hit.module) ?? []), hit]);
    }
    for (const [mod, hits] of byModule) {
      amber.push({
        id: `node-builtin-${mod}`,
        title: `\`${mod}\` (Node.js built-in) imported in frontend code`,
        detail: hits[0].guidance,
        action: { kind: "confirm", label: "I have reviewed these" },
        occurrences: hits.map((h) => ({ file: h.file, line: h.line, text: `import "${h.module}"` })),
      });
    }
  }
  if (input.postInstall?.duplicate_react_detected) {
    amber.push({
      id: "duplicate-react",
      title: "Duplicate React installation detected",
      detail: input.postInstall.duplicate_react_resolved
        ? "A nested copy of React was found in node_modules and collapsed automatically with `npm dedupe` (plus a resolutions pin where needed)."
        : "A nested copy of React was found and could not be fully collapsed. Hooks may throw at runtime.",
      action: { kind: "confirm", label: "Understood" },
    });
  }

  /* ------------------------------ peer dependencies & build retry loop */
  const autoAdded = [...(input.peerAudit?.added ?? []), ...(input.buildRetry?.added ?? [])];
  for (const pkg of autoAdded) {
    green.push({
      id: `auto-dep-${pkg.name}`,
      title: `${pkg.name}@${pkg.version} installed automatically`,
      detail: pkg.reason,
    });
  }
  if (input.buildRetry && input.buildRetry.attempts > 1) {
    green.push({
      id: "build-retries",
      title: `Build recovered after ${input.buildRetry.attempts - 1} automatic retr${input.buildRetry.attempts === 2 ? "y" : "ies"}`,
      detail: `Packages resolved during the retry loop: ${input.buildRetry.attemptedPackages.join(", ") || "none"}.`,
    });
  }
  for (const name of input.peerAudit?.missingUnresolved ?? []) {
    amber.push({
      id: `peer-unresolved-${name}`,
      title: `Peer dependency ${name} could not be resolved`,
      detail: "It is required by an installed package but no version could be fetched from the registry.",
      action: { kind: "confirm", label: "Continue without it" },
    });
  }
  if (input.buildRetry && !input.buildRetry.succeeded && input.buildRetry.attempts > 0) {
    red.push({
      id: "build-retry-exhausted",
      title: `Build still failing after ${input.buildRetry.attempts} attempt${input.buildRetry.attempts === 1 ? "" : "s"}`,
      detail:
        `Packages attempted: ${input.buildRetry.attemptedPackages.join(", ") || "none"}.\n` +
        (input.buildRetry.finalError ?? "").slice(-800),
    });
  }

  /* ------------------------------------------ typescript configuration */
  const ts = input.tsconfig;
  if (ts?.generated) {
    green.push({
      id: "tsconfig-generated",
      title: "TypeScript configuration was generated automatically",
      detail: "tsconfig.json was missing or unparseable, so CPR wrote a known-good configuration for this toolchain.",
    });
  }
  if (ts?.fixed && ts.issues.length) {
    green.push({
      id: "tsconfig-fixed",
      title: `${ts.issues.length} TypeScript setting${ts.issues.length === 1 ? "" : "s"} corrected`,
      detail: ts.issues.join(" · "),
    });
  }
  if (ts?.nodeConfigGenerated) {
    green.push({
      id: "tsconfig-node-generated",
      title: "tsconfig.node.json was generated",
      detail: "It was listed in the project references but absent from the workspace.",
    });
  }

  /* --------------------------------------------- module system normalization */
  const ms = input.moduleSystem;
  if (ms?.typeModuleRemoved) {
    green.push({
      id: "type-module-removed",
      title: "`type: \"module\"` was removed from package.json",
      detail: "Vite processes ES modules natively. Removing the field prevents Node's strict ES Module resolution from rejecting extensionless relative imports during the build.",
    });
  }
  if (ms?.craArtifactsRemoved.length) {
    green.push({
      id: "cra-artifacts-removed",
      title: `${ms.craArtifactsRemoved.length} Create React App artefact${ms.craArtifactsRemoved.length === 1 ? "" : "s"} removed`,
      detail: `${ms.craArtifactsRemoved.join(", ")} — CRA-only scaffolding with no meaning in a Vite production build; left in place they resolve to modules that are never installed.`,
    });
  }
  if (ms?.extensionlessImportsFixed) {
    green.push({
      id: "extensionless-imports-fixed",
      title: `${ms.extensionlessImportsFixed} relative import${ms.extensionlessImportsFixed === 1 ? "" : "s"} given explicit extensions`,
      detail: `${ms.filesModified.length} file${ms.filesModified.length === 1 ? "" : "s"} modified. Only the specifier text changed — nothing about what is imported or how it is used.`,
    });
  }
  if (ms?.configsConverted.length) {
    green.push({
      id: "configs-esm",
      title: `${ms.configsConverted.length} config file${ms.configsConverted.length === 1 ? "" : "s"} converted to ES Module syntax`,
      detail: ms.configsConverted.join(", "),
    });
  }
  if (ms?.unresolvableImports.length) {
    amber.push({
      id: "unresolvable-imports",
      title: `${ms.unresolvableImports.length} relative import${ms.unresolvableImports.length === 1 ? "" : "s"} could not be resolved on disk`,
      detail: ms.unresolvableImports.slice(0, 12).join(" · "),
    });
  }



  /* -------------------------------------------------- plugin conflict matrix */
  const plugins = input.audit?.pluginResolution ?? null;
  if (plugins) {
    const clean = plugins.resolved.filter((p) => p.status === "ok");
    if (clean.length) {
      green.push({
        id: "plugins-ok",
        title: `${clean.length} plugin${clean.length === 1 ? "" : "s"} resolved cleanly`,
        detail: clean.map((p) => `${p.name} @ ${p.version}`).join(" · "),
      });
    }
    if (plugins.gradleResolutions.length) {
      green.push({
        id: "plugins-native-forced",
        title: `${plugins.gradleResolutions.length} native library clash${plugins.gradleResolutions.length === 1 ? "" : "es"} pinned`,
        detail: plugins.gradleResolutions.map((r) => `${r.coordinate} → ${r.version} (${r.reason})`).join(" · "),
      });
    }
    if (plugins.permissions.length) {
      green.push({
        id: "plugins-permissions",
        title: `${plugins.permissions.length} Android permission${plugins.permissions.length === 1 ? "" : "s"} merged`,
        detail: plugins.permissions.join(", "),
      });
    }

    for (const p of plugins.resolved.filter((x) => x.status === "upgraded")) {
      amber.push({
        id: `plugin-upgraded-${p.npm}`,
        title: `${p.name} version changed`,
        detail: p.detail,
        action: { kind: "confirm", label: "Accept this version" },
      });
    }
    for (const up of plugins.dependencyUpgrades) {
      amber.push({
        id: `plugin-dep-${up.name}`,
        title: `${up.name} upgraded ${up.from} → ${up.to}`,
        detail: `${up.plugin} requires it. ${up.reason}`,
        action: { kind: "confirm", label: "Accept the dependency upgrade" },
      });
    }
    for (const x of plugins.experimental) {
      amber.push({
        id: `plugin-experimental-${x.npm}`,
        title: `${x.npm} is experimental`,
        detail: `${x.reason} It will be installed, but no compatibility guarantees apply.`,
        action: { kind: "confirm", label: "Install at my own risk" },
      });
    }
    if (plugins.minSdkRaisedBy) {
      amber.push({
        id: "plugin-min-sdk",
        title: `Minimum Android version raised to API ${plugins.minSdk}`,
        detail: `${plugins.minSdkRaisedBy} requires it. Devices older than Android API ${plugins.minSdk} will not be able to install this app.`,
        action: { kind: "confirm", label: "Accept the higher device requirement" },
      });
    }

    for (const b of plugins.blocking) {
      red.push({
        id: `plugin-conflict-${b.id}`,
        title: `Plugin conflict: ${b.plugins.join(" ↔ ")}`,
        detail: `${b.detail} Choose one: ${b.choices.join(" · ")}`,
        action: { kind: "confirm", label: b.choices[0] ?? "Resolve the conflict" },
      });
    }
    for (const pc of plugins.permissionConflicts) {
      red.push({
        id: `plugin-permission-${pc.permission}`,
        title: `Permission conflict: ${pc.permission}`,
        detail: `${pc.detail} Declared by ${pc.plugins.join(" and ")}.`,
      });
    }
    for (const gone of plugins.removed) {
      red.push({
        id: `plugin-removed-${gone.npm}`,
        title: `${gone.npm} removed from the build`,
        detail: gone.reason,
      });
    }
  }

  for (const kind of ["service-worker", "target-blank"] as const) {
    const items = group(findings, kind);
    if (!items.length) continue;
    green.push({
      id: kind,
      title:
        kind === "service-worker"
          ? `${items.length} service worker registration${items.length === 1 ? "" : "s"} gated`
          : `${items.length} target="_blank" link${items.length === 1 ? "" : "s"} removed`,
      detail: items[0].detail,
      occurrences: occurrences(items),
    });
  }

  /* ------------------------------------------------------------- amber */
  const localhost = group(findings, "localhost").filter((f) => !f.autoFixed);
  if (localhost.length) {
    amber.push({
      id: "localhost",
      title: `${localhost.length} local network reference${localhost.length === 1 ? "" : "s"}`,
      detail: "These URLs are unreachable from a device. Provide the production API base URL and CPR will rewrite them.",
      action: { kind: "input", label: "Production API base URL", field: "apiBaseUrl" },
      occurrences: occurrences(localhost),
    });
  }
  const envUndefined = input.transform?.envUndefined ?? [];
  if (envUndefined.length) {
    amber.push({
      id: "env",
      title: `${envUndefined.length} undefined environment variable${envUndefined.length === 1 ? "" : "s"}`,
      detail: envUndefined.join(", "),
      action: { kind: "input", label: "Provide values in project settings", field: "env" },
      occurrences: occurrences(group(findings, "env-undefined")),
    });
  }
  const windowOpen = group(findings, "window-open");
  if (windowOpen.length) {
    amber.push({
      id: "window-open",
      title: `${windowOpen.length} window.open call${windowOpen.length === 1 ? "" : "s"}`,
      detail: "Review these — replace with the Capacitor Browser plugin to keep users inside the app.",
      action: { kind: "confirm", label: "I have reviewed these" },
      occurrences: occurrences(windowOpen),
    });
  }
  const cdn = group(findings, "cdn");
  if (cdn.length) {
    amber.push({
      id: "cdn",
      title: `${cdn.length} external CDN dependenc${cdn.length === 1 ? "y" : "ies"}`,
      detail: "These require internet access on device. Bundle npm equivalents where possible.",
      action: { kind: "confirm", label: "Keep as remote dependencies" },
      occurrences: occurrences(cdn),
    });
  }
  const webOnly = group(findings, "web-only-ui");
  if (webOnly.length) {
    amber.push({
      id: "web-only-ui",
      title: `${webOnly.length} web-only UI element${webOnly.length === 1 ? "" : "s"}`,
      detail: "Cookie banners and install prompts should not render in a native app. Confirm to gate them behind the native flag.",
      action: { kind: "confirm", label: "Hide in native builds" },
      occurrences: occurrences(webOnly),
    });
  }

  /* --------------------------------------------------------------- red */
  for (const pkg of policy?.server_only_packages ?? []) {
    if (!pkg.production || !pkg.imported) continue;
    red.push({
      id: `server-only-${pkg.name}`,
      title: `\`${pkg.name}\` cannot run in a WebView`,
      detail: pkg.detail,
    });
  }
  for (const check of input.postInstall?.post_install_verification ?? []) {
    if (check.passed) continue;
    red.push({
      id: `post-install-failed-${check.check}`,
      title: `Post-install verification failed: ${check.check}`,
      detail: `${check.detail} The automatic fix did not resolve it, so the build cannot proceed.`,
    });
  }
  for (const flag of input.scan.serverSideFlags) {
    red.push({ id: `server-${flag.reason.slice(0, 20)}`, title: flag.reason, detail: flag.remedy });
  }
  if (input.scan.compatibility !== "supported") {
    red.push({
      id: "compatibility",
      title:
        input.scan.compatibility === "coming-soon"
          ? `Needs CPR v${input.scan.cprVersion}${input.scan.estimatedAvailability ? ` (${input.scan.estimatedAvailability})` : ""}`
          : "Project type not supported",
      detail: input.scan.compatibilityMessage,
    });
  }
  const v = input.verify;
  if (v?.buildStatus === "failed") {
    red.push({
      id: "build-failed",
      title: `Build failed after ${v.buildAttempts} attempt${v.buildAttempts === 1 ? "" : "s"}`,
      detail: v.buildLogExcerpt || "No output captured.",
    });
  }
  if (v?.headlessStatus === "failed") {
    red.push({
      id: "headless-failed",
      title: "Rendered a blank screen in the headless check",
      detail: [
        ...(v.consoleErrors.length ? [`Console: ${v.consoleErrors.slice(0, 5).join(" | ")}`] : []),
        ...(v.failedRequests.length ? [`Failed requests: ${v.failedRequests.slice(0, 5).join(" | ")}`] : []),
      ].join("\n") || "The page loaded but no visible content was rendered.",
    });
  }
  for (const check of v?.outputChecks ?? []) {
    if (check.passed) continue;
    red.push({ id: `output-${check.name}`, title: `Output check failed: ${check.name}`, detail: check.detail });
  }

  return {
    green,
    amber,
    red,
    blocking: red.length > 0,
    generatedAt: new Date().toISOString(),
    summary: {
      routerConversions,
      pathsFixed,
      fontsBundled,
      imagesCompressed,
      conflictsResolved: conflicts.length,
      packagesAdded: added.length,
      packagesRemoved: removed.length,
    },
  };
}
