/**
 * Deterministic patcher for Android native files.
 * Used by the agent to safely modify MainActivity, capacitor.config, and other
 * sensitive native files without relying on free-form LLM text replacement.
 */

export interface MainActivityPatchResult {
  content: string;
  addedImports: string[];
  addedRegistrations: string[];
  alreadyPresent: string[];
}

/**
 * Add `import` lines + `registerPlugin(...)` calls inside the
 * Capacitor BridgeActivity-derived `onCreate` block of MainActivity.java.
 * Idempotent — duplicate imports/registrations are skipped.
 */
export function patchMainActivityJava(
  source: string,
  imports: string[],
  registrations: string[]
): MainActivityPatchResult {
  let content = source;
  const addedImports: string[] = [];
  const addedRegistrations: string[] = [];
  const alreadyPresent: string[] = [];

  // 1. Insert imports right after the package declaration
  for (const imp of imports) {
    const importLine = imp.trim().endsWith(";") ? imp.trim() : imp.trim() + ";";
    if (content.includes(importLine)) { alreadyPresent.push(importLine); continue; }
    const packageMatch = content.match(/(package\s+[^;]+;\s*)/);
    if (packageMatch) {
      content = content.replace(packageMatch[1], `${packageMatch[1]}\n${importLine}\n`);
    } else {
      content = `${importLine}\n${content}`;
    }
    addedImports.push(importLine);
  }

  // 2. Insert registrations inside onCreate(...) { ... }
  if (registrations.length > 0) {
    const onCreateMatch = content.match(/(onCreate\s*\([^)]*\)\s*\{)([\s\S]*?super\.onCreate\([^)]*\);)/);
    if (onCreateMatch) {
      let block = onCreateMatch[0];
      for (const reg of registrations) {
        const line = reg.trim().endsWith(";") ? reg.trim() : reg.trim() + ";";
        if (block.includes(line) || content.includes(line)) {
          alreadyPresent.push(line);
          continue;
        }
        block = block.replace(onCreateMatch[2], `${onCreateMatch[2]}\n        ${line}`);
        addedRegistrations.push(line);
      }
      content = content.replace(onCreateMatch[0], block);
    }
  }

  return { content, addedImports, addedRegistrations, alreadyPresent };
}

/**
 * Merge plugin entries into capacitor.config.json.
 * Preserves existing keys.
 */
export function mergeCapacitorConfig(
  source: string,
  pluginConfig: Record<string, unknown>
): { content: string; merged: string[] } {
  const merged: string[] = [];
  let cfg: Record<string, any> = {};
  try { cfg = JSON.parse(source); } catch { cfg = {}; }
  cfg.plugins = cfg.plugins || {};
  for (const [k, v] of Object.entries(pluginConfig)) {
    if (JSON.stringify(cfg.plugins[k]) !== JSON.stringify(v)) {
      cfg.plugins[k] = v;
      merged.push(k);
    }
  }
  return { content: JSON.stringify(cfg, null, 2) + "\n", merged };
}

/**
 * Validate XML well-formedness (lightweight — checks balanced tags).
 * Returns true if no obviously broken structure detected.
 */
export function validateXmlBalanced(xml: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const tagRegex = /<\/?([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(xml)) !== null) {
    const full = match[0];
    const name = match[1];
    const selfClosing = match[2] === "/" || full.endsWith("/>");
    if (full.startsWith("</")) {
      const last = stack.pop();
      if (last !== name) {
        issues.push(`Mismatched closing tag </${name}> (expected </${last || "?"}>).`);
      }
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  if (stack.length > 0) issues.push(`Unclosed tags: ${stack.join(", ")}`);
  return { valid: issues.length === 0, issues };
}
