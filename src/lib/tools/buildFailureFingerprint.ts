import type { ParsedBuildError } from "@/lib/tools/buildErrorParser";

export function buildFailureFingerprint(parsed: ParsedBuildError | null, stepName: string, errorText: string): string {
  const stableDetail = parsed?.detail || errorText;
  const normalized = stableDetail
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}t[\d:.+-]+z?/gi, "<timestamp>")
    .replace(/\b[0-9a-f]{7,64}\b/gi, "<hash>")
    .replace(/\b(?:run|job|build)\s*#?\d+\b/gi, "<execution-id>")
    .replace(/\/home\/runner\/work\/[^\s:'"]+/gi, "<workspace>")
    .replace(/\b\d+(?:\.\d+){1,3}\b/g, "<version>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
  return `${parsed?.category || "unknown"}|${parsed?.filePath || "unknown-file"}|${stepName.trim().toLowerCase()}|${normalized}`;
}
