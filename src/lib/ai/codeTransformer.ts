/**
 * AI Code Transformer
 * Uses AI to analyze project entry points and safely inject
 * Capacitor plugin initialization code based on the detected framework.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ProjectFile } from "@/stores/projectStore";
import { planPluginInjections, applyInjectionPlan, type InjectionPlan } from "@/lib/tools/pluginCodeInjector";

export interface TransformResult {
  success: boolean;
  plan: InjectionPlan | null;
  modifiedFiles: string[];
  aiSuggestions: string[];
  errors: string[];
}

/**
 * Detect the framework from project files (React, Vue, Angular, Svelte, etc.)
 */
function detectFramework(files: ProjectFile[]): string {
  const flat = flattenFiles(files);
  const pkgFile = flat.find(f => f.name === "package.json");
  if (!pkgFile?.content) return "unknown";

  try {
    const pkg = JSON.parse(pkgFile.content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["react"]) return "react";
    if (deps["vue"]) return "vue";
    if (deps["@angular/core"]) return "angular";
    if (deps["svelte"]) return "svelte";
  } catch { /* ignore */ }

  return "unknown";
}

function flattenFiles(files: ProjectFile[]): ProjectFile[] {
  const result: ProjectFile[] = [];
  const walk = (nodes: ProjectFile[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(files);
  return result;
}

/**
 * Run the full AI code transformation pipeline:
 * 1. Detect framework
 * 2. Plan injections
 * 3. Apply injections to in-memory file tree
 * 4. Optionally call AI for advanced analysis
 */
export async function transformProjectCode(
  files: ProjectFile[],
  pluginIds: string[],
  engine: string,
  updateFileContent: (path: string, content: string) => void,
  options: { useAI?: boolean; projectId?: string } = {}
): Promise<TransformResult> {
  const errors: string[] = [];
  const aiSuggestions: string[] = [];

  if (pluginIds.length === 0) {
    return { success: true, plan: null, modifiedFiles: [], aiSuggestions: [], errors: [] };
  }

  // Flatten files for the injector
  const flat = flattenFiles(files);
  const sourceFiles = flat
    .filter(f => f.type === "file" && !f.isBinary)
    .map(f => ({ path: f.path, content: f.content }));

  // Plan injections
  const plan = planPluginInjections(sourceFiles, pluginIds, engine);

  if (plan.warnings.length > 0) {
    errors.push(...plan.warnings);
  }

  // Apply injections to the in-memory file tree
  const modifiedFiles = applyInjectionPlan(plan, updateFileContent);

  // If AI analysis is enabled, call the edge function for advanced suggestions
  if (options.useAI && options.projectId) {
    try {
      const framework = detectFramework(files);
      const { data: aiResult } = await supabase.functions.invoke("forge-ai-chat", {
        body: {
          projectId: options.projectId,
          message: `Analyze this ${framework} project for Capacitor plugin integration. Plugins: ${pluginIds.join(", ")}. Suggest any additional setup steps needed.`,
          role: "system",
        },
      });

      if (aiResult?.reply) {
        aiSuggestions.push(aiResult.reply);
      }
    } catch (err) {
      console.error("AI analysis failed (non-blocking):", err);
    }
  }

  return {
    success: errors.filter(e => !e.includes("could not be resolved")).length === 0,
    plan,
    modifiedFiles,
    aiSuggestions,
    errors,
  };
}

/**
 * Validate that injected code doesn't break imports.
 * Basic check — looks for obvious syntax issues.
 */
export function validateInjection(content: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for duplicate imports
  const importLines = content.split("\n").filter(l => l.trim().startsWith("import "));
  const importSet = new Set<string>();
  for (const line of importLines) {
    const normalized = line.trim();
    if (importSet.has(normalized)) {
      issues.push(`Duplicate import: ${normalized}`);
    }
    importSet.add(normalized);
  }

  // Check for unclosed brackets (basic)
  let braceCount = 0;
  let parenCount = 0;
  for (const char of content) {
    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    if (char === "(") parenCount++;
    if (char === ")") parenCount--;
  }
  if (braceCount !== 0) issues.push(`Mismatched braces (${braceCount > 0 ? "unclosed" : "extra closing"})`);
  if (parenCount !== 0) issues.push(`Mismatched parentheses (${parenCount > 0 ? "unclosed" : "extra closing"})`);

  return { valid: issues.length === 0, issues };
}
