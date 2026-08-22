/**
 * Module System Normalization (CPR).
 *
 * Runs after dependency installation and after TypeScript configuration
 * validation, and before the build command. It resolves the class of failures
 * caused by ES Module vs CommonJS mismatches, extensionless relative imports
 * and Create React App template artefacts that have no meaning in a Vite build.
 *
 * Runtime-agnostic: it operates purely on the in-memory CPR file list.
 */

import type { CprFile, ModuleSystemResult } from "../types/index.ts";

export const RESOLVE_EXTENSIONS = [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"];

/** CRA-only imports that are always safe to strip from a Vite entry point. */
const CRA_ARTIFACTS = ["reportWebVitals", "setupTests", "react-app-polyfill"] as const;

const VITE_CONFIG_FILES = [
  "vite.config.js",
  "vite.config.ts",
  "vite.config.mjs",
  "vite.config.mts",
  "vite.config.cjs",
  "vite.config.cts",
] as const;

/** Optional editor-only plugins must not make the production config loader require ESM. */
const OPTIONAL_VITE_PLUGIN_IMPORTS = ["lovable-tagger"] as const;

export function emptyModuleSystemResult(): ModuleSystemResult {
  return {
    ran: false,
    typeModuleRemoved: false,
    craArtifactsRemoved: [],
    extensionlessImportsFixed: 0,
    filesModified: [],
    unresolvableImports: [],
    configsConverted: [],
    patches: [],
    deletions: [],
    notes: [],
  };
}

function stripPrefix(path: string, prefix: string): string {
  return prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/** Resolves the project entry point from index.html, with sensible fallbacks. */
export function findEntryPoint(files: CprFile[], root = ""): CprFile | null {
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  const html = files.find((f) => f.path === `${prefix}index.html`);
  if (html?.content) {
    const m = /<script[^>]+src=["']([^"']+)["']/i.exec(html.content);
    if (m) {
      const rel = m[1].replace(/^[./]+/, "");
      const hit = files.find((f) => stripPrefix(f.path, prefix) === rel);
      if (hit?.content) return hit;
    }
  }
  for (const candidate of ["src/index.tsx", "src/index.jsx", "src/index.ts", "src/index.js", "src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js"]) {
    const hit = files.find((f) => f.path === `${prefix}${candidate}`);
    if (hit?.content) return hit;
  }
  return null;
}

/* ------------------------------------------------------------------ fix 2 */

/** Removes CRA template imports and their call sites from the entry point. */
export function stripCraArtifacts(source: string): { content: string; removed: string[] } {
  let out = source;
  const removed: string[] = [];

  for (const name of CRA_ARTIFACTS) {
    const importLine = new RegExp(
      `^[ \\t]*import[^\\n;]*['"][^'"\\n]*${name}[^'"\\n]*['"][^\\n]*;?[ \\t]*\\r?\\n?`,
      "gmi",
    );
    if (importLine.test(out)) {
      out = out.replace(importLine, "");
      removed.push(name);
    }
  }

  if (removed.includes("reportWebVitals")) {
    // `reportWebVitals();` or `reportWebVitals(console.log);` — single statement.
    out = out.replace(/^[ \t]*reportWebVitals\s*\([^)]*\)\s*;?[ \t]*\r?\n?/gm, "");
  }

  return { content: out, removed };
}

/* ------------------------------------------------------------------ fix 4 */

const IMPORT_SPEC_RE =
  /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(["'])(\.\.?\/[^"'\n]+)\2/g;

function hasExtension(spec: string): boolean {
  return /\.(mjs|cjs|js|jsx|ts|tsx|json|css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|woff2?|mp4|txt|md|html)$/i.test(spec);
}

function resolveDir(filePath: string): string {
  const idx = filePath.lastIndexOf("/");
  return idx === -1 ? "" : filePath.slice(0, idx);
}

function normalizePath(base: string, rel: string): string {
  const parts = `${base}/${rel}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

/**
 * Adds the real on-disk extension to every extensionless relative import in a
 * file. Only the specifier text changes; nothing else is touched.
 */
export function fixExtensionlessImports(
  file: CprFile,
  existing: Set<string>,
): { content: string; fixed: number; unresolvable: string[] } {
  const src = file.content ?? "";
  const dir = resolveDir(file.path);
  const unresolvable: string[] = [];
  let fixed = 0;

  const content = src.replace(IMPORT_SPEC_RE, (match, head, quote, spec) => {
    if (hasExtension(spec)) return match;
    const target = normalizePath(dir, spec);
    for (const ext of [".js", ".ts", ".jsx", ".tsx", ".json"]) {
      if (existing.has(`${target}${ext}`)) {
        fixed++;
        return `${head}${quote}${spec}${ext}${quote}`;
      }
    }
    for (const ext of [".js", ".ts", ".jsx", ".tsx"]) {
      // Directory import → its barrel file. Left as-is (Vite resolves it), but
      // recorded so the report can show it.
      if (existing.has(`${target}/index${ext}`)) return match;
    }
    unresolvable.push(`${stripPrefix(file.path, "")} → ${spec}`);
    return match;
  });

  return { content, fixed, unresolvable };
}

/* ------------------------------------------------------------------ fix 5 */

/** Converts a CommonJS config file to ES Module syntax. */
export function toEsmConfig(source: string): string {
  let out = source.replace(/module\.exports\s*=\s*/g, "export default ");
  out = out.replace(
    /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*(["'][^"']+["'])\s*\)\s*;?/g,
    "import $1 from $2;",
  );
  out = out.replace(
    /(?:const|let|var)\s+\{([^}]+)\}\s*=\s*require\(\s*(["'][^"']+["'])\s*\)\s*;?/g,
    "import {$1} from $2;",
  );
  return out;
}

function matchingBrace(source: string, open: number): number {
  let depth = 0;
  let quote = "";
  for (let index = open; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (char === "\\" ) index++;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth++;
    if (char === "}" && --depth === 0) return index;
  }
  return -1;
}

/** Removes optional ESM-only Vite plugins and duplicate build options. */
export function normalizeViteConfig(source: string): { content: string; changed: boolean; notes: string[] } {
  let content = source;
  const notes: string[] = [];

  for (const plugin of OPTIONAL_VITE_PLUGIN_IMPORTS) {
    const importRe = new RegExp(`^[ \\t]*import[^\\n;]*from[ \\t]*["']${plugin}["'][^\\n]*;?[ \\t]*\\r?\\n?`, "gmi");
    if (!importRe.test(content)) continue;
    content = content.replace(importRe, "");
    content = content.replace(new RegExp(`(?:mode[ \\t]*===[ \\t]*["']development["'][ \\t]*&&[ \\t]*)?componentTagger\\s*\\([^)]*\\)[ \\t]*,?`, "g"), "");
    content = content.replace(/,\s*,/g, ",").replace(/\[\s*,/g, "[").replace(/,\s*\]/g, "]");
    notes.push(`${plugin} removed from Vite config because it is an optional ESM-only development plugin.`);
  }

  const buildStarts = [...content.matchAll(/\bbuild\s*:\s*\{/g)].map((match) => match.index ?? -1).filter((index) => index >= 0);
  if (buildStarts.length > 1) {
    const firstOpen = content.indexOf("{", buildStarts[0]);
    const firstClose = matchingBrace(content, firstOpen);
    const secondOpen = content.indexOf("{", buildStarts[1]);
    const secondClose = matchingBrace(content, secondOpen);
    if (firstClose >= 0 && secondClose >= 0) {
      const secondKey = buildStarts[1];
      const afterSecond = content[secondClose + 1] === "," ? secondClose + 2 : secondClose + 1;
      content = content.slice(0, secondKey).replace(/,?\s*$/, "") + content.slice(afterSecond);
      notes.push("Duplicate Vite build options merged into one build block.");
    }
  }

  return { content, changed: content !== source, notes };
}

/* --------------------------------------------------------------- the step */

export interface ModuleSystemOptions {
  root?: string;
  /** Set false to keep `type: module` and rely on extension fixing instead. */
  removeTypeModule?: boolean;
}

/**
 * Runs every module-system fix over the canonical workspace. Never throws —
 * on internal failure the caller receives an empty result and the build simply
 * proceeds unmodified.
 */
export function normalizeModuleSystem(
  files: CprFile[],
  packageJson: Record<string, unknown>,
  opts: ModuleSystemOptions = {},
): ModuleSystemResult {
  const result = emptyModuleSystemResult();
  try {
    const root = opts.root ?? "";
    const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
    result.ran = true;

    const existing = new Set(files.map((f) => f.path));
    const push = (path: string, content: string, reason: string) => {
      const hit = result.patches.find((p) => p.path === path);
      if (hit) hit.content = content;
      else result.patches.push({ path, content, reason });
      if (!result.filesModified.includes(path)) result.filesModified.push(path);
    };

    /* -- fix 1: type: module ------------------------------------------- */
    const removeTypeModule = opts.removeTypeModule !== false;
    if (removeTypeModule && packageJson?.type === "module") {
      delete (packageJson as Record<string, unknown>).type;
      result.typeModuleRemoved = true;
      result.notes.push("`type: \"module\"` removed — Vite handles ES modules natively.");
    }
    const stillEsmPackage = packageJson?.type === "module";

    /* -- fix 2: CRA artefacts ------------------------------------------ */
    const entry = findEntryPoint(files, root);
    if (entry?.content) {
      const { content, removed } = stripCraArtifacts(entry.content);
      if (removed.length) {
        push(entry.path, content, "Removed Create React App template imports with no Vite equivalent");
        result.craArtifactsRemoved = removed;
      }
    }

    const deps = {
      ...(packageJson?.dependencies as Record<string, string> ?? {}),
      ...(packageJson?.devDependencies as Record<string, string> ?? {}),
    };
    for (const ext of [".js", ".ts", ".jsx", ".tsx"]) {
      const rw = files.find((f) => f.path === `${prefix}src/reportWebVitals${ext}`);
      if (rw && /from\s+["']web-vitals["']|require\(\s*["']web-vitals["']/.test(rw.content ?? "")) {
        if (!deps["web-vitals"]) {
          result.deletions.push(rw.path);
          if (!result.craArtifactsRemoved.includes("reportWebVitals")) {
            result.craArtifactsRemoved.push("reportWebVitals");
          }
          result.notes.push("`reportWebVitals` deleted — it imports `web-vitals`, which is not a declared dependency.");
        }
      }
    }

    /* -- fix 5: config files to ESM ------------------------------------ */
    if (stillEsmPackage) {
      for (const name of ["postcss.config.js", "tailwind.config.js", "postcss.config.cjs", "tailwind.config.cjs"]) {
        const cfg = files.find((f) => f.path === `${prefix}${name}`);
        if (cfg?.content && /module\.exports\s*=/.test(cfg.content)) {
          push(cfg.path, toEsmConfig(cfg.content), "Converted CommonJS config to ES Module syntax for `type: module`");
          result.configsConverted.push(name);
        }
      }
    }

    /* -- fix 6: Vite config loader compatibility ------------------------ */
    for (const name of VITE_CONFIG_FILES) {
      const cfg = files.find((f) => f.path === `${prefix}${name}`);
      if (!cfg?.content) continue;
      const normalized = normalizeViteConfig(result.patches.find((p) => p.path === cfg.path)?.content ?? cfg.content);
      if (normalized.changed) {
        push(cfg.path, normalized.content, "Removed ESM-only optional Vite plugins and normalized duplicate build options");
        result.notes.push(...normalized.notes);
      }
    }

    /* -- fix 4: extensionless relative imports -------------------------- */
    const sourceFiles = files.filter(
      (f) =>
        f.path.startsWith(`${prefix}src/`) &&
        !f.isBinary &&
        typeof f.content === "string" &&
        /\.(m?js|jsx|ts|tsx)$/.test(f.path) &&
        !result.deletions.includes(f.path),
    );
    for (const file of sourceFiles) {
      const base = result.patches.find((p) => p.path === file.path)?.content ?? file.content ?? "";
      const scan = fixExtensionlessImports({ ...file, content: base }, existing);
      result.unresolvableImports.push(...scan.unresolvable);
      if (scan.fixed > 0 && stillEsmPackage) {
        result.extensionlessImportsFixed += scan.fixed;
        push(file.path, scan.content, "Added explicit file extensions to relative imports for ES Module resolution");
      }
    }
    if (!stillEsmPackage && result.unresolvableImports.length === 0) {
      result.notes.push("Extension rewriting was unnecessary — Vite resolves extensionless imports via `resolve.extensions`.");
    }
  } catch (err) {
    result.notes.push(
      `Module system normalization error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return result;
}
