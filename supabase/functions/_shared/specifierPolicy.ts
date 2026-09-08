/**
 * Authoritative specifier policy and package name resolution.
 * Single source of truth across CPR phases, runner scripts, and platform classifiers.
 *
 * Guarantees:
 * - Alias imports (@/, ~/, #, $/) are NEVER misidentified as npm packages
 * - Built-in Node modules and protocol specifiers (node:, virtual:, data:, http:) are rejected
 * - Relative and absolute filesystem paths are rejected
 * - Scoped and unscoped packages are accurately parsed and validated against strict npm naming rules
 */

export const ALIAS_PREFIXES = ["@/", "~/", "#", "$/", "~"] as const;

export const NODE_BUILTINS: ReadonlySet<string> = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);

/**
 * Returns true if the specifier is an alias (e.g. `@/components/Foo`, `~/utils`, `#app`).
 * Scoped packages (`@scope/package`) are NOT aliases and return false.
 */
export function isAliasSpecifier(spec: string | null | undefined): boolean {
  if (!spec || typeof spec !== "string") return false;
  const trimmed = spec.trim();
  if (trimmed.startsWith("@/")) return true;
  if (trimmed.startsWith("~/")) return true;
  if (trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("$/")) return true;
  if (trimmed.startsWith("~")) return true;
  return false;
}

/**
 * Returns true if the specifier is a builtin module, protocol, or relative/absolute path.
 */
export function isBuiltinOrProtocolSpecifier(spec: string | null | undefined): boolean {
  if (!spec || typeof spec !== "string") return false;
  const trimmed = spec.trim();
  if (trimmed.startsWith(".") || trimmed.startsWith("/")) return true;
  if (/^(node|virtual|data|https?|file):/i.test(trimmed)) return true;
  const bare = trimmed.replace(/^npm:/, "").split("/")[0];
  if (NODE_BUILTINS.has(bare)) return true;
  return false;
}

/**
 * Extracts a normalized, valid npm package name from an import specifier.
 * Returns null if the specifier is:
 * - an alias (@/, ~/, #, $/)
 * - a relative path (./, ../, /)
 * - a built-in module (fs, path, etc. or node:*)
 * - a protocol URL (http:, https:, data:, virtual:)
 * - an invalid or malformed npm package name
 */
export function packageFromSpecifier(spec: string | null | undefined): string | null {
  if (!spec || typeof spec !== "string") return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;

  // 1. Explicit alias check
  if (isAliasSpecifier(trimmed)) return null;

  // 2. Relative or absolute filesystem paths
  if (trimmed.startsWith(".") || trimmed.startsWith("/")) return null;

  // 3. Virtual, data, http(s), or file protocols
  if (/^(virtual|data|https?|file):/i.test(trimmed)) return null;

  // 4. Node protocol
  if (trimmed.startsWith("node:")) return null;

  // Strip npm: prefix if present (e.g. Deno / Yarn specifier: npm:lodash@^4)
  const cleaned = trimmed.replace(/^npm:/, "");

  // 5. Scoped vs unscoped package
  const parts = cleaned.split("/");
  let packageName: string;

  if (cleaned.startsWith("@")) {
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return null; // Lone '@' or '@scope' without package name
    }
    if (parts[0] === "@") return null;
    packageName = `${parts[0]}/${parts[1]}`;
  } else {
    packageName = parts[0];
  }

  // Strip version suffix if present: e.g. `lodash@^4.17.21` or `@scope/pkg@1.0.0`
  if (packageName.startsWith("@")) {
    const scope = parts[0];
    const rest = (parts[1] || "").split("@")[0];
    if (!rest) return null;
    packageName = `${scope}/${rest}`;
  } else {
    packageName = packageName.split("@")[0];
  }

  if (!packageName || packageName.length > 214) return null;

  // Built-in check
  if (NODE_BUILTINS.has(packageName)) return null;

  // Strict npm package name regex:
  // - scoped: @[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*
  // - unscoped: [a-z0-9-~][a-z0-9-._~]*
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(packageName)) {
    return null;
  }

  // Base name cannot start with '.' or '_'
  const baseName = packageName.startsWith("@") ? packageName.split("/")[1] : packageName;
  if (!baseName || baseName.startsWith(".") || baseName.startsWith("_")) {
    return null;
  }

  return packageName;
}

/**
 * Backward compatibility alias for packageNameOf.
 */
export const packageNameOf = packageFromSpecifier;

/**
 * Mirror of bareSpecifier returning undefined instead of null,
 * matching classifier signatures.
 */
export function bareSpecifier(spec?: string | null): string | undefined {
  return packageFromSpecifier(spec) ?? undefined;
}
