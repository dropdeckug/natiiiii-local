import { describe, it, expect, beforeEach } from "vitest";
import {
  buildSignature,
  normalizeErrorText,
  extractSubject,
  fixConfidence,
  HIGH_CONFIDENCE,
  lookupKnownFix,
  recordSuccessfulFix,
  recordFixFailure,
  clearKnowledgeStore,
} from "@/lib/repair/knowledgeBase";
import { runCodeRepairAgent } from "@/lib/repair/codeRepairAgent";
import { useProjectStore } from "@/stores/projectStore";

describe("Knowledge Base & Compounding Knowledge (Stage 3)", () => {
  beforeEach(() => {
    clearKnowledgeStore();
    useProjectStore.getState().setFiles([]);
  });

  it("normalizes error text by stripping paths, line numbers, hashes, and colors", () => {
    const error1 = `\u001b[31mError\u001b[39m: Failed to resolve import "@/components/Button" from "/home/runner/work/app/src/App.tsx:14:28"`;
    const error2 = `Error: Failed to resolve import "@/components/Button" from "C:\\Users\\runner\\AppData\\Local\\Temp\\build-9a8f7c6e\\src\\App.tsx:99:12"`;

    const norm1 = normalizeErrorText(error1);
    const norm2 = normalizeErrorText(error2);

    expect(norm1).toContain('failed to resolve import "@/components/button"');
    expect(norm2).toContain('failed to resolve import "@/components/button"');

    // Both should yield identical signatures
    const sig1 = buildSignature("vite-config", "build", error1);
    const sig2 = buildSignature("vite-config", "build", error2);
    expect(sig1).toBe(sig2);
  });

  it("extracts clean subjects from error messages", () => {
    expect(extractSubject("Cannot find module 'lucide-react'")).toBe("lucide-react");
    expect(extractSubject('Failed to resolve import "@/lib/utils"')).toBe("@/lib/utils");
    expect(extractSubject("Package subpath './client' is not defined by exports in /app/node_modules/foo")).toBe("foo");
  });

  it("records successful fix and computes high confidence", async () => {
    const errorText = "Cannot find package 'clsx'";
    const sig = buildSignature("dependency", "build", errorText);

    await recordSuccessfulFix({
      signature: sig,
      errorType: "dependency",
      stepName: "build",
      errorText,
      summary: "Added clsx dependency",
      patches: [
        {
          path: "package.json",
          before: "{}",
          after: '{"dependencies": {"clsx": "^2.1.1"}}',
          oldText: "{}",
          newText: '{"dependencies": {"clsx": "^2.1.1"}}',
          at: Date.now(),
        },
      ],
      dependencies: { clsx: "^2.1.1" },
    });

    const known = await lookupKnownFix(sig);
    expect(known).not.toBeNull();
    expect(known?.signature).toBe(sig);
    expect(known?.dependencies?.clsx).toBe("^2.1.1");
    expect(fixConfidence(known!)).toBeGreaterThanOrEqual(HIGH_CONFIDENCE);
  });

  it("lowers confidence on fix failure", async () => {
    const sig = "test-failure-sig";
    await recordSuccessfulFix({
      signature: sig,
      errorType: "syntax",
      stepName: "build",
      errorText: "Syntax error in file",
      summary: "Attempted patch",
      patches: [],
    });

    const known = await lookupKnownFix(sig);
    expect(known).not.toBeNull();
    const confBefore = fixConfidence(known!);

    await recordFixFailure(known!);
    const knownAfter = await lookupKnownFix(sig);
    expect(fixConfidence(knownAfter!)).toBeLessThan(confBefore);
  });

  it("fast path skips model invocation when a proven fix is known", async () => {
    // 1. Setup project in store
    const store = useProjectStore.getState();
    store.setFiles([
      {
        id: "package.json",

        name: "package.json",

        path: "package.json",
        type: "file",
        content: JSON.stringify({ name: "app", version: "1.0.0", dependencies: {} }, null, 2),
      },
      {
        id: "src/index.ts",

        name: "index.ts",

        path: "src/index.ts",
        type: "file",
        content: `import { clsx } from "clsx";\nconsole.log(clsx);`,
      },
    ]);

    const error = "Cannot find package 'clsx' imported from src/index.ts";
    const sig = buildSignature("dependency", "build", error);

    // 2. Pre-seed the knowledge base with proven fix
    await recordSuccessfulFix({
      signature: sig,
      errorType: "dependency",
      stepName: "build",
      errorText: error,
      summary: "Add clsx to dependencies",
      patches: [],
      dependencies: { clsx: "^2.1.1" },
    });

    // 3. Run the agent against the failure
    let stepRan = false;
    const result = await runCodeRepairAgent({
      errorText: error,
      stepName: "build",
      errorType: "dependency",
      verifyStep: async () => {
        stepRan = true;
        const pkg = useProjectStore.getState().files.find((f) => f.path === "package.json")?.content || "";
        const hasDep = pkg.includes('"clsx"');
        return hasDep
          ? { ok: true, output: "Build passed with clsx installed" }
          : { ok: false, output: "Cannot find package clsx" };
      },
    });

    // Fast path should succeed in 1 attempt without calling the LLM!
    expect(stepRan).toBe(true);
    expect(result.status).toBe("fixed");
    expect(result.usedKnownFix).toBe(true);
    expect(result.attempts).toBe(1);
  });
});
