/**
 * TOOL 9: Build Error Parser
 * Classifies Gradle/npm/Capacitor build errors into actionable categories.
 * Used by both the edge function (server-side) and the UI (client-side).
 */

export interface ParsedBuildError {
  category:
    | "aar-metadata"
    | "dependency"
    | "manifest-merge"
    | "compilation"
    | "oom"
    | "missing-module"
    | "gradle"
    | "capacitor"
    | "npm"
    | "ts-error"
    | "duplicate-import"
    | "syntax"
    | "vite-config"
    | "wrong-export"
    | "deno-specifier"
    | "unknown";
  /** Structured (specifier, filePath) pairs extracted from "Remove or install:" blocks. */
  unresolvedImports?: { specifier: string; filePath: string }[];
  title: string;
  detail: string;
  suggestedFix: string;
  severity: "blocker" | "error" | "warning";
  autoFixable: boolean;
  /** Path of the offending file when the parser can extract it. */
  filePath?: string;
}

const ERROR_PATTERNS: {
  pattern: RegExp;
  category: ParsedBuildError["category"];
  title: string;
  suggestedFix: string;
  autoFixable: boolean;
}[] = [
  {
    pattern: /Remove or install:[\s\S]*?(?:npm:|https:)/i,
    category: "deno-specifier",
    title: "Unresolved Deno-style import specifiers (npm: / https:)",
    suggestedFix: "Rewrite npm:/https: imports to bare specifiers, install missing packages, or exclude Deno-only files (supabase/functions/**) from the web build.",
    autoFixable: true,
  },
  {
    pattern: /checkDebugAarMetadata|AAR metadata|compileSdk of at least (\d+)/i,
    category: "aar-metadata",
    title: "AAR Metadata: compileSdk version too low",
    suggestedFix: "Update compileSdk in variables.gradle to match the required version. Our system auto-patches this.",
    autoFixable: true,
  },
  {
    pattern: /ERESOLVE|npm ERR! peer dep|peer dependency|could not resolve dependency/i,
    category: "dependency",
    title: "Dependency resolution conflict",
    suggestedFix: "Use --legacy-peer-deps flag or update conflicting package versions in package.json.",
    autoFixable: true,
  },
  {
    pattern: /Cannot find module|Module not found|Cannot resolve|failed to resolve import|Rollup failed to resolve import/i,
    category: "missing-module",
    title: "Missing JavaScript module",
    suggestedFix: "Ensure all imports exist and their packages are listed in package.json dependencies.",
    autoFixable: true,
  },
  {
    pattern: /has no exported member|does not provide an export named|is not exported from/i,
    category: "wrong-export",
    title: "Imported symbol does not exist in module",
    suggestedFix: "Check the named import — the package does not export that symbol. Update the import to a valid export or correct the package version.",
    autoFixable: true,
  },
  {
    pattern: /Duplicate identifier|already declared|has already been declared/i,
    category: "duplicate-import",
    title: "Duplicate import or identifier",
    suggestedFix: "Remove the duplicate import line — the identifier is already defined in the file.",
    autoFixable: true,
  },
  {
    pattern: /TS\d{4}|Type '.+' is not assignable to type|Property '.+' does not exist on type/i,
    category: "ts-error",
    title: "TypeScript type error",
    suggestedFix: "Fix the TypeScript error in the indicated file. Check types, optional properties, and union members.",
    autoFixable: true,
  },
  {
    pattern: /Unexpected token|Unterminated|SyntaxError/i,
    category: "syntax",
    title: "JavaScript/TypeScript syntax error",
    suggestedFix: "A patched file has invalid syntax — re-read the file and reapply a clean edit.",
    autoFixable: true,
  },
  {
    pattern: /vite\.config|Failed to resolve plugin|Invalid Vite config/i,
    category: "vite-config",
    title: "Vite configuration error",
    suggestedFix: "Validate vite.config.ts — a plugin or option may be missing or misconfigured.",
    autoFixable: false,
  },
  {
    pattern: /Manifest merger failed|manifest merger/i,
    category: "manifest-merge",
    title: "Android Manifest merge conflict",
    suggestedFix: "Add tools:replace attributes in AndroidManifest.xml to resolve conflicting entries from plugins.",
    autoFixable: false,
  },
  {
    pattern: /OutOfMemoryError|out of memory|GC overhead/i,
    category: "oom",
    title: "Out of memory during build",
    suggestedFix: "Increase Gradle heap size: org.gradle.jvmargs=-Xmx4g in gradle.properties.",
    autoFixable: true,
  },
  {
    pattern: /bcprov-jdk|bouncycastle|Failed to create Jar file|Failed to process the entry/i,
    category: "gradle",
    title: "Gradle JAR cache corruption (BouncyCastle)",
    suggestedFix: "Clear Gradle cache (rm -rf ~/.gradle/caches/jars-9) and rebuild. This has been auto-fixed in the workflow.",
    autoFixable: true,
  },
  {
    pattern: /npm ERR! 404|E404|package.*not found in registry/i,
    category: "npm",
    title: "npm package not found (404)",
    suggestedFix: "One or more packages don't exist on npm. Check plugin names and remove any invalid ones.",
    autoFixable: false,
  },
  {
    pattern: /cap init|cap add|capacitor\.config/i,
    category: "capacitor",
    title: "Capacitor initialization error",
    suggestedFix: "Ensure your project has a valid package.json and a web output directory (dist/build/www).",
    autoFixable: false,
  },
  {
    pattern: /npm ERR!/i,
    category: "npm",
    title: "npm installation error",
    suggestedFix: "Check package.json for invalid dependencies or private registry references.",
    autoFixable: false,
  },
  {
    pattern: /BUILD FAILED|FAILURE: Build failed/i,
    category: "gradle",
    title: "Gradle build failed",
    suggestedFix: "Check the full build logs for the specific Gradle error message.",
    autoFixable: false,
  },
];

/** Try to extract a file path from a TypeScript/Vite/Webpack error message. */
function extractFilePath(text: string): string | undefined {
  const m =
    text.match(/([\w./-]+\.(?:tsx?|jsx?|json|vue|svelte)):\d+/) ||
    text.match(/in ([\w./-]+\.(?:tsx?|jsx?|json|vue|svelte))/) ||
    text.match(/from ["']([^"']+\.(?:tsx?|jsx?|json|vue|svelte))["']/);
  return m ? m[1] : undefined;
}

/** Extract `specifier (filePath)` pairs from a "Remove or install:" / "Unresolved imports:" block. */
function extractUnresolvedImports(text: string): { specifier: string; filePath: string }[] {
  const out: { specifier: string; filePath: string }[] = [];
  // Pattern: "npm:foo@1.2.3 (path/to/file.tsx)" or "https://esm.sh/x (path/to/file.ts)" or "foo (path)"
  const re = /((?:npm:|https?:\/\/|@?[\w./-]+))\s*\(([^)\n]+\.(?:tsx?|jsx?|mjs|cjs))\)/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(text)) !== null) {
    const spec = m[1].trim().replace(/[,]+$/, "");
    const file = m[2].trim();
    const key = `${spec}|${file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ specifier: spec, filePath: file });
  }
  // Vite/Rollup: failed to resolve import "pkg" from "/workspace/src/file.ts".
  const viteRe = /(?:failed to resolve import|Rollup failed to resolve import)\s+["']([^"']+)["']\s+from\s+["']([^"']+\.(?:tsx?|jsx?|mjs|cjs|vue|svelte))["']/gi;
  while ((m = viteRe.exec(text)) !== null) {
    const spec = m[1].trim();
    const file = m[2].replace(/^.*?\/(src\/)/, "$1");
    const key = `${spec}|${file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ specifier: spec, filePath: file });
  }
  return out;
}

export function parseBuildError(logs: string[], error?: string): ParsedBuildError | null {
  const allText = [error || "", ...logs].join("\n");
  if (!allText.trim()) return null;

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(allText)) {
      const match = allText.match(pattern.pattern);
      const detail = match ? match[0] : "";
      const unresolved = extractUnresolvedImports(allText);

      return {
        category: pattern.category,
        title: pattern.title,
        detail,
        suggestedFix: pattern.suggestedFix,
        severity: "blocker",
        autoFixable: pattern.autoFixable,
        filePath: extractFilePath(allText),
        unresolvedImports: unresolved.length > 0 ? unresolved : undefined,
      };
    }
  }

  if (error) {
    return {
      category: "unknown",
      title: "Build failed",
      detail: error,
      suggestedFix: "Check the build logs for details.",
      severity: "error",
      autoFixable: false,
      filePath: extractFilePath(error),
    };
  }

  return null;
}

export function parsedErrorToLogs(parsed: ParsedBuildError): string[] {
  return [
    `Error type: ${parsed.title}`,
    `Category: ${parsed.category}`,
    `Detail: ${parsed.detail}`,
    `Fix: ${parsed.suggestedFix}`,
    parsed.autoFixable ? "This error can be auto-fixed by our system." : "Manual intervention may be needed.",
  ];
}
