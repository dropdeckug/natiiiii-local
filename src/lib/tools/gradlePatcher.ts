/**
 * Deterministic Gradle patchers.
 * Handles dependency merging into android/app/build.gradle and value
 * patching in android/variables.gradle.
 */

export interface GradlePatchResult {
  content: string;
  addedDependencies: string[];
  appliedPlugins: string[];
  changedVariables: Record<string, string>;
}

/**
 * Add an implementation/api dependency to the dependencies { ... } block.
 * Idempotent — won't add the same coordinate twice.
 */
export function addGradleDependency(
  source: string,
  coordinate: string,
  config: "implementation" | "api" | "compileOnly" = "implementation"
): { content: string; added: boolean } {
  if (source.includes(coordinate)) return { content: source, added: false };

  // Find dependencies { ... } block
  const depBlockMatch = source.match(/dependencies\s*\{([\s\S]*?)\n\}/);
  if (!depBlockMatch) {
    // Append a new block
    return {
      content: `${source.trimEnd()}\n\ndependencies {\n    ${config} "${coordinate}"\n}\n`,
      added: true,
    };
  }
  const newBlock = depBlockMatch[0].replace(/\n\}$/, `\n    ${config} "${coordinate}"\n}`);
  return { content: source.replace(depBlockMatch[0], newBlock), added: true };
}

/** Apply a plugin via `apply plugin: '...'` if not already applied. */
export function applyGradlePlugin(source: string, pluginId: string): { content: string; added: boolean } {
  const applyLine = `apply plugin: '${pluginId}'`;
  if (source.includes(applyLine) || source.includes(`id '${pluginId}'`) || source.includes(`id("${pluginId}")`)) {
    return { content: source, added: false };
  }
  return { content: `${source.trimEnd()}\n${applyLine}\n`, added: true };
}

/**
 * Patch a key in android/variables.gradle (e.g. compileSdkVersion = 35).
 * Adds the line if missing.
 */
export function patchVariableGradle(
  source: string,
  key: string,
  value: string | number
): { content: string; previous?: string } {
  const re = new RegExp(`(${key}\\s*=\\s*)(['"]?[^'"\\n]+['"]?)`);
  const match = source.match(re);
  if (match) {
    if (match[2] === String(value)) return { content: source, previous: match[2] };
    return { content: source.replace(re, `$1${value}`), previous: match[2] };
  }
  // Append at end of ext block if it exists, otherwise at file end
  const extMatch = source.match(/ext\s*\{([\s\S]*?)\n\}/);
  if (extMatch) {
    const newBlock = extMatch[0].replace(/\n\}$/, `\n    ${key} = ${value}\n}`);
    return { content: source.replace(extMatch[0], newBlock) };
  }
  return { content: `${source.trimEnd()}\next {\n    ${key} = ${value}\n}\n` };
}

/** Bump heap size in gradle.properties (idempotent). */
export function patchGradleProperties(source: string, key: string, value: string): string {
  const re = new RegExp(`^${key.replace(/\./g, "\\.")}\\s*=.*$`, "m");
  if (re.test(source)) return source.replace(re, `${key}=${value}`);
  return `${source.trimEnd()}\n${key}=${value}\n`;
}
