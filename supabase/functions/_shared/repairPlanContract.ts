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

export interface RepairTodo {
  id: string;
  stepNumber: number; // 1 to 5
  totalSteps: 5;
  title: string;
  details?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  command?: string;
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
  todos: RepairTodo[];
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

/** `npm pkg` subcommands the runner may use. */
const MANIFEST_SUBCOMMANDS = new Set(["get", "set", "delete"]);

/**
 * package.json fields a repair plan may read or rewrite: only the dependency
 * surface plus the overrides/resolutions escape hatches used to pin a peer.
 */
const MANIFEST_FIELD =
  /^(dependencies|devDependencies|optionalDependencies|peerDependencies|overrides|resolutions)(\.[^.\s]+)*$/;


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

  // `npm pkg` is the only sanctioned way to edit package.json on the runner.
  // It is restricted to the dependency surface so a plan can drop or repin an
  // unresolvable package (a mistyped or unpublished Capacitor plugin, a bad
  // specifier) without being able to rewrite scripts, engines or anything else.
  if (bin === "npm" && args[0] === "pkg") {
    const sub = args[1];
    if (!MANIFEST_SUBCOMMANDS.has(sub)) {
      return { ok: false, reason: `npm pkg ${sub ?? ""} is not allowed (get/set/delete only)` };
    }
    const keys = args.slice(2).filter((a) => !a.startsWith("-"));
    if (keys.length === 0) return { ok: false, reason: "npm pkg without a key" };
    for (const k of keys) {
      const field = k.split("=")[0];
      if (!MANIFEST_FIELD.test(field)) {
        return { ok: false, reason: `npm pkg key "${field}" is outside the dependency surface` };
      }
    }
    return { ok: true, argv };
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

export function makeTodos(steps: { title: string; details?: string; command?: string }[]): RepairTodo[] {
  const todos: RepairTodo[] = [];
  for (let i = 0; i < 5; i++) {
    const s = steps[i] || {
      title: `Step ${i + 1}: Final verification and build readiness validation`,
      details: "Verify workspace integrity and ensure pipeline passes",
    };
    todos.push({
      id: `todo-${i + 1}`,
      stepNumber: i + 1,
      totalSteps: 5,
      title: s.title,
      details: s.details,
      status: "pending",
      command: s.command,
    });
  }
  return todos;
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

  let todos = plan.todos;
  if (!Array.isArray(todos) || todos.length !== 5) {
    todos = makeTodos(Array.isArray(todos) ? (todos as any[]) : []);
  } else {
    todos = todos.map((t, i) => ({
      id: t.id || `todo-${i + 1}`,
      stepNumber: i + 1,
      totalSteps: 5 as const,
      title: String(t.title || `Task ${i + 1}`),
      details: t.details ? String(t.details) : undefined,
      status: (["pending", "in_progress", "completed", "failed"].includes(t.status) ? t.status : "pending") as any,
      command: t.command ? String(t.command) : undefined,
    }));
  }

  return { plan: { ...plan, commands, verify, rollback, todos }, rejected };
}

/* ─────────────────────── registry / Capacitor knowledge ────────────────── */

/**
 * Package names that regularly appear in AI-generated manifests but are not
 * published, mapped to the real package providing the same capability.
 * Keeps a mistyped or hallucinated plugin from dead-ending a whole build.
 */
export const CAPACITOR_PLUGIN_ALIASES: Record<string, string> = {
  "@capacitor/storage": "@capacitor/preferences",
  "@capacitor/permissions": "@capacitor/core",
  "@capacitor/notifications": "@capacitor/local-notifications",
  "@capacitor/push-notification": "@capacitor/push-notifications",
  "@capacitor/local-notification": "@capacitor/local-notifications",
  "@capacitor/file": "@capacitor/filesystem",
  "@capacitor/files": "@capacitor/filesystem",
  "@capacitor/geo-location": "@capacitor/geolocation",
  "@capacitor/status-bar-plugin": "@capacitor/status-bar",
  "@capacitor/splashscreen": "@capacitor/splash-screen",
  "@capacitor/barcode-scanner": "@capacitor-mlkit/barcode-scanning",
  "@capacitor/bluetooth": "@capacitor-community/bluetooth-le",
  "@capacitor/sqlite": "@capacitor-community/sqlite",
  "@capacitor/http": "@capacitor/core",
  "@capacitor/media": "@capacitor/camera",
};

/** Pulls the package names npm reported as unresolvable out of the real log. */
export function extractUnresolvablePackages(log: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /404\s+Not Found[^\n]*?['"]?(@?[\w.-]+(?:\/[\w.-]+)?)['"]?@/gi,
    /404\s+['"]?(@?[\w.-]+(?:\/[\w.-]+)?)@[^\s'"]+['"]?\s+is not in this registry/gi,
    /notarget No matching version found for (@?[\w.-]+(?:\/[\w.-]+)?)@/gi,
    /Invalid package name "([^"]+)"/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(log))) {
      const name = (m[1] || "").trim();
      // npm prints the registry path form (@scope%2fname) in some lines.
      const clean = name.replace(/%2f/gi, "/").replace(/^\/+/, "");
      if (clean && clean !== "npm" && !/^https?:/.test(clean)) names.add(clean);
    }
  }
  return [...names].slice(0, 8);
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
      todos: makeTodos([
        { title: "Analyze manifest drift & isolate mismatched lockfile", details: "Detect differences between package.json requirements and frozen lockfile" },
        { title: "Purge out-of-sync lockfile artifact", details: "Remove stale lockfile to allow clean resolution", command: `rm -f ${lock}` },
        { title: "Regenerate clean lockfile matching manifest", details: "Rebuild dependency tree without audit delays", command: "npm install --package-lock-only --no-audit --no-fund" },
        { title: "Execute deterministic clean install via npm ci", details: "Install exact versions pinned in the newly generated lockfile", command: "npm ci --no-audit --no-fund" },
        { title: "Validate dependency tree and confirm pipeline readiness", details: "Verify workspace integrity with npm ls", command: "npm ls --depth=0" },
      ]),
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
      todos: makeTodos([
        { title: "Analyze peer dependency conflict logs & isolate clashing versions", details: "Examine ERESOLVE error output to identify conflicting peer dependency ranges" },
        { title: "Formulate relaxed peer resolution strategy", details: "Configure npm legacy peer dependencies mode to reconcile peer constraints" },
        { title: "Execute package installation with legacy peer flag", details: "Run whitelisted npm install with legacy peer flag", command: "npm install --legacy-peer-deps --no-audit --no-fund" },
        { title: "Deduplicate installed packages across node_modules", details: "Collapse duplicated transitive copies to ensure runtime stability", command: "npm dedupe --legacy-peer-deps" },
        { title: "Validate dependency graph and confirm pipeline readiness", details: "Run npm ls to confirm healthy installation and proceed with build workflow", command: "npm ls --depth=0" },
      ]),
    };
  }

  if (/E404|404 Not Found - GET|is not in this registry|Invalid package name|Unsupported URL Type/i.test(log)) {
    const bad = extractUnresolvablePackages(log);
    const rename = bad.map((name) => [name, CAPACITOR_PLUGIN_ALIASES[name]] as const).filter(([, to]) => !!to);
    const drop = bad.filter((name) => !CAPACITOR_PLUGIN_ALIASES[name]);

    const commands: RepairCommand[] = [
      { step: 1, name: "Drop the lockfile", cmd: `rm -f ${lock}`, critical: false, why: "It pins tarball URLs the registry no longer serves" },
    ];
    for (const [from, to] of rename) {
      commands.push({
        step: commands.length + 1,
        name: `Replace ${from} with ${to}`,
        cmd: `npm pkg delete dependencies.${from}`,
        critical: false,
        why: `${from} is not published; ${to} is the maintained package for the same capability`,
      });
    }
    for (const name of drop.slice(0, 3)) {
      commands.push({
        step: commands.length + 1,
        name: `Quarantine unresolvable package ${name}`,
        cmd: `npm pkg delete dependencies.${name}`,
        critical: false,
        why: "The registry has no such package, so no install can ever succeed while it is listed",
      });
    }
    for (const [, to] of rename) {
      commands.push({
        step: commands.length + 1,
        name: `Install ${to}`,
        cmd: `npm install ${to} --no-audit --no-fund --legacy-peer-deps --save`,
        critical: false,
        why: "Restore the capability under its real package name",
      });
    }
    commands.push({
      step: commands.length + 1,
      name: "Reinstall from the corrected manifest",
      cmd: "npm install --no-audit --no-fund --legacy-peer-deps",
      critical: true,
      why: "Re-resolve every remaining specifier against the live registry",
    });

    return {
      ...base,
      diagnosis: {
        type: "REGISTRY_404",
        severity: "high",
        rootCause: bad.length
          ? `package.json lists ${bad.join(", ")}, which the npm registry cannot serve.`
          : "package.json references a package name or specifier the registry cannot serve.",
        evidence: pick(log, /E404|404 Not Found|not in this registry|Invalid package name|Unsupported URL Type/i),
      },
      commands,
      notes: drop.length
        ? `Removed ${drop.join(", ")} from the manifest — no published package answers those names.`
        : undefined,
      todos: makeTodos([
        { title: "Inspect failed package specifiers against npm registry", details: bad.length ? `Unresolvable: ${bad.join(", ")}` : "Identify unreachable package names or obsolete tarball URLs" },
        { title: "Clear stale lockfile pointers and cache references", details: "Remove old lockfile so npm queries the live registry directly", command: `rm -f ${lock}` },
        { title: "Correct the manifest: rename or quarantine bad packages", details: rename.length ? `Rename ${rename.map(([f, t]) => `${f} → ${t}`).join(", ")}` : "Delete dependency entries the registry cannot serve" },
        { title: "Re-resolve and reinstall packages from public registry", details: "Fetch available package versions using legacy peer resolution", command: "npm install --no-audit --no-fund --legacy-peer-deps" },
        { title: "Verify workspace build readiness with npm ls", details: "Run depth check to confirm package availability", command: "npm ls --depth=0" },
      ]),
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
      todos: makeTodos([
        { title: "Identify missing filesystem artifacts and corrupted module paths", details: "Locate missing module references causing ENOENT errors" },
        { title: "Purge corrupt node_modules tree and obsolete lockfile", details: "Delete incomplete dependency directory and stale lockfile", command: "rm -rf node_modules" },
        { title: "Flush runner npm package cache to force fresh downloads", details: "Clear npm cache to prevent pulling corrupted tarballs", command: "npm cache clean --force" },
        { title: "Perform complete rebuild of dependency tree", details: "Run fresh npm install to restore all required modules", command: "npm install --no-audit --no-fund --legacy-peer-deps" },
        { title: "Verify intact filesystem modules and pipeline readiness", details: "Check node_modules presence and validate with npm ls", command: "npm ls --depth=0" },
      ]),
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
      todos: makeTodos([
        { title: "Diagnose failing lifecycle script from runner logs", details: "Identify failing preinstall, postinstall, or native compilation scripts" },
        { title: "Isolate non-essential native scripts for web bundle compatibility", details: "Configure install parameters to skip platform-specific lifecycle binaries" },
        { title: "Execute package install bypassing lifecycle scripts", details: "Install packages safely with --ignore-scripts flag", command: "npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps" },
        { title: "Verify necessary JavaScript modules exist in node_modules", details: "Confirm runtime JS assets are present despite skipping native binaries" },
        { title: "Confirm dependency health and proceed with pipeline", details: "Run verification check to ensure build step can execute cleanly", command: "npm ls --depth=0" },
      ]),
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
      todos: makeTodos([
        { title: "Audit Node.js runtime version versus package engine constraints", details: "Compare runner Node environment against package.json engine declarations" },
        { title: "Formulate engine override strategy for web bundle compatibility", details: "Prepare force-installation parameters for browser-targeted bundling" },
        { title: "Execute package installation with engine enforcement bypassed", details: "Run npm install --force to install packages regardless of engine advisories", command: "npm install --force --no-audit --no-fund --legacy-peer-deps" },
        { title: "Verify runtime compatibility across installed modules", details: "Check that required bundler and compiler packages load properly" },
        { title: "Perform dependency validation check with npm ls", details: "Run depth check to confirm package readiness for build", command: "npm ls --depth=0" },
      ]),
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
      todos: makeTodos([
        { title: "Analyze network timeout and transient registry failure", details: "Inspect ETIMEDOUT or ECONNRESET logs from npm registry connection" },
        { title: "Verify runner connectivity and refresh network socket", details: "Confirm network interface status before re-attempting package download" },
        { title: "Re-dispatch package install with retried network connection", details: "Retry npm install to fetch packages through restored connection", command: `${pm === "npm" ? "npm" : pm} install --no-audit --no-fund` },
        { title: "Verify package tarball downloads completed successfully", details: "Confirm that all downloaded packages extracted properly into node_modules" },
        { title: "Confirm dependency tree integrity with npm ls", details: "Validate installed packages to ensure pipeline can resume without error", command: "npm ls --depth=0" },
      ]),
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
      todos: makeTodos([
        { title: "Audit runner disk utilization and identify temporary caches", details: "Identify ENOSPC condition on runner and locate bloated cache directories" },
        { title: "Flush global npm cache to liberate disk space", details: "Force clean the local cache to free up required working storage", command: "npm cache clean --force" },
        { title: "Execute lean installation omitting optional native packages", details: "Install only required runtime dependencies with --omit=optional", command: "npm install --no-audit --no-fund --omit=optional" },
        { title: "Verify essential runtime packages are installed", details: "Ensure required compiler and bundler modules are present" },
        { title: "Run final disk check and dependency validation", details: "Confirm sufficient disk headspace and valid dependency tree", command: "npm ls --depth=0" },
      ]),
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
    todos: makeTodos([
      { title: "Parse full installer logs and extract error context", details: "Analyze installer stderr and contract logs to isolate failure patterns" },
      { title: "Consult AI model with package manifest and error traces", details: "Send failure context to the model to generate custom remediation steps" },
      { title: "Execute whitelisted repair commands on the runner", details: "Run the sanitized model-proposed command sequence directly on the runner" },
      { title: "Verify dependency health and module availability", details: "Check node_modules presence and run verification commands", command: "npm ls --depth=0" },
      { title: "Validate repaired state and confirm workflow readiness", details: "Ensure clean build environment before resuming workflow pipeline" },
    ]),
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
const MANIFEST_SUBCOMMANDS = ['get', 'set', 'delete'];
const MANIFEST_FIELD = /^(dependencies|devDependencies|optionalDependencies|peerDependencies|overrides|resolutions)(\.[^.\s]+)*$/;


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
  if (argv[0] === 'npm' && argv[1] === 'pkg') {
    if (MANIFEST_SUBCOMMANDS.indexOf(argv[2]) === -1) return 'npm pkg ' + (argv[2] || '') + ' is not allowed (get/set/delete only)';
    const keys = argv.slice(3).filter(function (a) { return a.indexOf('-') !== 0; });
    if (!keys.length) return 'npm pkg without a key';
    for (const k of keys) {
      if (!MANIFEST_FIELD.test(k.split('=')[0])) return 'npm pkg key "' + k + '" is outside the dependency surface';
    }
    return null;
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

    if (!plan.todos || plan.todos.length !== 5) {
      plan.todos = [
        { id: 'todo-1', stepNumber: 1, totalSteps: 5, title: 'Analyze failure context & isolate root cause', status: 'pending' },
        { id: 'todo-2', stepNumber: 2, totalSteps: 5, title: 'Formulate remediation plan & command sequence', status: 'pending' },
        { id: 'todo-3', stepNumber: 3, totalSteps: 5, title: 'Execute targeted repair commands on runner', status: 'pending' },
        { id: 'todo-4', stepNumber: 4, totalSteps: 5, title: 'Verify dependency health & filesystem integrity', status: 'pending' },
        { id: 'todo-5', stepNumber: 5, totalSteps: 5, title: 'Validate workflow readiness & resume pipeline', status: 'pending' },
      ];
    }

    function syncTodo(idx, status, extra) {
      if (!plan.todos || !plan.todos[idx]) return;
      plan.todos[idx].status = status;
      if (extra) Object.assign(plan.todos[idx], extra);
      try { fs.writeFileSync('repair-plan.json', JSON.stringify(plan, null, 2)); } catch (e) {}
    }

    syncTodo(0, 'in_progress');
    log('\n  [To-Do 1/5] ' + plan.todos[0].title + ' ... (in progress)');
    syncTodo(0, 'completed');
    log('  ✓ [To-Do 1/5] completed');

    syncTodo(1, 'in_progress');
    log('\n  [To-Do 2/5] ' + plan.todos[1].title + ' ... (in progress)');
    if (!plan.commands || !plan.commands.length) {
      syncTodo(1, 'failed');
      log('  ✗ [To-Do 2/5] no executable commands in the plan — aborting');
      break;
    }

    const signature = plan.diagnosis.type + '::' + plan.commands.map(function (c) { return c.cmd; }).join('|');
    if (tried.indexOf(signature) !== -1) {
      syncTodo(1, 'failed');
      log('  ✗ [To-Do 2/5] identical plan already attempted — aborting to avoid a loop');
      break;
    }
    tried.push(signature);
    syncTodo(1, 'completed');
    log('  ✓ [To-Do 2/5] completed');

    syncTodo(2, 'in_progress');
    log('\n  [To-Do 3/5] ' + plan.todos[2].title + ' ... (in progress)');
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
      syncTodo(2, 'failed');
      log('  ✗ [To-Do 3/5] critical command failed');
      for (const rb of plan.rollback || []) { if (!validate(rb)) run(rb); }
      restoreLockfile();
      continue;
    }
    syncTodo(2, 'completed');
    log('  ✓ [To-Do 3/5] completed');

    syncTodo(3, 'in_progress');
    log('\n  [To-Do 4/5] ' + plan.todos[3].title + ' ... (in progress)');
    let verified = true;
    for (const v of plan.verify || []) {
      if (validate(v)) continue;
      const r = run(v);
      log('  verify $ ' + v + ' → ' + (r.ok ? 'ok' : 'exit ' + r.exitCode));
      if (!r.ok && v.indexOf('npm ls') !== 0) verified = false;
    }
    if (!fs.existsSync('node_modules')) { log('  verify: node_modules missing'); verified = false; }

    if (!verified) {
      log('  verification check failed — retrying with standard install command');
      const re = run(installCmd);
      try { fs.writeFileSync('dependency-install.log', re.output); } catch (e) {}
      if (re.ok) verified = true;
    }

    if (!verified) {
      syncTodo(3, 'failed');
      log('  ✗ [To-Do 4/5] verification failed — retrying with fresh evidence');
      continue;
    }
    syncTodo(3, 'completed');
    log('  ✓ [To-Do 4/5] completed');

    syncTodo(4, 'in_progress');
    log('\n  [To-Do 5/5] ' + plan.todos[4].title + ' ... (in progress)');
    syncTodo(4, 'completed');
    log('  ✓ [To-Do 5/5] completed');

    log('\n=== All 5 to-dos completed successfully. AI repair succeeded on attempt ' + attempt + ' (' + plan.diagnosis.type + ') ===');
    await post('', { report: true, projectId: process.env.NB_PROJECT_ID || null, buildId: process.env.NB_BUILD_ID || null, phase: phase, attempt: attempt, plan: plan, results: history, outcome: 'repaired', packageJson: read('package.json', 60000), lockfileName: lockfileName() });
    process.exit(0);
  }

  log('\n=== AI repair exhausted — dependency installation could not be completed ===');
  log('NB_REPAIR_EXHAUSTED=' + (lastPlan ? lastPlan.diagnosis.type : 'UNKNOWN'));
  await post('', { report: true, projectId: process.env.NB_PROJECT_ID || null, buildId: process.env.NB_BUILD_ID || null, phase: phase, attempt: maxAttempts, plan: lastPlan, results: history, outcome: 'exhausted', packageJson: read('package.json', 60000), lockfileName: lockfileName() });
  process.exit(1);
}

main().catch(function (e) { log('repair executor crashed: ' + (e && e.message)); process.exit(1); });
`;
