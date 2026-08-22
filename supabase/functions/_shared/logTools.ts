/**
 * Server-side log tools for the chat agent.
 *
 * These give the AI first-class, queryable access to the same `build_logs`
 * rows the Logs explorer renders: filter by log type / level / phase / run,
 * isolate failures, and read the raw JSON of any single event.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const LOG_TOOLS = [
  {
    type: "function",
    function: {
      name: "queryLogs",
      description:
        "Query the platform log store (the same rows shown in the Logs explorer). Filter by log type (build, pipeline, api, ai-repair, ...), level, phase (phase1/phase2/phase3), run id, or a text search. Returns newest-first compact rows including their log id.",
      parameters: {
        type: "object",
        properties: {
          logType: { type: "string", description: "e.g. build, pipeline, api, ai-repair, edge" },
          level: { type: "string", enum: ["success", "warning", "error", "info", "debug"] },
          phase: { type: "string", description: "phase1 | phase2 | phase3" },
          runId: { type: "number" },
          search: { type: "string", description: "Substring match on the event message" },
          failedOnly: { type: "boolean", description: "Only error-level rows and failed CI steps" },
          limit: { type: "number", description: "Default 60, max 200" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getLogEvent",
      description:
        "Fetch one log event by id with the FULL raw JSON payload (raw_excerpt, meta, step, conclusion) — the same object the Logs explorer shows in the RAW JSON tab.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buildFailureReport",
      description:
        "Summarize the most recent build failure: which phase and CI step failed, the error rows around it, and the raw log excerpt. Call this FIRST whenever the user asks what broke.",
      parameters: { type: "object", properties: { runId: { type: "number" } } },
    },
  },
];

export const LOG_TOOL_NAMES = new Set(LOG_TOOLS.map((t) => t.function.name));

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

const fmt = (r: any) =>
  `#${r.id} ${r.ts} [${r.level}/${r.log_type}${r.phase ? `/${r.phase}` : ""}]${
    r.step_name ? ` (${r.step_name})` : ""
  } ${String(r.event_message || "").slice(0, 400)}`;

export async function execLogTool(
  name: string,
  args: any,
  ctx: { projectId?: string | null },
): Promise<string> {
  const db = admin();
  const projectId = ctx.projectId || null;

  if (name === "queryLogs") {
    let q = db
      .from("build_logs")
      .select("id, ts, level, log_type, phase, step_name, conclusion, status_code, event_message")
      .order("ts", { ascending: false })
      .limit(Math.min(Number(args.limit) || 60, 200));
    if (projectId) q = q.eq("project_id", projectId);
    if (args.logType) q = q.eq("log_type", String(args.logType));
    if (args.level) q = q.eq("level", String(args.level));
    if (args.phase) q = q.eq("phase", String(args.phase));
    if (args.runId) q = q.eq("run_id", Number(args.runId));
    if (args.failedOnly) q = q.in("level", ["error", "warning"]);
    if (args.search) q = q.ilike("event_message", `%${String(args.search)}%`);
    const { data, error } = await q;
    if (error) return `queryLogs failed: ${error.message}`;
    if (!data?.length) return "No log rows match that query.";
    return `${data.length} log rows (newest first):\n${data.map(fmt).join("\n")}`;
  }

  if (name === "getLogEvent") {
    const { data, error } = await db
      .from("build_logs")
      .select("*")
      .eq("id", String(args.id))
      .maybeSingle();
    if (error) return `getLogEvent failed: ${error.message}`;
    if (!data) return `No log event with id ${args.id}.`;
    return `RAW JSON for log ${args.id}:\n${JSON.stringify(data, null, 2).slice(0, 14000)}`;
  }

  if (name === "buildFailureReport") {
    let q = db
      .from("build_logs")
      .select("id, ts, level, log_type, phase, step_name, conclusion, event_message, raw_excerpt, run_id")
      .order("ts", { ascending: false })
      .limit(400);
    if (projectId) q = q.eq("project_id", projectId);
    if (args.runId) q = q.eq("run_id", Number(args.runId));
    const { data, error } = await q;
    if (error) return `buildFailureReport failed: ${error.message}`;
    const rows = data || [];
    if (!rows.length) return "No logs recorded yet for this project.";

    const errors = rows.filter(
      (r: any) => r.level === "error" || r.conclusion === "failure",
    );
    if (!errors.length) return `No failures found in the last ${rows.length} log rows. Most recent:\n${rows.slice(0, 15).map(fmt).join("\n")}`;

    const first = errors[0];
    const around = rows
      .filter((r: any) => Math.abs(new Date(r.ts).getTime() - new Date(first.ts).getTime()) < 60_000)
      .slice(0, 40);

    return [
      `FAILURE SUMMARY`,
      `Phase: ${first.phase || "unknown"} · Step: ${first.step_name || "unknown"} · Run: ${first.run_id ?? "n/a"}`,
      `Message: ${first.event_message}`,
      first.raw_excerpt ? `\nRaw excerpt:\n${String(first.raw_excerpt).slice(0, 6000)}` : "",
      `\nAll error rows (${errors.length}):\n${errors.slice(0, 30).map(fmt).join("\n")}`,
      `\nSurrounding context:\n${around.map(fmt).join("\n")}`,
    ].join("\n");
  }

  return `Unknown log tool: ${name}`;
}
