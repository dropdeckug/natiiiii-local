/**
 * TOOL 2: Compatibility Checker
 * Validates whether a project can actually build for the target engine.
 * Returns a pass/fail with actionable reasons.
 */

import type { ProjectScanResult } from "./projectScanner";

export interface CompatibilityResult {
  compatible: boolean;
  score: number; // 0-100
  blockers: string[];
  warnings: string[];
  suggestions: string[];
}

export function checkCompatibility(
  scan: ProjectScanResult,
  engine: string,
  outputMode: string
): CompatibilityResult {
  const result: CompatibilityResult = {
    compatible: true,
    score: 100,
    blockers: [],
    warnings: [],
    suggestions: [],
  };

  const isStaticHtml = scan.framework === "static" || (!scan.hasPackageJson && Boolean(scan.entryPoint?.endsWith("index.html")));

  // Must have package.json unless static HTML can be grounded automatically.
  if (!scan.hasPackageJson && !isStaticHtml) {
    result.blockers.push("No package.json found — cannot install dependencies");
    result.score -= 50;
  } else if (isStaticHtml && !scan.hasPackageJson) {
    result.warnings.push("Static HTML project — package.json and dist output will be synthesized");
    result.score -= 5;
  }

  // Must have a build script
  if (!scan.hasBuildScript && !isStaticHtml) {
    result.blockers.push("No build script in package.json — project cannot be compiled");
    result.score -= 40;
  }

  // SSR frameworks need static export
  if (scan.hasSSR) {
    result.warnings.push(`${scan.framework} uses SSR — native builds require static HTML output`);
    result.score -= 15;
    if (scan.framework === "next") {
      result.suggestions.push("Add 'output: \"export\"' to next.config.js for static HTML generation");
    } else if (scan.framework === "nuxt") {
      result.suggestions.push("Use 'nuxt generate' instead of 'nuxt build' for static output");
    }
  }

  // Check for native Node modules that won't work in WebView
  const dangerousDeps = ["sharp", "canvas", "node-gyp", "better-sqlite3", "bcrypt"];
  for (const dep of dangerousDeps) {
    if (scan.dependencies[dep] || scan.devDependencies[dep]) {
      result.warnings.push(`'${dep}' is a native Node module — it won't work in a mobile WebView`);
      result.score -= 10;
    }
  }

  // Engine-specific checks
  if (engine === "capacitor" || engine === "ionic") {
    if (scan.framework === "unknown" && !scan.hasBuildScript && !isStaticHtml) {
      result.blockers.push("Capacitor requires a web project with a build step");
      result.score -= 30;
    }
  }

  if (engine === "webview" || engine === "twa") {
    // These just wrap a URL, very permissive
    result.score = Math.max(result.score, 80);
  }

  // No files at all
  if (scan.sourceFiles === 0) {
    result.blockers.push("No source files uploaded");
    result.score = 0;
  }

  result.compatible = result.blockers.length === 0;
  result.score = Math.max(0, result.score);

  return result;
}

/**
 * Generates log lines from compatibility result
 */
export function compatibilityToLogs(result: CompatibilityResult): string[] {
  const logs: string[] = [];
  logs.push(`Compatibility score: ${result.score}/100`);
  if (result.compatible) {
    logs.push("✓ Project is compatible with target engine");
  } else {
    logs.push("✗ Project has blocking compatibility issues:");
  }
  for (const b of result.blockers) logs.push(`  ✗ ${b}`);
  for (const w of result.warnings) logs.push(`  ⚠ ${w}`);
  for (const s of result.suggestions) logs.push(`  → ${s}`);
  return logs;
}
