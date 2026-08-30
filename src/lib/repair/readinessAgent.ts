/**
 * Readiness Agent — the AI repair pass that runs inside the create-project
 * wizard, between "Source" and "Plan".
 *
 * It assembles the Canonical Project Representation (what the platform knows
 * about the imported project plus the exact CI contract the GitHub Actions
 * workflow will honour), hands it to the Gemini-backed `ai-readiness-repair`
 * edge function together with only the files the findings point at, applies the
 * returned patches to the in-memory project tree, and then re-runs the
 * deterministic checks to verify the project is actually buildable.
 */

import { supabase } from "@/integrations/supabase/client";
import { scanProject, type ProjectScanResult } from "@/lib/tools/projectScanner";
import { scanReactReadiness, type ReactReadinessReport } from "@/lib/tools/reactReadinessScan";
import { checkCompatibility } from "@/lib/tools/compatibilityChecker";
import { resolveDependencies } from "@/lib/tools/dependencyResolver";
import type { ProjectEntryCandidate } from "@/lib/tools/projectIndexer";
import { PLATFORM_RELEASE } from "../../../cpr/versions/index.ts";

export interface FlatFile {
  path: string;
  type: "file" | "folder";
  content?: string;
  isBinary?: boolean;
}

export interface ReadinessFinding {
  id: string;
  label: string;
  severity: "block" | "warn" | "info";
  message: string;
  files: string[];
}

export interface CanonicalRepresentation {
  framework: string;
  packageManager: string;
  isMonorepo: boolean;
  appRoot: string;
  entryHtml: string | null;
  buildTool: string | null;
  buildCommand: string;
  outputDir: string;
  hasTypeScript: boolean;
  sourceFiles: number;
  declaredDependencies: string[];
  detectedEnvVars: string[];
  presentEnvVars: string[];
  warnings: string[];
  ci: {
    nodeVersion: string;
    capacitorMajor: number;
    capacitorVersion: string;
    installCommand: string;
    buildCommand: string;
    expectedOutputDir: string;
    excludedGlobs: string[];
    shell: string;
    protectedPaths: string[];
  };
}

export interface RepairFileEdit {
  path: string;
  newContent: string;
  previousContent: string;
  reason: string;
  findingId?: string;
  created: boolean;
}

export interface RepairFileDelete {
  path: string;
  reason: string;
}

export interface VerificationCheck {
  id: string;
  label: string;
  command: string;
  passed: boolean;
  output: string;
}

export interface ReadinessAgentResult {
  edits: RepairFileEdit[];
  deletes: RepairFileDelete[];
  addedDependencies: { name: string; version: string; dev?: boolean }[];
  notes: string;
  resolved: string[];
  verification: VerificationCheck[];
  scan: ProjectScanResult;
  readiness: ReactReadinessReport | null;
  clean: boolean;
}

/** Context files always shipped with the request, on top of finding targets. */
const ALWAYS_INCLUDE = [
  "package.json",
  "index.html",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  ".env",
  ".env.example",
  "src/main.tsx",
  "src/main.ts",
  "src/main.jsx",
  "src/App.tsx",
  "src/index.js",
];

const PROTECTED = [".github/workflows/**", "package-lock.json", "bun.lockb", "*.keystore", "*.jks"];

export const flattenTree = (nodes: any[]): FlatFile[] => {
  const out: FlatFile[] = [];
  const walk = (list: any[]) => {
    for (const n of list || []) {
      out.push({ path: n.path, type: n.type, content: n.content, isBinary: n.isBinary });
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
};

export function buildCanonicalRepresentation(
  scan: ProjectScanResult,
  readiness: ReactReadinessReport | null,
  entry: ProjectEntryCandidate | null,
  opts: { appRoot: string; buildCommand: string; outputDir: string },
): CanonicalRepresentation {
  const deps = resolveDependencies(scan);
  return {
    framework: scan.framework,
    packageManager: scan.packageManager,
    isMonorepo: scan.isMonorepo,
    appRoot: opts.appRoot || entry?.projectRoot || "",
    entryHtml: entry?.entryHtml ?? null,
    buildTool: entry?.buildToolLabel ?? null,
    buildCommand: opts.buildCommand || scan.buildScript || "npm run build",
    outputDir: opts.outputDir || scan.outputDir || "dist",
    hasTypeScript: scan.hasTypeScript,
    sourceFiles: scan.sourceFiles,
    declaredDependencies: Object.keys({ ...scan.dependencies, ...scan.devDependencies }),
    detectedEnvVars: readiness?.detectedEnvVars ?? [],
    presentEnvVars: readiness?.presentEnvVars ?? [],
    warnings: scan.warnings ?? [],
    ci: {
      nodeVersion: PLATFORM_RELEASE.nodeVersion,
      capacitorMajor: PLATFORM_RELEASE.capacitorMajor,
      capacitorVersion: PLATFORM_RELEASE.capacitorVersion,
      installCommand: deps.installCommand,
      buildCommand: opts.buildCommand || scan.buildScript || "npm run build",
      expectedOutputDir: opts.outputDir || scan.outputDir || "dist",
      excludedGlobs: ["supabase/functions/**", "node_modules/**", "android/**", "ios/**"],
      shell: "Capacitor WebView loading from file:// — relative asset paths and no cleartext HTTP",
      protectedPaths: PROTECTED,
    },
  };
}

export function collectFindings(
  scan: ProjectScanResult,
  readiness: ReactReadinessReport | null,
): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];
  if (readiness) {
    for (const c of readiness.checks) {
      if (c.severity === "info") continue;
      findings.push({
        id: c.id,
        label: c.label,
        severity: c.severity === "block" ? "block" : "warn",
        message: c.message,
        files: c.files ?? [],
      });
    }
    for (const d of readiness.needsUserDecision) {
      if (findings.some((f) => f.id === d.id)) continue;
      findings.push({
        id: d.id,
        label: d.label,
        severity: "warn",
        message: `${d.message}${d.values?.length ? ` (${d.values.join(", ")})` : ""}`,
        files: [],
      });
    }
  }
  for (const w of scan.warnings ?? []) {
    if (!/^Grounding:/i.test(w)) continue;
    findings.push({
      id: `grounding-${findings.length}`,
      label: "Grounding",
      severity: "warn",
      message: w,
      files: [],
    });
  }
  return findings;
}

export function selectContextFiles(flat: FlatFile[], findings: ReadinessFinding[]): FlatFile[] {
  const wanted = new Set<string>(ALWAYS_INCLUDE);
  for (const f of findings) for (const p of f.files) wanted.add(p.split(":")[0]);
  return flat.filter(
    (f) => f.type === "file" && !f.isBinary && typeof f.content === "string" && wanted.has(f.path),
  );
}

/** Re-run the deterministic gates on the patched tree and report each as a check. */
export function verifyPatchedTree(
  flat: FlatFile[],
  engine: string,
  outputDir: string,
): { checks: VerificationCheck[]; scan: ProjectScanResult; readiness: ReactReadinessReport | null } {
  const scan = scanProject(flat as any);
  let readiness: ReactReadinessReport | null = null;
  if (scan.framework === "react" || scan.framework === "vanilla") {
    try {
      readiness = scanReactReadiness(flat as any, scan);
    } catch {
      readiness = null;
    }
  }
  const compatibility = checkCompatibility(scan, engine, "static");
  const deps = resolveDependencies(scan);

  const checks: VerificationCheck[] = [
    {
      id: "readiness",
      label: "Blank-screen readiness",
      command: "nativebridge check readiness",
      passed: !readiness || (readiness.ok && readiness.hardBlockers.length === 0),
      output: readiness
        ? readiness.hardBlockers.length
          ? readiness.hardBlockers.join("\n")
          : `risk=${readiness.blankScreenRisk} · ${readiness.checks.length} check(s) reported`
        : "not applicable for this framework",
    },
    {
      id: "compatibility",
      label: "Engine compatibility",
      command: `nativebridge check compatibility --engine ${engine}`,
      passed: compatibility.compatible,
      output: [
        `score ${compatibility.score}/100`,
        ...compatibility.blockers.map((b) => `✗ ${b}`),
        ...compatibility.warnings.map((w) => `⚠ ${w}`),
      ].join("\n"),
    },
    {
      id: "dependencies",
      label: "Dependency resolution",
      command: deps.installCommand,
      passed: deps.peerConflicts.length === 0,
      output: [...deps.preInstallActions, deps.installCommand, ...deps.warnings, ...deps.peerConflicts].join("\n"),
    },
    {
      id: "output",
      label: "Build output resolution",
      command: `nativebridge check output --dir ${outputDir}`,
      passed: Boolean(outputDir) && (scan.hasBuildScript || scan.framework === "static"),
      output: scan.hasBuildScript
        ? `build script present · output "${outputDir}"`
        : "no build script found in package.json",
    },
  ];

  return { checks, scan, readiness };
}

export interface RunRepairArgs {
  flat: FlatFile[];
  canonical: CanonicalRepresentation;
  findings: ReadinessFinding[];
  attempt?: number;
  previousFailures?: string[];
}

export interface RawRepairResponse {
  fileEdits: { path: string; newContent: string; reason: string; findingId?: string }[];
  fileDeletes: { path: string; reason: string }[];
  packageJsonPatch: { name: string; version: string; dev?: boolean }[];
  resolved: string[];
  notes: string;
}

export async function requestRepair(args: RunRepairArgs): Promise<RawRepairResponse> {
  const files = selectContextFiles(args.flat, args.findings).map((f) => ({
    path: f.path,
    content: f.content ?? "",
  }));

  const { data, error } = await supabase.functions.invoke("ai-readiness-repair", {
    body: {
      canonical: args.canonical,
      findings: args.findings,
      files,
      attempt: args.attempt ?? 1,
      previousFailures: args.previousFailures ?? [],
    },
  });

  if (error) {
    let message = error.message;
    try {
      const payload = await (error as any).context?.json?.();
      message = payload?.detail || payload?.error || message;
    } catch { /* keep SDK message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.detail || data.error);

  return {
    fileEdits: Array.isArray(data?.fileEdits) ? data.fileEdits : [],
    fileDeletes: Array.isArray(data?.fileDeletes) ? data.fileDeletes : [],
    packageJsonPatch: Array.isArray(data?.packageJsonPatch) ? data.packageJsonPatch : [],
    resolved: Array.isArray(data?.resolved) ? data.resolved : [],
    notes: typeof data?.notes === "string" ? data.notes : "",
  };
}

/** Merge dependency additions into a package.json string. */
export function applyPackageJsonPatch(
  current: string,
  patch: { name: string; version: string; dev?: boolean }[],
): string | null {
  if (patch.length === 0) return null;
  let pkg: any;
  try {
    pkg = JSON.parse(current);
  } catch {
    return null;
  }
  let changed = false;
  for (const dep of patch) {
    const bucket = dep.dev ? "devDependencies" : "dependencies";
    pkg[bucket] = pkg[bucket] || {};
    if (pkg[bucket][dep.name] !== dep.version) {
      pkg[bucket][dep.name] = dep.version;
      changed = true;
    }
  }
  if (!changed) return null;
  return JSON.stringify(pkg, null, 2) + "\n";
}

/** Compact line-level diff used by the timeline's edit rows. */
export function diffLines(before: string, after: string) {
  const a = before.split("\n");
  const b = after.split("\n");
  const beforeSet = new Set(a);
  const afterSet = new Set(b);
  const removed = a.filter((l) => l.trim() && !afterSet.has(l)).slice(0, 12);
  const added = b.filter((l) => l.trim() && !beforeSet.has(l)).slice(0, 12);
  return {
    added,
    removed,
    addedCount: b.filter((l) => !beforeSet.has(l)).length,
    removedCount: a.filter((l) => !afterSet.has(l)).length,
  };
}

/** Stable signature of a patch set — used to stop identical repeat rounds. */
export function patchSignature(res: RawRepairResponse): string {
  return [
    ...res.fileEdits.map((e) => `${e.path}:${e.newContent.length}`),
    ...res.fileDeletes.map((d) => `-${d.path}`),
    ...res.packageJsonPatch.map((p) => `+${p.name}@${p.version}`),
  ]
    .sort()
    .join("|");
}
