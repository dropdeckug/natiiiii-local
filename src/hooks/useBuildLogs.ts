import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BuildLogRow {
  id: string;
  user_id?: string;
  project_id: string | null;
  build_id: string | null;
  run_id: number | null;
  platform: string;
  phase: string | null;
  job_name: string | null;
  step_name: string | null;
  log_type: string;
  level: string;
  status_code: number | null;
  conclusion: string | null;
  event_message: string;
  raw_excerpt: string | null;
  meta?: Record<string, unknown> | null;
  ts: string;
}

export type TimeRangeKey = "15m" | "60m" | "24h" | "7d";

export const TIME_RANGES: { key: TimeRangeKey; label: string; ms: number }[] = [
  { key: "15m", label: "Last 15 minutes", ms: 15 * 60_000 },
  { key: "60m", label: "Last 60 minutes", ms: 60 * 60_000 },
  { key: "24h", label: "Last 24 hours", ms: 24 * 60 * 60_000 },
  { key: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60_000 },
];

export const LOG_TYPES = [
  { id: "api", label: "API Gateway" },
  { id: "pipeline", label: "CI Pipeline" },
  { id: "setup", label: "Setup" },
  { id: "install", label: "Install" },
  { id: "web-build", label: "Web Build" },
  { id: "capacitor", label: "Capacitor Sync" },
  { id: "gradle", label: "Gradle" },
  { id: "signing", label: "Signing" },
  { id: "keystore", label: "Keystore" },
  { id: "artifact", label: "Artifact" },
  { id: "xcode", label: "Xcode" },
  { id: "build", label: "Build" },
  { id: "agent", label: "Agent" },
  { id: "ai-repair", label: "AI Repair" },
  { id: "plugin", label: "Plugins" },
  { id: "source", label: "Source Snapshots" },
  { id: "webhook", label: "Webhooks" },
  { id: "mcp", label: "MCP" },
];


export const LEVELS = [
  { id: "success", label: "Success", badge: "2xx", tone: "bg-emerald-500" },
  { id: "warning", label: "Warning", badge: "4xx", tone: "bg-amber-500" },
  { id: "error", label: "Error", badge: "5xx", tone: "bg-destructive" },
  { id: "info", label: "Info", badge: "", tone: "bg-sky-500" },
  { id: "debug", label: "Debug", badge: "", tone: "bg-muted-foreground" },
];

export const PLATFORMS = [
  { id: "android", label: "Android" },
  { id: "ios", label: "iOS" },
];

export const PHASES = [
  { id: "phase1", label: "Phase 1" },
  { id: "phase2", label: "Phase 2" },
  { id: "phase3", label: "Phase 3" },
];

export const STATUS_CLASSES = [
  { id: "2xx", label: "2xx Success", min: 200, max: 299 },
  { id: "3xx", label: "3xx Redirect", min: 300, max: 399 },
  { id: "4xx", label: "4xx Client error", min: 400, max: 499 },
  { id: "5xx", label: "5xx Server error", min: 500, max: 599 },
];

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export interface LogFilters {
  range: TimeRangeKey;
  search: string;
  types: string[];
  levels: string[];
  platforms: string[];
  phases: string[];
  statuses: string[];
  methods: string[];
  pathname: string;
}

export const emptyFilters: LogFilters = {
  range: "24h",
  search: "",
  types: [],
  levels: [],
  platforms: [],
  phases: [],
  statuses: [],
  methods: [],
  pathname: "",
};

/** Method / pathname / status live in meta for API rows; derive them uniformly. */
export function rowMethod(row: BuildLogRow): string | null {
  const m = (row.meta as Record<string, unknown> | null)?.method;
  return typeof m === "string" ? m : null;
}

export function rowPathname(row: BuildLogRow): string | null {
  const p = (row.meta as Record<string, unknown> | null)?.pathname;
  if (typeof p === "string") return p;
  // Pipeline rows expose the step as the "path" so the column is never empty.
  if (row.step_name) return `${row.phase ? row.phase + "/" : ""}${row.step_name}`;
  return row.job_name ?? null;
}

const PAGE_SIZE = 200;

export function useBuildLogs(projectId: string | undefined, filters: LogFilters, live: boolean) {
  const [rows, setRows] = useState<BuildLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const since = useMemo(() => {
    const r = TIME_RANGES.find((t) => t.key === filters.range) ?? TIME_RANGES[2];
    return new Date(Date.now() - r.ms).toISOString();
  }, [filters.range]);

  const buildQuery = useCallback(
    (before?: string) => {
      let q = supabase
        .from("build_logs")
        .select("*")
        .gte("ts", since)
        .order("ts", { ascending: false })
        .limit(PAGE_SIZE);

      if (projectId) q = q.eq("project_id", projectId);
      if (before) q = q.lt("ts", before);
      if (filters.types.length) q = q.in("log_type", filters.types);
      if (filters.levels.length) q = q.in("level", filters.levels);
      if (filters.platforms.length) q = q.in("platform", filters.platforms);
      if (filters.phases.length) q = q.in("phase", filters.phases);
      if (filters.statuses.length) {
        const ranges = STATUS_CLASSES.filter((c) => filters.statuses.includes(c.id));
        if (ranges.length === 1) {
          q = q.gte("status_code", ranges[0].min).lte("status_code", ranges[0].max);
        } else if (ranges.length > 1) {
          q = q.or(ranges.map((r) => `and(status_code.gte.${r.min},status_code.lte.${r.max})`).join(","));
        }
      }
      if (filters.methods.length) {
        q = q.or(filters.methods.map((m) => `meta->>method.eq.${m}`).join(","));
      }
      if (filters.pathname.trim()) q = q.ilike("meta->>pathname", `%${filters.pathname.trim()}%`);
      if (filters.search.trim()) q = q.ilike("event_message", `%${filters.search.trim()}%`);
      return q;
    },
    [
      projectId,
      since,
      filters.types,
      filters.levels,
      filters.platforms,
      filters.phases,
      filters.search,
      filters.statuses,
      filters.methods,
      filters.pathname,
    ],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await buildQuery();
    if (err) setError(err.message);
    setRows((data as BuildLogRow[]) ?? []);
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    setLoading(false);
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    const last = rows[rows.length - 1];
    if (!last) return;
    const { data } = await buildQuery(last.ts);
    if (data?.length) {
      setRows((prev) => [...prev, ...(data as BuildLogRow[])]);
      setHasMore(data.length === PAGE_SIZE);
    } else {
      setHasMore(false);
    }
  }, [buildQuery, rows]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Live streaming ──
  useEffect(() => {
    if (!live) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || cancelled) return;

      channel = supabase
        // Topic is scoped to the subscriber so channel access can never leak across users
        .channel(`build_logs_live:${uid}:${projectId ?? "all"}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "build_logs",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const row = payload.new as BuildLogRow;
            if (row.user_id !== uid) return;
            if (projectId && row.project_id !== projectId) return;
            const f = filtersRef.current;
            if (f.types.length && !f.types.includes(row.log_type)) return;
            if (f.levels.length && !f.levels.includes(row.level)) return;
            if (f.platforms.length && !f.platforms.includes(row.platform)) return;
            if (f.phases.length && (!row.phase || !f.phases.includes(row.phase))) return;
            if (f.search.trim() && !row.event_message.toLowerCase().includes(f.search.trim().toLowerCase())) return;
            if (f.methods.length && !f.methods.includes(rowMethod(row) ?? "")) return;
            if (f.pathname.trim() && !(rowPathname(row) ?? "").includes(f.pathname.trim())) return;
            if (f.statuses.length) {
              const sc = row.status_code ?? -1;
              const ok = STATUS_CLASSES.some((c) => f.statuses.includes(c.id) && sc >= c.min && sc <= c.max);
              if (!ok) return;
            }
            setRows((prev) => [row, ...prev].slice(0, 2000));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [live, projectId]);


  return { rows, loading, error, hasMore, reload: load, loadMore };
}

/** Bucket rows into a fixed number of time buckets for the histogram strip. */
export function bucketLogs(rows: BuildLogRow[], buckets = 48) {
  if (rows.length === 0) return [] as { t: number; count: number; errors: number }[];
  const times = rows.map((r) => new Date(r.ts).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(max - min, 1);
  const out = Array.from({ length: buckets }, (_, i) => ({
    t: min + (span / buckets) * i,
    count: 0,
    errors: 0,
  }));
  for (const r of rows) {
    const idx = Math.min(buckets - 1, Math.floor(((new Date(r.ts).getTime() - min) / span) * buckets));
    out[idx].count++;
    if (r.level === "error") out[idx].errors++;
  }
  return out;
}
