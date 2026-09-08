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
  return Number((ratio * (0.7 + 0.3 * volume)).toFixed(3));
}

export const HIGH_CONFIDENCE = 0.75;

/* ─────────────────────────── signature building ────────────────────────── */

/** Strip project-specific values so similar errors collapse to one signature. */
export function normalizeErrorText(raw: string): string {
  return String(raw || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .toLowerCase()
    .replace(/:\d+:\d+/g, "")
    .replace(/:\d+\b/g, "")
    .replace(/\bline \d+\b/g, "")
    .replace(/[a-z]:\\[^\s"':]+/g, "<path>")
    .replace(/(?<!@)\/[^\s"':]{2,}\/[^\s"':]+/g, "<path>")
    .replace(/\b\d+(?:\.\d+){1,3}(?:-[0-9a-z.]+)?\b/g, "<version>")
    .replace(/\b[0-9a-f]{7,40}\b/g, "<hash>")
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
    /Package subpath ['"][^'"]+['"] is not defined by exports in [^\s]*node_modules\/([@\w.-]+)/i,
    /node_modules\/([@\w.-]+)/i,
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

const LOCAL_STORAGE_KEY = "forgeai_repair_knowledge_cache";
const localMemoryStore = new Map<string, KnownFix>();

// Seed from localStorage if available in browser
try {
  if (typeof window !== "undefined" && window.localStorage) {
    const cached = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item?.signature) localMemoryStore.set(item.signature, item);
        }
      }
    }
  }
} catch {
  // Ignore storage errors
}

function persistLocalStore() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const arr = Array.from(localMemoryStore.values()).slice(-200);
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(arr));
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearKnowledgeStore(): void {
  localMemoryStore.clear();
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch {}
}

function rowToFix(row: any): KnownFix {
  const pattern = (row.fix_pattern || {}) as any;
  return {
    id: row.id || `kb-${row.signature}`,
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

export async function lookupKnownFix(
  signature: string,
  fallbackOpts?: { errorType?: string; subject?: string },
): Promise<KnownFix | null> {
  // 1. Try local memory store first for immediate zero-latency lookup
  const localMatch = localMemoryStore.get(signature);
  if (localMatch && fixConfidence(localMatch) >= HIGH_CONFIDENCE) {
    return localMatch;
  }

  // 2. Query Supabase
  try {
    const { data, error } = await supabase
      .from("repair_knowledge")
      .select("*")
      .eq("signature", signature)
      .maybeSingle();
    if (!error && data) {
      const fix = rowToFix(data);
      localMemoryStore.set(signature, fix);
      persistLocalStore();
      return fix;
    }
  } catch {
    // Fall back to memory store below
  }

  // 3. Fallback: check memory store even if below high confidence if exact
  if (localMatch) return localMatch;

  // 4. Fuzzy lookup by errorType + subject if provided
  if (fallbackOpts?.errorType && fallbackOpts?.subject) {
    for (const fix of localMemoryStore.values()) {
      if (
        fix.errorType === fallbackOpts.errorType &&
        fix.subject === fallbackOpts.subject &&
        fixConfidence(fix) >= HIGH_CONFIDENCE
      ) {
        return fix;
      }
    }
  }

  return null;
}

/** Extracts dependency changes from a package.json patch if available. */
function extractDependenciesFromPatches(patches: PatchAudit[]): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const p of patches) {
    if (p.path === "package.json" || p.path.endsWith("/package.json")) {
      try {
        const beforeJson = JSON.parse(p.before || "{}");
        const afterJson = JSON.parse(p.after || "{}");
        const afterDeps = { ...(afterJson.dependencies || {}), ...(afterJson.devDependencies || {}) };
        const beforeDeps = { ...(beforeJson.dependencies || {}), ...(beforeJson.devDependencies || {}) };
        for (const [k, v] of Object.entries(afterDeps)) {
          if (beforeDeps[k] !== v) {
            deps[k] = String(v);
          }
        }
      } catch {
        // Skip JSON parse error
      }
    }
  }
  return deps;
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
  const inferredDeps = input.dependencies || extractDependenciesFromPatches(input.patches);

  // Update local store immediately
  const existingLocal = localMemoryStore.get(input.signature);
  if (existingLocal) {
    existingLocal.hitCount += 1;
    existingLocal.successCount += 1;
    existingLocal.summary = input.summary || existingLocal.summary;
    existingLocal.patches = patches.length ? patches : existingLocal.patches;
    existingLocal.dependencies = { ...existingLocal.dependencies, ...inferredDeps };
    if (filePattern) existingLocal.filePattern = filePattern;
    localMemoryStore.set(input.signature, existingLocal);
  } else {
    const newFix: KnownFix = {
      id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      signature: input.signature,
      errorType: input.errorType || "unknown",
      subject: extractSubject(input.errorText),
      filePattern,
      stepName: input.stepName,
      summary: input.summary?.slice(0, 600) || null,
      hitCount: 1,
      successCount: 1,
      failureCount: 0,
      patches,
      dependencies: inferredDeps,
    };
    localMemoryStore.set(input.signature, newFix);
  }
  persistLocalStore();

  // Also sync to Supabase
  try {
    const existing = await lookupKnownFix(input.signature);
    if (existing && !existing.id.startsWith("kb-")) {
      await supabase
        .from("repair_knowledge")
        .update({
          hit_count: existing.hitCount + 1,
          success_count: existing.successCount + 1,
          summary: input.summary || existing.summary,
          fix_pattern: { patches, dependencies: inferredDeps },
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
      fix_pattern: { patches, dependencies: inferredDeps },
    });
  } catch (e) {
    console.warn("[repair-kb] could not sync fix to Supabase (saved locally):", e);
  }
}

/** A stored fix did not apply / did not verify — lower its confidence. */
export async function recordFixFailure(fix: KnownFix): Promise<void> {
  const local = localMemoryStore.get(fix.signature);
  if (local) {
    local.hitCount += 1;
    local.failureCount += 1;
    localMemoryStore.set(fix.signature, local);
    persistLocalStore();
  }

  try {
    if (!fix.id.startsWith("kb-")) {
      await supabase
        .from("repair_knowledge")
        .update({ hit_count: fix.hitCount + 1, failure_count: fix.failureCount + 1 })
        .eq("id", fix.id);
    }
  } catch {
    /* non-fatal */
  }
}
