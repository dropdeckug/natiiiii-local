import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { DEFAULT_MODEL, gatewayJson } from "../_shared/aiGateway.ts";
import {
  ALLOWED_BINARIES,
  classifyInstallFailure,
  makeTodos,
  planSignature,
  sanitizePlan,
  type RepairPlan,
} from "../_shared/repairPlanContract.ts";

/**
 * Runner-executed AI repair — the analyst endpoint.
 *
 * The GitHub Actions runner owns execution. This function only ever *reads*
 * evidence (install log, dependency contract log, manifest) and *writes* a
 * repair plan: JSON with whitelisted commands, verification checks and
 * rollback commands. It never touches a filesystem and never runs a command.
 *
 * Deterministic classification first — a known error signature must always
 * produce the same plan. The model is consulted only when the classifier
 * returns UNKNOWN, or when a deterministic plan already failed on a previous
 * attempt (so repeating it would be a loop).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-nb-callback-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface PlanRequest {
  report?: boolean;
  projectId?: string | null;
  buildId?: string | null;
  phase?: string;
  attempt?: number;
  installLog?: string;
  contractLog?: string;
  packageJson?: string;
  lockfileName?: string;
  packageManager?: string;
  nodeVersion?: string;
  previousCommands?: string[];
  previousResults?: { cmd: string; exitCode: number; ms?: number; tail?: string }[];
  model?: string;
  /** report payload */
  plan?: RepairPlan | null;
  results?: { cmd: string; exitCode: number; tail?: string }[];
  outcome?: "repaired" | "exhausted";
}

/* ------------------------------------------------------------- timeline */

function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function ownerOf(buildId?: string | null): Promise<string | null> {
  if (!buildId) return null;
  const db = admin();
  if (!db) return null;
  const { data } = await db.from("builds").select("user_id").eq("id", buildId).maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

async function emit(
  body: PlanRequest,
  row: { step: string; status: string; message: string; meta?: Record<string, unknown> },
) {
  const db = admin();
  if (!db) return;
  const userId = await ownerOf(body.buildId);
  if (!userId) return; // build_events.user_id is NOT NULL — skip rather than fail the repair
  await db.from("build_events").insert({
    user_id: userId,
    build_id: body.buildId ?? null,
    project_id: body.projectId ?? null,
    phase: body.phase || "phase1",
    step: row.step,
    status: row.status,
    message: row.message,
    meta: row.meta ?? {},
  });
}

/* ---------------------------------------------------------------- model */

const SYSTEM_PROMPT = `You are the repair analyst for a mobile app build platform.

You NEVER execute anything. You read the real installer output and emit ONE JSON
repair plan that a GitHub Actions runner will execute verbatim.

Hard rules:
- Only these binaries may appear as the first token of a command: ${ALLOWED_BINARIES.join(", ")}.
- No shell syntax at all: no pipes, redirects, &&, ;, $(...), backticks, quotes, globs.
  One command = one program plus its flags.
- "rm" may only target: node_modules, package-lock.json, npm-shrinkwrap.json,
  pnpm-lock.yaml, yarn.lock, bun.lock, bun.lockb, .npmrc.
- Never touch .github, keystores, .env or anything outside the project directory.
- Order commands so the state is valid at every step, and mark a command
  critical:true only when the repair is pointless if it fails.
- Diagnose from evidence you can quote from the log. Do not guess.
- Never repeat a command sequence that already failed (it is given to you).

You CAN edit package.json on the runner, through "npm pkg" only, and only on the
dependency surface (dependencies, devDependencies, optionalDependencies,
peerDependencies, overrides, resolutions). Use it exactly when the manifest
itself is what the registry cannot satisfy:
- "npm pkg delete dependencies.<name>" removes a package that does not exist in
  the registry (a hallucinated or mistyped name). Never delete react,
  react-dom, vite, typescript, @capacitor/core, @capacitor/cli or the framework
  the app is built on — those are load-bearing; if one of them is unresolvable,
  the version specifier is wrong, so repin it instead.
- "npm pkg set dependencies.<name>=<range>" repins a bad or non-existent
  version onto a published one (prefer a caret range on a major that exists).
- "npm pkg set overrides.<name>=<range>" forces a single copy of a package that
  peers disagree about.
- "npm view <name> versions --json" and "npm view <name> version" tell you what
  the registry actually has BEFORE you pin anything. Probe first, then pin.
- "npm install <name>@<range> --no-audit --no-fund --legacy-peer-deps --save"
  adds the corrected package back.

Capacitor specifics, because most failures here are plugin failures:
- Every @capacitor/* plugin must share the SAME major as @capacitor/core and
  @capacitor/cli. A plugin from another major is the usual ERESOLVE cause —
  repin the plugin to the core major rather than forcing the install.
- Community plugins live under @capacitor-community/* or @capawesome/*, not
  under @capacitor/*. A 404 on @capacitor/<something-exotic> almost always
  means the real package is scoped elsewhere or does not exist.
- Known bad → good renames you may apply directly:
${Object.entries(CAPACITOR_PLUGIN_ALIASES).map(([f, t]) => `    ${f} → ${t}`).join("\n")}
- A plugin that genuinely does not exist is not worth failing a whole build
  for: delete it, say so in notes, and let the app build without it.
- If the log shows a source-level problem (broken import, invalid vite config)
  that no dependency command can fix, return an empty commands array and
  explain it in notes — the source-level repair agent takes over from there.

Diagnosis type must be one of: LOCKFILE_MISMATCH, DEPENDENCY_CONFLICT,
MISSING_FILE, SCRIPT_FAILURE, REGISTRY_404, ENGINE_MISMATCH, NETWORK,
DISK_SPACE, UNKNOWN.


Crucial to-do requirement:
You must provide a "todos" list containing EXACTLY five sequential to-dos (not more than five, and not less than five).
Name each to-do clearly yourself to describe the step being performed (e.g. 1/5: Analyze conflict logs & isolate versions, 2/5: Configure relaxed resolution flags, 3/5: Execute targeted installation commands, 4/5: Verify dependency tree integrity, 5/5: Validate workflow pipeline readiness).

Respond with JSON only:
{"diagnosis":{"type":"...","severity":"low|medium|high","rootCause":"...","evidence":["quoted log lines"]},
 "commands":[{"step":1,"name":"...","cmd":"npm ...","critical":true,"why":"..."}],
 "todos":[{"stepNumber":1,"title":"...","details":"..."},{"stepNumber":2,"title":"...","details":"..."},{"stepNumber":3,"title":"...","details":"..."},{"stepNumber":4,"title":"...","details":"..."},{"stepNumber":5,"title":"...","details":"..."}],
 "verify":["npm ls --depth=0"],
 "rollback":[],
 "notes":"one plain-English sentence"}`;

function tail(s: string | undefined, n: number): string {
  return String(s || "").slice(-n);
}

async function modelPlan(body: PlanRequest, deterministic: RepairPlan): Promise<RepairPlan> {
  const model = body.model || DEFAULT_MODEL;
  const userPrompt = [
    `Package manager: ${body.packageManager || "npm"}`,
    `Lockfile on disk: ${body.lockfileName || "none"}`,
    `Node: ${body.nodeVersion || "unknown"}`,
    `Attempt: ${body.attempt ?? 1}`,
    deterministic.diagnosis.type !== "UNKNOWN"
      ? `A deterministic plan for ${deterministic.diagnosis.type} was already tried and did not fix it.`
      : "No deterministic pattern matched.",
    (body.previousCommands || []).length
      ? `Already-attempted plan signatures:\n${(body.previousCommands || []).join("\n")}`
      : "",
    (body.previousResults || []).length
      ? `Previous command results:\n${(body.previousResults || [])
          .map((r) => `$ ${r.cmd} → exit ${r.exitCode}\n${tail(r.tail, 600)}`)
          .join("\n")}`
      : "",
    `--- cpr-dependency-contract.log ---\n${tail(body.contractLog, 4000)}`,
    `--- package.json ---\n${tail(body.packageJson, 12000)}`,
    `--- dependency-install.log (tail) ---\n${tail(body.installLog, 16000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const data = await gatewayJson({
    model,
    payload: {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    },
  });

  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = String(raw).match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }

  const d = (parsed.diagnosis ?? {}) as Record<string, unknown>;
  return {
    diagnosis: {
      type: (typeof d.type === "string" ? d.type : "UNKNOWN") as RepairPlan["diagnosis"]["type"],
      severity: (["low", "medium", "high"].includes(String(d.severity))
        ? String(d.severity)
        : "high") as RepairPlan["diagnosis"]["severity"],
      rootCause: String(d.rootCause ?? "Model could not determine a root cause."),
      evidence: Array.isArray(d.evidence) ? d.evidence.map((e) => String(e).slice(0, 240)).slice(0, 6) : [],
    },
    commands: Array.isArray(parsed.commands)
      ? (parsed.commands as Record<string, unknown>[]).slice(0, 5).map((c, i) => ({
          step: i + 1,
          name: String(c?.name ?? `Step ${i + 1}`).slice(0, 120),
          cmd: String(c?.cmd ?? ""),
          critical: Boolean(c?.critical),
          why: String(c?.why ?? "").slice(0, 240),
        }))
      : [],
    verify: Array.isArray(parsed.verify) ? (parsed.verify as unknown[]).map(String).slice(0, 4) : ["npm ls --depth=0"],
    rollback: Array.isArray(parsed.rollback) ? (parsed.rollback as unknown[]).map(String).slice(0, 4) : [],
    todos: Array.isArray(parsed.todos) && (parsed.todos as Record<string, unknown>[]).length === 5
      ? (parsed.todos as Record<string, unknown>[]).map((t, i) => ({
          id: `todo-${i + 1}`,
          stepNumber: i + 1,
          totalSteps: 5 as const,
          title: String(t?.title ?? `Repair step ${i + 1}`).slice(0, 120),
          details: t?.details ? String(t.details).slice(0, 240) : undefined,
          status: "pending" as const,
        }))
      : makeTodos(
          Array.isArray(parsed.commands)
            ? (parsed.commands as Record<string, unknown>[]).slice(0, 5).map((c, i) => ({
                title: String(c?.name ?? `Step ${i + 1}`),
                details: String(c?.why ?? ""),
                command: String(c?.cmd ?? ""),
              }))
            : []
        ),
    source: "model",
    attempt: body.attempt ?? 1,
    model,
    notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 600) : "",
  };
}

/* ------------------------------------------------------------------ http */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const expected = Deno.env.get("NB_CALLBACK_SECRET") ?? "";
  if (expected && req.headers.get("x-nb-callback-secret") !== expected) {
    return json({ error: "invalid callback secret" }, 401);
  }

  let body: PlanRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  /* ----- the runner reporting the outcome of a plan it already executed ---- */
  if (body.report) {
    const repaired = body.outcome === "repaired";
    await emit(body, {
      step: "AI repair · runner execution",
      status: repaired ? "success" : "error",
      message: repaired
        ? `Dependency install repaired on attempt ${body.attempt ?? 1} (${body.plan?.diagnosis?.type ?? "UNKNOWN"})`
        : `AI repair exhausted after ${body.attempt ?? 0} attempt(s) — ${body.plan?.diagnosis?.rootCause ?? "no diagnosis"}`,
      meta: {
        kind: "runner-repair",
        outcome: body.outcome ?? "exhausted",
        diagnosis: body.plan?.diagnosis ?? null,
        commands: (body.plan?.commands ?? []).map((c) => c.cmd),
        results: (body.results ?? []).map((r) => ({ cmd: r.cmd, exitCode: r.exitCode, tail: tail(r.tail, 1200) })),
      },
    });
    return json({ ok: true });
  }

  if (!body.installLog && !body.contractLog) {
    return json({ error: "no installer evidence supplied" }, 400);
  }

  const attempt = Math.max(1, Number(body.attempt ?? 1) || 1);
  const deterministic = classifyInstallFailure({
    installLog: body.installLog ?? "",
    contractLog: body.contractLog,
    lockfileName: body.lockfileName,
    packageManager: body.packageManager,
  });
  deterministic.attempt = attempt;

  const alreadyTried = new Set(body.previousCommands ?? []);
  const deterministicUsable =
    deterministic.diagnosis.type !== "UNKNOWN" &&
    deterministic.commands.length > 0 &&
    !alreadyTried.has(planSignature(deterministic));

  let plan = deterministic;
  let modelError: string | null = null;

  if (!deterministicUsable) {
    try {
      plan = await modelPlan(body, deterministic);
    } catch (e) {
      modelError = e instanceof Error ? e.message : String(e);
      plan = deterministic;
    }
  }

  // Second, independent validation pass — the executor validates again locally.
  const { plan: safePlan, rejected } = sanitizePlan({ ...plan, attempt });
  if (rejected.length) {
    console.warn("[ai-repair-plan] rejected commands", rejected);
  }

  if (alreadyTried.has(planSignature(safePlan)) && safePlan.commands.length > 0) {
    safePlan.commands = [];
    safePlan.notes = `${safePlan.notes ?? ""} Identical plan already attempted — stopping to avoid a repair loop.`.trim();
  }

  await emit(body, {
    step: `AI repair · plan (attempt ${attempt})`,
    status: safePlan.commands.length ? "running" : "error",
    message: safePlan.commands.length
      ? `${safePlan.diagnosis.type}: ${safePlan.diagnosis.rootCause}`
      : `${safePlan.diagnosis.type}: no safe dependency command can fix this — ${safePlan.notes || "handing back to source repair"}`,
    meta: {
      kind: "runner-repair",
      source: safePlan.source,
      model: safePlan.model ?? null,
      diagnosis: safePlan.diagnosis,
      commands: safePlan.commands,
      verify: safePlan.verify,
      rejected,
      modelError,
    },
  });

  return json(safePlan);
});
