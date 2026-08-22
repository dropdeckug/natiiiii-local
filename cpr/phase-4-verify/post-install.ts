/**
 * CPR post-install remediation script (Categories 2, 7 and 8).
 *
 * Runs on the build runner immediately after the install command and before
 * the build command:
 *   2. duplicate React detection → npm dedupe → resolutions fallback
 *   7. npm dedupe (always, never skipped)
 *   8. post-install verification (react/react-dom parity, Capacitor peer
 *      acceptance, vite ↔ plugin peers, typescript ↔ @types/react)
 *
 * Writes cpr-post-install.json. Exits 1 ONLY when a verification check fails
 * and its automatic fix also failed after one retry — that is a red blocking
 * condition and the build must not proceed.
 *
 * Keep in sync with supabase/functions/_shared/cprRunnerScripts.ts.
 */
export const POST_INSTALL_JS = `/* CPR post-install verification */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT = 'cpr-post-install.json';
const report = {
  duplicate_react_detected: false,
  duplicate_react_resolved: false,
  dedupe_packages_collapsed: 0,
  post_install_verification: [],
  wrong_dependency_resolved: [],
  scope_reresolutions: [],
  capacitor_plugin_corrections: [],
  critical_packages_pinned: [],
  dependencies_placement_corrected: [],
  blocking: [],
  notes: [],
};

function save() { try { fs.writeFileSync(OUT, JSON.stringify(report, null, 2)); } catch (e) {} }
function finish() { save(); process.exit(report.blocking.length ? 1 : 0); }
function log(m) { console.log('[cpr:post-install] ' + m); }

function run(cmd) {
  try {
    const out = execSync(cmd + ' 2>&1', { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, output: String((e.stdout || '') + (e.stderr || '') || (e && e.message)) };
  }
}

const ROOT = process.cwd();
const NM = path.join(ROOT, 'node_modules');
const PKG_PATH = path.join(ROOT, 'package.json');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function installed(name) { return readJson(path.join(NM, name, 'package.json')); }
function version(name) { const m = installed(name); return m && m.version ? m.version : null; }
function check(name, passed, detail) {
  report.post_install_verification.push({ check: name, result: passed ? 'pass' : 'fail', detail: detail || '' });
  log((passed ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
}

if (!fs.existsSync(NM)) {
  report.notes.push('node_modules missing — post-install verification skipped.');
  finish();
}

let pkg = readJson(PKG_PATH) || {};

/* ---------------------------------- category 2 — duplicate React ------- */
function nestedReactPaths() {
  const hits = [];
  let entries = [];
  try { entries = fs.readdirSync(NM); } catch (e) { return hits; }
  const scan = (dir, label) => {
    const nested = path.join(dir, 'node_modules', 'react', 'package.json');
    if (fs.existsSync(nested)) hits.push(label + '/node_modules/react');
  };
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'react') continue;
    const full = path.join(NM, entry);
    if (entry.startsWith('@')) {
      let inner = [];
      try { inner = fs.readdirSync(full); } catch (e) { continue; }
      for (const sub of inner) scan(path.join(full, sub), entry + '/' + sub);
    } else scan(full, entry);
  }
  return hits;
}

const topReact = fs.existsSync(path.join(NM, 'react', 'package.json'));
if (topReact) {
  let nested = nestedReactPaths();
  if (nested.length) {
    report.duplicate_react_detected = true;
    log('duplicate React installations: ' + nested.join(', '));
    run('npm dedupe --legacy-peer-deps');
    nested = nestedReactPaths();
    if (!nested.length) {
      report.duplicate_react_resolved = true;
      log('npm dedupe collapsed all nested React copies.');
    } else {
      pkg = readJson(PKG_PATH) || pkg;
      const rv = (pkg.dependencies && pkg.dependencies.react) || ('^' + (version('react') || '18.3.1'));
      const rdv = (pkg.dependencies && pkg.dependencies['react-dom']) || rv;
      pkg.resolutions = Object.assign({}, pkg.resolutions, { react: rv, 'react-dom': rdv });
      pkg.overrides = Object.assign({}, pkg.overrides, { react: rv, 'react-dom': rdv });
      fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\\n');
      const re = run('npm install --legacy-peer-deps --no-audit --no-fund');
      report.duplicate_react_resolved = re.ok && nestedReactPaths().length === 0;
      log('resolutions pin applied; resolved=' + report.duplicate_react_resolved);
    }
  }
}

/* ---------------------------------- category 7 — dedupe (always) ------- */
const before = countPackages();
const dedupe = run('npm dedupe --legacy-peer-deps');
if (!dedupe.ok) report.notes.push('npm dedupe reported an error; continuing.');
const after = countPackages();
report.dedupe_packages_collapsed = Math.max(0, before - after);
log('dedupe collapsed ' + report.dedupe_packages_collapsed + ' package copies.');

function countPackages() {
  let total = 0;
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.name.startsWith('@')) { walk(full, depth); continue; }
      total++;
      const inner = path.join(full, 'node_modules');
      if (fs.existsSync(inner)) walk(inner, depth + 1);
    }
  };
  walk(NM, 0);
  return total;
}

/* --------------------------- category 8 — post-install verification ---- */
function satisfies(v, range) {
  if (!v || !range) return true;
  if (range === '*' || range === 'latest' || /workspace:|file:|link:/.test(range)) return true;
  const parts = String(range).split('||').map(function (s) { return s.trim(); });
  const cur = v.split('-')[0].split('.').map(Number);
  for (const part of parts) {
    const m = part.match(/^([\\^~>=]*)\\s*(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?/);
    if (!m) return true;
    const op = m[1] || '=';
    const t = [Number(m[2]), Number(m[3] || 0), Number(m[4] || 0)];
    const cmp = cur[0] - t[0] || (cur[1] || 0) - t[1] || (cur[2] || 0) - t[2];
    if (op.indexOf('^') === 0) { if (cur[0] === t[0] && cmp >= 0) return true; }
    else if (op.indexOf('~') === 0) { if (cur[0] === t[0] && (cur[1] || 0) === t[1] && cmp >= 0) return true; }
    else if (op.indexOf('>=') === 0) { if (cmp >= 0) return true; }
    else if (cmp === 0) return true;
  }
  return false;
}

function reinstall(reason) {
  log('re-installing after fix: ' + reason);
  return run('npm install --legacy-peer-deps --no-audit --no-fund').ok;
}

function setDep(name, range) {
  pkg = readJson(PKG_PATH) || pkg;
  if (pkg.devDependencies && pkg.devDependencies[name]) pkg.devDependencies[name] = range;
  else { pkg.dependencies = pkg.dependencies || {}; pkg.dependencies[name] = range; }
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\\n');
}

/* Correctness checks use the installed package surface, not just manifests. */
function sourceFiles(dir, out) {
  out = out || [];
  let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) { const f = path.join(dir, e.name); if (e.isDirectory() && e.name !== 'node_modules') sourceFiles(f, out); else if (/\.(m?js|jsx|ts|tsx)$/.test(e.name)) out.push(f); }
  return out;
}
function packageName(spec) { if (!spec || /^[.\/]|^node:|^@\//.test(spec)) return null; const p = spec.split('/'); return spec[0] === '@' ? p.slice(0, 2).join('/') : p[0]; }
function exportedNames(manifest) {
  const names = new Set();
  for (const key of ['exports', 'types', 'typings', 'main', 'module']) { const v = manifest && manifest[key]; if (typeof v === 'string') { const text = readText(path.join(NM, manifest.name || '', v)); (text.match(/export\s+(?:declare\s+)?(?:const|function|class|interface|type)\s+([A-Za-z_$][\w$]*)/g) || []).forEach(x => names.add(x.replace(/^.*\s/, ''))); } }
  return names;
}
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }
function runResolutionChecks() {
  for (const file of sourceFiles(path.join(ROOT, 'src'))) {
    const text = readText(file);
    const re = /import\s+([^;\n]+?)\s+from\s+['"]([^'"]+)['"]/g; let m;
    while ((m = re.exec(text))) {
      const pkgName = packageName(m[2]); const manifest = pkgName && installed(pkgName); if (!manifest) continue;
      const names = []; const braces = m[1].match(/\{([^}]*)\}/); if (braces) braces[1].split(',').forEach(x => names.push(x.trim().split(/\s+as\s+/i)[0]));
      const exports = exportedNames(manifest);
      for (const name of names) if (name && name !== 'type' && exports.size && !exports.has(name)) report.wrong_dependency_resolved.push({ importName: name, file: path.relative(ROOT, file), package: pkgName });
    }
  }
  const pkg = readJson(PKG_PATH) || {};
  const all = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  for (const name of Object.keys(all)) if (name.startsWith('@capacitor/')) {
    if (name === '@capacitor/google-auth') { setDep(name, '0.0.0'); delete pkg.dependencies[name]; delete pkg.devDependencies[name]; pkg.dependencies['@codetrix-studio/capacitor-google-auth'] = '^3.3.0'; fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n'); report.capacitor_plugin_corrections.push({ invalid: name, corrected: '@codetrix-studio/capacitor-google-auth' }); }
  }
  const critical = ['react','react-dom','vite','@vitejs/plugin-react','@vitejs/plugin-vue','typescript','@capacitor/core','@capacitor/cli','@capacitor/android','@capacitor/ios'];
  const current = readJson(PKG_PATH) || {};
  for (const name of critical) { const bucket = current.dependencies && current.dependencies[name] ? current.dependencies : current.devDependencies && current.devDependencies[name] ? current.devDependencies : null; if (bucket && !/^(workspace:|file:|link:)/.test(bucket[name])) { bucket[name] = bucket[name].replace(/^[^0-9]*/, ''); report.critical_packages_pinned.push({ name, version: bucket[name] }); } }
  fs.writeFileSync(PKG_PATH, JSON.stringify(current, null, 2) + '\n');
  for (const name of Object.keys(current.devDependencies || {})) if (all[name] && report.dependencies_placement_corrected.indexOf(name) < 0) { if (report.wrong_dependency_resolved.some(x => x.package === name)) { current.dependencies = current.dependencies || {}; current.dependencies[name] = current.devDependencies[name]; delete current.devDependencies[name]; report.dependencies_placement_corrected.push(name); } }
}
runResolutionChecks();

/* 8a — react / react-dom parity */
(function () {
  const r = version('react');
  const rd = version('react-dom');
  if (!r || !rd) { check('react/react-dom present', true, 'React not used by this project.'); return; }
  if (r === rd) { check('react/react-dom version parity', true, r); return; }
  const higher = satisfies(r, '>=' + rd) ? r : rd;
  setDep('react', '^' + higher);
  setDep('react-dom', '^' + higher);
  reinstall('react/react-dom mismatch ' + r + ' vs ' + rd);
  const ok = version('react') === version('react-dom');
  check('react/react-dom version parity', ok, ok ? 'aligned to ' + version('react') : r + ' vs ' + rd);
  if (!ok) report.blocking.push('react (' + r + ') and react-dom (' + rd + ') could not be aligned. Set both to the same version in package.json.');
})();

/* 8b — Capacitor plugins accept the installed @capacitor/core */
(function () {
  const core = version('@capacitor/core');
  if (!core) { check('capacitor core peer acceptance', true, 'Capacitor core not installed yet.'); return; }
  let scoped = [];
  try { scoped = fs.readdirSync(path.join(NM, '@capacitor')); } catch (e) {}
  const bad = [];
  for (const name of scoped) {
    if (name === 'core') continue;
    const manifest = installed('@capacitor/' + name);
    const peer = manifest && manifest.peerDependencies && manifest.peerDependencies['@capacitor/core'];
    if (peer && !satisfies(core, peer)) bad.push({ name: '@capacitor/' + name, peer: peer });
  }
  if (!bad.length) { check('capacitor core peer acceptance', true, 'core ' + core); return; }
  for (const b of bad) setDep(b.name, '^' + core.split('.')[0] + '.0.0');
  reinstall('capacitor plugin peers rejected core ' + core);
  const still = bad.filter(function (b) {
    const manifest = installed(b.name);
    const peer = manifest && manifest.peerDependencies && manifest.peerDependencies['@capacitor/core'];
    return peer && !satisfies(version('@capacitor/core'), peer);
  });
  check('capacitor core peer acceptance', still.length === 0, still.map(function (b) { return b.name + ' wants ' + b.peer; }).join(', '));
  if (still.length) report.blocking.push('These Capacitor plugins do not support @capacitor/core ' + core + ': ' + still.map(function (b) { return b.name; }).join(', ') + '. Remove or upgrade them.');
})();

/* 8c — vite ↔ plugin peer compatibility */
(function () {
  const vite = version('vite');
  if (!vite) { check('vite plugin compatibility', true, 'Vite not used by this project.'); return; }
  const plugins = ['@vitejs/plugin-react', '@vitejs/plugin-react-swc', '@vitejs/plugin-vue'];
  const bad = [];
  for (const p of plugins) {
    const manifest = installed(p);
    const peer = manifest && manifest.peerDependencies && manifest.peerDependencies.vite;
    if (peer && !satisfies(vite, peer)) bad.push(p + ' wants vite ' + peer);
  }
  check('vite plugin compatibility', bad.length === 0, bad.length ? bad.join(', ') : 'vite ' + vite);
  if (bad.length) report.notes.push('Vite plugin peer mismatch: ' + bad.join(', '));
})();

/* 8d — typescript ↔ @types/react */
(function () {
  const ts = version('typescript');
  const types = version('@types/react');
  if (!ts || !types) { check('typescript/@types/react compatibility', true, 'Not applicable.'); return; }
  const tsMajor = Number(ts.split('.')[0]);
  const ok = tsMajor >= 4;
  check('typescript/@types/react compatibility', ok, 'typescript ' + ts + ', @types/react ' + types);
  if (!ok) report.notes.push('TypeScript ' + ts + ' is too old for @types/react ' + types + '.');
})();

if (report.blocking.length) {
  console.error('[cpr:post-install] BLOCKING: ' + report.blocking.join(' | '));
}
finish();
`;
