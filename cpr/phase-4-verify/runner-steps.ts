/**
 * Executable runner scripts owned by CPR.
 *
 * CPR itself has no filesystem or process access, so the two remediation
 * loops it specifies — the peer dependency audit and the automated build
 * retry — are emitted as self-contained Node scripts that the build workflow
 * executes immediately after install and in place of a bare build. Both
 * scripts are failure-tolerant: the audit always exits 0, the retry exits
 * non-zero only when the build itself is genuinely unrecoverable.
 */

import { MAX_AUTO_BUILD_RETRIES } from "./build-retry.ts";

/** node_modules walk → add missing peers → re-install. Always exits 0. */
export const PEER_AUDIT_JS = `/* CPR peer dependency audit */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const OUT = 'cpr-peer-audit.json';
const report = { ran: false, added: [], missingUnresolved: [], installReran: false, notes: [] };
const IGNORED = new Set(['react-native','@types/react','@types/react-dom','webpack','eslint']);

function finish() {
  try { fs.writeFileSync(OUT, JSON.stringify(report, null, 2)); } catch (e) {}
  process.exit(0);
}

try {
  const root = process.cwd();
  const nm = path.join(root, 'node_modules');
  if (!fs.existsSync(nm)) { report.notes.push('node_modules missing — audit skipped.'); finish(); }
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const declared = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});

  const names = [];
  for (const entry of fs.readdirSync(nm)) {
    if (entry.startsWith('.')) continue;
    if (entry.startsWith('@')) {
      let inner = [];
      try { inner = fs.readdirSync(path.join(nm, entry)); } catch (e) {}
      for (const sub of inner) names.push(entry + '/' + sub);
    } else names.push(entry);
  }

  const present = new Set(names);
  const wanted = new Map();
  for (const name of names) {
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(path.join(nm, name, 'package.json'), 'utf8')); } catch (e) { continue; }
    const peers = manifest.peerDependencies || {};
    const meta = manifest.peerDependenciesMeta || {};
    for (const peer of Object.keys(peers)) {
      if (meta[peer] && meta[peer].optional) continue;
      if (IGNORED.has(peer) || present.has(peer) || declared[peer]) continue;
      const cur = wanted.get(peer) || [];
      cur.push(name);
      wanted.set(peer, cur);
    }
  }
  report.ran = true;

  if (wanted.size === 0) { report.notes.push('All peer dependencies satisfied.'); finish(); }

  pkg.dependencies = pkg.dependencies || {};
  for (const [peer, requiredBy] of wanted) {
    let version = null;
    try { version = execSync('npm view ' + JSON.stringify(peer) + ' version', { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); } catch (e) {}
    if (!version) { report.missingUnresolved.push(peer); continue; }
    pkg.dependencies[peer] = '^' + version;
    report.added.push({ name: peer, version: '^' + version, source: 'peer', reason: 'Peer dependency of ' + requiredBy.join(', ') + '.' });
    console.log('[cpr:peer] adding ' + peer + '@^' + version + ' (peer of ' + requiredBy.join(', ') + ')');
  }

  if (report.added.length) {
    pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort((a, b) => a[0].localeCompare(b[0])));
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\\n');
    try {
      execSync('npm install --no-audit --no-fund', { stdio: 'inherit' });
      report.installReran = true;
    } catch (e) {
      report.notes.push('Re-install after adding peer dependencies failed: ' + (e && e.message));
    }
  }
} catch (e) {
  report.notes.push('Peer audit error: ' + (e && e.message));
}
finish();
`;

/** Build with up to five auto-install retries on unresolved modules. */
export const BUILD_RETRY_JS = `/* CPR build retry loop */
const fs = require('fs');
const { execSync } = require('child_process');
const MAX = ${MAX_AUTO_BUILD_RETRIES};
const OUT = 'cpr-build-retry.json';
const report = { attempts: 0, succeeded: false, added: [], attemptedPackages: [], finalError: null, module_errors_auto_fixed: [] };
const CMD = process.env.NB_BUILD_COMMAND && process.env.NB_BUILD_COMMAND.trim() ? process.env.NB_BUILD_COMMAND : 'npm run build';

function save() { try { fs.writeFileSync(OUT, JSON.stringify(report, null, 2)); } catch (e) {} }

function run(cmd) {
  try {
    const out = execSync(cmd + ' 2>&1', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(out);
    return { ok: true, output: out };
  } catch (e) {
    const out = String((e.stdout || '') + (e.stderr || '') || (e && e.message));
    process.stdout.write(out);
    return { ok: false, output: out };
  }
}

const path = require('path');
const SRC_EXT = ['.js', '.ts', '.jsx', '.tsx', '.json'];

function walkSrc(dir, out) {
  out = out || [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walkSrc(full, out); }
    else if (/\\.(m?js|jsx|ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

function detectModuleError(o) {
  const rules = [
    { pattern: 'did-you-mean-js-extension', re: /Did you mean to import ([^\\s?'"]+\\.js)/i, fix: 'add-extension' },
    { pattern: 'module-not-found-report-web-vitals', re: /(?:Module not found|Cannot find module|Failed to resolve import)[^\\n]*reportWebVitals/i, fix: 'remove-cra-artifacts' },
    { pattern: 'module-not-found-web-vitals', re: /(?:Module not found|Cannot find module|Failed to resolve import)[^\\n]*web-vitals/i, fix: 'remove-cra-artifacts' },
    { pattern: 'require-not-defined-in-esm', re: /require is not defined in ES module scope/i, fix: 'convert-require-to-import' },
    { pattern: 'import-in-commonjs', re: /Cannot use import statement outside a module|Cannot use import statement in a CommonJS module/i, fix: 'remove-type-module' },
    { pattern: 'vite-esm-only-config-plugin', re: /(?:resolved to an ESM file|ESM file cannot be loaded by `require`)[\s\S]*?(?:lovable-tagger|externalize-deps)/i, fix: 'repair-config' },
    { pattern: 'vite-config-load-failure', re: /failed to load config from\\s+(\\S+)/i, fix: 'repair-config' },
    { pattern: 'cannot-resolve-relative-extensionless', re: /(?:Cannot resolve|Failed to resolve import|Cannot find module)\\s+["']?(\\.\\.?\\/[^"'\\s]+)["']?/i, fix: 'add-extension' },
  ];
  for (const rule of rules) {
    const m = o.match(rule.re);
    if (!m) continue;
    const fileM = o.match(/from\\s+["']?([^\\s"']+\\.(?:m?js|jsx|ts|tsx))["']?/i);
    return { pattern: rule.pattern, fix: rule.fix, file: fileM ? fileM[1] : null, specifier: m[1] || null };
  }
  return null;
}

function addExtensions(targetFile) {
  const files = targetFile && fs.existsSync(targetFile) ? [targetFile] : walkSrc('src');
  let changed = 0;
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const dir = path.dirname(f);
    const next = src.replace(/(\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\brequire\\s*\\(\\s*|\\bimport\\s+)(["'])(\\.\\.?\\/[^"'\\n]+)\\2/g, function (match, head, q, spec) {
      if (/\\.[a-z0-9]{2,5}$/i.test(spec)) return match;
      const base = path.resolve(dir, spec);
      for (const ext of SRC_EXT) {
        if (fs.existsSync(base + ext)) { changed++; return head + q + spec + ext + q; }
      }
      return match;
    });
    if (next !== src) { try { fs.writeFileSync(f, next); } catch (e) {} }
  }
  return changed > 0;
}

function removeCraArtifacts() {
  const candidates = ['src/index.tsx','src/index.jsx','src/index.ts','src/index.js','src/main.tsx','src/main.jsx','src/main.ts','src/main.js'];
  let changed = false;
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    let src = fs.readFileSync(f, 'utf8');
    const before = src;
    src = src.replace(/^[ \\t]*import[^\\n;]*['"][^'"\\n]*(reportWebVitals|setupTests|react-app-polyfill)[^'"\\n]*['"][^\\n]*;?[ \\t]*\\r?\\n?/gmi, '');
    src = src.replace(/^[ \\t]*reportWebVitals\\s*\\([^)]*\\)\\s*;?[ \\t]*\\r?\\n?/gm, '');
    if (src !== before) { fs.writeFileSync(f, src); changed = true; }
  }
  for (const ext of ['.js', '.ts', '.jsx', '.tsx']) {
    const rw = 'src/reportWebVitals' + ext;
    if (fs.existsSync(rw)) { try { fs.unlinkSync(rw); changed = true; } catch (e) {} }
  }
  return changed;
}

function removeTypeModule() {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (pkg.type !== 'module') return false;
    delete pkg.type;
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
    return true;
  } catch (e) { return false; }
}

function convertRequires(target) {
  const files = target && fs.existsSync(target) ? [target] : ['vite.config.js','vite.config.ts','vite.config.mjs','vite.config.mts','postcss.config.js','tailwind.config.js'].filter(function (f) { return fs.existsSync(f); });
  let changed = false;
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    let next = src.replace(/module\\.exports\\s*=\\s*/g, 'export default ');
    next = next.replace(/(?:const|let|var)\\s+\\{([^}]+)\\}\\s*=\\s*require\\(\\s*(["'][^"']+["'])\\s*\\)\\s*;?/g, 'import {$1} from $2;');
    next = next.replace(/(?:const|let|var)\\s+(\\w+)\\s*=\\s*require\\(\\s*(["'][^"']+["'])\\s*\\)\\s*;?/g, 'import $1 from $2;');
    if (next !== src) { fs.writeFileSync(f, next); changed = true; }
  }
  return changed;
}

/* ---------------------------------------------------- config-load repair */

const CONFIG_CANDIDATES = ['vite.config.ts','vite.config.js','vite.config.mjs','vite.config.mts','vite.config.cjs','vite.config.cts'];

function resolvable(name) {
  // Only the project's own node_modules counts — a parent-directory hit would
  // wrongly keep an import that the CI runner cannot resolve.
  try { if (require('module').builtinModules.indexOf(name.replace(/^node:/, '')) !== -1) return true; } catch (e) {}
  return fs.existsSync(path.join(process.cwd(), 'node_modules', name, 'package.json'))
    || fs.existsSync(path.join(process.cwd(), 'node_modules', name));
}

function findConfigFile(hint) {
  if (hint) {
    const base = hint.split(/[\\\\/]/).pop();
    if (base && fs.existsSync(base)) return base;
  }
  for (const c of CONFIG_CANDIDATES) if (fs.existsSync(c)) return c;
  return null;
}

/**
 * A build tool config that will not even load (\`failed to load config from
 * vite.config.ts\`) blocks every later step. Repair it in place:
 *   1. drop imports of packages that are not installed (dev-only plugins such
 *      as lovable-tagger / componentTagger are the usual culprit) and remove
 *      their usage from the plugins array,
 *   2. shim \`__dirname\`/\`require\` when the config is ESM,
 *   3. as a last resort replace it with a minimal config that preserves the
 *      output directory and the "@" -> ./src alias.
 */
function repairConfig(hint) {
  const file = findConfigFile(hint);
  if (!file) return false;
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return false; }
  const original = src;
  const unresolved = [];

  // Vite 5 loads config dependencies through a CommonJS bridge. Optional
  // ESM-only editor plugins must not be present in a production build config.
  if (/lovable-tagger/.test(src) && /(?:resolved to an ESM file|externalize-deps|componentTagger)/i.test(src)) {
    src = src.replace(/^[ \\t]*import\\s+[^;\\n]*from\\s*["']lovable-tagger["'][^\\n]*;?[ \\t]*\\r?\\n?/gmi, '');
    src = src.replace(/(?:mode[ \\t]*===[ \\t]*["']development["'][ \\t]*&&[ \\t]*)?componentTagger\\s*\\([^)]*\\)[ \\t]*,?/g, '');
    src = src.replace(/,\\s*,/g, ',').replace(/\\[\\s*,/g, '[').replace(/,\\s*\\]/g, ']');
    console.log('[cpr:config] removed optional ESM-only lovable-tagger plugin');
  }

  src = src.replace(/^[ \\t]*import\\s+([^;\\n]*?)\\s+from\\s*["']([^"'\\n]+)["'][ \\t]*;?[ \\t]*\\r?\\n?/gm, function (line, clause, spec) {
    if (/^[.\\/]|^node:|^virtual:/.test(spec)) return line;
    if (resolvable(spec)) return line;
    // Prefer installing a genuine plugin (@vitejs/plugin-react, lovable-tagger…)
    // over deleting it; only truly unresolvable packages get stripped.
    try {
      execSync('npm install ' + JSON.stringify(spec) + ' --save-dev --no-audit --no-fund --legacy-peer-deps', { stdio: 'inherit' });
    } catch (e) {}
    if (resolvable(spec)) {
      console.log('[cpr:config] installed missing config dependency "' + spec + '"');
      return line;
    }
    const names = [];
    const def = clause.match(/^([A-Za-z_$][\\w$]*)/);
    if (def) names.push(def[1]);
    const braces = clause.match(/\\{([^}]*)\\}/);
    if (braces) braces[1].split(',').forEach(function (part) {
      const n = part.split(/\\bas\\b/).pop().trim();
      if (n) names.push(n);
    });
    unresolved.push({ spec: spec, names: names });
    console.log('[cpr:config] ' + file + ' imports missing package "' + spec + '" — removing it');
    return '';
  });

  for (const entry of unresolved) {
    for (const name of entry.names) {
      // Drop the whole conditional operand first (\`mode === 'x' && plugin()\`)
      // so no dangling \`&&\` is left behind.
      const cond = new RegExp('[^,\\\\[\\\\]]*(?:&&|\\\\|\\\\|)\\\\s*' + name + '\\\\s*\\\\([^()]*\\\\)\\\\s*,?', 'g');
      src = src.replace(cond, '');
      const call = new RegExp('(^|[,\\\\[\\\\s])' + name + '\\\\s*\\\\([^()]*\\\\)\\\\s*,?', 'g');
      src = src.replace(call, '$1');
      const bare = new RegExp('(^|[,\\\\[\\\\s])' + name + '\\\\s*,', 'g');
      src = src.replace(bare, '$1');
    }
  }
  // Clean up artefacts left behind by removed plugin entries.
  src = src.replace(/,\\s*,/g, ',').replace(/\\[\\s*,/g, '[').replace(/,\\s*\\]/g, ']');
  src = src.replace(/(?:&&|\\|\\|)\\s*(?=[,\\]\\)])/g, '').replace(/&&\\s*,/g, ',').replace(/\\.filter\\(Boolean\\)\\s*\\.filter\\(Boolean\\)/g, '.filter(Boolean)');

  if (/__dirname/.test(src) && !/fileURLToPath/.test(src) && !/\\.cjs$/.test(file)) {
    src = 'import { fileURLToPath as __cprToPath } from "url";\\nimport { dirname as __cprDirname } from "path";\\nconst __dirname = __cprDirname(__cprToPath(import.meta.url));\\n' + src;
  }

  if (src !== original) {
    try { fs.writeFileSync(file, src); } catch (e) { return false; }
    return true;
  }

  // Nothing removable — fall back to a minimal, always-loadable config.
  if (!resolvable('vite')) return false;
  const outDir = (original.match(/outDir\\s*:\\s*["'\`]([^"'\`$]+)["'\`]/) || [])[1] || 'dist';
  const wantsReact = fs.existsSync('package.json') && /"react"\\s*:/.test(fs.readFileSync('package.json', 'utf8'));
  const plugin = wantsReact && resolvable('@vitejs/plugin-react') ? '@vitejs/plugin-react'
    : wantsReact && resolvable('@vitejs/plugin-react-swc') ? '@vitejs/plugin-react-swc' : null;
  const minimal = [
    'import { defineConfig } from "vite";',
    'import path from "path";',
    plugin ? 'import react from "' + plugin + '";' : '',
    'export default defineConfig({',
    plugin ? '  plugins: [react()],' : '  plugins: [],',
    '  resolve: { alias: { "@": path.resolve(process.cwd(), "./src") } },',
    '  build: { outDir: "' + outDir + '" },',
    '});',
    ''
  ].filter(Boolean).join('\\n');
  try {
    fs.writeFileSync(file, minimal);
    console.log('[cpr:config] ' + file + ' could not be loaded — replaced with a minimal Vite config (outDir: ' + outDir + ')');
    return true;
  } catch (e) { return false; }
}

function applyModuleFix(mod) {
  if (mod.fix === 'repair-config') return repairConfig(mod.specifier || mod.file);
  if (mod.fix === 'add-extension') return addExtensions(mod.file);
  if (mod.fix === 'remove-cra-artifacts') return removeCraArtifacts();
  if (mod.fix === 'convert-require-to-import') return convertRequires(mod.file);
  if (mod.fix === 'remove-type-module') return removeTypeModule();
  return false;
}

function packageFromSpecifier(spec) {
  if (!spec || /^[./]|^node:|^virtual:|^data:|^https?:|^@\\//.test(spec)) return null;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function extractMissing(output) {
  const patterns = [
    /failed to resolve import\\s+["']([^"']+)["']/i,
    /Cannot find module\\s+["']([^"']+)["']/i,
    /Cannot find package\\s+["']([^"']+)["']/i,
    /Failed to load url\\s+([^\\s]+)\\s/i,
    /Module not found:?[^"'\\n]*["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = output.match(re);
    if (m && m[1]) { const n = packageFromSpecifier(m[1]); if (n) return n; }
  }
  return null;
}

for (let attempt = 0; attempt <= MAX; attempt++) {
  const build = run(CMD);
  report.attempts = attempt + 1;
  if (build.ok) { report.succeeded = true; save(); process.exit(0); }
  report.finalError = build.output.slice(-4000);
  if (attempt === MAX) break;
  const mod = detectModuleError(build.output);
  if (mod && !report.module_errors_auto_fixed.some(function (x) { return x.pattern === mod.pattern; })) {
    if (applyModuleFix(mod)) {
      report.module_errors_auto_fixed.push({ pattern: mod.pattern, fix: mod.fix, file: mod.file || null });
      console.log('[cpr:module] ' + mod.pattern + ' → ' + mod.fix + '; rebuilding');
      continue;
    }
  }
  if (!/failed to resolve import|cannot find module|module not found/i.test(build.output)) break;
  const name = extractMissing(build.output);
  if (!name || report.attemptedPackages.indexOf(name) !== -1) break;
  report.attemptedPackages.push(name);
  let version = null;
  try { version = execSync('npm view ' + JSON.stringify(name) + ' version', { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); } catch (e) {}
  if (!version) break;
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies[name] = '^' + version;
    pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort((a, b) => a[0].localeCompare(b[0])));
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
  } catch (e) { break; }
  report.added.push({ name: name, version: '^' + version, source: 'build-retry', reason: 'Required by the build but missing from package.json.' });
  console.log('[cpr:retry] installing ' + name + '@^' + version + ' and rebuilding (attempt ' + (attempt + 2) + '/' + (MAX + 1) + ')');
  const install = run('npm install --no-audit --no-fund');
  if (!install.ok) { report.finalError = install.output.slice(-4000); break; }
}

save();
console.error('[cpr:retry] build failed after ' + report.attempts + ' attempt(s). Packages attempted: ' + (report.attemptedPackages.join(', ') || 'none'));
process.exit(1);
`;

/** Fail-closed verification of the compiled production bundle. */
export const BUILD_INTEGRITY_JS = `/* CPR production build integrity */
const fs = require('fs'); const path = require('path');
const root = process.env.NB_WEB_DIR || 'dist';
const report = { bundle_leaked_localhost_reference: [], production_mode_verified: false, env_substitution_verified: { verified: true, failed: [] } };
function walk(dir, out) { out = out || []; let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; } for (const e of es) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, out); else if (/\\.m?js$/.test(e.name)) out.push(f); } return out; }
for (const file of walk(root)) { const text = fs.readFileSync(file, 'utf8'); const hit = text.match(/localhost|127\\.0\\.0\\.1|192\\.168\\.|10\\.0\\.0\\./i); if (hit) report.bundle_leaked_localhost_reference.push({ file, context: text.slice(Math.max(0, hit.index - 100), hit.index + hit[0].length + 100) }); if (/import\\.meta\\.env\\.(?:DEV|PROD)/.test(text)) report.production_mode_verified = false; }
report.production_mode_verified = report.bundle_leaked_localhost_reference.length === 0 && !walk(root).some(f => /import\\.meta\\.env\\.(?:DEV|PROD)/.test(fs.readFileSync(f, 'utf8')));
const env = fs.existsSync('.env.production') ? fs.readFileSync('.env.production', 'utf8') : ''; for (const line of env.split(/\\r?\\n/)) { const m = line.match(/^(VITE_[A-Z0-9_]+)=(.*)$/); if (m && m[2] && !walk(root).some(f => fs.readFileSync(f, 'utf8').includes(m[2]))) report.env_substitution_verified.failed.push(m[1]); }
report.env_substitution_verified.verified = report.env_substitution_verified.failed.length === 0;
fs.writeFileSync('cpr-build-integrity.json', JSON.stringify(report, null, 2));
if (report.bundle_leaked_localhost_reference.length || !report.production_mode_verified || !report.env_substitution_verified.verified) process.exit(1);
`;
