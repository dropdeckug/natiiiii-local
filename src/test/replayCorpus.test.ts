import { describe, it, expect, beforeEach } from "vitest";
import {
  REPLAY_CORPUS_FIXTURES,
  executeFixtureReplay,
  runCorpusSuite,
} from "@/lib/repair/replayCorpus";
import { clearKnowledgeStore } from "@/lib/repair/knowledgeBase";
import { useProjectStore } from "@/stores/projectStore";

describe("Replay Corpus Suite (Stage 3)", () => {
  beforeEach(() => {
    clearKnowledgeStore();
    useProjectStore.getState().setFiles([]);
  });

  it("contains all critical real-world failure fixtures", () => {
    const fixtureIds = REPLAY_CORPUS_FIXTURES.map((f) => f.id);
    expect(fixtureIds).toContain("fixture-vite-missing-alias");
    expect(fixtureIds).toContain("fixture-pkg-missing-type-module");
    expect(fixtureIds).toContain("fixture-conflicting-lockfile");
    expect(fixtureIds).toContain("fixture-uncommitted-component-stub");
    expect(fixtureIds).toContain("fixture-missing-dependency-import");
  });

  it("executes the Vite missing alias fixture and compounds knowledge", async () => {
    const fixture = REPLAY_CORPUS_FIXTURES.find((f) => f.id === "fixture-vite-missing-alias")!;
    const result = await executeFixtureReplay(fixture);

    expect(result.passed).toBe(true);
    expect(result.attemptsRound1).toBe(1);
    // In round 2, the fix should be known and applied via fast path
    expect(result.round2UsedKnownFix).toBe(true);
  });

  it("executes the missing type module fixture and compounds knowledge", async () => {
    const fixture = REPLAY_CORPUS_FIXTURES.find((f) => f.id === "fixture-pkg-missing-type-module")!;
    const result = await executeFixtureReplay(fixture);

    expect(result.passed).toBe(true);
    expect(result.round2UsedKnownFix).toBe(true);
  });

  it("executes the conflicting lockfile fixture and compounds knowledge", async () => {
    const fixture = REPLAY_CORPUS_FIXTURES.find((f) => f.id === "fixture-conflicting-lockfile")!;
    const result = await executeFixtureReplay(fixture);

    expect(result.passed).toBe(true);
    expect(result.round2UsedKnownFix).toBe(true);
  });

  it("executes the uncommitted component stub fixture", async () => {
    const fixture = REPLAY_CORPUS_FIXTURES.find((f) => f.id === "fixture-uncommitted-component-stub")!;
    const result = await executeFixtureReplay(fixture);

    expect(result.passed).toBe(true);
    expect(result.round2UsedKnownFix).toBe(true);
  });

  it("executes the missing dependency import fixture", async () => {
    const fixture = REPLAY_CORPUS_FIXTURES.find((f) => f.id === "fixture-missing-dependency-import")!;
    const result = await executeFixtureReplay(fixture);

    expect(result.passed).toBe(true);
    expect(result.round2UsedKnownFix).toBe(true);
  });

  it("runs the full corpus suite with high reliability and high fast-path hit rate", async () => {
    const suite = await runCorpusSuite();

    expect(suite.total).toBe(REPLAY_CORPUS_FIXTURES.length);
    expect(suite.passed).toBe(suite.total);
    expect(suite.failed).toBe(0);
    expect(suite.reliabilityPercent).toBe(100);
    expect(suite.fastPathHits).toBeGreaterThanOrEqual(suite.total);
    expect(suite.fastPathPercent).toBe(100);
  });
});
