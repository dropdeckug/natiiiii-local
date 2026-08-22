/**
 * ForgeAI Code Repair Agent — error knowledge base.
 *
 * Every successful repair session is generalized into a signature + fix
 * pattern stored in `public.repair_knowledge` (shared platform-wide). Before a
 * new session starts we look the signature up and try the known fix directly,
 * skipping the full investigation loop.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PatchAudit } from "./tools";

export interface KnownFix {
  id: string;
  signature: string;
  errorType: string;
  subject: string | null;
  filePattern: string | null;
  stepName: string | null;
  summary: string | null;
  hitCount: number;
  successCount: number;
  failureCount: number;
  /** Generalized patch list: file pattern + verbatim old/new text. */
  patches: { path: string; oldText: string; newText: string }[];
  /** package.json dependency additions the fix relied on. */
  dependencies: Record<string, string>;
}

/** Confidence 0..1 — how much we trust applying this fix without investigating. */
export function fixConfidence(fix: KnownFix): number {
  const total = fix.successCount + fix.failureCount;
  if (total === 0) return 0;
  const ratio = fix.successCount / total;
  const volume = Math.min(1, fix.successCount / 3);
  return Number((ratio * (0.6 + 0.4 * volume)).toFixed(3));
}

export const HIGH_CONFIDENCE = 0.75;

/* ─────────────────────────── signature building ────────────────────────── */

/** Strip project-specific values so similar errors collapse to one signature. */
export function normalizeErrorText(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/[a-z]:\\[^\s"']+/g, "<path>")
    .replace(/\/[^\s"':]{2,}\/[^\s"':]+/g, "<path>")
    .replace(/\b\d+(?:\.\d+){1,3}(?:-[0-9a-z.]+)?\b/g, "<version>")
    .replace(/\b[0-9a-f]{7,40}\b/g, "<hash>")
    .replace(/:\d+:\d+/g, ":<line>:<col>")
    .replace(/\bline \d+\b/g, "line <n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

/** The package / module / class the error is really about, when detectable. */
export function extractSubject(raw: string): string | null {
  const text = String(raw || "");
  const patterns: RegExp[] = [
    /Cannot find (?:module|package) ['"]([^'"]+)['"]/i,
    /Failed to resolve import ['"]([^'"]+)['"]/i,
    /Could not resolve ['"]([^'"]+)['"]/i,
    /No matching version found for ([^\s]+)/i,
    /notarget[^\n]*?([@\w./-]+)@/i,
    /Duplicate class ([\w.$]+)/i,
    /error TS\d+[^\n]*?['"]([^'"]+)['"]/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].slice(0, 120);
  }
  return null;
}

export function buildSignature(errorType: string, stepName: string, errorText: string): string {
  const subject = extractSubject(errorText) || "-";
  return [
    errorType || "unknown",
    stepName.trim().toLowerCase().replace(/\s+/g, "-") || "unknown-step",
    subject,
    normalizeErrorText(errorText).slice(0, 220),
  ].join("|");
}

/** Turn a concrete path into a reusable pattern (src/pages/Foo.tsx → src/pages/*.tsx). */
export function generalizePath(path: string): string {
  const parts = path.split("/");
  const file = parts.pop() || "";
  const ext = file.includes(".") ? "*." + file.split(".").pop() : "*";
  return [...parts, ext].join("/");
}

/* ───────────────────────────── persistence ─────────────────────────────── */

function rowToFix(row: any): KnownFix {
  const pattern = (row.fix_pattern || {}) as any;
  return {
    id: row.id,
    signature: row.signature,
    errorType: row.error_type,
    subject: row.subject ?? null,
    filePattern: row.file_pattern ?? null,
    stepName: row.step_name ?? null,
    summary: row.summary ?? null,
    hitCount: row.hit_count ?? 0,
    successCount: row.success_count ?? 0,
    failureCount: row.failure_count ?? 0,
    patches: Array.isArray(pattern.patches) ? pattern.patches : [],
    dependencies: pattern.dependencies && typeof pattern.dependencies === "object" ? pattern.dependencies : {},
  };
}

export async function lookupKnownFix(signature: string): Promise<KnownFix | null> {
  try {
    const { data, error } = await supabase
      .from("repair_knowledge")
      .select("*")
      .eq("signature", signature)
      .maybeSingle();
    if (error || !data) return null;
    return rowToFix(data);
  } catch {
    return null;
  }
}

export async function recordSuccessfulFix(input: {
  signature: string;
  errorType: string;
  stepName: string;
  errorText: string;
  summary: string;
  patches: PatchAudit[];
  dependencies?: Record<string, string>;
}): Promise<void> {
  const patches = input.patches.map((p) => ({ path: p.path, oldText: p.oldText, newText: p.newText }));
  const filePattern = patches.length ? generalizePath(patches[0].path) : null;
  try {
    const existing = await lookupKnownFix(input.signature);
    if (existing) {
      await supabase
        .from("repair_knowledge")
        .update({
          hit_count: existing.hitCount + 1,
          success_count: existing.successCount + 1,
          summary: input.summary || existing.summary,
          fix_pattern: { patches, dependencies: input.dependencies || {} },
          file_pattern: filePattern || existing.filePattern,
        })
        .eq("id", existing.id);
      return;
    }
    await supabase.from("repair_knowledge").insert({
      signature: input.signature,
      error_type: input.errorType || "unknown",
      subject: extractSubject(input.errorText),
      file_pattern: filePattern,
      step_name: input.stepName,
      summary: input.summary?.slice(0, 600) || null,
      fix_pattern: { patches, dependencies: input.dependencies || {} },
    });
  } catch (e) {
    console.warn("[repair-kb] could not record fix:", e);
  }
}

/** A stored fix did not apply / did not verify — lower its confidence. */
export async function recordFixFailure(fix: KnownFix): Promise<void> {
  try {
    await supabase
      .from("repair_knowledge")
      .update({ hit_count: fix.hitCount + 1, failure_count: fix.failureCount + 1 })
      .eq("id", fix.id);
  } catch {
    /* non-fatal */
  }
}
