/**
 * In-app NativeBridge Console.
 *
 * Safe, allowlisted, READ-ONLY inspection commands that operate on the
 * in-memory project file tree (Zustand store). No real shell, no network
 * calls — purely local introspection so the user (and the AI) can poke at
 * the project without leaving the platform.
 *
 * Supported commands:
 *   help                          – list commands
 *   ls [path]                     – list files (optionally under a path prefix)
 *   find <pattern>                – fuzzy file-name search
 *   grep <pattern>                – content search across source files
 *   cat <path>                    – print a file's content (truncated)
 *   pkg                           – summarize package.json (deps, scripts)
 *   plugins                       – list enabled plugins + npm package names
 *   deps [filter]                 – list installed deps from package.json
 *   missing                       – flag imports that aren't in package.json
 *   clear                         – clear the console
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { useProjectStore, type ProjectFile } from "@/stores/projectStore";
import { PLUGIN_NPM_MAP } from "@/lib/generators/pluginMapping";

function detectLang(text: string): string {
  const t = text.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (/^\s*<[a-zA-Z!?]/.test(t)) return "markup";
  if (/^(import |export |const |let |function |class )/.test(t)) return "typescript";
  if (/^\s*#|\$\s|npm |yarn |pnpm |bunx? /.test(t)) return "bash";
  return "bash";
}

type Line = { kind: "in" | "out" | "err" | "sys"; text: string };

function flatten(files: ProjectFile[]): ProjectFile[] {
  const out: ProjectFile[] = [];
  const walk = (n: ProjectFile[]) => { for (const f of n) { out.push(f); if (f.children) walk(f.children); } };
  walk(files);
  return out;
}

const HELP = `NativeBridge Console — safe project inspection

Commands:
  help                    Show this help
  ls [path]               List files (optionally under a path prefix)
  find <pattern>          Fuzzy file-name search (case-insensitive)
  grep <pattern>          Content search across source files
  cat <path>              Print a file's content (truncated to 4 KB)
  pkg                     Summarize package.json (scripts, deps count)
  plugins                 List enabled plugins and resolved npm packages
  deps [filter]           List installed deps from package.json
  missing                 List imports that aren't in package.json
  clear                   Clear the console

This console is read-only — no shell access, no network calls.`;

function runCommand(input: string, files: ProjectFile[], enabledPlugins: Set<string>): { kind: Line["kind"]; text: string }[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const [cmd, ...rest] = trimmed.split(/\s+/);
  const flat = flatten(files);
  const fileNodes = flat.filter((f) => f.type === "file");

  const findFile = (path: string) =>
    fileNodes.find((f) => f.path === path) ||
    fileNodes.find((f) => f.path.endsWith("/" + path)) ||
    fileNodes.find((f) => f.name === path);

  const pkgFile = fileNodes.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  let pkg: any = null;
  try { pkg = pkgFile?.content ? JSON.parse(pkgFile.content) : null; } catch {}

  switch (cmd) {
    case "help":
      return [{ kind: "out", text: HELP }];
    case "clear":
      return [{ kind: "sys", text: "__CLEAR__" }];
    case "ls": {
      const prefix = rest[0] || "";
      const matches = fileNodes
        .filter((f) => !prefix || f.path.startsWith(prefix))
        .map((f) => f.path)
        .sort();
      if (matches.length === 0) return [{ kind: "err", text: `(no files${prefix ? ` under ${prefix}` : ""})` }];
      return [{ kind: "out", text: matches.slice(0, 200).join("\n") + (matches.length > 200 ? `\n… +${matches.length - 200} more` : "") }];
    }
    case "find": {
      const pat = rest.join(" ");
      if (!pat) return [{ kind: "err", text: "Usage: find <pattern>" }];
      const lower = pat.toLowerCase();
      const matches = fileNodes.filter((f) => f.path.toLowerCase().includes(lower)).map((f) => f.path);
      return [{ kind: matches.length ? "out" : "err", text: matches.length ? matches.slice(0, 80).join("\n") : `No paths match "${pat}"` }];
    }
    case "grep": {
      const pat = rest.join(" ");
      if (!pat) return [{ kind: "err", text: "Usage: grep <pattern>" }];
      let re: RegExp;
      try { re = new RegExp(pat, "i"); } catch { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); }
      const out: string[] = [];
      for (const f of fileNodes) {
        if (!f.content || f.isBinary) continue;
        const lines = f.content.split("\n");
        const hits = lines.map((l, i) => re.test(l) ? `  L${i + 1}: ${l.trim().slice(0, 140)}` : null).filter(Boolean) as string[];
        if (hits.length > 0) out.push(`${f.path}\n${hits.slice(0, 5).join("\n")}`);
        if (out.length >= 20) break;
      }
      return [{ kind: out.length ? "out" : "err", text: out.length ? out.join("\n\n") : `No content matches for "${pat}"` }];
    }
    case "cat": {
      const path = rest[0];
      if (!path) return [{ kind: "err", text: "Usage: cat <path>" }];
      const f = findFile(path);
      if (!f) return [{ kind: "err", text: `Not found: ${path}` }];
      if (f.isBinary) return [{ kind: "err", text: `${f.path} is binary` }];
      const c = f.content || "";
      return [{ kind: "out", text: c.slice(0, 4096) + (c.length > 4096 ? `\n… (${c.length - 4096} more chars)` : "") }];
    }
    case "pkg": {
      if (!pkg) return [{ kind: "err", text: "No package.json found." }];
      const deps = Object.keys(pkg.dependencies || {});
      const dev = Object.keys(pkg.devDependencies || {});
      const scripts = Object.entries(pkg.scripts || {}).map(([k, v]) => `  ${k}: ${v}`).join("\n");
      return [{
        kind: "out",
        text: `name: ${pkg.name || "(unnamed)"}\nversion: ${pkg.version || "(none)"}\nscripts:\n${scripts || "  (none)"}\ndependencies: ${deps.length}\ndevDependencies: ${dev.length}`,
      }];
    }
    case "plugins": {
      const ids = [...enabledPlugins];
      if (ids.length === 0) return [{ kind: "out", text: "(no plugins enabled)" }];
      const lines = ids.map((id) => {
        const e = PLUGIN_NPM_MAP[id];
        return `  ${id.padEnd(28)} → ${e?.npm || "(unmapped)"}`;
      });
      return [{ kind: "out", text: `Enabled (${ids.length}):\n${lines.join("\n")}` }];
    }
    case "deps": {
      if (!pkg) return [{ kind: "err", text: "No package.json found." }];
      const filter = (rest[0] || "").toLowerCase();
      const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const entries = Object.entries(all)
        .filter(([k]) => !filter || k.toLowerCase().includes(filter))
        .sort(([a], [b]) => a.localeCompare(b));
      if (entries.length === 0) return [{ kind: "err", text: `No deps match "${filter}"` }];
      return [{ kind: "out", text: entries.map(([k, v]) => `  ${k}@${v}`).join("\n") }];
    }
    case "missing": {
      if (!pkg) return [{ kind: "err", text: "No package.json found." }];
      const installed = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
      const NODE_BUILTINS = new Set(["fs","path","os","crypto","http","https","url","util","stream","events","buffer","child_process","zlib","net","tls","querystring","assert"]);
      const importRe = /(?:import\s+(?:[\s\S]*?)from\s*|require\s*\(\s*)["']([^"']+)["']/g;
      const missing = new Map<string, string[]>();
      for (const f of fileNodes) {
        if (!f.content || f.isBinary) continue;
        if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f.path)) continue;
        if (f.path.includes("node_modules/")) continue;
        for (const m of f.content.matchAll(importRe)) {
          const spec = m[1];
          if (!spec || spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/") || NODE_BUILTINS.has(spec)) continue;
          const parts = spec.split("/");
          const pkgName = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
          if (installed.has(pkgName)) continue;
          if (!missing.has(pkgName)) missing.set(pkgName, []);
          missing.get(pkgName)!.push(f.path);
        }
      }
      if (missing.size === 0) return [{ kind: "out", text: "All imports resolve to entries in package.json ✓" }];
      const lines = [...missing.entries()].map(([p, where]) => `  ${p}\n    ${where.slice(0, 3).join("\n    ")}`);
      return [{ kind: "err", text: `Missing from package.json (${missing.size}):\n${lines.join("\n")}` }];
    }
    default:
      return [{ kind: "err", text: `Unknown command: ${cmd}. Type "help" to see what's supported.` }];
  }
}

const ConsolePanel = () => {
  const { files, enabledPlugins } = useProjectStore();
  const [lines, setLines] = useState<Line[]>([
    { kind: "sys", text: "NativeBridge Console — type 'help' for commands." },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number>(-1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines]);

  const submit = () => {
    const value = input;
    if (!value.trim()) return;
    setLines((prev) => [...prev, { kind: "in", text: `$ ${value}` }]);
    setHistory((h) => [...h, value]);
    setHistIdx(-1);
    setInput("");
    const results = runCommand(value, files, enabledPlugins);
    if (results.length === 1 && results[0].kind === "sys" && results[0].text === "__CLEAR__") {
      setLines([{ kind: "sys", text: "Console cleared." }]);
      return;
    }
    setLines((prev) => [...prev, ...results.map((r) => ({ kind: r.kind, text: r.text }))]);
  };

  const colorFor = (k: Line["kind"]) =>
    k === "in" ? "text-primary" :
    k === "err" ? "text-destructive" :
    k === "sys" ? "text-muted-foreground italic" :
    "text-foreground";

  const totalFiles = useMemo(() => flatten(files).filter((f) => f.type === "file").length, [files]);

  return (
    <div className="flex flex-col h-full bg-background text-sm font-mono">
      <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>Console · {totalFiles} files · {enabledPlugins.size} plugin{enabledPlugins.size === 1 ? "" : "s"}</span>
        <button
          onClick={() => setLines([{ kind: "sys", text: "Console cleared." }])}
          className="text-xs hover:text-foreground transition-colors"
        >
          clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {lines.map((l, i) => {
          if (l.kind === "in" || l.kind === "sys" || l.kind === "err") {
            return (
              <pre key={i} className={`whitespace-pre-wrap break-words ${colorFor(l.kind)}`}>{l.text}</pre>
            );
          }
          const lang = detectLang(l.text);
          return (
            <Highlight key={i} code={l.text} language={lang} theme={themes.vsDark}>
              {({ tokens, getLineProps, getTokenProps }) => (
                <pre className="whitespace-pre-wrap break-words bg-transparent">
                  {tokens.map((line, idx) => (
                    <div key={idx} {...getLineProps({ line })}>
                      {line.map((token, k) => (
                        <span key={k} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border px-3 py-2 flex items-center gap-2">
        <span className="text-primary">$</span>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (history.length === 0) return;
              const ni = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
              setHistIdx(ni); setInput(history[ni] || "");
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              if (history.length === 0 || histIdx < 0) return;
              const ni = histIdx + 1;
              if (ni >= history.length) { setHistIdx(-1); setInput(""); }
              else { setHistIdx(ni); setInput(history[ni] || ""); }
            }
          }}
          placeholder="type 'help' and press Enter"
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default ConsolePanel;
