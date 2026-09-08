/**
 * Pure, shared resilience logic for GitHub Actions CI and platform runner.
 *
 * Provides:
 * - classifyError: categorizes stderr / build failures into actionable error types
 * - bareSpecifier: safely extracts bare npm package names (via specifierPolicy)
 * - applyFix: determines and executes sanctioned repair commands on the runner
 * - computeStderrFingerprint & hasProgress: no-progress guard to halt infinite loops
 */

import { bareSpecifier } from "./specifierPolicy.ts";

export type ResilienceErrorType =
  | "dependency_missing"
  | "dependency_conflict"
  | "native_addon"
  | "network_error"
  | "typescript_error"
  | "gradle_duplicate_class"
  | "gradle_error"
  | "output_missing"
  | "import_extension_missing"
  | "module_system_conflict"
  | "unknown";

export type ResilienceFixAction =
  | "add_package"
  | "legacy_peer_deps"
  | "remove_native_package"
  | "retry_with_delay"
  | "install_typescript"
  | "add_gradle_resolution"
  | "clean_gradle_cache"
  | "find_alternate_output"
  | "add_import_extension"
  | "normalize_module_system"
  | "ai_diagnosis";

export interface ResilienceClassification {
  errorType: ResilienceErrorType;
  packageName?: string;
  filePath?: string;
  className?: string;
  suggestedFile?: string;
  fixAction: ResilienceFixAction;
  automatic: boolean;
  explanation: string;
  advice?: string;
}

export interface FixExecutionContext {
  runCommand: (cmd: string) => { ok: boolean; status: number; output: string };
  readFile?: (filePath: string) => string | null;
  writeFile?: (filePath: string, content: string) => boolean;
  appRoot?: string;
}

export interface FixResult {
  applied: boolean;
  action: ResilienceFixAction;
  explanation: string;
  command?: string;
  error?: string;
}

const KNOWN_NATIVE_PACKAGES: Record<string, string> = {
  sharp: "Image processing native C++ library. Use client-side Canvas or standard web image handling.",
  sqlite3: "Native SQLite binding. Use Capacitor SQLite plugin (@capacitor-community/sqlite) or IndexedDB.",
  "better-sqlite3": "Native SQLite binding against Node C++ ABI. Use sql.js (Wasm) or IndexedDB.",
  bcrypt: "Native C++ password hashing. Use bcryptjs (pure JS) instead.",
  argon2: "Native password hashing. Use argon2-browser or backend hashing.",
  canvas: "Native Cairo canvas binding. Use HTML5 Canvas elements natively supported in WebViews.",
  "node-gyp": "Native C++ build tool, not a runtime web package.",
  fsevents: "macOS native filesystem watcher. Not applicable or needed in WebView runtime.",
  nodegit: "Native libgit2 binding. Incompatible with mobile WebView environments.",
  puppeteer: "Headless Chrome automation. Cannot run inside mobile WebView.",
  playwright: "Browser automation library. Cannot run inside mobile WebView.",
};

const PKG_RE =
  /(?:Cannot find module|Module not found:? (?:Error: )?Can't resolve|failed to resolve import|Rollup failed to resolve import)\s*["']?([^"'\s)]+)["']?/i;

function firstMatch(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1];
}

function isGradleContext(text: string): boolean {
  return /gradle|gradlew|Execution failed for task|:app:|AAR metadata|Android|assembleDebug|assembleRelease/i.test(
    text,
  );
}

/**
 * Normalizes stderr into a stable fingerprint invariant to timestamps,
 * execution IDs, hashes, and runner-specific paths.
 */
export function computeStderrFingerprint(output: string, stepName = ""): string {
  const normalized = (output || "")
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}t[\d:.+-]+z?/gi, "<timestamp>")
    .replace(/\b[0-9a-f]{7,64}\b/gi, "<hash>")
    .replace(/\b(?:run|job|build)\s*#?\d+\b/gi, "<execution-id>")
    .replace(/\/home\/runner\/work\/[^\s:'"]+/gi, "<workspace>")
    .replace(/\b\d+(?:\.\d+){1,3}\b/g, "<version>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-1200);
  return `${stepName.trim().toLowerCase()}|${normalized}`;
}

/**
 * No-progress guard: returns false if the error fingerprint is identical
 * across consecutive attempts, proving that previous fixes yielded no progress.
 */
export function hasProgress(
  previousFingerprint: string | null | undefined,
  currentFingerprint: string,
): boolean {
  if (!previousFingerprint) return true;
  return previousFingerprint !== currentFingerprint;
}

/**
 * Classifies an execution error from a workflow or build step.
 */
export function classifyError(output: string, stepName = ""): ResilienceClassification {
  const text = `${stepName}\n${output || ""}`;

  // 1. Native addons (gyp / prebuild failures)
  if (/node-gyp|prebuild-install|gyp ERR|native module/i.test(text)) {
    const pkg =
      bareSpecifier(firstMatch(text, /(?:npm ERR!.*?)?node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/\s]+)/i)) ??
      bareSpecifier(firstMatch(text, /(?:for package|building package|building|package)\s+([@\w./-]+)@?/i));
    return {
      errorType: "native_addon",
      packageName: pkg,
      fixAction: "remove_native_package",
      automatic: false,
      explanation: pkg
        ? `${pkg} needs to be compiled from C/C++ source, which a mobile WebView app cannot do.`
        : "A dependency requires native C/C++ compilation, which is not supported.",
      advice: pkg ? KNOWN_NATIVE_PACKAGES[pkg] : undefined,
    };
  }

  // 2. Peer dependency conflict
  if (/ERESOLVE|unable to resolve dependency tree|peer dependency conflict|npm ERR! peer dep/i.test(text)) {
    return {
      errorType: "dependency_conflict",
      fixAction: "legacy_peer_deps",
      automatic: true,
      explanation:
        "Two dependencies want incompatible versions of the same package. Installing with legacy peer resolution.",
    };
  }

  // 3. Network transient error
  if (/ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network error|npm ERR! network|socket hang up/i.test(text)) {
    return {
      errorType: "network_error",
      fixAction: "retry_with_delay",
      automatic: true,
      explanation: "The build machine could not reach the package registry. Retrying after a delay.",
    };
  }

  // 4. Missing import extension
  if (/Did you mean to import\s+(\S+)/i.test(text)) {
    const suggested = firstMatch(text, /Did you mean to import\s+["']?([^\s"'?]+)["']?/i);
    return {
      errorType: "import_extension_missing",
      suggestedFile: suggested,
      filePath: firstMatch(text, /from\s+["']?([^\s"']+\.(?:m?js|jsx|ts|tsx))["']?/i),
      fixAction: "add_import_extension",
      automatic: true,
      explanation: `An import is missing its file extension${suggested ? ` — it should point at ${suggested}` : ""}.`,
    };
  }

  // 5. Module system conflict
  if (
    /require is not defined in ES module|Cannot use import statement|"type"\s*:\s*"module"|type module/i.test(
      text,
    )
  ) {
    return {
      errorType: "module_system_conflict",
      fixAction: "normalize_module_system",
      automatic: true,
      explanation:
        'The project mixes CommonJS and ES modules ("type": "module" conflict). Normalizing the module system.',
    };
  }

  // 6. Gradle duplicate class
  if (/Duplicate class|duplicate class found in modules/i.test(text)) {
    return {
      errorType: "gradle_duplicate_class",
      className: firstMatch(text, /Duplicate class ([\w.$]+)/i),
      fixAction: "add_gradle_resolution",
      automatic: true,
      explanation:
        "Two Android libraries ship the same Java class. Forcing a single version via Gradle resolution strategy.",
    };
  }

  // 7. Output directory missing
  if (
    /www\/index\.html|webDir[^\n]*not found|No such file or directory[^\n]*index\.html|index\.html[^\n]*No such file or directory/i.test(
      text,
    )
  ) {
    return {
      errorType: "output_missing",
      fixAction: "find_alternate_output",
      automatic: true,
      explanation:
        "The web build output was not where Capacitor expected it. Searching for the real output directory.",
    };
  }

  // 8. Missing npm package
  if (PKG_RE.test(text)) {
    const pkg = bareSpecifier(firstMatch(text, PKG_RE));
    if (pkg && KNOWN_NATIVE_PACKAGES[pkg]) {
      return {
        errorType: "native_addon",
        packageName: pkg,
        fixAction: "remove_native_package",
        automatic: false,
        explanation: `${pkg} requires native compilation and cannot run in a mobile WebView app.`,
        advice: KNOWN_NATIVE_PACKAGES[pkg],
      };
    }
    return {
      errorType: "dependency_missing",
      packageName: pkg,
      filePath: firstMatch(text, /from\s+["']?([^\s"']+\.(?:m?js|jsx|ts|tsx|vue|svelte))["']?/i),
      fixAction: "add_package",
      automatic: Boolean(pkg),
      explanation: pkg
        ? `The project imports ${pkg} but it is not listed in package.json. Adding it and reinstalling.`
        : "A package used by the project is missing from package.json.",
    };
  }

  // 9. TypeScript error
  if (/Could not find installation of TypeScript|Cannot find name|Type error|TS\d{4}/i.test(text)) {
    return {
      errorType: "typescript_error",
      fixAction: "install_typescript",
      automatic: true,
      explanation: "TypeScript (or its Node type definitions) is missing. Installing them and retrying.",
    };
  }

  // 10. General Gradle error
  if (/Duplicate class|Execution failed for task|BUILD FAILED/i.test(text) && isGradleContext(text)) {
    return {
      errorType: "gradle_error",
      fixAction: "clean_gradle_cache",
      automatic: true,
      explanation: "The Android Gradle build failed. Cleaning Gradle cache and retrying.",
    };
  }

  return {
    errorType: "unknown",
    fixAction: "ai_diagnosis",
    automatic: false,
    explanation:
      "This failure did not match any known automated pattern. Sending for AI diagnosis.",
  };
}

/**
 * Applies an automated fix on the runner if the classification allows it.
 */
export function applyFix(
  classification: ResilienceClassification,
  ctx: FixExecutionContext,
): FixResult {
  if (!classification.automatic) {
    return {
      applied: false,
      action: classification.fixAction,
      explanation: "Manual or AI intervention required: fix is not marked automatic.",
    };
  }

  switch (classification.fixAction) {
    case "legacy_peer_deps": {
      const cmd = "npm install --legacy-peer-deps --no-audit --no-fund";
      const res = ctx.runCommand(cmd);
      return {
        applied: res.ok,
        action: classification.fixAction,
        command: cmd,
        explanation: res.ok
          ? "Installed dependencies with --legacy-peer-deps."
          : "Failed to install dependencies with --legacy-peer-deps.",
        error: res.ok ? undefined : res.output,
      };
    }

    case "add_package": {
      const pkg = classification.packageName;
      if (!pkg) {
        return {
          applied: false,
          action: classification.fixAction,
          explanation: "Cannot add package: package name could not be determined.",
        };
      }
      // Use sanctioned npm pkg set to add to dependencies
      const cmdSet = `npm pkg set dependencies.${pkg}="*"`;
      const resSet = ctx.runCommand(cmdSet);
      if (!resSet.ok) {
        return {
          applied: false,
          action: classification.fixAction,
          command: cmdSet,
          explanation: `Failed to record missing package ${pkg} in package.json.`,
          error: resSet.output,
        };
      }
      const cmdInstall = "npm install --no-audit --no-fund";
      const resInstall = ctx.runCommand(cmdInstall);
      return {
        applied: resInstall.ok,
        action: classification.fixAction,
        command: `${cmdSet} && ${cmdInstall}`,
        explanation: resInstall.ok
          ? `Added missing package ${pkg} and reinstalled.`
          : `Added package ${pkg} but install failed.`,
        error: resInstall.ok ? undefined : resInstall.output,
      };
    }

    case "normalize_module_system": {
      const cmd = "npm pkg delete type";
      const res = ctx.runCommand(cmd);
      return {
        applied: res.ok,
        action: classification.fixAction,
        command: cmd,
        explanation: res.ok
          ? 'Removed "type": "module" from package.json.'
          : 'Failed to remove "type": "module" from package.json.',
        error: res.ok ? undefined : res.output,
      };
    }

    case "clean_gradle_cache": {
      const cmd = "./gradlew clean --no-daemon";
      const res = ctx.runCommand(cmd);
      return {
        applied: res.ok,
        action: classification.fixAction,
        command: cmd,
        explanation: res.ok ? "Cleaned Gradle build cache." : "Failed to clean Gradle build cache.",
        error: res.ok ? undefined : res.output,
      };
    }

    case "retry_with_delay": {
      const cmd = "sleep 3";
      const res = ctx.runCommand(cmd);
      return {
        applied: res.ok,
        action: classification.fixAction,
        command: cmd,
        explanation: "Waited 3 seconds before retrying.",
      };
    }

    default:
      return {
        applied: false,
        action: classification.fixAction,
        explanation: `No runner execution handler implemented for fix action: ${classification.fixAction}`,
      };
  }
}

export { bareSpecifier };
