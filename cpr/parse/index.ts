/**
 * CPR â structuralising module-graph parsing.
 *
 * Regex scanning over raw source is fragile: commented-out imports, imports
 * inside template literals and dynamic specifiers all produce false readings.
 * This module strips non-code regions first and exposes a pluggable AST hook
 * so richer runtimes (the browser wizard, the Node verification runner) can
 * register a real parser â acorn, swc, esprima â without the shared CPR core
 * taking a runtime dependency.
 */

export type AstImportParser = (code: string, filename: string) => string[] | null;

let astParser: AstImportParser | null = null;

/** Registers a real AST parser. Returns the previously registered one. */
export function setAstParser(parser: AstImportParser | null): AstImportParser | null {
  const prev = astParser;
  astParser = parser;
  return prev;
}

export function hasAstParser(): boolean {
  return astParser !== null;
}

/**
 * Removes comments and the interior of template literals so scanning only ever
 * sees executable code. String literals are preserved because import
 * specifiers live inside them.
 */
export function stripNonCode(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "`") {
      out += '""';
      i++;
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          out += src[i];
          i++;
        }
        if (i < n) out += src[i];
        i++;
      }
      out += quote;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const SPECIFIER_PATTERNS = [
  /import\s+(?:[^'";]*?from\s+)?["']([^"']+)["']/g,
  /export\s+(?:[^'";]*?from\s+)?["']([^"']+)["']/g,
  /require\(\s*["']([^"']+)["']\s*\)/g,
  /import\(\s*["']([^"']+)["']\s*\)/g,
  /@import\s+["']([^"']+)["']/g,
];

/**
 * Returns every module specifier referenced by a file. Uses the registered AST
 * parser when available and falls back to comment-stripped pattern scanning.
 */
export function parseModuleSpecifiers(code: string, filename = "file.ts"): string[] {
  if (astParser) {
    try {
      const viaAst = astParser(code, filename);
      if (viaAst) return [...new Set(viaAst)];
    } catch {
      /* fall through to the resilient scanner */
    }
  }
  const clean = stripNonCode(code);
  const found = new Set<string>();
  for (const re of SPECIFIER_PATTERNS) {
    let m: RegExpExecArray | null;
    const rx = new RegExp(re.source, re.flags);
    while ((m = rx.exec(clean))) found.add(m[1]);
  }
  return [...found];
}

/**
 * Reads config-declared plugin/package references that never appear as ESM
 * imports â Tailwind/PostCSS plugin arrays, Angular builder options, Vite
 * plugin strings. These packages are real build inputs and must never be
 * treated as ghosts.
 */
export function parseConfigReferencedPackages(content: string): string[] {
  const clean = stripNonCode(content);
  const names = new Set<string>();
  const re = /["']((?:@[\w.-]+\/)?[a-z0-9][\w.-]*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const value = m[1];
    if (value.includes(" ") || value.startsWith(".") || value.startsWith("/")) continue;
    names.add(value);
  }
  return [...names];
}
