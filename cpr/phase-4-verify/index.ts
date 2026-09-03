import type { PackageManager, VerifyRequest, VerifyResult } from "../types/index.ts";
import { installCommandFor, runCommandFor } from "../phase-2-validate/index.ts";
import { PLATFORM_NODE_VERSION } from "../versions/index.ts";

/**
 * Phase 4 — build execution and headless verification.
 *
 * CPR itself never runs npm or a browser: no such capability exists in the
 * edge runtime or the browser. This module owns the *contract* with the
 * runner (the `cpr-verify` GitHub Actions workflow), builds its dispatch
 * payload, classifies build errors, and interprets the result it reports back.
 */

export const MAX_BUILD_RETRIES = 3;

export {
  MAX_AUTO_BUILD_RETRIES,
  buildWithAutoRetry,
  emptyBuildRetryResult,
  extractUnresolvedPackage,
  outputSignalsMissingModule,
  packageFromSpecifier,
  type BuildRetryIO,
} from "./build-retry.ts";
export * from "./repair-plan.ts";
export const MAX_HEADLESS_RETRIES = 2;
export const BUILD_TIMEOUT_MINUTES = 5;
export const INSTALL_TIMEOUT_MINUTES = 3;

export function buildVerifyRequest(opts: {
  projectId: string;
  canonicalPath: string;
  packageManager: PackageManager;
  buildScript?: string;
  outputDir: string;
}): VerifyRequest {
  return {
    projectId: opts.projectId,
    canonicalPath: opts.canonicalPath,
    packageManager: opts.packageManager,
    installCommand: installCommandFor(opts.packageManager),
    buildCommand: runCommandFor(opts.packageManager, opts.buildScript ?? "build"),
    outputDir: opts.outputDir,
    nodeVersion: PLATFORM_NODE_VERSION,
    maxBuildRetries: MAX_BUILD_RETRIES,
    headless: true,
  };
}

/* ------------------------------------------------------ error classification */

export type BuildErrorKind =
  | "missing-module"
  | "missing-registry-package"
  | "type-error"
  | "syntax-error"
  | "out-of-memory"
  | "permission"
  | "network"
  | "version-resolution"
  | "config"
  | "timeout"
  | "unknown";

export interface ClassifiedBuildError {
  kind: BuildErrorKind;
  detail: string;
  /** A remedy CPR can apply itself and retry. */
  autoFix: string | null;
}

export function classifyBuildError(output: string): ClassifiedBuildError {
  const o = output ?? "";
  const pick = (re: RegExp) => o.match(re)?.[1]?.trim();

  if (/E404|404 Not Found - GET .*registry\.npmjs/.test(o)) {
    return {
      kind: "missing-registry-package",
      detail: pick(/404\s+'?([^'\s]+)'? is not in this registry/) ?? "A declared package does not exist on npm.",
      autoFix: null,
    };
  }
  if (/ERESOLVE|peer dep|ETARGET|No matching version/.test(o)) {
    return {
      kind: "version-resolution",
      detail: pick(/(No matching version[^\n]*)/) ?? "Dependency version conflict.",
      autoFix: null,
    };
  }
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|network|socket hang up/i.test(o)) {
    return { kind: "network", detail: "Registry network failure.", autoFix: "retry-after-delay" };
  }
  if (/EACCES|EPERM|permission denied/i.test(o)) {
    return { kind: "permission", detail: "Workspace permission error.", autoFix: "clean-workspace-retry" };
  }
  if (/JavaScript heap out of memory|FATAL ERROR: .*allocation failed/i.test(o)) {
    return { kind: "out-of-memory", detail: "Build ran out of memory.", autoFix: "raise-node-heap" };
  }
  if (/Cannot find module ['"]([^'"]+)['"]|Failed to resolve import ["']([^"']+)["']/.test(o)) {
    const name = pick(/Cannot find module ['"]([^'"]+)['"]/) ?? pick(/Failed to resolve import ["']([^"']+)["']/);
    return { kind: "missing-module", detail: name ?? "Unresolved import.", autoFix: "install-missing-module" };
  }
  if (/error TS\d+|Type error:/.test(o)) {
    return { kind: "type-error", detail: pick(/(error TS\d+:[^\n]*)/) ?? "TypeScript error.", autoFix: "skip-typecheck" };
  }
  if (/SyntaxError|Unexpected token/.test(o)) {
    return { kind: "syntax-error", detail: pick(/(SyntaxError[^\n]*)/) ?? "Syntax error in source.", autoFix: null };
  }
  if (/timed out|timeout/i.test(o)) {
    return { kind: "timeout", detail: "Command exceeded its timeout.", autoFix: "clean-retry" };
  }
  if (/config|Invalid configuration|Unknown option/i.test(o)) {
    return { kind: "config", detail: "Build configuration rejected.", autoFix: "regenerate-config" };
  }
  return { kind: "unknown", detail: o.slice(-800), autoFix: null };
}

/* ----------------------------------------------------------- output checks */

export function evaluateOutput(files: { path: string; size: number }[]): VerifyResult["outputChecks"] {
  const total = files.reduce((n, f) => n + f.size, 0);
  const index = files.find((f) => /(^|\/)index\.html$/.test(f.path));
  const bundles = files.filter((f) => /\.m?js$/.test(f.path));

  return [
    { name: "output-directory", passed: files.length > 0, detail: `${files.length} files emitted` },
    { name: "index-html", passed: !!index, detail: index ? index.path : "index.html missing from build output" },
    {
      name: "index-not-empty",
      passed: !!index && index.size > 200,
      detail: index ? `${index.size} bytes` : "n/a",
    },
    { name: "js-bundles", passed: bundles.length > 0, detail: `${bundles.length} JS bundles` },
    {
      name: "reasonable-size",
      passed: total > 20 * 1024,
      detail: `${Math.round(total / 1024)} KB total`,
    },
  ];
}

export function emptyVerifyResult(): VerifyResult {
  return {
    buildStatus: "skipped",
    buildAttempts: 0,
    buildLogExcerpt: "",
    outputChecks: [],
    headlessStatus: "skipped",
    consoleErrors: [],
    failedRequests: [],
    screenshotUrl: null,
    finishedAt: null,
  };
}

export function verifyPassed(r: VerifyResult | null): boolean {
  return !!r && r.buildStatus === "passed" && r.headlessStatus !== "failed" && r.outputChecks.every((c) => c.passed);
}
