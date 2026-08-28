/**
 * ForgeAI Code Repair Agent — session orchestration.
 *
 * Activates as the fallback path when the standard CPR fixes and the error
 * classifier could not resolve a failure (the `unknown` type, or any type whose
 * standard fix action already exhausted its retries).
 *
 * Loop: initialize → investigate → patch → verify → evaluate, max 4 attempts.
 * The agent only ever sees the eight tools in ./tools.ts and can only touch the
 * paths allowed by ./scope.ts.
 */

import { supabase } from "@/integrations/supabase/client";
import { useBuildStore } from "@/stores/buildStore";
import { useProjectStore } from "@/stores/projectStore";
import { logEvent } from "@/lib/logs/logSink";
import { getPlatformContext } from "./platformContext";
import {
  createSessionState,
  executeRepairTool,
  type PatchAudit,
  type RepairSessionState,
} from "./tools";
import {
  buildSignature,
  fixConfidence,
  HIGH_CONFIDENCE,
  lookupKnownFix,
  recordFixFailure,
  recordSuccessfulFix,
  type KnownFix,
} from "./knowledgeBase";
import { tryDeterministicRepair } from "./deterministicRepairMatrix";

export const MAX_REPAIR_ATTEMPTS = 4;

export interface RepairAgentInput {
  /** Full raw output of the failed step. */
  errorText: string;
  /** Name of the step that failed (install, build, capacitor_sync, gradle_build…). */
  stepName: string;
  /** Classifier verdict, or "unknown". */
  errorType?: string;
  projectId?: string | null;
  buildId?: string | null;
  runId?: string | number | null;
  phase?: string | null;
  model?: string;
  /** Re-runs ONLY the failing step. */
  verifyStep: (step: string) => Promise<{ ok: boolean; output: string }>;
}

export interface RepairAgentResult {
  status: "fixed" | "escalated";
  attempts: number;
  patches: PatchAudit[];
  /** Plain-English explanation for the user. */
  userSummary: string;
  usedKnownFix: boolean;
  sessionId: string | null;
  transcript: TranscriptEntry[];
}

export interface TranscriptEntry {
  at: number;
  kind: "system" | "error" | "tool" | "assistant" | "patch" | "verify" | "note";
  label: string;
  detail?: string;
}

/* ─────────────────────────── timeline callbacks ─────────────────────────── */

interface Ctx extends RepairAgentInput {
  transcript: TranscriptEntry[];
  sessionId: string | null;
  userId: string | null;
}

function push(ctx: Ctx, kind: TranscriptEntry["kind"], label: string, detail?: string) {
  ctx.transcript.push({ at: Date.now(), kind, label, detail: detail?.slice(0, 4000) });
}

async function callback(
  ctx: Ctx,
  step: string,
  status: "running" | "success" | "error" | "info",
  message: string,
  meta: Record<string, unknown> = {},
) {
  logEvent({
    logType: "ai-repair",
    level: status === "error" ? "error" : status === "success" ? "success" : "info",
    phase: ctx.phase || "repair-agent",
    runId: ctx.runId ?? null,
    projectId: ctx.projectId ?? null,
    message,
    stepName: step,
    meta,
  });
  if (!ctx.userId) return;
  try {
    await supabase.from("build_events").insert({
      user_id: ctx.userId,
      project_id: ctx.projectId ?? null,
      build_id: ctx.buildId ?? null,
      phase: "code-repair-agent",
      step,
      status,
      message: message.slice(0, 1000),
      meta: meta as never,
    });
  } catch {
    /* timeline callbacks are best-effort */
  }
}

/* ───────────────────────────── session record ──────────────────────────── */

async function openSession(ctx: Ctx, signature: string): Promise<string | null> {
  if (!ctx.userId) return null;
  try {
    const { data } = await supabase
      .from("repair_sessions")
      .insert({
        user_id: ctx.userId,
        project_id: ctx.projectId ?? null,
        build_id: ctx.buildId ?? null,
        run_id: ctx.runId != null ? String(ctx.runId) : null,
        step_name: ctx.stepName,
        signature,
        outcome: "running",
        original_error: ctx.errorText.slice(0, 20000),
      })
      .select("id")
      .single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

async function closeSession(
  ctx: Ctx,
  outcome: "fixed" | "escalated",
  attempts: number,
  patches: PatchAudit[],
  userSummary: string,
) {
  if (!ctx.sessionId) return;
  try {
    await supabase
      .from("repair_sessions")
      .update({
        outcome,
        attempts,
        user_summary: userSummary.slice(0, 4000),
        transcript: ctx.transcript as never,
        patches: patches.map((p) => ({
          path: p.path,
          oldText: p.oldText.slice(0, 4000),
          newText: p.newText.slice(0, 4000),
          at: p.at,
        })) as never,
      })
      .eq("id", ctx.sessionId);
  } catch {
    /* non-fatal */
  }
}

/* ─────────────────────────── known-fix fast path ───────────────────────── */

async function tryKnownFix(
  ctx: Ctx,
  fix: KnownFix,
  state: RepairSessionState,
): Promise<boolean> {
  const store = useProjectStore.getState();
  const flat: { path: string; content?: string }[] = [];
  const walk = (nodes: any[]) => nodes.forEach((n) => { flat.push(n); if (n.children) walk(n.children); });
  walk(store.files as any[]);

  let applied = 0;
  for (const patch of fix.patches) {
    const target =
      flat.find((f) => f.path === patch.path && typeof f.content === "string") ||
      flat.find((f) => typeof f.content === "string" && f.content.includes(patch.oldText));
    if (!target?.content) continue;
    if (target.content.split(patch.oldText).length - 1 !== 1) continue;
    state.inspected.add(target.path);
    const result = await executeRepairTool(
      "patch_file",
      { path: target.path, old_text: patch.oldText, new_text: patch.newText },
      { state, verifyStep: ctx.verifyStep },
    );
    if (result.startsWith("SUCCESS")) applied++;
  }
  if (applied === 0) return false;

  push(ctx, "note", `Applied ${applied} known fix patch(es) from the knowledge base`);
  await callback(ctx, "known-fix", "running", `Applying a previously proven fix for this error (seen ${fix.hitCount}×)`);
  const verdict = await ctx.verifyStep(ctx.stepName);
  push(ctx, "verify", `Known fix verification: ${verdict.ok ? "passed" : "failed"}`, verdict.output);
  return verdict.ok;
}

/* ──────────────────────────────── the loop ─────────────────────────────── */

const SYSTEM_PROMPT = `You are the ForgeAI Code Repair Agent. A NativeForge build failed and the standard automated fixes could not resolve it. You investigate the real failing code and make precise surgical edits.

Rules you must obey:
1. Ground every fix in code you actually read. Never patch based on the error message alone.
2. Call get_platform_context once at the start.
3. Use inspect / search_code / read_lines / list_files / get_file_structure to locate the exact cause.
4. Before patching a file you MUST have read it in this session (get_file_structure, read_lines or search_code).
5. patch_file takes a verbatim old_text that occurs exactly once. If it fails, re-read the file and retry with the exact current text.
6. After a patch, call run_build_check with the failing step name to verify.
7. Fix build breakage only — missing imports, wrong types, missing dependencies, incorrect Gradle/Capacitor config, selector typos. NEVER redesign features or change what a component does, what data it fetches, or how it responds to the user, unless the error output traces the build failure to that exact logic.
8. You may never touch .github/workflows/** or cpr/** or any secret/keystore/.env file. If you conclude the bug is in the platform's own pipeline, STOP, do not patch anything, and reply with the single line "PLATFORM_BUG: <explanation>".
9. When run_build_check reports success, reply with a short plain-English summary of what was wrong and what you changed. No tool call.`;

export async function runCodeRepairAgent(input: RepairAgentInput): Promise<RepairAgentResult> {
  const buildStore = useBuildStore.getState();
  const { data: auth } = await supabase.auth.getUser();

  const ctx: Ctx = { ...input, transcript: [], sessionId: null, userId: auth?.user?.id ?? null };
  const errorType = input.errorType || "unknown";
  const signature = buildSignature(errorType, input.stepName, input.errorText);
  const state = createSessionState();

  ctx.sessionId = await openSession(ctx, signature);
  push(ctx, "error", `Step "${input.stepName}" failed`, input.errorText);
  await callback(ctx, "session-start", "running", `Investigating the "${input.stepName}" failure`, { signature });

  const evtId = buildStore.pushAiEvent({
    op: "thinking",
    title: `Code Repair Agent · ${input.stepName}`,
    detail: "Investigating the failing code",
    status: "active",
  });

  const finish = async (
    status: "fixed" | "escalated",
    attempts: number,
    userSummary: string,
    usedKnownFix = false,
  ): Promise<RepairAgentResult> => {
    buildStore.completeAiEvent(evtId, status === "fixed" ? "done" : "error");
    await closeSession(ctx, status, attempts, state.patches, userSummary);
    await callback(
      ctx,
      status === "fixed" ? "session-success" : "session-escalated",
      status === "fixed" ? "success" : "error",
      status === "fixed"
        ? `Repaired after ${attempts} attempt${attempts === 1 ? "" : "s"}: ${userSummary}`
        : userSummary,
      { attempts, sessionId: ctx.sessionId, patches: state.patches.map((p) => p.path) },
    );
    return {
      status,
      attempts,
      patches: state.patches,
      userSummary,
      usedKnownFix,
      sessionId: ctx.sessionId,
      transcript: ctx.transcript,
    };
  };

  // ── Fast path 1: Deterministic repair matrix for known structural issues ──
  const attemptedFixes = new Set<string>();
  const deterministic = tryDeterministicRepair(input.errorText, input.stepName, attemptedFixes);
  if (deterministic.applied && deterministic.summary) {
    push(ctx, "note", `Applied deterministic repair: ${deterministic.summary}`);
    await callback(ctx, "deterministic-repair", "running", `Applying deterministic repair for ${input.stepName}: ${deterministic.summary}`);
    const verdict = await input.verifyStep(input.stepName);
    push(ctx, "verify", `Deterministic repair verification: ${verdict.ok ? "passed" : "failed"}`, verdict.output);
    if (verdict.ok) {
      return finish("fixed", 1, `Deterministically resolved: ${deterministic.summary}`, true);
    }
  }

  // ── Fast path 2: a fix for this exact signature is already known in knowledge base. ──
  const known = await lookupKnownFix(signature);
  if (known && fixConfidence(known) >= HIGH_CONFIDENCE && known.patches.length > 0) {
    push(ctx, "note", `Knowledge base hit (confidence ${fixConfidence(known)})`, known.summary || undefined);
    const ok = await tryKnownFix(ctx, known, state);
    if (ok) {
      await recordSuccessfulFix({
        signature,
        errorType,
        stepName: input.stepName,
        errorText: input.errorText,
        summary: known.summary || "Applied a previously proven fix.",
        patches: state.patches,
      });
      return finish("fixed", 1, known.summary || "Applied a fix that already solved this exact error before.", true);
    }
    await recordFixFailure(known);
    push(ctx, "note", "Known fix did not resolve it — falling back to full investigation");
  }

  // ── Full agent loop ──
  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: getPlatformContext() },
    {
      role: "user",
      content: `The build step \`${input.stepName}\` failed. Classifier verdict: ${errorType}.\n\nRaw error output:\n\`\`\`\n${input.errorText.slice(-12000)}\n\`\`\`\n\nInvestigate the project, fix the cause, and verify by re-running only the \`${input.stepName}\` step.`,
    },
  ];

  let attempts = 0;
  let lastAssistant = "";

  const deps = {
    state,
    verifyStep: input.verifyStep,
    onActivity: (description: string, kind: "investigate" | "patch" | "verify") => {
      push(ctx, kind === "patch" ? "patch" : kind === "verify" ? "verify" : "tool", description);
      buildStore.setThinkingCaption(description);
      void callback(ctx, kind, "info", description);
    },
  };

  // Each verified patch cycle counts as one attempt; the model may run many
  // tool calls inside a single attempt.
  const MAX_TURNS = 40;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let assistant: any;
    try {
      const { data, error } = await supabase.functions.invoke("code-repair-agent", {
        body: { messages, model: input.model },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      assistant = (data as any).message;
    } catch (e: any) {
      push(ctx, "note", `Model call failed: ${e.message || e}`);
      return finish(
        "escalated",
        Math.max(attempts, 1),
        `The repair agent could not reach the AI service (${e.message || e}). The build needs manual review.`,
      );
    }

    messages.push(assistant);
    const toolCalls = assistant?.tool_calls || [];
    const content = typeof assistant?.content === "string" ? assistant.content : "";
    if (content) {
      lastAssistant = content;
      push(ctx, "assistant", content.slice(0, 600));
    }

    if (content.includes("PLATFORM_BUG:")) {
      const explanation = content.split("PLATFORM_BUG:")[1]?.trim() || "The failure originates in the platform pipeline.";
      return finish(
        "escalated",
        Math.max(attempts, 1),
        `This failure looks like a problem in the NativeForge build pipeline itself, not in your project: ${explanation} It has been sent to the platform team for review.`,
      );
    }

    if (toolCalls.length === 0) {
      // No tool call: the agent believes it is done, or it is stuck.
      const verified = ctx.transcript.some((t) => t.kind === "verify" && t.label.includes("passed"));
      if (verified && state.patches.length > 0) break;
      if (state.patches.length === 0) {
        return finish(
          "escalated",
          Math.max(attempts, 1),
          `The repair agent investigated the "${input.stepName}" failure but could not find a safe code fix. ${
            content.slice(0, 500) || "No change was made."
          }`,
        );
      }
      // Patched but never verified — verify now.
      attempts++;
      const verdict = await input.verifyStep(input.stepName);
      push(ctx, "verify", `Verification: ${verdict.ok ? "passed" : "failed"}`, verdict.output);
      if (verdict.ok) break;
      if (attempts >= MAX_REPAIR_ATTEMPTS) break;
      messages.push({
        role: "user",
        content: `The \`${input.stepName}\` step still fails after your patch. New output:\n\`\`\`\n${verdict.output.slice(-8000)}\n\`\`\`\nKeep investigating.`,
      });
      continue;
    }

    for (const call of toolCalls) {
      const name = call?.function?.name || "";
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(call?.function?.arguments || "{}");
      } catch {
        args = {};
      }
      let result: string;
      if (name === "run_build_check") {
        attempts++;
        result = await executeRepairTool(name, args, deps);
        push(ctx, "verify", `Attempt ${attempts}: ${result.startsWith("SUCCESS") ? "passed" : "failed"}`, result);
      } else {
        result = await executeRepairTool(name, args, deps);
        push(ctx, "tool", `${name}(${JSON.stringify(args).slice(0, 200)})`, result);
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result.slice(0, 8000) });
    }

    if (state.platformBugSuspected) {
      return finish(
        "escalated",
        Math.max(attempts, 1),
        `The repair agent concluded the problem lies in platform-owned pipeline code, which it is not allowed to change (${state.platformBugSuspected}). The platform team has been notified.`,
      );
    }

    const passed = messages.some(
      (m) => m.role === "tool" && typeof m.content === "string" && m.content.startsWith("SUCCESS: the"),
    );
    if (passed) {
      lastAssistant = lastAssistant || "Fixed the failing code and verified the step now passes.";
      break;
    }

    if (attempts >= MAX_REPAIR_ATTEMPTS) {
      return finish(
        "escalated",
        attempts,
        `The repair agent tried ${attempts} fixes for the "${input.stepName}" failure and the step still fails. ` +
          `Files it changed: ${state.patches.map((p) => p.path).join(", ") || "none"}. ` +
          `Last finding: ${lastAssistant.slice(0, 400) || "no summary"}. This build needs manual review.`,
      );
    }
  }

  const succeeded = state.patches.length > 0 && (await input.verifyStep(input.stepName)).ok;
  if (!succeeded) {
    return finish(
      "escalated",
      Math.max(attempts, 1),
      `The repair agent could not get the "${input.stepName}" step to pass within ${MAX_REPAIR_ATTEMPTS} attempts. ` +
        `Files it changed: ${state.patches.map((p) => p.path).join(", ") || "none"}. This build needs manual review.`,
    );
  }

  const summary =
    lastAssistant.slice(0, 600) ||
    `Fixed ${state.patches.map((p) => p.path).join(", ")} and the ${input.stepName} step now passes.`;
  await recordSuccessfulFix({
    signature,
    errorType,
    stepName: input.stepName,
    errorText: input.errorText,
    summary,
    patches: state.patches,
  });
  return finish("fixed", Math.max(attempts, 1), summary);
}
