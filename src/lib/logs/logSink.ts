/**
 * Lightweight client-side log sink.
 * Buffers structured log events in memory, exposes a subscription API,
 * and taps fetch() calls to record API activity.
 */

export type LogLevel = "debug" | "info" | "success" | "warning" | "error";

export type LogType =
  | "api"
  | "build"
  | "pipeline"
  | "ai-repair"
  | "ci"
  | "runtime"
  | "system";

export interface LogEvent {
  id?: string;
  timestamp?: number;
  logType: LogType | string;
  level: LogLevel | string;
  message: string;
  phase?: string | null;
  runId?: string | number | null;
  projectId?: string | null;
  platform?: string | null;
  repoName?: string | null;
  stepName?: string | null;
  jobName?: string | null;
  conclusion?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  raw?: string | null;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LogContext {
  projectId?: string | null;
  platform?: string | null;
  repoName?: string | null;
  runId?: string | number | null;
  phase?: string | null;
}

const MAX_EVENTS = 5000;

let context: LogContext = {};
const events: LogEvent[] = [];
const listeners = new Set<(events: LogEvent[]) => void>();
const persistQueue: LogEvent[] = [];
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let isPersisting = false;

function emit() {
  const snapshot = [...events];
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* noop */
    }
  });
}

export function setLogContext(patch: LogContext) {
  context = { ...context, ...patch };
}

export function getLogContext(): LogContext {
  return { ...context };
}

export function logEvent(event: LogEvent) {
  const enriched: LogEvent = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...context,
    ...event,
  };
  events.push(enriched);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  if (enriched.projectId) {
    persistQueue.push(enriched);
    if (!persistTimer) persistTimer = setTimeout(() => void flushLogs(), 900);
  }
  emit();
  return enriched;
}

export function getLogs(): LogEvent[] {
  return [...events];
}

export function clearLogs() {
  events.length = 0;
  emit();
}

export function subscribeLogs(fn: (events: LogEvent[]) => void): () => void {
  listeners.add(fn);
  fn([...events]);
  return () => listeners.delete(fn);
}

export async function flushLogs(): Promise<void> {
  if (isPersisting || persistQueue.length === 0) return;
  isPersisting = true;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  const batch = persistQueue.splice(0, 100);
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    const rows = batch.map((event) => ({
      user_id: userId,
      project_id: event.projectId ?? null,
      run_id: event.runId == null ? null : Number(event.runId),
      platform: event.platform ?? "android",
      phase: event.phase ?? null,
      job_name: event.jobName ?? null,
      step_name: event.stepName ?? null,
      log_type: String(event.logType),
      level: String(event.level),
      status_code: event.statusCode ?? null,
      conclusion: event.conclusion ?? null,
      event_message: event.message.slice(0, 4000),
      raw_excerpt: event.raw?.slice(0, 12000) ?? null,
      meta: { ...(event.meta ?? {}), repoName: event.repoName ?? null, durationMs: event.durationMs ?? null },
      ts: new Date(event.timestamp ?? Date.now()).toISOString(),
    }));
    const { error } = await supabase.from("build_logs").insert(rows);
    if (error) throw error;
  } catch (error) {
    persistQueue.unshift(...batch);
    console.warn("Log persistence failed:", error);
  } finally {
    isPersisting = false;
    if (persistQueue.length && !persistTimer) persistTimer = setTimeout(() => void flushLogs(), 1800);
  }
}

/**
 * Pull error-level log lines relevant to a build run, used as AI repair context.
 */
export async function fetchErrorContext(opts: {
  projectId?: string | null;
  runId?: string | number | null;
  limit?: number;
}): Promise<string[]> {
  const limit = opts.limit ?? 100;
  const inMemory = events
    .filter((e) => e.level === "error" || e.level === "warning")
    .filter((e) => (opts.projectId ? e.projectId === opts.projectId : true))
    .filter((e) => (opts.runId ? String(e.runId ?? "") === String(opts.runId) : true))
    .slice(-limit)
    .map((e) => `[${e.logType}] ${e.message}${e.raw ? `\n${e.raw}` : ""}`);

  try {
    const { supabase } = await import("@/integrations/supabase/client");
    let query = supabase
      .from("build_logs")
      .select("ts, log_type, level, phase, job_name, step_name, event_message, raw_excerpt")
      .in("level", ["error", "warning"])
      .order("ts", { ascending: false })
      .limit(limit);
    if (opts.projectId) query = query.eq("project_id", opts.projectId);
    if (opts.runId != null) query = query.eq("run_id", Number(opts.runId));
    const { data, error } = await query;
    if (error) throw error;
    const persisted = [...(data ?? [])].reverse().map((row) => {
      const scope = [row.phase, row.job_name, row.step_name].filter(Boolean).join("/");
      return `${row.ts} [${row.log_type}${scope ? `/${scope}` : ""}] ${row.event_message}${row.raw_excerpt ? `\n${row.raw_excerpt}` : ""}`;
    });
    return Array.from(new Set([...persisted, ...inMemory])).slice(-limit);
  } catch (error) {
    console.warn("Persisted repair log retrieval failed; using live buffer:", error);
    return inMemory;
  }
}

/**
 * Import CI logs for a workflow run into the buffer (best-effort).
 */
export async function importCiLogs(opts: {
  projectId?: string | null;
  repoName: string;
  runId: string | number;
  platform?: string;
  phase?: string | null;
}): Promise<void> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("build-apk", {
      body: { action: "export-logs", repoName: opts.repoName, runId: opts.runId, platform: opts.platform, phase: opts.phase },
    });
    if (error || !data) return;
    const lines: Array<string | Record<string, unknown>> = Array.isArray(data.lines)
      ? data.lines
      : typeof data.logs === "string"
        ? data.logs.split("\n")
        : [];
    for (const line of lines) {
      const structured = typeof line === "object" && line !== null ? line : null;
      const message = structured ? String(structured.event_message ?? "") : String(line ?? "");
      if (!message.trim()) continue;
      const lower = message.toLowerCase();
      const level: LogLevel = lower.includes("error") || lower.includes("failed")
        ? "error"
        : lower.includes("warn")
          ? "warning"
          : "info";
      logEvent({
        logType: structured ? String(structured.log_type ?? "ci") : "ci",
        level: structured ? String(structured.level ?? level) : level,
        message,
        projectId: opts.projectId ?? getLogContext().projectId ?? null,
        runId: opts.runId,
        phase: opts.phase ?? null,
        platform: opts.platform ?? null,
        jobName: structured ? String(structured.job_name ?? "") || null : null,
        stepName: structured ? String(structured.step_name ?? "") || null : null,
        statusCode: structured ? Number(structured.status_code ?? 0) || null : null,
        conclusion: structured ? String(structured.conclusion ?? "") || null : null,
        raw: message,
      });
    }
    await flushLogs();
  } catch (error) {
    console.warn("CI log import failed:", error);
  }
}

let tapInstalled = false;

/** Patch window.fetch to record API requests as log events. */
export function installApiLogTap() {
  if (tapInstalled || typeof window === "undefined" || !window.fetch) return;
  tapInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now();
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input as Request)?.method || "GET").toUpperCase();
    try {
      const res = await originalFetch(input as RequestInfo, init);
      const durationMs = Math.round(performance.now() - started);
      logEvent({
        logType: "api",
        level: res.ok ? "success" : "error",
        statusCode: res.status,
        durationMs,
        message: `${method} ${res.status} ${url}`,
        meta: { method, pathname: (() => { try { return new URL(url, window.location.href).pathname; } catch { return url; } })() },
      });
      return res;
    } catch (err) {
      logEvent({
        logType: "api",
        level: "error",
        durationMs: Math.round(performance.now() - started),
        message: `${method} FAILED ${url} — ${(err as Error)?.message ?? "network error"}`,
        meta: { method, pathname: url },
      });
      throw err;
    }
  };
}
