/**
 * ForgeAI Code Repair Agent — path scope boundary.
 *
 * Every tool that touches a path validates it here BEFORE executing.
 * The agent may only see and edit user project source and native config.
 * It can never read or write the platform's own pipeline, CI, or secrets.
 */

const ALLOWED: RegExp[] = [
  /^src\/.+/,
  /^android\/app\/src\/main\/.+/,
  /^android\/(?:[^/]+\/)*build\.gradle$/,
  /^android\/build\.gradle$/,
  /^android\/variables\.gradle$/,
  /^ios\/App\/App\/Info\.plist$/,
  /^ios\/App\/App\/.+/,
  /^package\.json$/,
  /^capacitor\.config\.(?:json|ts|js)$/,
  /^vite\.config\.(?:ts|js)$/,
  /^tsconfig\.json$/,
  /^tsconfig\.node\.json$/,
  /^tsconfig\.app\.json$/,
  /^\.npmrc$/,
];

const FORBIDDEN: RegExp[] = [
  /^\.github\/workflows\//,
  /(^|\/)cpr\//,
  /(^|\/)\.\.(\/|$)/,
  /vault|credential|keystore|secret/i,
  /^\.env(\.|$)/,
  /(^|\/)\.env(\.|$)/,
  /\.(jks|p12|pem|key|mobileprovision)$/i,
  /^package-lock\.json$|^bun\.lockb?$|^yarn\.lock$/,
];

export const SCOPE_REJECTION =
  "This file is outside the repair agent's permitted scope. Focus only on the project's source code " +
  "(src/**), native configuration (android/**, ios/App/App/**), and the project manifests " +
  "(package.json, capacitor.config.json, vite.config.ts, tsconfig*.json, .npmrc). " +
  "The platform's CI workflows and CPR pipeline can never be modified.";

/** Normalize a path the model produced (strip leading ./ or /). */
export function normalizePath(p: string): string {
  return String(p || "").trim().replace(/^\.\//, "").replace(/^\/+/, "");
}

export function isPathAllowed(rawPath: string): boolean {
  const p = normalizePath(rawPath);
  if (!p) return false;
  if (FORBIDDEN.some((re) => re.test(p))) return false;
  return ALLOWED.some((re) => re.test(p));
}

/** Returns null when allowed, otherwise the rejection message. */
export function checkPath(rawPath: string): string | null {
  return isPathAllowed(rawPath) ? null : `REJECTED: ${normalizePath(rawPath)} — ${SCOPE_REJECTION}`;
}

/** True when the *whole* forbidden pipeline is implicated (used for escalation). */
export function isPlatformPipelinePath(rawPath: string): boolean {
  const p = normalizePath(rawPath);
  return /^\.github\/workflows\//.test(p) || /(^|\/)cpr\//.test(p);
}