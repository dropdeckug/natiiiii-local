/**
 * COMPONENT 1 — ERROR CLASSIFIER (platform-side mirror)
 *
 * The same rule table is implemented inside the runner script
 * (supabase/functions/_shared/resilienceRunner.ts) so GitHub Actions can
 * classify without network access. Keep the two in sync.
 */

import { lookupNativePackage, nativePackageAdvice } from "./nativePackages";

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

export interface ErrorClassification {
  errorType: ResilienceErrorType;
  /** Affected npm package, when extractable. */
  packageName?: string;
  /** Affected file, when extractable. */
  filePath?: string;
  /** Gradle duplicate class name, when extractable. */
  className?: string;
  /** Filename suggested by a "Did you mean" hint. */
  suggestedFile?: string;
  fixAction: ResilienceFixAction;
  /** True when the fix executor may apply the fix without user confirmation. */
  automatic: boolean;
  /** Plain English summary shown to the user. */
  explanation: string;
  /** Extra guidance for native packages (from the known-native table). */
  advice?: string;
}

const PKG_RE =
  /(?:Cannot find module|Module not found:? (?:Error: )?Can't resolve|failed to resolve import|Rollup failed to resolve import)\s*["']?([^"'\s)]+)["']?/i;

function bareSpecifier(spec?: string | null): string | undefined {
  if (!spec) return undefined;
  let s = spec.trim().replace(/^npm:/, "");
  if (s.startsWith(".") || s.startsWith("/")) return undefined; // relative import, not a package
  s = s.replace(/^(@[^/]+\/[^/@]+).*$/, "$1");
  if (!s.startsWith("@")) s = s.split("/")[0];
  return s.replace(/@\d[\w.\-+]*$/, "") || undefined;
}

function firstMatch(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1];
}

function isGradleContext(text: string): boolean {
  return /gradle|gradlew|Execution failed for task|:app:|AAR metadata|Android|assembleDebug|assembleRelease/i.test(
    text,
  );
}

export function classifyError(output: string, stepName = ""): ErrorClassification {
  const text = `${stepName}\n${output || ""}`;

  // native addon — checked before dependency_missing so gyp failures win
  if (/node-gyp|prebuild-install|gyp ERR|native module/i.test(text)) {
    const pkg =
      bareSpecifier(firstMatch(text, /(?:npm ERR!.*?)?node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/\s]+)/i)) ??
      bareSpecifier(firstMatch(text, /(?:for|building|package)\s+([@\w./-]+)@?/i));
    return {
      errorType: "native_addon",
      packageName: pkg,
      fixAction: "remove_native_package",
      automatic: false,
      explanation: pkg
        ? `${pkg} needs to be compiled from C/C++ source on the build machine, which a mobile WebView app cannot do.`
        : "A dependency needs native C/C++ compilation, which a mobile WebView app cannot do.",
      advice: pkg ? nativePackageAdvice(pkg) : undefined,
    };
  }

  if (/ERESOLVE|unable to resolve dependency tree|peer dependency conflict|npm ERR! peer dep/i.test(text)) {
    return {
      errorType: "dependency_conflict",
      fixAction: "legacy_peer_deps",
      automatic: true,
      explanation:
        "Two dependencies want incompatible versions of the same package. Installing with legacy peer resolution.",
    };
  }

  if (/ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network error|npm ERR! network|socket hang up/i.test(text)) {
    return {
      errorType: "network_error",
      fixAction: "retry_with_delay",
      automatic: true,
      explanation: "The build machine could not reach the package registry. Retrying after a delay.",
    };
  }

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

  if (/Duplicate class|duplicate class found in modules/i.test(text)) {
    return {
      errorType: "gradle_duplicate_class",
      className: firstMatch(text, /Duplicate class ([\w.$]+)/i),
      fixAction: "add_gradle_resolution",
      automatic: true,
      explanation:
        "Two Android libraries ship the same Java class. Forcing a single version via a Gradle resolution strategy.",
    };
  }

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

  if (PKG_RE.test(text)) {
    const pkg = bareSpecifier(firstMatch(text, PKG_RE));
    const native = lookupNativePackage(pkg);
    if (native) {
      return {
        errorType: "native_addon",
        packageName: pkg,
        fixAction: "remove_native_package",
        automatic: false,
        explanation: `${pkg} requires native compilation and cannot run in a mobile WebView app.`,
        advice: nativePackageAdvice(pkg as string),
      };
    }
    return {
      errorType: "dependency_missing",
      packageName: pkg,
      filePath: firstMatch(text, /from\s+["']?([^\s"']+\.(?:m?js|jsx|ts|tsx|vue|svelte))["']?/i),
      fixAction: "add_package",
      automatic: true,
      explanation: pkg
        ? `The project imports ${pkg} but it is not listed in package.json. Adding it and reinstalling.`
        : "A package used by the project is missing from package.json.",
    };
  }

  if (/Could not find installation of TypeScript|Cannot find name|Type error|TS\d{4}/i.test(text)) {
    return {
      errorType: "typescript_error",
      fixAction: "install_typescript",
      automatic: true,
      explanation: "TypeScript (or its Node type definitions) is missing. Installing them and retrying.",
    };
  }

  if (/Duplicate class|Execution failed for task|BUILD FAILED/i.test(text) && isGradleContext(text)) {
    return {
      errorType: "gradle_error",
      fixAction: "clean_gradle_cache",
      automatic: true,
      explanation: "The Android Gradle build failed, most likely due to a corrupted cache. Cleaning and retrying.",
    };
  }

  return {
    errorType: "unknown",
    fixAction: "ai_diagnosis",
    automatic: false,
    explanation:
      "This failure did not match any known pattern. Sending it for AI diagnosis so you get a plain English explanation.",
  };
}
