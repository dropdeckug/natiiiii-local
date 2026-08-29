/**
 * Automated build retry loop.
 *
 * When a build fails on an unresolved module, CPR extracts the package name
 * from the error output, adds it to the canonical manifest at its latest
 * stable version, re-installs and rebuilds — up to five times.
 *
 * Runtime-agnostic: install / build / registry access is injected.
 */

import type { PeerDependencyAddition, BuildRetryResult } from "../types/index.ts";

export const MAX_AUTO_BUILD_RETRIES = 5;

const UNRESOLVED_PATTERNS: RegExp[] = [
  /failed to resolve import\s+["']([^"']+)["']/i,
  /Cannot find module\s+["']([^"']+)["']/i,
  /Module not found:?[^"'\n]*["']([^"']+)["']/i,
  /Rollup failed to resolve import\s+["']([^"']+)["']/i,
];

export function outputSignalsMissingModule(output: string): boolean {
  return /failed to resolve import|cannot find module|module not found/i.test(output ?? "");
}

/** Turn an import specifier into the npm package it belongs to, or null. */
export function packageFromSpecifier(spec: string): string | null {
  if (!spec) return null;
  if (/^[./]|^node:|^virtual:|^data:|^https?:|^@\/|^~\//.test(spec)) return null;
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  if (!name || name.length > 214) return null;
  
  // Strict npm package name validation
  // Cannot contain spaces, uppercase letters, or special chars like brackets/quotes
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    return null;
  }
  
  return name;
}

/** Extract the first unresolved package name from build error output. */
export function extractUnresolvedPackage(output: string): string | null {
  const o = output ?? "";
  for (const re of UNRESOLVED_PATTERNS) {
    const m = o.match(re);
    if (m?.[1]) {
      const name = packageFromSpecifier(m[1]);
      if (name) return name;
    }
  }
  return null;
}

export interface BuildRetryIO {
  runBuild(): Promise<{ ok: boolean; output: string }>;
  runInstall(): Promise<{ ok: boolean; output: string }>;
  resolveLatest(name: string): Promise<string | null>;
}

export function emptyBuildRetryResult(): BuildRetryResult {
  return { attempts: 0, succeeded: false, added: [], attemptedPackages: [], finalError: null };
}

/**
 * Build, and on an unresolved-module failure install the missing package and
 * build again. Never throws; a thrown IO error ends the loop and is reported.
 */
export async function buildWithAutoRetry(
  io: BuildRetryIO,
  packageJson: Record<string, unknown>,
  maxRetries = MAX_AUTO_BUILD_RETRIES,
): Promise<BuildRetryResult> {
  const result = emptyBuildRetryResult();
  const added: PeerDependencyAddition[] = [];

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const build = await io.runBuild();
      result.attempts = attempt + 1;
      if (build.ok) {
        result.succeeded = true;
        result.added = added;
        return result;
      }
      result.finalError = build.output;

      if (attempt === maxRetries) break;
      if (!outputSignalsMissingModule(build.output)) break;

      const name = extractUnresolvedPackage(build.output);
      if (!name || result.attemptedPackages.includes(name)) break;
      result.attemptedPackages.push(name);

      const version = await io.resolveLatest(name);
      if (!version) break;

      const deps = { ...(packageJson.dependencies as Record<string, string> ?? {}) };
      deps[name] = version;
      (packageJson as { dependencies: Record<string, string> }).dependencies = Object.fromEntries(
        Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
      );
      added.push({
        name,
        version,
        source: "build-retry",
        reason: "Required by the build but missing from package.json.",
      });

      const install = await io.runInstall();
      if (!install.ok) {
        result.finalError = install.output;
        break;
      }
    }
  } catch (err) {
    result.finalError = `${result.finalError ?? ""}\n${err instanceof Error ? err.message : String(err)}`.trim();
  }

  result.added = added;
  return result;
}

/* ------------------------------------------------- module-system failures */

export interface ModuleErrorDetection {
  pattern: string;
  fix: string;
  file?: string;
  specifier?: string;
}

const MODULE_ERROR_RULES: {
  pattern: string;
  re: RegExp;
  fix: string;
  capture?: (m: RegExpMatchArray) => Partial<ModuleErrorDetection>;
}[] = [
  {
    pattern: "did-you-mean-js-extension",
    re: /Did you mean to import ([^\s?'"]+\.js)/i,
    fix: "add-extension",
    capture: (m) => ({ specifier: m[1] }),
  },
  {
    pattern: "module-not-found-report-web-vitals",
    re: /(?:Module not found|Cannot find module|Failed to resolve import)[^\n]*reportWebVitals/i,
    fix: "remove-cra-artifacts",
  },
  {
    pattern: "module-not-found-web-vitals",
    re: /(?:Module not found|Cannot find module|Failed to resolve import)[^\n]*web-vitals/i,
    fix: "remove-cra-artifacts",
  },
  {
    pattern: "require-not-defined-in-esm",
    re: /require is not defined in ES module scope/i,
    fix: "convert-require-to-import",
  },
  {
    pattern: "import-in-commonjs",
    re: /Cannot use import statement outside a module|Cannot use import statement in a CommonJS module/i,
    fix: "convert-file-to-commonjs",
  },
  {
    pattern: "cannot-resolve-relative-extensionless",
    re: /(?:Cannot resolve|Failed to resolve import|Cannot find module)\s+["']?(\.\.?\/[^"'\s]+)["']?/i,
    fix: "add-extension",
    capture: (m) => ({ specifier: m[1] }),
  },
];

/** Classifies a module-system build failure and names the fix to apply. */
export function detectModuleError(output: string): ModuleErrorDetection | null {
  const o = output ?? "";
  for (const rule of MODULE_ERROR_RULES) {
    const m = o.match(rule.re);
    if (!m) continue;
    if (rule.pattern === "cannot-resolve-relative-extensionless" && /\.\w{2,4}$/.test(m[1] ?? "")) continue;
    const file = o.match(/from\s+["']?([^\s"']+\.(?:m?js|jsx|ts|tsx))["']?/i)?.[1];
    return { pattern: rule.pattern, fix: rule.fix, file, ...(rule.capture?.(m) ?? {}) };
  }
  return null;
}
