/**
 * CPR Transform: Vite Alias Synchronizer.
 *
 * Syncs `resolve.alias` in a valid `vite.config.*` with tsconfig path mappings,
 * scoped to `appRoot` (works for nested roots like `frontend/` or `client/`).
 *
 * Prevents the classic "Rollup failed to resolve import '@/...'" build failure
 * where tsconfig declares the alias path mapping but Vite doesn't know about it.
 */

import type { CprFile } from "../types/index.ts";

export interface ViteAliasResult {
  synced: boolean;
  filePath?: string;
  patches: { path: string; content: string; reason: string }[];
  aliasesAdded: Record<string, string>;
  notes: string[];
}

const VITE_CONFIG_NAMES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.mts",
  "vite.config.cjs",
  "vite.config.cts",
] as const;

function stripJsonComments(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Extracts alias mappings from tsconfig.json or jsconfig.json in root.
 */
export function extractTsconfigAliases(
  files: CprFile[],
  root = "",
): Record<string, string> {
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  const aliases: Record<string, string> = {};

  const candidates = [
    `${prefix}tsconfig.json`,
    `${prefix}tsconfig.app.json`,
    `${prefix}jsconfig.json`,
  ];

  for (const p of candidates) {
    const file = files.find((f) => f.path === p);
    if (!file?.content) continue;
    try {
      const parsed = JSON.parse(stripJsonComments(file.content));
      const paths = parsed?.compilerOptions?.paths || parsed?.paths;
      if (paths && typeof paths === "object") {
        for (const [key, targets] of Object.entries(paths)) {
          if (!Array.isArray(targets) || !targets[0]) continue;
          const cleanKey = key.replace(/\/\*$/, "");
          const cleanTarget = String(targets[0]).replace(/\/\*$/, "");
          if (cleanKey && cleanTarget && !aliases[cleanKey]) {
            aliases[cleanKey] = cleanTarget;
          }
        }
      }
    } catch {
      // Ignore unparseable tsconfig
    }
  }

  // If no aliases in tsconfig, check if source code references `@/`
  if (Object.keys(aliases).length === 0) {
    const usesAt = files.some(
      (f) =>
        f.path.startsWith(`${prefix}src/`) &&
        /\.(tsx?|jsx?)$/.test(f.path) &&
        /from\s+["']@\/|import\(\s*["']@\//.test(f.content ?? ""),
    );
    if (usesAt) {
      aliases["@"] = "./src";
    }
  }

  return aliases;
}

/**
 * Checks if a given alias key (e.g. "@") is already declared in vite config content.
 */
export function viteConfigHasAlias(content: string, aliasKey: string): boolean {
  const escaped = aliasKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Matches:
  // alias: { "@": ... }
  // alias: { '@': ... }
  // alias: { @: ... }
  // find: "@", replacement: ...
  // find: '@', replacement: ...
  const patterns = [
    new RegExp(`["']${escaped}["']\\s*:`, "i"),
    new RegExp(`\\b${escaped}\\s*:`, "i"),
    new RegExp(`find\\s*:\\s*["']${escaped}["']`, "i"),
  ];
  return patterns.some((re) => re.test(content));
}

/**
 * Injects missing aliases into a vite.config.* file.
 */
export function injectViteAliases(
  source: string,
  aliasesToInject: Record<string, string>,
): { content: string; added: Record<string, string> } {
  let content = source;
  const added: Record<string, string> = {};

  const missing = Object.entries(aliasesToInject).filter(
    ([key]) => !viteConfigHasAlias(content, key),
  );
  if (missing.length === 0) {
    return { content: source, added: {} };
  }

  for (const [k, v] of missing) {
    added[k] = v;
  }

  const isCjs = /\bmodule\.exports\b|\brequire\s*\(/.test(content);

  // Check if path is imported
  const hasPath = /\bfrom\s+["'](?:node:)?path["']|\brequire\s*\(\s*["'](?:node:)?path["']\)/.test(content);
  const hasDirname = /\b__dirname\b/.test(content);
  const hasFileUrlToPath = /\bfileURLToPath\b/.test(content);

  // Prepare header polyfills if needed
  let header = "";
  if (!hasPath) {
    header += isCjs ? `const path = require("path");\n` : `import path from "path";\n`;
  }
  if (!isCjs && !hasDirname) {
    if (!hasFileUrlToPath) {
      header += `import { fileURLToPath } from "url";\n`;
    }
    header += `const __dirname = path.dirname(fileURLToPath(import.meta.url));\n`;
  }

  // Format the alias entries
  const aliasLines = Object.entries(added)
    .map(([key, target]) => `      "${key}": path.resolve(__dirname, "${target}"),`)
    .join("\n");

  // Case 1: resolve.alias block already exists
  const aliasBlockMatch = /\balias\s*:\s*\{/i.exec(content);
  if (aliasBlockMatch) {
    const insertIdx = aliasBlockMatch.index + aliasBlockMatch[0].length;
    content = content.slice(0, insertIdx) + "\n" + aliasLines + content.slice(insertIdx);
    if (header) content = header + content;
    return { content, added };
  }

  // Case 2: resolve block exists without alias
  const resolveBlockMatch = /\bresolve\s*:\s*\{/i.exec(content);
  if (resolveBlockMatch) {
    const insertIdx = resolveBlockMatch.index + resolveBlockMatch[0].length;
    const aliasBlock = `\n    alias: {\n${aliasLines}\n    },`;
    content = content.slice(0, insertIdx) + aliasBlock + content.slice(insertIdx);
    if (header) content = header + content;
    return { content, added };
  }

  // Case 3: inject resolve: { alias: { ... } } into defineConfig config object
  // Find where the config object begins:
  // e.g. defineConfig({
  // e.g. defineConfig(({ ... }) => ({
  // e.g. export default {
  const insertPoints = [
    /\bdefineConfig\s*\(\s*\{/g,
    /\bdefineConfig\s*\(\s*\([^)]*\)\s*=>\s*\(\{/g,
    /\bdefineConfig\s*\(\s*\w+\s*=>\s*\(\{/g,
    /\bexport\s+default\s*\{/g,
    /\bmodule\.exports\s*=\s*\{/g,
  ];

  let bestMatch: { index: number; length: number } | null = null;
  for (const re of insertPoints) {
    const m = re.exec(content);
    if (m && (bestMatch === null || m.index < bestMatch.index)) {
      bestMatch = { index: m.index, length: m[0].length };
    }
  }

  if (bestMatch) {
    const insertIdx = bestMatch.index + bestMatch.length;
    const resolveSnippet = `\n  resolve: {\n    alias: {\n${aliasLines}\n    },\n  },`;
    content = content.slice(0, insertIdx) + resolveSnippet + content.slice(insertIdx);
    if (header) content = header + content;
    return { content, added };
  }

  // If no standard config object matched, return unmodified
  return { content: source, added: {} };
}

/**
 * Main CPR transform: syncs resolve.alias in vite.config.* with tsconfig path mappings.
 */
export function syncViteAliases(
  files: CprFile[],
  root = "",
): ViteAliasResult {
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  const result: ViteAliasResult = {
    synced: false,
    patches: [],
    aliasesAdded: {},
    notes: [],
  };

  // 1. Extract aliases declared in tsconfig/jsconfig (or fallback `@` -> `./src`)
  const aliases = extractTsconfigAliases(files, root);
  if (Object.keys(aliases).length === 0) {
    return result;
  }

  // 2. Find vite.config.* in root
  const configCandidate = VITE_CONFIG_NAMES.map((name) => `${prefix}${name}`).find(
    (candPath) => files.some((f) => f.path === candPath && typeof f.content === "string"),
  );

  if (!configCandidate) {
    return result;
  }

  const configFile = files.find((f) => f.path === configCandidate);
  if (!configFile?.content) {
    return result;
  }

  // 3. Inject missing aliases
  const { content: updatedContent, added } = injectViteAliases(
    configFile.content,
    aliases,
  );

  if (Object.keys(added).length > 0 && updatedContent !== configFile.content) {
    result.synced = true;
    result.filePath = configFile.path;
    result.aliasesAdded = added;
    result.patches.push({
      path: configFile.path,
      content: updatedContent,
      reason: `Synced Vite resolve.alias with tsconfig paths: ${Object.keys(added).join(", ")}`,
    });
    result.notes.push(
      `Vite resolve.alias configured for: ${Object.entries(added).map(([k, v]) => `"${k}" → "${v}"`).join(", ")}`,
    );
  }

  return result;
}
