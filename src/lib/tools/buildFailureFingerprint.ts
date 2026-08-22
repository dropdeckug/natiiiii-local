import type { ParsedBuildError } from "@/lib/tools/buildErrorParser";

export function buildFailureFingerprint(parsed: ParsedBuildError | null, stepName: string, errorText: string): string {
  const normalized = errorText.toLowerCase().replace(/\b\d+(?:\.\d+){1,3}\b/g, "<version>").replace(/\s+/g, " ").trim().slice(0, 1200);
  return `${parsed?.category || "unknown"}|${stepName.trim().toLowerCase()}|${normalized}`;
}
