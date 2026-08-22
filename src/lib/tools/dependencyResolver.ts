/**
 * TOOL 3: Dependency Resolver
 * Analyzes package.json for potential issues and decides install strategy.
 */

import type { ProjectScanResult } from "./projectScanner";

export interface DependencyResolution {
  installCommand: string;
  flags: string[];
  preInstallActions: string[];
  warnings: string[];
  peerConflicts: string[];
}

export function resolveDependencies(scan: ProjectScanResult): DependencyResolution {
  const result: DependencyResolution = {
    installCommand: "npm install",
    flags: ["--legacy-peer-deps"],
    preInstallActions: [],
    warnings: [],
    peerConflicts: [],
  };

  // Remove bun lockfile if using npm in CI
  if (scan.packageManager === "bun" || scan.lockFile === "bun.lockb") {
    result.preInstallActions.push("rm -f bun.lockb bun.lock");
    result.warnings.push("Bun lockfile removed — using npm in CI for broader compatibility");
  }

  // Check for known peer dependency conflicts
  const deps = { ...scan.dependencies, ...scan.devDependencies };
  
  // React 18 + React 19 peer dep issues
  if (deps["react"] && deps["react"].includes("19")) {
    result.peerConflicts.push("React 19 detected — some packages may not support it yet");
    result.flags.push("--legacy-peer-deps");
  }

  // Check for private registry references
  if (scan.lockFile === "package-lock.json") {
    result.warnings.push("Using existing package-lock.json — if it references private registries, build may fail");
  }

  // Detect monorepo
  if (deps["lerna"] || deps["turbo"] || deps["nx"]) {
    result.warnings.push("Monorepo detected — ensure the correct workspace package is being built");
  }

  // Build the final install command
  result.installCommand = `npm install ${result.flags.join(" ")}`.trim();

  return result;
}

export function dependencyResolutionToLogs(result: DependencyResolution): string[] {
  const logs: string[] = [];
  if (result.preInstallActions.length > 0) {
    for (const a of result.preInstallActions) logs.push(`Pre-install: ${a}`);
  }
  logs.push(`Install command: ${result.installCommand}`);
  for (const w of result.warnings) logs.push(`⚠ ${w}`);
  for (const c of result.peerConflicts) logs.push(`⚠ Peer conflict: ${c}`);
  return logs;
}
