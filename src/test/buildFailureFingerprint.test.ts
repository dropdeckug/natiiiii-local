import { describe, expect, it } from "vitest";
import { buildFailureFingerprint } from "@/lib/tools/buildFailureFingerprint";
import type { ParsedBuildError } from "@/lib/tools/buildErrorParser";

const parsed: ParsedBuildError = {
  category: "missing-module",
  title: "Missing JavaScript module",
  detail: 'Rollup failed to resolve import "@capacitor/text-zoom" from "src/main.tsx"',
  suggestedFix: "Install it",
  severity: "blocker",
  autoFixable: true,
  filePath: "src/main.tsx",
};

describe("buildFailureFingerprint", () => {
  it("is stable across GitHub timestamps, run ids, and workspace paths", () => {
    const first = buildFailureFingerprint(parsed, "Build", "2026-08-24T00:00:01Z run #123 /home/runner/work/a/a deadbeef");
    const second = buildFailureFingerprint(parsed, "Build", "2026-08-24T00:04:18Z run #987 /home/runner/work/b/b cafebabe");
    expect(first).toBe(second);
  });
});