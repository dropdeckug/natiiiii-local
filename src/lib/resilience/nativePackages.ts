/**
 * KNOWN NATIVE PACKAGES TABLE
 *
 * Packages that require native (node-gyp / prebuild) compilation and therefore
 * cannot run inside a mobile WebView app. Used by:
 *  - the workflow resilience runner (native_addon classification)
 *  - the CPR pre-flight report (red items shown to the user)
 */

export interface NativePackageEntry {
  /** npm package name. */
  name: string;
  /** Plain English reason it cannot be used in a mobile WebView app. */
  reason: string;
  /** Recommended JavaScript / WebAssembly alternative, when one exists. */
  alternative: string | null;
}

export const KNOWN_NATIVE_PACKAGES: NativePackageEntry[] = [
  {
    name: "canvas",
    reason: "Requires native compilation (node-gyp, Cairo system libraries).",
    alternative: "html-canvas-api, or use the browser Canvas API directly.",
  },
  {
    name: "sharp",
    reason: "Requires native compilation (libvips prebuilt binaries).",
    alternative: "jimp for image processing, or the browser Canvas API for basic operations.",
  },
  {
    name: "better-sqlite3",
    reason: "Requires native compilation against the Node.js C++ ABI.",
    alternative: "sql.js — a WebAssembly SQLite build that runs in browsers.",
  },
  {
    name: "node-gyp",
    reason: "This is a native build tool, not a runtime package.",
    alternative: null,
  },
  {
    name: "bcrypt",
    reason: "Requires native compilation.",
    alternative: "bcryptjs — a pure JavaScript implementation.",
  },
  {
    name: "argon2",
    reason: "Requires native compilation.",
    alternative: "argon2-browser for client-side use, or move password hashing to the backend.",
  },
  {
    name: "puppeteer",
    reason: "A browser automation tool that downloads a full Chromium — no use in a mobile app.",
    alternative: null,
  },
  {
    name: "playwright",
    reason: "A browser automation tool that downloads browsers — no use in a mobile app.",
    alternative: null,
  },
];

export function lookupNativePackage(name?: string | null): NativePackageEntry | null {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  return (
    KNOWN_NATIVE_PACKAGES.find((e) => e.name === key || key.startsWith(e.name + "@")) ?? null
  );
}

/** Red pre-flight item text for a detected native package. */
export function nativePackageAdvice(name: string): string {
  const entry = lookupNativePackage(name);
  if (!entry) {
    return `${name} appears to require native compilation, which is not available inside a mobile WebView app. Remove it or replace it with a pure JavaScript package.`;
  }
  const alt = entry.alternative
    ? ` Recommended alternative: ${entry.alternative}`
    : " There is no alternative — remove it from your dependencies.";
  return `${entry.name} cannot be used in a mobile WebView app. ${entry.reason}${alt}`;
}
