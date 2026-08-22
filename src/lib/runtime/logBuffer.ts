/**
 * Capture browser console output + uncaught errors into a ring buffer the
 * Agent can query via the `getConsoleLogs` / `getRuntimeErrors` tools.
 *
 * Installed once from main.tsx. Safe in SSR / non-browser contexts (no-op).
 */

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

export interface ConsoleEntry {
  level: ConsoleLevel;
  message: string;
  ts: number;
}

export interface RuntimeError {
  message: string;
  stack?: string;
  source?: string;
  ts: number;
}

const MAX_LOGS = 300;
const MAX_ERRORS = 100;

const consoleBuffer: ConsoleEntry[] = [];
const errorBuffer: RuntimeError[] = [];
let installed = false;

function fmt(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === "string") return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(" ")
    .slice(0, 2000);
}

function push(level: ConsoleLevel, args: unknown[]) {
  consoleBuffer.push({ level, message: fmt(args), ts: Date.now() });
  if (consoleBuffer.length > MAX_LOGS) consoleBuffer.shift();
}

export function installLogBuffer() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  (["log", "info", "warn", "error", "debug"] as ConsoleLevel[]).forEach((lvl) => {
    const orig = (console as any)[lvl]?.bind(console);
    if (!orig) return;
    (console as any)[lvl] = (...args: unknown[]) => {
      try { push(lvl, args); } catch { /* noop */ }
      orig(...args);
    };
  });

  window.addEventListener("error", (e) => {
    errorBuffer.push({
      message: e.message || "Uncaught error",
      stack: e.error?.stack,
      source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
      ts: Date.now(),
    });
    if (errorBuffer.length > MAX_ERRORS) errorBuffer.shift();
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason: any = e.reason;
    errorBuffer.push({
      message: reason?.message || String(reason) || "Unhandled rejection",
      stack: reason?.stack,
      source: "unhandledrejection",
      ts: Date.now(),
    });
    if (errorBuffer.length > MAX_ERRORS) errorBuffer.shift();
  });
}

export function getConsoleLogs(opts: { level?: ConsoleLevel | "all"; limit?: number } = {}): ConsoleEntry[] {
  const lvl = opts.level && opts.level !== "all" ? opts.level : null;
  const limit = opts.limit ?? 80;
  const filtered = lvl ? consoleBuffer.filter((e) => e.level === lvl) : consoleBuffer;
  return filtered.slice(-limit);
}

export function getRuntimeErrors(limit = 20): RuntimeError[] {
  return errorBuffer.slice(-limit);
}

export function clearLogBuffers() {
  consoleBuffer.length = 0;
  errorBuffer.length = 0;
}
