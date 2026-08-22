/**
 * TOOL 1: Project Scanner
 * Reads uploaded files, detects framework, package manager, entry points, build scripts.
 * Returns a structured analysis that all downstream tools consume.
 */

import { indexProject } from "./projectIndexer";
import { discoverProjectEntries, type ProjectEntryCandidate } from "./projectIndexer";

export interface WorkspacePackage {
  path: string;       // relative dir, e.g. "apps/web"
  name: string;       // from package.json "name"
  buildScript: string | null;
  outputDir: string | null;
}

export interface ProjectScanResult {
  framework: "react" | "vue" | "angular" | "svelte" | "next" | "nuxt" | "vanilla" | "static" | "unknown";
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
  hasPackageJson: boolean;
  hasBuildScript: boolean;
  buildScript: string | null;
  outputDir: string | null;
  entryPoint: string | null;
  hasTypeScript: boolean;
  hasSSR: boolean;
  totalFiles: number;
  sourceFiles: number;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  warnings: string[];
  lockFile: string | null;
  isMonorepo: boolean;
  workspacePackages: WorkspacePackage[];
  entryCandidates: ProjectEntryCandidate[];
}

interface FileEntry {
  path: string;
  type: "file" | "folder";
  content?: string;
}

export function scanProject(files: FileEntry[]): ProjectScanResult {
  const index = indexProject(files);
  const result: ProjectScanResult = {
    framework: index.shape === "plain-html" ? "static" : index.framework.toLowerCase().includes("react") ? "react" : index.framework.toLowerCase().includes("vue") ? "vue" : index.framework.toLowerCase().includes("angular") ? "angular" : index.framework.toLowerCase().includes("svelte") ? "svelte" : index.framework.toLowerCase().includes("next") ? "next" : index.framework.toLowerCase().includes("nuxt") ? "nuxt" : index.shape === "unknown" ? "unknown" : "vanilla",
    packageManager: index.packageManager,
    hasPackageJson: index.hasPackageJson,
    hasBuildScript: index.hasBuildScript,
    buildScript: index.hasBuildScript ? index.buildCommand.replace(/^npm run /, "") : null,
    outputDir: index.outputDir,
    entryPoint: index.entryHtml,
    hasTypeScript: false,
    hasSSR: false,
    totalFiles: files.length,
    sourceFiles: 0,
    dependencies: index.dependencies,
    devDependencies: index.devDependencies,
    warnings: [...index.warnings, ...index.remediations.map((r) => `Grounding: ${r}`)],
    lockFile: null,
    isMonorepo: index.isMonorepo,
    workspacePackages: [],
    entryCandidates: discoverProjectEntries(files),
  };

  const fileNames = files.filter(f => f.type === "file").map(f => f.path);
  result.sourceFiles = fileNames.length;

  // Detect lock file & package manager
  if (fileNames.some(f => f.endsWith("bun.lockb") || f.endsWith("bun.lock"))) {
    result.packageManager = "bun";
    result.lockFile = "bun.lockb";
  } else if (fileNames.some(f => f.endsWith("pnpm-lock.yaml"))) {
    result.packageManager = "pnpm";
    result.lockFile = "pnpm-lock.yaml";
  } else if (fileNames.some(f => f.endsWith("yarn.lock"))) {
    result.packageManager = "yarn";
    result.lockFile = "yarn.lock";
  } else if (fileNames.some(f => f.endsWith("package-lock.json"))) {
    result.packageManager = "npm";
    result.lockFile = "package-lock.json";
  }

  // Parse package.json for workspace details and legacy fields not covered above
  const selectedPackagePath = index.projectRoot ? `${index.projectRoot}/package.json` : "package.json";
  const pkgFile = files.find(f => f.path === selectedPackagePath);
  if (pkgFile?.content) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      
      // Detect build script
      const scripts = pkg.scripts || {};
      if (scripts.build) {
        result.hasBuildScript = true;
        result.buildScript = scripts.build;
      } else if (scripts["build:prod"]) {
        result.hasBuildScript = true;
        result.buildScript = scripts["build:prod"];
      }

      // Detect framework from dependencies
      const allDeps = { ...result.dependencies, ...result.devDependencies };
      if (allDeps["next"]) result.framework = "next";
      else if (allDeps["nuxt"] || allDeps["nuxt3"]) result.framework = "nuxt";
      else if (allDeps["@angular/core"]) result.framework = "angular";
      else if (allDeps["svelte"] || allDeps["@sveltejs/kit"]) result.framework = "svelte";
      else if (allDeps["vue"]) result.framework = "vue";
      else if (allDeps["react"]) result.framework = "react";
    } catch {
      result.warnings.push("package.json exists but could not be parsed");
    }
  } else if (result.framework !== "static") {
    // No package.json — check if this is a static HTML/CSS/JS project
    const hasHtml = fileNames.some(f => /\.html?$/i.test(f) && !/(^|\/)(node_modules|dist|build|www|android|ios)(\/|$)/.test(f));
    if (hasHtml) {
      result.framework = "static";
      result.warnings.push("Static HTML project detected — Capacitor scaffolding will be auto-generated");
    } else {
      result.warnings.push("No package.json found — build may fail");
    }
  }

  // Detect TypeScript
  result.hasTypeScript = fileNames.some(f => f.endsWith(".ts") || f.endsWith(".tsx") || f === "tsconfig.json");

  // Detect SSR
  if (result.framework === "next" || result.framework === "nuxt") {
    result.hasSSR = true;
    result.warnings.push(`${result.framework} uses SSR by default — ensure static export is configured for native builds`);
  }

  // Detect output directory. Static/plain-HTML projects are grounded into www/,
  // so never overwrite that with a framework guess — and never leave it empty.
  if (result.framework === "static") result.outputDir = result.outputDir || "www";
  else if (result.buildScript?.includes("vite")) result.outputDir = "dist";
  else if (result.framework === "react") result.outputDir = "build";
  else if (result.framework === "angular") result.outputDir = "dist";
  else if (result.framework === "vue") result.outputDir = "dist";
  else if (result.framework === "next") result.outputDir = "out";
  else result.outputDir = result.outputDir || "dist";

  // Detect entry point
  const entryFiles = ["src/main.tsx", "src/main.ts", "src/index.tsx", "src/index.ts", "src/App.tsx", "src/app.tsx", "index.html"];
  result.entryPoint = result.entryPoint || entryFiles.find(e => fileNames.some(f => f.endsWith(e))) || null;

  // Detect monorepo + workspace packages
  const hasPnpmWorkspace = fileNames.some(f => f === "pnpm-workspace.yaml" || f.endsWith("/pnpm-workspace.yaml"));
  const hasTurbo = fileNames.some(f => f === "turbo.json" || f.endsWith("/turbo.json"));
  let pkgWorkspaces: string[] | null = null;
  if (pkgFile?.content) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      if (Array.isArray(pkg.workspaces)) pkgWorkspaces = pkg.workspaces;
      else if (pkg.workspaces?.packages) pkgWorkspaces = pkg.workspaces.packages;
    } catch { /* ignore */ }
  }
  result.isMonorepo = hasPnpmWorkspace || hasTurbo || !!pkgWorkspaces;

  if (result.isMonorepo) {
    const childPkgs = files.filter(
      f => f.type === "file" && f.path !== "package.json" && f.path.endsWith("/package.json")
            && !f.path.includes("node_modules/"),
    );
    for (const pf of childPkgs) {
      try {
        const pj = JSON.parse(pf.content || "{}");
        const dir = pf.path.replace(/\/package\.json$/, "");
        const buildScript = pj.scripts?.build || pj.scripts?.["build:prod"] || null;
        let outDir: string | null = null;
        if (buildScript?.includes("vite")) outDir = "dist";
        else if (pj.dependencies?.next) outDir = "out";
        else outDir = "dist";
        result.workspacePackages.push({
          path: dir,
          name: pj.name || dir,
          buildScript,
          outputDir: outDir,
        });
      } catch { /* skip malformed */ }
    }
  }

  return result;
}

/**
 * Generates human-readable log lines from scan results
 */
export function scanResultToLogs(scan: ProjectScanResult): string[] {
  const logs: string[] = [];
  logs.push(`Framework: ${scan.framework}`);
  logs.push(`Package manager: ${scan.packageManager}`);
  logs.push(`Files: ${scan.sourceFiles} source files`);
  if (scan.hasBuildScript) logs.push(`Build script: ${scan.buildScript}`);
  if (scan.outputDir) logs.push(`Expected output: ${scan.outputDir}/`);
  if (scan.hasTypeScript) logs.push(`TypeScript: yes`);
  if (scan.entryPoint) logs.push(`Entry point: ${scan.entryPoint}`);
  for (const w of scan.warnings) logs.push(`⚠ ${w}`);
  return logs;
}
