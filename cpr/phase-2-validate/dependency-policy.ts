/**
 * CPR dependency policy — all metadata-resolvable dependency conflict
 * categories that must be settled BEFORE the install command runs.
 *
 * Category 1 — package manager field / script conflicts
 * Category 3 — Node.js built-in module imports in frontend source (report only)
 * Category 4 — server-only packages (report only, never silently removed)
 * Category 5 — Capacitor version alignment
 * Category 6 — build tool version pinning
 *
 * Categories 2, 7 and 8 (duplicate React, dedupe, post-install verification)
 * require a real node_modules tree and live in phase-4-verify/post-install.ts.
 */

import type { CprFile, DependencyPolicyResult, PackageManager } from "../types/index.ts";
import { PLATFORM_CAPACITOR_MAJOR } from "../versions/index.ts";

/* ----------------------------------------------------- platform standards */

export const PLATFORM_BUILD_TOOL_VERSIONS: Record<string, string> = {
  vite: "5.4.10",
  "@vitejs/plugin-react": "4.3.4",
  "@vitejs/plugin-react-swc": "3.7.1",
  "@vitejs/plugin-vue": "5.1.4",
  typescript: "5.6.3",
  postcss: "^8.4.47",
  autoprefixer: "^10.4.20",
  tailwindcss: "^3.4.13",
};

/** Known-good plugin versions per Capacitor major. */
export const CAPACITOR_COMPAT: Record<number, Record<string, string>> = {
  6: {
    "@capacitor/core": "^6.0.0",
    "@capacitor/cli": "^6.0.0",
    "@capacitor/android": "^6.0.0",
    "@capacitor/ios": "^6.0.0",
    "@capacitor/app": "^6.0.0",
    "@capacitor/status-bar": "^6.0.0",
    "@capacitor/keyboard": "^6.0.0",
    "@capacitor/splash-screen": "^6.0.0",
    "@capacitor/haptics": "^6.0.0",
    "@capacitor/camera": "^6.0.0",
    "@capacitor/filesystem": "^6.0.0",
    "@capacitor/geolocation": "^6.0.0",
    "@capacitor/network": "^6.0.0",
    "@capacitor/device": "^6.0.0",
    "@capacitor/clipboard": "^6.0.0",
    "@capacitor/share": "^6.0.0",
    "@capacitor/browser": "^6.0.0",
    "@capacitor/preferences": "^6.0.0",
    "@capacitor/push-notifications": "^6.0.0",
    "@capacitor/local-notifications": "^6.0.0",
    "@codetrix-studio/capacitor-google-auth": "^3.3.0",
    "@capacitor-community/apple-sign-in": "^1.0.1",
    "@capacitor-community/facebook-login": "^6.0.0",
    "@aparajita/capacitor-biometric-auth": "^9.0.0",
  },
  7: {
    "@capacitor/core": "^7.0.0",
    "@capacitor/cli": "^7.0.0",
    "@capacitor/android": "^7.0.0",
    "@capacitor/ios": "^7.0.0",
    "@capacitor/app": "^7.0.0",
    "@capacitor/status-bar": "^7.0.0",
    "@capacitor/keyboard": "^7.0.0",
    "@capacitor/splash-screen": "^7.0.0",
    "@capacitor/haptics": "^7.0.0",
    "@capacitor/camera": "^7.0.0",
    "@capacitor/filesystem": "^7.0.0",
    "@capacitor/geolocation": "^7.0.0",
    "@capacitor/network": "^7.0.0",
    "@capacitor/device": "^7.0.0",
    "@capacitor/clipboard": "^7.0.0",
    "@capacitor/share": "^7.0.0",
    "@capacitor/browser": "^7.0.0",
    "@capacitor/preferences": "^7.0.0",
    "@capacitor/push-notifications": "^7.0.0",
    "@capacitor/local-notifications": "^7.0.0",
    "@codetrix-studio/capacitor-google-auth": "^3.4.0-rc.4",
    "@capacitor-community/apple-sign-in": "^7.0.0",
    "@capacitor-community/facebook-login": "^7.0.0",
    "@aparajita/capacitor-biometric-auth": "^9.0.0",
  },
};

export const NODE_BUILTIN_MODULES = [
  "path", "fs", "os", "crypto", "buffer", "stream", "events", "http", "https", "net",
  "child_process", "cluster", "dgram", "dns", "domain", "module", "readline", "repl",
  "tls", "url", "util", "vm", "worker_threads", "zlib", "assert", "constants",
  "punycode", "querystring", "string_decoder", "sys", "timers", "tty", "v8",
];

const BUILTIN_GUIDANCE: Record<string, string> = {
  path:
    "Do path work on the backend and pass the result through your API, or use the browser URL API (new URL(...)) instead.",
  fs: "Use the Capacitor Filesystem plugin (@capacitor/filesystem) for file access inside the mobile app.",
  crypto:
    "Use the Web Crypto API (window.crypto.subtle) — it is available in every modern browser and WebView.",
  buffer: "CPR added the `buffer` package and a Vite global shim so Buffer resolves in the WebView.",
  child_process: "Process spawning does not exist in a WebView — move this logic to your backend API.",
  net: "Raw sockets are unavailable in a WebView — use fetch or WebSockets against your backend.",
};

export interface ServerOnlyPackageInfo {
  name: string;
  detail: string;
}

export const SERVER_ONLY_PACKAGES: ServerOnlyPackageInfo[] = [
  { name: "nodemailer", detail: "Email sending needs the Node `net` module. Send email from your backend API instead." },
  { name: "sharp", detail: "Native image processing. Use the browser Canvas API or hand image work to your backend." },
  { name: "googleapis", detail: "Node-only Google client. Use Google Identity Services in the browser instead." },
  { name: "aws-sdk", detail: "Node-only AWS SDK. Use AWS Amplify or pre-signed URLs generated on your backend." },
  { name: "mongoose", detail: "MongoDB ODM for Node. Reach your database through a backend API." },
  { name: "prisma", detail: "Node-only ORM. Reach your database through a backend API." },
  { name: "@prisma/client", detail: "Node-only ORM client. Reach your database through a backend API." },
  { name: "express", detail: "Web server framework — a frontend bundle has no use for it. Upload only the frontend of your project." },
  { name: "fastify", detail: "Web server framework — upload only the frontend of your project." },
  { name: "hapi", detail: "Web server framework — upload only the frontend of your project." },
  { name: "@hapi/hapi", detail: "Web server framework — upload only the frontend of your project." },
  { name: "koa", detail: "Web server framework — upload only the frontend of your project." },
  { name: "bcrypt", detail: "Native password hashing addon. Use `bcryptjs`, a pure JavaScript drop-in that runs in browsers." },
];

function isServerOnly(name: string): ServerOnlyPackageInfo | null {
  const hit = SERVER_ONLY_PACKAGES.find((p) => p.name === name);
  if (hit) return hit;
  if (name.startsWith("@aws-sdk/")) {
    return { name, detail: "Node-only AWS SDK module. Use AWS Amplify or pre-signed URLs from your backend." };
  }
  return null;
}

/* ------------------------------------------------------------------ types */

export type { DependencyPolicyResult };

export function emptyDependencyPolicy(): DependencyPolicyResult {
  return {
    package_manager_field_removed: false,
    package_manager_field_value: null,
    scripts_rewritten: [],
    capacitor_versions_aligned: [],
    build_tool_versions_pinned: [],
    critical_packages_pinned: [],
    build_script_normalized_to_production: { changed: false },
    node_builtin_imports: [],
    buffer_polyfill_added: false,
    server_only_packages: [],
    notes: [],
  };
}

/* -------------------------------------------------- category 1 — pm field */

const SCRIPT_REWRITES: [RegExp, string][] = [
  [/\bbunx\b/g, "npx"],
  [/\bbun\s+x\b/g, "npx"],
  [/\bbun\s+run\b/g, "npm run"],
  [/\bpnpm\s+exec\b/g, "npx"],
  [/\bpnpm\s+dlx\b/g, "npx"],
  [/\bpnpm\s+run\b/g, "npm run"],
  [/\byarn\s+dlx\b/g, "npx"],
  [/\byarn\s+run\b/g, "npm run"],
];

export function normalizePackageManagerFields(
  pkg: Record<string, any>,
  scripts: Record<string, string>,
  packageManager: PackageManager,
  out: DependencyPolicyResult,
): { packageManagerField: string | null } {
  const declared = typeof pkg.packageManager === "string" ? pkg.packageManager : null;
  let keep: string | null = declared;

  if (declared) {
    const tool = declared.split("@")[0].trim();
    if (tool !== packageManager || packageManager !== "npm") {
      keep = null;
      out.package_manager_field_removed = true;
      out.package_manager_field_value = declared;
      out.notes.push(
        `Removed the packageManager field (\`${declared}\`) — Corepack would force a package manager the build runner does not ship.`,
      );
    }
  }

  for (const [name, cmd] of Object.entries(scripts)) {
    if (typeof cmd !== "string") continue;
    let next = cmd;
    for (const [re, to] of SCRIPT_REWRITES) next = next.replace(re, to);
    if (next !== cmd) {
      scripts[name] = next;
      out.scripts_rewritten.push({ script: name, from: cmd, to: next });
    }
  }
  const originalBuild = scripts.build;
  if (typeof originalBuild !== "string" || originalBuild !== "vite build") {
    scripts.build = "vite build";
    out.build_script_normalized_to_production = { changed: true, original: originalBuild };
    out.notes.push("Normalized the build script to the explicit Vite production command `vite build`.");
  }
  if (out.scripts_rewritten.length) {
    out.notes.push(
      `${out.scripts_rewritten.length} script${out.scripts_rewritten.length === 1 ? "" : "s"} rewritten to npm equivalents.`,
    );
  }

  return { packageManagerField: keep };
}

/* ------------------------------------------ category 5 — capacitor align */

function majorOf(range: string): number | null {
  const m = String(range).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function alignCapacitorVersions(
  deps: Record<string, string>,
  devDeps: Record<string, string>,
  out: DependencyPolicyResult,
  capacitorMajor = PLATFORM_CAPACITOR_MAJOR,
): void {
  const table = CAPACITOR_COMPAT[capacitorMajor] ?? {};
  for (const bucket of [deps, devDeps]) {
    for (const name of Object.keys(bucket)) {
      const known = table[name];
      const current = bucket[name];
      if (!current || /^(workspace:|file:|link:)/.test(current)) continue;
      if (known) {
        if (current === known) continue;
        if (majorOf(current) === capacitorMajor && !name.startsWith("@capacitor/")) continue;
        bucket[name] = known;
        out.capacitor_versions_aligned.push({ name, from: current, to: known });
        continue;
      }
      if (!name.startsWith("@capacitor/")) continue;
      if (majorOf(current) === capacitorMajor) continue;
      const to = `^${capacitorMajor}.0.0`;
      bucket[name] = to;
      out.capacitor_versions_aligned.push({ name, from: current, to });
    }
  }
  if (out.capacitor_versions_aligned.length) {
    out.notes.push(
      `${out.capacitor_versions_aligned.length} Capacitor package${out.capacitor_versions_aligned.length === 1 ? "" : "s"} aligned with the platform Capacitor ${capacitorMajor}.x runtime.`,
    );
  }
}

/* ---------------------------------------- category 6 — build tool pinning */

export function pinBuildTools(
  deps: Record<string, string>,
  devDeps: Record<string, string>,
  out: DependencyPolicyResult,
): void {
  for (const [name, version] of Object.entries(PLATFORM_BUILD_TOOL_VERSIONS)) {
    const bucket = devDeps[name] ? devDeps : deps[name] ? deps : null;
    if (!bucket) continue;
    const current = bucket[name];
    if (current === version) {
      if (["vite", "@vitejs/plugin-react", "@vitejs/plugin-vue", "typescript"].includes(name)) {
        out.critical_packages_pinned.push({ name, version });
      }
      continue;
    }
    if (/^(workspace:|file:|link:)/.test(current)) continue;
    // Build tools live in devDependencies on the canonical manifest.
    delete deps[name];
    devDeps[name] = version;
    out.build_tool_versions_pinned.push({ name, from: current, to: version });
    if (["vite", "@vitejs/plugin-react", "@vitejs/plugin-vue", "typescript"].includes(name)) {
      out.critical_packages_pinned.push({ name, version });
    }
  }
  if (out.build_tool_versions_pinned.length) {
    out.notes.push(
      `${out.build_tool_versions_pinned.length} build tool${out.build_tool_versions_pinned.length === 1 ? "" : "s"} pinned to the platform standard version.`,
    );
  }
}

/* ------------------------------- category 3 — Node built-ins in frontend */

const BUILTIN_IMPORT_RE =
  /(?:import[^"'\n]*from\s*|import\s*|require\s*\(\s*)["'](?:node:)?([a-z_/]+)["']/g;

export function scanNodeBuiltins(sources: CprFile[], out: DependencyPolicyResult): void {
  const builtins = new Set(NODE_BUILTIN_MODULES);
  for (const file of sources) {
    const content = file.content ?? "";
    if (!content) continue;
    const lines = content.split("\n");
    lines.forEach((text, i) => {
      BUILTIN_IMPORT_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = BUILTIN_IMPORT_RE.exec(text))) {
        const mod = m[1].split("/")[0];
        if (!builtins.has(mod)) continue;
        out.node_builtin_imports.push({
          file: file.path,
          line: i + 1,
          module: mod,
          guidance:
            BUILTIN_GUIDANCE[mod] ??
            `\`${mod}\` is a Node.js built-in and does not exist in a browser or WebView — move this code to your backend.`,
        });
      }
    });
  }
  if (out.node_builtin_imports.some((b) => b.module === "buffer")) out.buffer_polyfill_added = true;
  if (out.node_builtin_imports.length) {
    out.notes.push(
      `${out.node_builtin_imports.length} Node.js built-in import${out.node_builtin_imports.length === 1 ? "" : "s"} found in frontend source.`,
    );
  }
}

/** Adds the `buffer` package + a Vite global shim when Buffer is used. */
export function applyBufferPolyfill(
  deps: Record<string, string>,
  files: CprFile[],
  root: string,
): { patch: { path: string; content: string; reason: string } | null; added: boolean } {
  let added = false;
  if (!deps.buffer) {
    deps.buffer = "^6.0.3";
    added = true;
  }
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  const config = files.find(
    (f) => f.content && /vite\.config\.[cm]?[jt]s$/.test(f.path) && f.path.startsWith(prefix),
  );
  if (!config?.content) return { patch: null, added };
  if (/globalThis\s*:\s*['"]globalThis['"]/.test(config.content) || /Buffer.*buffer\/?['"]/.test(config.content)) {
    return { patch: null, added };
  }
  let content = config.content;
  if (/\bdefine\s*:/.test(content)) return { patch: null, added };
  const inserted = content.replace(
    /defineConfig\(([^)]*?)\{/,
    (full, head) => `defineConfig(${head}{\n  define: { global: "globalThis" },`,
  );
  if (inserted === content) return { patch: null, added };
  content = inserted;
  return {
    patch: {
      path: config.path,
      content,
      reason: "Buffer/global shim so the `buffer` polyfill resolves inside the WebView.",
    },
    added,
  };
}

/* ------------------------------ category 4 — server-only package flagging */

export function scanServerOnlyPackages(
  deps: Record<string, string>,
  devDeps: Record<string, string>,
  importedPackages: Set<string>,
  out: DependencyPolicyResult,
): void {
  const seen = new Set<string>();
  for (const [bucket, production] of [[deps, true], [devDeps, false]] as [Record<string, string>, boolean][]) {
    for (const name of Object.keys(bucket)) {
      const info = isServerOnly(name);
      if (!info || seen.has(name)) continue;
      seen.add(name);
      out.server_only_packages.push({
        name,
        detail: info.detail,
        imported: importedPackages.has(name),
        production,
      });
    }
  }
  const blocking = out.server_only_packages.filter((p) => p.production && p.imported);
  if (blocking.length) {
    out.notes.push(
      `${blocking.length} server-only package${blocking.length === 1 ? " is" : "s are"} imported by frontend source and cannot run in a WebView.`,
    );
  }
}
