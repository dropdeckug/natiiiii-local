/**
 * Build Repair Runner
 *
 * When a build phase fails with a code-level error (bad imports, missing
 * packages, Deno-only specifiers, duplicate imports, syntax, missing exports),
 * this runner asks the AI to produce a minimal patch plan and applies it to
 * the in-memory project tree. The caller can then re-zip and retry the phase.
 *
 * Workflow YAML is never touched. All fixes are code-only.
 */

import { supabase } from "@/integrations/supabase/client";
import { useProjectStore, type ProjectFile } from "@/stores/projectStore";
import { useBuildStore } from "@/stores/buildStore";
import type { ParsedBuildError } from "@/lib/tools/buildErrorParser";
import { toast } from "sonner";
import { logEvent } from "@/lib/logs/logSink";
import { PACKAGE_NAME, SAFE_VERSION, sanitizeDependencyManifest } from "@/lib/tools/dependencyManifest";
import { buildFailureFingerprint } from "@/lib/tools/buildFailureFingerprint";

const REPAIRABLE_CATEGORIES = new Set<ParsedBuildError["category"]>([
  "deno-specifier",
  "missing-module",
  "wrong-export",
  "duplicate-import",
  "syntax",
  "ts-error",
  "vite-config",
  "dependency",
  "npm",
  // Unclassified CI failures still get one grounded AI attempt so the action
  // panel always traces the error instead of silently giving up.
  "unknown",
]);

/** Categories we attempt even when the parser did not mark them auto-fixable. */
const BEST_EFFORT_CATEGORIES = new Set<ParsedBuildError["category"]>([
  "unknown",
  "dependency",
  "npm",
]);

interface RepairPlan {
  fileEdits: { path: string; newContent: string; reason: string }[];
  packageJsonPatch: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  excludeFromBuild: string[];
  notes: string;
}

export const DEFAULT_REPAIR_MODEL = "openai/gpt-5";

function isBuildConfigPath(path: string): boolean {
  return /(^|\/)(vite|postcss|tailwind|rollup|webpack|svelte|astro|nuxt|next)\.config(?:\.[\w.-]+)?\.(?:m|c)?[jt]s$/.test(path);
}

const flatten = (files: ProjectFile[]): ProjectFile[] => {
  const out: ProjectFile[] = [];
  const walk = (nodes: ProjectFile[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(files);
  return out;
};

function findFile(path: string): ProjectFile | undefined {
  return flatten(useProjectStore.getState().files).find(
    (f) => f.type === "file" && (f.path === path || f.path.endsWith("/" + path))
  );
}

function isSensitiveOrIrrelevantPath(path: string): boolean {
  const p = path.toLowerCase();
  if (/(^|\/)\.env(\.|$)/.test(p)) return true;
  if (/(^|\/)(google-services\.json|googleservice-info\.plist)$/.test(p)) return true;
  if (/\.(jks|keystore|p12|mobileprovision|pem|key|cer|crt)$/.test(p)) return true;
  if (p.startsWith("android/") || p.startsWith("ios/")) return true;
  return false;
}

/**
 * Build the set of files most relevant to the parsed error so AI has tight context.
 */
function collectAffectedFiles(parsed: ParsedBuildError): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = [];
  const seen = new Set<string>();
  const push = (path?: string) => {
    if (!path || seen.has(path)) return;
    if (isSensitiveOrIrrelevantPath(path) && path !== "package.json") return;
    const f = findFile(path);
    if (f?.content && !f.isBinary) {
      seen.add(path);
      result.push({ path: f.path, content: f.content.slice(0, 12000) });
    }
  };
  const includeConfigs = parsed.category === "vite-config" || parsed.category === "dependency" || parsed.category === "npm" || parsed.category === "unknown" || isBuildConfigPath(parsed.filePath || "");
  if (includeConfigs) {
    for (const f of flatten(useProjectStore.getState().files)) {
      if (
        isBuildConfigPath(f.path) ||
        /(^|\/)(package\.json|tsconfig(?:\.[\w.-]+)?\.json|index\.html)$/.test(f.path) ||
        /(^|\/)src\/(main|app)\.(?:tsx?|jsx?)$/i.test(f.path)
      ) push(f.path);
    }
  }
  for (const u of parsed.unresolvedImports || []) push(u.filePath);
  push(parsed.filePath);
  return result.slice(0, 20);
}

/** Merge a packageJsonPatch into the in-memory package.json. */
function applyPackageJsonPatch(patch: RepairPlan["packageJsonPatch"]): string[] {
  const added: string[] = [];
  if (!patch || (!patch.dependencies && !patch.devDependencies)) return added;
  const projectStore = useProjectStore.getState();
  const pkgFile = flatten(projectStore.files).find(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json")
  );
  if (!pkgFile?.content) return added;
  let pkg: any;
  try {
    pkg = JSON.parse(pkgFile.content);
  } catch {
    return added;
  }
  pkg.dependencies = pkg.dependencies || {};
  pkg.devDependencies = pkg.devDependencies || {};
  for (const [name, version] of Object.entries(patch.dependencies || {})) {
    if (!PACKAGE_NAME.test(name) || typeof version !== "string" || !SAFE_VERSION.test(version)) continue;
    // Overwrite an existing range too — most "missing module" failures are a
    // bad/nonexistent version, not a missing entry.
    if (pkg.devDependencies[name]) delete pkg.devDependencies[name];
    if (pkg.dependencies[name] === version) continue;
    pkg.dependencies[name] = version;
    added.push(`${name}@${version}`);
  }
  for (const [name, version] of Object.entries(patch.devDependencies || {})) {
    if (!PACKAGE_NAME.test(name) || typeof version !== "string" || !SAFE_VERSION.test(version)) continue;
    if (pkg.dependencies[name]) delete pkg.dependencies[name];
    if (pkg.devDependencies[name] === version) continue;
    pkg.devDependencies[name] = version;
    added.push(`${name}@${version} (dev)`);
  }

  if (added.length > 0) {
    projectStore.updateFileContent(pkgFile.path, JSON.stringify(pkg, null, 2) + "\n");
  }
  return added;
}

/** Patch vite.config.ts to externalize patterns from the web build. */
function applyExcludeFromBuild(patterns: string[]): string[] {
  if (!patterns || patterns.length === 0) return [];
  const projectStore = useProjectStore.getState();
  const viteFile = flatten(projectStore.files).find(
    (f) => f.path === "vite.config.ts" || f.path === "vite.config.js"
  );
  if (!viteFile?.content) return [];
  let content = viteFile.content;
  const applied: string[] = [];

  // Idempotent marker so we don't keep growing the file across repairs.
  const MARKER = "/* nb-build-repair:exclude */";
  if (!content.includes(MARKER)) {
    // Inject a Rollup external function that excludes the given patterns.
    // Place it inside `defineConfig({ ... })` via a build.rollupOptions.external override.
    const block = `\n${MARKER}\nconst __nbExcludePatterns = ${JSON.stringify(patterns)};\nfunction __nbIsExcluded(id) { return __nbExcludePatterns.some(p => id.includes(p.replace(/\\*+/g, ""))); }\n`;
    // Prepend before defineConfig for visibility.
    content = content.replace(/export default defineConfig\(/, block + "\nexport default defineConfig(");

    // Add build.rollupOptions.external if missing — best-effort string injection.
    if (!/rollupOptions\s*:\s*{[^}]*external/.test(content)) {
      content = content.replace(
        /defineConfig\(\(\{([^)]*)\}\) => \(\{/,
        (m) =>
          m +
          "\n  build: { rollupOptions: { external: (id) => __nbIsExcluded(id) } },"
      );
    }
    applied.push(...patterns);
  } else {
    // Update the patterns array in place
    content = content.replace(
      /const __nbExcludePatterns = \[[^\]]*\];/,
      `const __nbExcludePatterns = ${JSON.stringify(Array.from(new Set([...patterns])))};`
    );
    applied.push(...patterns);
  }
  if (content !== viteFile.content) {
    projectStore.updateFileContent(viteFile.path, content);
  }
  return applied;
}

export interface RepairOutcome {
  patched: boolean;
  summary: string;
  edits: string[];
  changedFiles: { path: string; before: string; after: string; reason: string }[];
}

export function isRepairable(parsed: ParsedBuildError | null): boolean {
  if (!parsed) return false;
  if (!REPAIRABLE_CATEGORIES.has(parsed.category)) return false;
  return parsed.autoFixable || BEST_EFFORT_CATEGORIES.has(parsed.category);
}

export async function runRepair(
  errorText: string,
  logs: string[],
  opts: { phaseName: string; parsed: ParsedBuildError; model?: string; projectId?: string; runId?: string | number | null }
): Promise<RepairOutcome> {
  const parsed = opts.parsed;
  if (!isRepairable(parsed)) {
    return { patched: false, summary: "Not auto-repairable", edits: [], changedFiles: [] };
  }

  const buildStore = useBuildStore.getState();
  const projectStore = useProjectStore.getState();

  const affectedFiles = collectAffectedFiles(parsed!);
  const pkgFile = flatten(projectStore.files).find(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json")
  );
  let packageJson: any = null;
  const deterministicEdits: string[] = [];
  const deterministicChanges: RepairOutcome["changedFiles"] = [];
  try {
    packageJson = pkgFile?.content ? JSON.parse(pkgFile.content) : null;
  } catch {
    /* ignore */
  }

  if (packageJson) {
    const manifestRepair = sanitizeDependencyManifest(packageJson);
    if (manifestRepair.changed && pkgFile?.path) {
      const sanitized = JSON.stringify(packageJson, null, 2) + "\n";
      if (sanitized !== pkgFile.content) {
        const before = pkgFile.content || "";
        projectStore.markAiChanged(pkgFile.path, before);
        projectStore.updateFileContent(pkgFile.path, sanitized);
        deterministicChanges.push({ path: pkgFile.path, before, after: sanitized, reason: "Removed invalid dependency entries" });
        deterministicEdits.push(`Removed invalid dependency entries: ${manifestRepair.removed.join(", ")}`);
        logEvent({
          logType: "ai-repair",
          level: "warning",
          message: `Removed ${manifestRepair.removed.length} invalid dependency manifest entr${manifestRepair.removed.length === 1 ? "y" : "ies"}`,
          stepName: pkgFile.path,
          meta: { method: "NORMALIZE", pathname: pkgFile.path, removed: manifestRepair.removed },
        });
      }
    }
  }

  const evtId = buildStore.pushAiEvent({
    op: "thinking",
    title: `AI Repair · ${opts.phaseName}`,
    detail: parsed!.title,
    status: "active",
  });
  buildStore.setThinkingCaption(`AI repairing ${opts.phaseName} error…`);

  let plan: RepairPlan | null = null;
  try {
    const { data, error } = await supabase.functions.invoke("ai-repair-build", {
      body: {
        errorCategory: parsed!.category,
        errorDetail: parsed!.detail,
        logs: logs.join("\n").slice(-24000),
        affectedFiles,
        packageJson,
        unresolvedImports: parsed!.unresolvedImports || [],
        enabledPlugins: Array.from(projectStore.enabledPlugins || []),
        model: opts.model || DEFAULT_REPAIR_MODEL,
        projectId: opts.projectId,
        runId: opts.runId,
      },
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    plan = data as RepairPlan;
  } catch (e: any) {
    buildStore.completeAiEvent(evtId, "error");
    toast.error(`AI repair failed: ${e.message || e}`);
    return { patched: false, summary: e.message || "AI repair failed", edits: [], changedFiles: [] };
  }

  const edits: string[] = [...deterministicEdits];
  const changedFiles: RepairOutcome["changedFiles"] = [...deterministicChanges];
  const suppliedPaths = new Set(affectedFiles.map((file) => file.path));

  // 1. Apply file edits
  for (const edit of plan.fileEdits || []) {
    if (!edit?.path || typeof edit.newContent !== "string") continue;
    const existing = findFile(edit.path);
    if (!existing || !suppliedPaths.has(existing.path)) continue;
    const oldContent = existing.content || "";
    if (oldContent === edit.newContent) continue;
    projectStore.markAiChanged(edit.path, oldContent);
    projectStore.updateFileContent(edit.path, edit.newContent);
    const beforeLines = oldContent.split("\n");
    const afterLines = edit.newContent.split("\n");
    const added = Math.max(0, afterLines.length - beforeLines.length);
    const removed = Math.max(0, beforeLines.length - afterLines.length);
    changedFiles.push({ path: existing.path, before: oldContent, after: edit.newContent, reason: edit.reason || "fix" });
    edits.push(`Patched ${edit.path} — ${edit.reason || "fix"}`);
    logEvent({ logType: "ai-repair", level: "info", message: `Patched ${edit.path} — ${edit.reason || "fix"}`, stepName: edit.path, meta: { method: "EDIT", pathname: edit.path } });
    buildStore.pushAiEvent({
      op: "edit",
      title: `Repaired ${edit.path}`,
      detail: edit.reason,
      status: "done",
      path: existing.path,
      oldContent,
      newContent: edit.newContent,
      added,
      removed,
    });
  }

  // 2. Apply package.json patch
  const packageBefore = pkgFile?.content || "";
  const addedDeps = applyPackageJsonPatch(plan.packageJsonPatch || {});
  if (addedDeps.length > 0) {
    const packageAfter = pkgFile?.content || packageBefore;
    if (pkgFile && packageAfter !== packageBefore) changedFiles.push({ path: pkgFile.path, before: packageBefore, after: packageAfter, reason: "Dependency repair" });
    edits.push(`Added to package.json: ${addedDeps.join(", ")}`);
    buildStore.pushAiEvent({
      op: "edit",
      title: `Added ${addedDeps.length} dependencies`,
      detail: addedDeps.join(", "),
      status: "done",
      path: pkgFile?.path || "package.json",
      oldContent: packageBefore,
      newContent: packageAfter,
    });
  }

  // 3. Apply build excludes (e.g. supabase/functions/**)
  const excluded = applyExcludeFromBuild(plan.excludeFromBuild || []);
  if (excluded.length > 0) {
    const viteFile = flatten(projectStore.files).find((file) => file.path === "vite.config.ts" || file.path === "vite.config.js");
    const originalViteFile = affectedFiles.find((file) => file.path === viteFile?.path);
    if (viteFile?.content && originalViteFile && viteFile.content !== originalViteFile.content) {
      changedFiles.push({ path: viteFile.path, before: originalViteFile.content, after: viteFile.content, reason: "Excluded server-only modules from the web build" });
      buildStore.pushAiEvent({
        op: "edit",
        title: `Repaired ${viteFile.path}`,
        detail: "Excluded server-only modules from the web build",
        status: "done",
        path: viteFile.path,
        oldContent: originalViteFile.content,
        newContent: viteFile.content,
      });
    }
    edits.push(`Excluded from web build: ${excluded.join(", ")}`);
    buildStore.pushAiEvent({
      op: "config",
      title: `Excluded ${excluded.length} pattern(s) from web build`,
      detail: excluded.join(", "),
      status: "done",
    });
  }

  buildStore.completeAiEvent(evtId, edits.length > 0 ? "done" : "error");

  if (edits.length === 0) {
    toast.warning("AI Repair could not apply any changes.", {
      description: plan.notes || "Returning original error.",
    });
    return { patched: false, summary: plan.notes || "No edits applied", edits: [], changedFiles: [] };
  }

  toast.success(`AI Repair applied ${edits.length} fix${edits.length === 1 ? "" : "es"}`, {
    description: plan.notes?.slice(0, 160) || "Retrying build phase…",
  });

  return { patched: true, summary: plan.notes || "", edits, changedFiles };
}
