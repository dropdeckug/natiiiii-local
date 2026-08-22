/**
 * ForgeAI Code Repair Agent — the ONLY eight tools the agent can call.
 *
 * There is no general-purpose shell. `inspect` runs an allowlisted, read-only
 * command emulated against the canonical project tree held in the project
 * store (the same tree that gets zipped and shipped to CI), so the agent sees
 * exactly the bytes the build will see.
 *
 * Every path argument is validated against src/lib/repair/scope.ts first.
 */

import { useProjectStore, type ProjectFile } from "@/stores/projectStore";
import { checkPath, isPathAllowed, normalizePath, isPlatformPipelinePath, SCOPE_REJECTION } from "./scope";
import { getPlatformContext } from "./platformContext";

export const MAX_TOOL_OUTPUT = 4000;
const TRUNCATION_NOTE =
  "\n\n[output truncated at 4000 characters — narrow your search with a tighter pattern, a specific path, or a smaller line range]";

export interface PatchAudit {
  path: string;
  before: string;
  after: string;
  oldText: string;
  newText: string;
  at: number;
}

export interface RepairSessionState {
  /** Files read (structure/lines/search/inspect) in THIS session — patching requires membership. */
  inspected: Set<string>;
  /** Full before/after audit of every applied patch. */
  patches: PatchAudit[];
  /** Set when investigation concludes the bug is in platform-owned pipeline code. */
  platformBugSuspected: string | null;
}

export interface RepairToolDeps {
  state: RepairSessionState;
  /** Re-runs a single build step. Provided by the build runner. */
  verifyStep: (step: string) => Promise<{ ok: boolean; output: string }>;
  /** Live timeline callback. */
  onActivity?: (description: string, kind: "investigate" | "patch" | "verify") => void;
}

export function createSessionState(): RepairSessionState {
  return { inspected: new Set(), patches: [], platformBugSuspected: null };
}

/* ────────────────────────────── virtual FS ────────────────────────────── */

function flatten(nodes: ProjectFile[], out: ProjectFile[] = []): ProjectFile[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children) flatten(n.children, out);
  }
  return out;
}

function allFiles(): ProjectFile[] {
  return flatten(useProjectStore.getState().files).filter((f) => f.type === "file" && !f.isBinary);
}

function resolve(path: string): ProjectFile | undefined {
  const p = normalizePath(path);
  const files = allFiles();
  return files.find((f) => f.path === p) || files.find((f) => f.path.endsWith("/" + p));
}

function readFile(path: string): string | null {
  const f = resolve(path);
  return typeof f?.content === "string" ? f.content : null;
}

function clip(text: string): string {
  return text.length > MAX_TOOL_OUTPUT ? text.slice(0, MAX_TOOL_OUTPUT) + TRUNCATION_NOTE : text;
}

/* ─────────────────────────── inspect: allowlist ────────────────────────── */

const ALLOWED_COMMANDS = new Set(["rg", "grep", "sed", "find", "ls", "cat", "wc", "head", "tail"]);
const PIPE_TARGETS = new Set(["head", "tail", "wc"]);
const BANNED_SEQUENCES = [">>", ">", "rm ", "mv ", "cp -r", "chmod", "curl", "wget", "npm install", "yarn install", "bun install", "git push", "git commit"];

function tokenize(cmd: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export function validateInspectCommand(raw: string): string | null {
  const cmd = String(raw || "").trim();
  if (!cmd) return "REJECTED: empty command.";
  for (const bad of BANNED_SEQUENCES) {
    if (cmd.includes(bad)) {
      if (bad === ">" || bad === ">>") return "REJECTED: redirects are not permitted. This tool is read-only — use patch_file to change a file.";
      return `REJECTED: '${bad.trim()}' is not permitted through inspect. This tool is read-only.`;
    }
  }
  const segments = cmd.split("|").map((s) => s.trim());
  const base = tokenize(segments[0])[0];
  if (!ALLOWED_COMMANDS.has(base)) {
    return `REJECTED: '${base}' is not on the allowlist. Permitted commands: ${[...ALLOWED_COMMANDS].join(", ")}.`;
  }
  for (const seg of segments.slice(1)) {
    const t = tokenize(seg)[0];
    if (!PIPE_TARGETS.has(t)) return `REJECTED: piping to '${t}' is not permitted. Only | head, | tail and | wc are allowed.`;
  }
  if (base === "sed") {
    const tokens = tokenize(segments[0]);
    if (cmd.includes("-i")) return "REJECTED: in-place edits are not permitted through inspect. Use the patch_file tool instead.";
    const hasN = tokens.includes("-n");
    const range = tokens.find((t) => /^\d+,\d+p$/.test(t));
    const extraFlags = tokens.slice(1).filter((t) => t.startsWith("-") && t !== "-n");
    if (!hasN || !range || extraFlags.length > 0) {
      return "REJECTED: sed may only be used as `sed -n 'START,ENDp' <file>`. Prefer the read_lines tool.";
    }
  }
  return null;
}

function globToRe(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*").replace(/\?/g, ".");
  return new RegExp("^" + esc + "$");
}

function filesForArgs(paths: string[]): ProjectFile[] {
  const files = allFiles().filter((f) => isPathAllowed(f.path));
  if (paths.length === 0) return files;
  const out: ProjectFile[] = [];
  for (const raw of paths) {
    const p = normalizePath(raw).replace(/\/$/, "");
    if (!p || p === ".") return files;
    if (p.includes("*")) {
      const re = globToRe(p);
      out.push(...files.filter((f) => re.test(f.path)));
    } else {
      out.push(...files.filter((f) => f.path === p || f.path.startsWith(p + "/")));
    }
  }
  return Array.from(new Set(out));
}

function runGrep(tokens: string[]): string {
  const flags = new Set<string>();
  let after = 0;
  let before = 0;
  const rest: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-A" || t === "-B" || t === "-C") {
      const n = parseInt(tokens[++i] || "0", 10) || 0;
      if (t !== "-B") after = n;
      if (t !== "-A") before = n;
    } else if (/^-[A-Za-z]+$/.test(t)) {
      t.slice(1).split("").forEach((c) => flags.add(c));
    } else if (/^--/.test(t)) {
      /* ignore long flags */
    } else rest.push(t);
  }
  const pattern = rest.shift() || "";
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.has("i") ? "i" : "");
  } catch {
    return `Invalid pattern: ${pattern}`;
  }
  const lines: string[] = [];
  for (const f of filesForArgs(rest)) {
    const src = (f.content || "").split("\n");
    src.forEach((line, idx) => {
      if (!re.test(line)) return;
      if (flags.has("l")) {
        if (!lines.includes(f.path)) lines.push(f.path);
        return;
      }
      const from = Math.max(0, idx - before);
      const to = Math.min(src.length - 1, idx + after);
      for (let i = from; i <= to; i++) lines.push(`${f.path}:${i + 1}:${src[i]}`);
    });
  }
  return lines.length ? lines.join("\n") : "(no matches)";
}

function runInspect(command: string): string {
  const rejection = validateInspectCommand(command);
  if (rejection) return rejection;

  const segments = command.split("|").map((s) => s.trim());
  const tokens = tokenize(segments[0]);
  const base = tokens[0];
  let output = "";

  if (base === "rg" || base === "grep") {
    output = runGrep(tokens);
  } else if (base === "sed") {
    const range = tokens.find((t) => /^\d+,\d+p$/.test(t))!;
    const file = tokens[tokens.length - 1];
    const scope = checkPath(file);
    if (scope) return scope;
    const content = readFile(file);
    if (content == null) return `No such file: ${file}`;
    const [start, end] = range.replace(/p$/, "").split(",").map(Number);
    output = content
      .split("\n")
      .slice(Math.max(0, start - 1), end)
      .map((l, i) => `${start + i}: ${l}`)
      .join("\n");
  } else if (base === "ls") {
    const dir = normalizePath(tokens.slice(1).find((t) => !t.startsWith("-")) || "");
    const names = new Set<string>();
    for (const f of allFiles()) {
      if (dir && !f.path.startsWith(dir.replace(/\/$/, "") + "/") && f.path !== dir) continue;
      const relative = dir ? f.path.slice(dir.replace(/\/$/, "").length + 1) : f.path;
      const head = relative.split("/")[0];
      if (head) names.add(relative.includes("/") ? head + "/" : head);
    }
    output = [...names].sort().join("\n") || "(empty)";
  } else if (base === "find") {
    const nameIdx = tokens.indexOf("-name");
    const pattern = nameIdx >= 0 ? tokens[nameIdx + 1] : "*";
    const dir = tokens[1] && !tokens[1].startsWith("-") ? tokens[1] : "";
    const re = globToRe(pattern);
    output = filesForArgs(dir ? [dir] : [])
      .filter((f) => re.test(f.name))
      .map((f) => f.path)
      .join("\n") || "(no matches)";
  } else if (base === "cat" || base === "head" || base === "tail" || base === "wc") {
    const args = tokens.slice(1);
    let n = base === "cat" ? Infinity : 10;
    const nIdx = args.findIndex((a) => a === "-n");
    if (nIdx >= 0) {
      n = parseInt(args[nIdx + 1] || "10", 10) || 10;
      args.splice(nIdx, 2);
    }
    const targets = args.filter((a) => !a.startsWith("-"));
    const chunks: string[] = [];
    for (const t of targets) {
      const scope = checkPath(t);
      if (scope) return scope;
      const content = readFile(t);
      if (content == null) {
        chunks.push(`No such file: ${t}`);
        continue;
      }
      const lines = content.split("\n");
      if (base === "wc") chunks.push(`${lines.length} ${content.split(/\s+/).filter(Boolean).length} ${content.length} ${t}`);
      else if (base === "head") chunks.push(lines.slice(0, n).join("\n"));
      else if (base === "tail") chunks.push(lines.slice(-n).join("\n"));
      else chunks.push(lines.map((l, i) => `${i + 1}: ${l}`).join("\n"));
    }
    output = chunks.join("\n");
  }

  // Apply permitted output-limiting pipes.
  for (const seg of segments.slice(1)) {
    const t = tokenize(seg);
    const lines = output.split("\n");
    const n = parseInt(t[t.indexOf("-n") + 1] || "10", 10) || 10;
    if (t[0] === "head") output = lines.slice(0, n).join("\n");
    else if (t[0] === "tail") output = lines.slice(-n).join("\n");
    else if (t[0] === "wc") output = String(lines.length);
  }
  return clip(output || "(no output)");
}

/* ───────────────────────── structured read tools ───────────────────────── */

function readLines(path: string, start: number, end: number): string {
  const scope = checkPath(path);
  if (scope) return scope;
  const content = readFile(path);
  if (content == null) return `No such file: ${normalizePath(path)}`;
  const lines = content.split("\n");
  const from = Math.max(1, Math.floor(start || 1));
  const to = Math.min(lines.length, Math.floor(end || from + 50));
  return clip(lines.slice(from - 1, to).map((l, i) => `${from + i}: ${l}`).join("\n"));
}

function searchCode(pattern: string, paths: string[] = [], ext?: string, context = 0): string {
  let re: RegExp;
  try {
    re = new RegExp(pattern, "i");
  } catch {
    return `Invalid regular expression: ${pattern}`;
  }
  let files = filesForArgs(paths);
  if (ext) {
    const suffix = ext.startsWith(".") ? ext : "." + ext;
    files = files.filter((f) => f.path.endsWith(suffix));
  }
  const out: string[] = [];
  for (const f of files) {
    const lines = (f.content || "").split("\n");
    lines.forEach((line, idx) => {
      if (!re.test(line)) return;
      const from = Math.max(0, idx - context);
      const to = Math.min(lines.length - 1, idx + context);
      for (let i = from; i <= to; i++) out.push(`${f.path}:${i + 1}:${lines[i]}`);
    });
  }
  return clip(out.length ? out.join("\n") : "(no matches)");
}

function listFiles(directory?: string, ext?: string): string {
  let files = allFiles().filter((f) => isPathAllowed(f.path));
  if (directory) {
    const d = normalizePath(directory).replace(/\/$/, "");
    files = files.filter((f) => f.path === d || f.path.startsWith(d + "/"));
  }
  if (ext) {
    const suffix = ext.startsWith(".") ? ext : "." + ext;
    files = files.filter((f) => f.path.endsWith(suffix));
  }
  return clip(files.map((f) => f.path).sort().join("\n") || "(no files)");
}

const STRUCTURE_RE =
  /^\s*(?:export\s+(?:default\s+)?)?(?:import\s.+|export\s+\{[^}]*\}.*|(?:async\s+)?function\s+\w+|class\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)|async|function|React\.forwardRef|styled)|interface\s+\w+|type\s+\w+\s*=|enum\s+\w+)/;

function getFileStructure(path: string): string {
  const scope = checkPath(path);
  if (scope) return scope;
  const content = readFile(path);
  if (content == null) return `No such file: ${normalizePath(path)}`;
  const lines = content.split("\n");
  const out: string[] = [`${normalizePath(path)} — ${lines.length} lines`];
  lines.forEach((line, idx) => {
    if (STRUCTURE_RE.test(line)) out.push(`${idx + 1}: ${line.trim().slice(0, 160)}`);
  });
  if (out.length === 1) out.push("(no top-level declarations detected — read the file with read_lines)");
  return clip(out.join("\n"));
}

/* ─────────────────────────────── patch_file ────────────────────────────── */

function patchFile(path: string, oldText: string, newText: string, deps: RepairToolDeps): string {
  const scope = checkPath(path);
  if (scope) {
    if (isPlatformPipelinePath(path)) {
      deps.state.platformBugSuspected =
        `The agent tried to patch platform-owned file ${normalizePath(path)}.`;
    }
    return scope;
  }
  const file = resolve(path);
  if (!file || typeof file.content !== "string") return `No such file: ${normalizePath(path)}`;
  if (!deps.state.inspected.has(file.path)) {
    return `REJECTED: you have not read ${file.path} in this session. Call get_file_structure or read_lines or search_code on it first, then patch.`;
  }
  if (typeof oldText !== "string" || typeof newText !== "string" || oldText.length === 0) {
    return "REJECTED: both old_text and new_text are required, and old_text must be a verbatim substring of the current file.";
  }
  const before = file.content;
  const occurrences = before.split(oldText).length - 1;
  if (occurrences === 0) {
    return `FAILED: old_text was not found verbatim in ${file.path}. Re-read the exact lines with read_lines and retry with the exact current text (including indentation).`;
  }
  if (occurrences > 1) {
    return `FAILED: old_text is ambiguous — it matches ${occurrences} locations in ${file.path}. Include more surrounding context so it matches exactly once.`;
  }
  const after = before.replace(oldText, newText);
  const store = useProjectStore.getState();
  store.markAiChanged(file.path, before);
  store.updateFileContent(file.path, after);
  deps.state.patches.push({ path: file.path, before, after, oldText, newText, at: Date.now() });
  deps.onActivity?.(`Patched ${file.path}`, "patch");
  return `SUCCESS: applied patch to ${file.path} (1 replacement).`;
}

/* ──────────────────── file creation / deletion / folders ───────────────── */

function writeFile(path: string, content: string, deps: RepairToolDeps): string {
  const scope = checkPath(path);
  if (scope) {
    if (isPlatformPipelinePath(path)) {
      deps.state.platformBugSuspected = `The agent tried to write platform-owned file ${normalizePath(path)}.`;
    }
    return scope;
  }
  const p = normalizePath(path);
  const store = useProjectStore.getState();
  const existing = resolve(p);
  const before = typeof existing?.content === "string" ? existing.content : "";
  if (existing) {
    store.markAiChanged(existing.path, before);
    store.updateFileContent(existing.path, content);
  } else {
    store.addFile(p, content);
  }
  deps.state.inspected.add(existing?.path || p);
  deps.state.patches.push({ path: existing?.path || p, before, after: content, oldText: before, newText: content, at: Date.now() });
  deps.onActivity?.(`${existing ? "Rewrote" : "Created"} ${existing?.path || p}`, "patch");
  return `SUCCESS: ${existing ? "rewrote" : "created"} ${existing?.path || p} (${content.split("\n").length} lines).`;
}

function deleteFileTool(path: string, deps: RepairToolDeps): string {
  const scope = checkPath(path);
  if (scope) return scope;
  const file = resolve(path);
  if (!file) return `No such file: ${normalizePath(path)}`;
  const before = typeof file.content === "string" ? file.content : "";
  useProjectStore.getState().removeFile(file.path);
  deps.state.patches.push({ path: file.path, before, after: "", oldText: before, newText: "", at: Date.now() });
  deps.onActivity?.(`Deleted ${file.path}`, "patch");
  return `SUCCESS: deleted ${file.path}.`;
}

function createFolder(path: string, deps: RepairToolDeps): string {
  const scope = checkPath(path);
  if (scope) return scope;
  const p = normalizePath(path).replace(/\/$/, "");
  if (!p) return "REJECTED: a folder path is required.";
  useProjectStore.getState().addFile(`${p}/.gitkeep`, "");
  deps.onActivity?.(`Created folder ${p}`, "patch");
  return `SUCCESS: created folder ${p}.`;
}

/** Structured, safe package.json surgery — the dependency-conflict fix path. */
function setDependency(
  args: { name?: string; version?: string | null; section?: string; remove?: boolean },
  deps: RepairToolDeps,
): string {
  const name = String(args.name || "").trim();
  if (!name) return "REJECTED: a package name is required.";
  const files = allFiles().filter((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  // Canonical root = the shallowest package.json (CPR's frontend root).
  const pkgFile = files.sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
  if (!pkgFile?.content) return "No package.json found in the project tree.";
  let json: any;
  try {
    json = JSON.parse(pkgFile.content);
  } catch (e) {
    return `package.json is not valid JSON (${(e as Error).message}). Fix the syntax with patch_file first.`;
  }
  const section = args.section === "devDependencies" ? "devDependencies" : "dependencies";
  const before = pkgFile.content;

  if (args.remove) {
    let removed = false;
    for (const s of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      if (json[s]?.[name] != null) { delete json[s][name]; removed = true; }
    }
    if (!removed) return `${name} is not listed in package.json — nothing to remove.`;
  } else {
    const version = String(args.version || "").trim();
    if (!version || /^(latest|\*)$/i.test(version) || /^(git|file|workspace)[:+]/i.test(version)) {
      return "REJECTED: supply an explicit registry version (e.g. \"7.4.3\" or \"^5.2.0\"). latest/*/git/file/workspace specifiers are forbidden.";
    }
    // A package must live in exactly one section.
    for (const s of ["dependencies", "devDependencies"]) if (s !== section && json[s]?.[name]) delete json[s][name];
    json[section] = json[section] || {};
    json[section][name] = version;
  }

  const after = JSON.stringify(json, null, 2) + "\n";
  const store = useProjectStore.getState();
  store.markAiChanged(pkgFile.path, before);
  store.updateFileContent(pkgFile.path, after);
  deps.state.inspected.add(pkgFile.path);
  deps.state.patches.push({ path: pkgFile.path, before, after, oldText: before, newText: after, at: Date.now() });
  deps.onActivity?.(
    args.remove ? `Removed ${name} from package.json` : `Set ${name}@${args.version} in ${section}`,
    "patch",
  );
  return `SUCCESS: package.json updated and saved (${args.remove ? `removed ${name}` : `${name}@${args.version} in ${section}`}). The runner will receive this file.`;
}

/* ───────────────────────────── tool dispatch ───────────────────────────── */

export const REPAIR_TOOL_NAMES = [
  "inspect",
  "read_lines",
  "search_code",
  "list_files",
  "get_file_structure",
  "patch_file",
  "write_file",
  "delete_file",
  "create_folder",
  "set_dependency",
  "run_build_check",
  "get_platform_context",
] as const;

export type RepairToolName = (typeof REPAIR_TOOL_NAMES)[number];

function markInspected(state: RepairSessionState, path?: string) {
  const f = path ? resolve(path) : undefined;
  if (f) state.inspected.add(f.path);
}

export async function executeRepairTool(
  name: string,
  args: Record<string, any>,
  deps: RepairToolDeps,
): Promise<string> {
  const { state } = deps;
  switch (name) {
    case "get_platform_context":
      deps.onActivity?.("Loading NativeForge platform conventions", "investigate");
      return getPlatformContext();

    case "inspect": {
      const command = String(args.command || "");
      deps.onActivity?.(`Running \`${command.slice(0, 90)}\``, "investigate");
      const result = runInspect(command);
      // Any file named in the output counts as inspected.
      for (const m of result.matchAll(/^([\w./@-]+\.[\w]+):\d+:/gm)) markInspected(state, m[1]);
      tokenize(command).forEach((t) => { if (/\.[a-z]{2,5}$/i.test(t)) markInspected(state, t); });
      return result;
    }

    case "read_lines": {
      const path = String(args.path ?? args.file_path ?? "");
      deps.onActivity?.(`Reading lines ${args.start_line}-${args.end_line} of ${normalizePath(path)}`, "investigate");
      const out = readLines(path, Number(args.start_line), Number(args.end_line));
      if (!out.startsWith("REJECTED") && !out.startsWith("No such file")) markInspected(state, path);
      return out;
    }

    case "search_code": {
      const pattern = String(args.pattern || "");
      deps.onActivity?.(`Searching for \`${pattern.slice(0, 60)}\``, "investigate");
      const paths: string[] = Array.isArray(args.paths) ? args.paths.map(String) : [];
      const out = searchCode(pattern, paths, args.extension ? String(args.extension) : undefined, Number(args.context) || 0);
      for (const m of out.matchAll(/^([^\s:]+):\d+:/gm)) markInspected(state, m[1]);
      return out;
    }

    case "list_files":
      deps.onActivity?.(`Listing project files${args.directory ? ` in ${args.directory}` : ""}`, "investigate");
      return listFiles(args.directory ? String(args.directory) : undefined, args.extension ? String(args.extension) : undefined);

    case "get_file_structure": {
      const path = String(args.path ?? args.file_path ?? "");
      deps.onActivity?.(`Outlining ${normalizePath(path)}`, "investigate");
      const out = getFileStructure(path);
      if (!out.startsWith("REJECTED") && !out.startsWith("No such file")) markInspected(state, path);
      return out;
    }

    case "patch_file":
      return patchFile(
        String(args.path ?? args.file_path ?? ""),
        String(args.old_text ?? ""),
        String(args.new_text ?? ""),
        deps,
      );

    case "write_file":
      return writeFile(String(args.path ?? args.file_path ?? ""), String(args.content ?? ""), deps);

    case "delete_file":
      return deleteFileTool(String(args.path ?? args.file_path ?? ""), deps);

    case "create_folder":
      return createFolder(String(args.path ?? ""), deps);

    case "set_dependency":
      return setDependency(
        {
          name: args.name != null ? String(args.name) : "",
          version: args.version != null ? String(args.version) : null,
          section: args.section != null ? String(args.section) : "dependencies",
          remove: Boolean(args.remove),
        },
        deps,
      );

    case "run_build_check": {
      const step = String(args.step || "build");
      deps.onActivity?.(`Re-running the \`${step}\` step to verify the fix`, "verify");
      const res = await deps.verifyStep(step);
      return res.ok
        ? `SUCCESS: the \`${step}\` step now passes.`
        : `FAILED: the \`${step}\` step still fails.\n\n${clip(res.output)}`;
    }

    default:
      return `Unknown tool '${name}'. ${SCOPE_REJECTION}`;
  }
}