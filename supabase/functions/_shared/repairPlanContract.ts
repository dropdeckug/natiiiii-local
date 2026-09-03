/**
 * Runner-executed AI repair — shared contract.
 *
 * The AI never runs commands. It analyses the real installer output and emits
 * a `repair-plan.json`; the GitHub Actions runner is the only component that
 * executes anything, and only commands that survive this whitelist twice:
 * once in the edge function before the plan is returned, once in the executor
 * before the process is spawned.
 *
 * This module is the single source of truth for:
 *   • the diagnosis vocabulary
 *   • the command whitelist + argv validator
 *   • the deterministic classifier (evidence -> diagnosis -> commands)
 *   • the executor script text inlined into the workflow
 *
 * Mirrored by `cpr/phase-4-verify/repair-plan.ts` (re-export, never a copy).
 */

export type RepairDiagnosisType =
  | "LOCKFILE_MISMATCH"
  | "DEPENDENCY_CONFLICT"
  | "MISSING_FILE"
  | "SCRIPT_FAILURE"
  | "REGISTRY_404"
  | "ENGINE_MISMATCH"
  | "NETWORK"
  | "DISK_SPACE"
  | "UNKNOWN";

export interface RepairCommand {
  step: number;
  name: string;
  /** Full command line. Parsed to argv and validated before execution. */
  cmd: string;
  critical: boolean;
  why: string;
}

export interface RepairDiagnosis {
  type: RepairDiagnosisType;
  severity: "low" | "medium" | "high";
  rootCause: string;
  evidence: string[];
}

export interface RepairPlan {
  diagnosis: RepairDiagnosis;
  commands: RepairCommand[];
  /** Read-only checks run after the commands to confirm the repair worked. */
  verify: string[];
  /** Restorative commands run when a critical command fails. */
  rollback: string[];
  source: "deterministic" | "model";
  attempt: number;
  model?: string;
  notes?: string;
}

/* ─────────────────────────── command whitelist ─────────────────────────── */

/** Executables the runner may spawn. Nothing else, ever. */
export const ALLOWED_BINARIES = ["rm", "npm", "npx", "node", "mkdir", "touch", "cp", "ls", "corepack", "yarn", "pnpm"] as const;

/** Shell metacharacters that must never appear in a planned command. */
const SHELL_META = /[;&|`$><\n\r\\]|\|\||&&|\$\(/;

const DESTRUCTIVE_ALLOWED = new Set([
  "node_modules",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  ".npmrc",
  "dependency-install.log",
]);

const FORBIDDEN_PATH = /(^\/|^~|\.\.|^\.github(\/|$)|\.(keystore|jks|p12|pem|mobileprovision)$|^\.env)/;

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  argv?: string[];
}

/** Splits a command line into argv without invoking a shell. */
export function parseArgv(cmd: string): string[] {
  return String(cmd).trim().split(/\s+/).filter(Boolean);
}

/**
 * Validates one planned command. Rejects shell metacharacters, unknown
 * binaries, destructive targets outside the dependency surface, and any path
 * that escapes the workspace.
 */
export function validateCommand(cmd: unknown): ValidationResult {
  if (typeof cmd !== "string" || !cmd.trim()) return { ok: false, reason: "empty command" };
  if (cmd.length > 400) return { ok: false, reason: "command too long" };
  if (SHELL_META.test(cmd)) return { ok: false, reason: "shell metacharacters are not allowed" };

  const argv = parseArgv(cmd);
  const bin = argv[0];
  if (!(ALLOWED_BINARIES as readonly string[]).includes(bin)) {
    return { ok: false, reason: `binary "${bin}" is not whitelisted` };
  }

  const args = argv.slice(1);
  const paths = args.filter((a) => !a.startsWith("-"));

  if (bin === "rm") {
    if (paths.length === 0) return { ok: false, reason: "rm without a target" };
    for (const p of paths) {
      const clean = p.replace(/^\.\//, "").replace(/\/+$/, "");
      if (!DESTRUCTIVE_ALLOWED.has(clean)) return { ok: false, reason: `rm target "${p}" is not a dependency artifact` };
    }
  }

  if (bin === "node") {
    const script = paths[0] ?? "";
    if (!script || FORBIDDEN_PATH.test(script)) return { ok: false, reason: "node script must be a workspace-relative file" };
  }

  for (const p of paths) {
    if (FORBIDDEN_PATH.test(p)) return { ok: false, reason: `path "${p}" escapes the workspace or is protected` };
  }

  if (bin === "npm" || bin === "npx" || bin === "yarn" || bin === "pnpm") {
    if (args.some((a) => a === "publish" || a === "login" || a === "token" || a === "adduser")) {
      return { ok: false, reason: "registry account commands are not allowed" };
    }
  }

  return { ok: true, argv };
}

/** Filters a plan down to commands that pass validation. */
export function sanitizePlan(plan: RepairPlan): { plan: RepairPlan; rejected: { cmd: string; reason: string }[] } {
  const rejected: { cmd: string; reason: string }[] = [];
  const commands = (plan.commands || []).filter((c) => {
    const v = validateCommand(c?.cmd);
    if (!v.ok) rejected.push({ cmd: String(c?.cmd ?? ""), reason: v.reason || "rejected" });
    return v.ok;
  }).map((c, i) => ({ ...c, step: i + 1 }));

  const verify = (plan.verify || []).filter((c) => validateCommand(c).ok);
  const rollback = (plan.rollback || []).filter((c) => validateCommand(c).ok);

  return { plan: { ...plan, commands, verify, rollback }, rejected };
}

/* ───────────────────────── deterministic classifier ────────────────────── */

const pick = (log: string, re: RegExp, max = 3): string[] => {
  const out: string[] = [];
  for (const line of log.split("\n")) {
    if (re.test(line)) out.push(line.trim().slice(0, 240));
    if (out.length >= max) break;
  }
  return out;
};

export interface ClassifierInput {
  installLog: string;
  contractLog?: string;
  lockfileName?: string;
  packageManager?: string;
}

/**
 * Maps the real installer output to a diagnosis and the commands that fix it.
 * Returns UNKNOWN when no pattern matches — the caller then escalates to the
 * model instead of guessing.
 */
export function classifyInstallFailure(input: ClassifierInput): RepairPlan {
  const log = `${input.installLog || ""}\n${input.contractLog || ""}`;
  const lock = input.lockfileName || "package-lock.json";
  const pm = input.packageManager || "npm";
  const base = { verify: ["npm ls --depth=0"], rollback: [], source: "deterministic" as const, attempt: 1 };

  if (/npm ci can only install|Missing: .+ from lock ?file|lock ?file drifted|EUSAGE/i.test(log)) {
    return {
      ...base,
      diagnosis: {
        type: "LOCKFILE_MISMATCH",
        severity: "high",
        rootCause: "package.json and the lockfile describe different dependency graphs, so `npm ci` refuses to install.",
        evidence: pick(log, /npm ci can only install|Missing: |drifted|EUSAGE/i),
      },
      commands: [
        { step: 1, name: "Remove the drifted lockfile", cmd: `rm -f ${lock}`, critical: false, why: "Force regeneration from package.json" },
        { step: 2, name: "Regenerate the lockfile", cmd: "npm install --package-lock-only --no-audit --no-fund", critical: true, why: "Rebuild a lockfile that matches the manifest" },
        { step: 3, name: "Clean install", cmd: "npm ci --no-audit --no-fund", critical: true, why: "Install exactly what the new lockfile pins" },
      ],
    };
  }

  if (/ERESOLVE|peer dep missing|could not resolve dependency|conflicting peer dependency/i.test(log)) {
    return {
      ...base,
      diagnosis: {
        type: "DEPENDENCY_CONFLICT",
        severity: "medium",
        rootCause: "Peer dependency ranges conflict, so npm cannot build a single dependency tree.",
        evidence: pick(log, /ERESOLVE|peer dep|Conflicting peer|Found:|Could not resolve/i),
      },
      commands: [
        { step: 1, name: "Install ignoring strict peers", cmd: "npm install --legacy-peer-deps --no-audit --no-fund", critical: true, why: "npm 7+ peer resolution is stricter than the tree the app actually needs" },
        { step: 2, name: "Deduplicate", cmd: "npm dedupe --legacy-peer-deps", critical: false, why: "Collapse duplicated transitive copies" },
      ],
    };
  }

  if (/E404|404 Not Found - GET|is not in this registry|Invalid package name|Unsupported URL Type/i.test(log)) {
    return {
      ...base,
      diagnosis: {
        type: "REGISTRY_404",
        severity: "high",
        rootCause: "package.json references a package name or specifier the registry cannot serve.",
        evidence: pick(log, /E404|404 Not Found|not in this registry|Invalid package name|Unsupported URL Type/i),
      },
      // A bad specifier is a manifest problem: the runner cannot invent the
      // right name. Retry once without the lockfile, then hand back to the
      // source-level repair agent.
      commands: [
        { step: 1, name: "Retry resolution from the manifest", cmd: `rm -f ${lock}`, critical: false, why: "The lockfile may pin a stale tarball URL" },
        { step: 2, name: "Reinstall", cmd: "npm install --no-audit --no-fund --legacy-peer-deps", critical: true, why: "Re-resolve every specifier against the registry" },
      ],
    };
  }

  if (/ENOENT|Cannot find module|no such file or directory/i.test(log)) {
    return {
      ...base,
      diagnosis: {
        type: "MISSING_FILE",
        severity: "high",
        rootCause: "The dependency tree on disk is incomplete or corrupt.",
        evidence: pick(log, /ENOENT|Cannot find module|no such file/i),
      },
      commands: [
        { step: 1, name: "Drop node_modules", cmd: "rm -rf node_modules", critical: false, why: "Remove the partial tree" },
        { step: 2, name: "Drop the lockfile", cmd: `rm -f ${lock}`, critical: false, why: "It may point at missing tarballs" },
        { step: 3, name: "Clear the npm cache", cmd: "npm cache clean --force", critical: false, why: "Corrupt cache entries reproduce the same ENOENT" },
        { step: 4, name: "Fresh install", cmd: "npm install --no-audit --no-fund --legacy-peer-deps", critical: true, why: "Rebuild the tree from scratch" },
      ],
    };
  }

  if (/ELIFECYCLE|postinstall|preinstall script|command failed with exit code/i.test(log)) {
    return {
      ...base,
      diagnosis: {
        type: "SCRIPT_FAILURE",
        severity: "medium",
        rootCause: "A package lifecycle script failed on the runner.",
        evidence: pick(log, /ELIFECYCLE|postinstall|preinstall|exit code/i),
      },
      commands: [
        { step: 1, name: "Install without lifecycle scripts", cmd: "npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps", critical: true, why: "Native postinstall scripts are not needed for a web bundle" },
      ],
    };
  }

  if (/Unsupported engine|EBADENGINE|requires Node/i.test(log)) {
    return {
      ...base,
      diagnosis: {
        type: "ENGINE_MISMATCH",
        severity: "medium",
        rootCause: "A dependency declares a Node engine range the runner does not satisfy.",
        evidence: pick(log, /Unsupported engine|EBADENGINE|requires Node/i),
      },
      commands: [
        { step: 1, name: "Install ignoring engine ranges", cmd: "npm install --force --no-audit --no-fund --legacy-peer-deps", critical: true, why: "Engine ranges are advisory for a browser bundle" },
      ],
    };
  }

  if (/ETIMEDOUT|ECONNRESET|ENOTFOUND registry|network timeout|socket hang up/i.test(log)) {
    return {
      ...base,
      diagnosis: {
        type: "NETWORK",
        severity: "low",
        rootCause: "A transient registry/network failure interrupted the install.",
        evidence: pick(log, /ETIMEDOUT|ECONNRESET|ENOTFOUND|network timeout|socket hang up/i),
      },
      commands: [
        { step: 1, name: "Retry the install", cmd: `${pm === "npm" ? "npm" : pm} install --no-audit --no-fund`, critical: true, why: "Network failures usually clear on a retry" },
      ],
    };
  }

  if (/ENOSPC|no space left on device/i.test(log)) {
    return {
      ...base,
      diagnosis: {
        type: "DISK_SPACE",
        severity: "high",
        rootCause: "The runner ran out of disk while installing.",
        evidence: pick(log, /ENOSPC|no space left/i),
      },
      commands: [
        { step: 1, name: "Clear the npm cache", cmd: "npm cache clean --force", critical: false, why: "Reclaim cache space" },
        { step: 2, name: "Reinstall lean", cmd: "npm install --no-audit --no-fund --omit=optional", critical: true, why: "Skip optional native downloads" },
      ],
    };
  }

  return {
    ...base,
    diagnosis: {
      type: "UNKNOWN",
      severity: "high",
      rootCause: "No deterministic pattern matched the installer output.",
      evidence: log.split("\n").filter((l) => /err|error|fail/i.test(l)).slice(-5).map((l) => l.trim().slice(0, 240)),
    },
    commands: [],
  };
}

/** Stable signature so the runner never executes the same failing plan twice. */
export function planSignature(plan: RepairPlan): string {
  return `${plan.diagnosis.type}::${plan.commands.map((c) => c.cmd).join("|")}`;
}

/* ────────────────────────────── executor script ────────────────────────── */

export const REPAIR_EXECUTOR_FILENAME = "nb-repair-executor.cjs";

/**
 * Runner-side executor. Requests a plan, validates it again locally, executes
 * with execFileSync (never a shell string), verifies, and loops up to
 * NB_REPAIR_MAX_ATTEMPTS. Writes repair-plan.json + repair-execution.log.
 */
export const REPAIR_EXECUTOR_JS = String.raw`
const fs = require('fs');
const { execFileSync } = require('child_process');

const ALLOWED = ${JSON.stringify(ALLOWED_BINARIES)};
const DESTRUCTIVE_ALLOWED = ${JSON.stringify([...DESTRUCTIVE_ALLOWED])};
const SHELL_META = /[;&|` + "`" + `$><\n\r\\]|\|\||&&|\$\(/;
const FORBIDDEN_PATH = /(^\/|^~|\.\.|^\.github(\/|$)|\.(keystore|jks|p12|pem|mobileprovision)$|^\.env)/;

const LOG = 'repair-execution.log';
function log(line) {
  const s = String(line);
  process.stdout.write(s + '\n');
  try { fs.appendFileSync(LOG, s + '\n'); } catch (e) {}
}

function validate(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) return 'empty command';
  if (cmd.length > 400) return 'command too long';
  if (SHELL_META.test(cmd)) return 'shell metacharacters are not allowed';
  const argv = cmd.trim().split(/\s+/).filter(Boolean);
  if (ALLOWED.indexOf(argv[0]) === -1) return 'binary "' + argv[0] + '" is not whitelisted';
  const paths = argv.slice(1).filter(function (a) { return a.indexOf('-') !== 0; });
  if (argv[0] === 'rm') {
    if (!paths.length) return 'rm without a target';
    for (const p of paths) {
      const clean = p.replace(/^\.\//, '').replace(/\/+$/, '');
      if (DESTRUCTIVE_ALLOWED.indexOf(clean) === -1) return 'rm target "' + p + '" is not a dependency artifact';
    }
  }
  for (const p of paths) if (FORBIDDEN_PATH.test(p)) return 'path "' + p + '" is protected';
  return null;
}

function read(file, limit) {
  try { const s = fs.readFileSync(file, 'utf8'); return limit ? s.slice(-limit) : s; } catch (e) { return ''; }
}

function lockfileName() {
  const c = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
  for (const f of c) if (fs.existsSync(f)) return f;
  return '';
}

function backupLockfiles() {
  try {
    fs.mkdirSync('/tmp/nb-repair-backup', { recursive: true });
    const l = lockfileName();
    if (l) fs.copyFileSync(l, '/tmp/nb-repair-backup/' + l);
    if (fs.existsSync('package.json')) fs.copyFileSync('package.json', '/tmp/nb-repair-backup/package.json');
  } catch (e) {}
}

function restoreLockfile() {
  try {
    const dir = '/tmp/nb-repair-backup';
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) if (f !== 'package.json') fs.copyFileSync(dir + '/' + f, f);
    log('  ↺ restored ' + fs.readdirSync(dir).join(', '));
  } catch (e) {}
}

function run(cmd) {
  const argv = cmd.trim().split(/\s+/).filter(Boolean);
  const started = Date.now();
  try {
    const out = execFileSync(argv[0], argv.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024, env: process.env });
    return { ok: true, exitCode: 0, output: String(out).slice(-8000), ms: Date.now() - started };
  } catch (e) {
    const output = String((e.stdout || '') + (e.stderr || '') || e.message || '').slice(-8000);
    return { ok: false, exitCode: typeof e.status === 'number' ? e.status : 1, output: output, ms: Date.now() - started };
  }
}

function post(pathSuffix, payload) {
  const url = process.env.NB_REPAIR_ENDPOINT;
  if (!url) return Promise.resolve(null);
  return fetch(url + pathSuffix, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nb-callback-secret': process.env.NB_CALLBACK_SECRET || '',
      'Authorization': 'Bearer ' + (process.env.NB_SUPABASE_ANON_KEY || ''),
      'apikey': process.env.NB_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify(payload),
  }).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); })
    .catch(function (e) { log('  ! plan request failed: ' + e.message); return null; });
}

async function main() {
  const maxAttempts = Math.min(Number(process.env.NB_REPAIR_MAX_ATTEMPTS || 3) || 3, 3);
  const phase = process.env.NB_REPAIR_PHASE || 'phase1';
  const installCmd = process.env.NB_REPAIR_INSTALL_CMD || 'npm ci --no-audit --no-fund';
  const tried = [];
  const history = [];
  let lastPlan = null;

  log('=== AI repair: install failed (exit ' + (process.env.NB_INSTALL_EXIT || '?') + ') — entering runner repair loop ===');
  backupLockfiles();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log('\n── Attempt ' + attempt + '/' + maxAttempts + ' — requesting repair plan');
    const res = await post('', {
      projectId: process.env.NB_PROJECT_ID || null,
      buildId: process.env.NB_BUILD_ID || null,
      phase: phase,
      attempt: attempt,
      installLog: read('dependency-install.log', 20000),
      contractLog: read('cpr-dependency-contract.log', 6000),
      packageJson: read('package.json', 40000),
      lockfileName: lockfileName(),
      packageManager: process.env.NB_PACKAGE_MANAGER || 'npm',
      nodeVersion: process.version,
      previousCommands: tried,
      previousResults: history,
    });

    if (!res || res.status >= 400) {
      log('  ! repair service unavailable (' + (res ? res.status : 'no response') + ')');
      break;
    }

    let plan;
    try { plan = JSON.parse(res.text); } catch (e) { log('  ! invalid plan payload'); break; }
    if (plan.error) { log('  ! ' + plan.error); break; }
    lastPlan = plan;
    try { fs.writeFileSync('repair-plan.json', JSON.stringify(plan, null, 2)); } catch (e) {}

    log('  diagnosis: ' + plan.diagnosis.type + ' (' + plan.source + ')');
    log('  root cause: ' + plan.diagnosis.rootCause);
    for (const ev of plan.diagnosis.evidence || []) log('    evidence: ' + ev);

    if (!plan.commands || !plan.commands.length) {
      log('  ! no executable commands in the plan — aborting');
      break;
    }

    const signature = plan.diagnosis.type + '::' + plan.commands.map(function (c) { return c.cmd; }).join('|');
    if (tried.indexOf(signature) !== -1) {
      log('  ! identical plan already attempted — aborting to avoid a loop');
      break;
    }
    tried.push(signature);

    let failedCritical = false;
    for (const c of plan.commands) {
      const bad = validate(c.cmd);
      if (bad) { log('  ✗ rejected "' + c.cmd + '": ' + bad); if (c.critical) failedCritical = true; continue; }
      log('\n  → ' + c.name + '\n    $ ' + c.cmd);
      const r = run(c.cmd);
      history.push({ cmd: c.cmd, exitCode: r.exitCode, ms: r.ms, tail: r.output.slice(-1200) });
      log('    ' + (r.ok ? '✓ ok' : '✗ exit ' + r.exitCode) + ' (' + Math.round(r.ms / 1000) + 's)');
      if (!r.ok) {
        log(r.output.split('\n').slice(-25).map(function (l) { return '      ' + l; }).join('\n'));
        if (c.critical) { failedCritical = true; break; }
      }
    }

    if (failedCritical) {
      log('  ! critical command failed');
      for (const rb of plan.rollback || []) { if (!validate(rb)) run(rb); }
      restoreLockfile();
      continue;
    }

    let verified = true;
    for (const v of plan.verify || []) {
      if (validate(v)) continue;
      const r = run(v);
      log('  verify $ ' + v + ' → ' + (r.ok ? 'ok' : 'exit ' + r.exitCode));
      if (!r.ok && v.indexOf('npm ls') !== 0) verified = false;
    }
    if (!fs.existsSync('node_modules')) { log('  verify: node_modules missing'); verified = false; }

    if (verified) {
      log('\n=== AI repair succeeded on attempt ' + attempt + ' (' + plan.diagnosis.type + ') ===');
      await post('', { report: true, projectId: process.env.NB_PROJECT_ID || null, buildId: process.env.NB_BUILD_ID || null, phase: phase, attempt: attempt, plan: plan, results: history, outcome: 'repaired' });
      process.exit(0);
    }

    log('  verification failed — retrying with fresh evidence');
    const re = run(installCmd);
    try { fs.writeFileSync('dependency-install.log', re.output); } catch (e) {}
    if (re.ok) {
      log('\n=== AI repair succeeded on attempt ' + attempt + ' (install now clean) ===');
      await post('', { report: true, projectId: process.env.NB_PROJECT_ID || null, buildId: process.env.NB_BUILD_ID || null, phase: phase, attempt: attempt, plan: plan, results: history, outcome: 'repaired' });
      process.exit(0);
    }
  }

  log('\n=== AI repair exhausted — dependency installation could not be completed ===');
  log('NB_REPAIR_EXHAUSTED=' + (lastPlan ? lastPlan.diagnosis.type : 'UNKNOWN'));
  await post('', { report: true, projectId: process.env.NB_PROJECT_ID || null, buildId: process.env.NB_BUILD_ID || null, phase: phase, attempt: maxAttempts, plan: lastPlan, results: history, outcome: 'exhausted' });
  process.exit(1);
}

main().catch(function (e) { log('repair executor crashed: ' + (e && e.message)); process.exit(1); });
`;
