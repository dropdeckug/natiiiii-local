/**
 * ForgeAI Code Repair Agent — path scope boundary.
 *
 * Every tool that touches a path validates it here BEFORE executing.
 * The agent may only see and edit user project source and native config.
 * It can never read or write the platform's own pipeline, CI, or secrets.
 */

const ALLOWED: RegExp[] = [
  // Application source
  /^(?:.*\/)?src\/.+/,
  /^(?:.*\/)?app\/.+/,
  /^(?:.*\/)?components\/.+/,
  /^(?:.*\/)?pages\/.+/,
  /^(?:.*\/)?lib\/.+/,
  /^(?:.*\/)?hooks\/.+/,
  /^(?:.*\/)?styles\/.+/,
  /^(?:.*\/)?utils\/.+/,
  // Native configuration
  /^android\/app\/src\/main\/.+/,
  /^android\/(?:[^/]+\/)*build\.gradle$/,
  /^android\/build\.gradle$/,
  /^android\/variables\.gradle$/,
  /^ios\/App\/App\/Info\.plist$/,
  /^ios\/App\/App\/.+/,
  // Manifests & package configs
  /^(?:.*\/)?package\.json$/,
  /^(?:.*\/)?\.npmrc$/,
  // Entry HTML
  /^(?:.*\/)?index\.html$/,
  // Bundler & framework configs
  /^(?:.*\/)?capacitor\.config\.(?:json|ts|js|mjs|cjs)$/,
  /^(?:.*\/)?vite\.config\.(?:ts|js|mjs|cjs)$/,
  /^(?:.*\/)?svelte\.config\.(?:ts|js|mjs|cjs)$/,
  /^(?:.*\/)?astro\.config\.(?:ts|js|mjs|cjs)$/,
  /^(?:.*\/)?tailwind\.config\.(?:ts|js|mjs|cjs)$/,
  /^(?:.*\/)?postcss\.config\.(?:ts|js|mjs|cjs)$/,
  /^(?:.*\/)?tsconfig(?:\.[\w.-]+)?\.json$/,
  // Assets, manifest, service worker
  /^(?:.*\/)?public\/.+/,
  /^(?:.*\/)?manifest\.(?:json|webmanifest)$/,
  /^(?:.*\/)?(?:sw|service-worker)\.(?:js|ts)$/,
  // Safe environment templates
  /^(?:.*\/)?\.env(?:\.example|\.local|\.defaults)?$/,
];

const FORBIDDEN: RegExp[] = [
  /^\.github\/workflows\//,
  /(^|\/)cpr\//,
  /(^|\/)\.\.(\/|$)/,
  /vault|credential|keystore|secret/i,
  /\.(jks|p12|pem|key|mobileprovision)$/i,
  // Backend directories must not be touched
  /(^|\/)(backend|server)\//,
];

export const SCOPE_REJECTION =
  "This file is outside the repair agent's permitted scope. Focus only on the project's source code " +
  "(src/**), bundler configs (vite.config.*, tsconfig*.json), native configuration (android/**, ios/App/App/**), " +
  "and web manifests (package.json, index.html, public/**). " +
  "Workflows, secrets, keystores, and backend directories can never be modified.";

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