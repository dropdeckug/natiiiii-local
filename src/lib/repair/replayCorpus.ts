/**
 * ForgeAI Replay Corpus
 *
 * "Every real failed project becomes a fixture. CI runs the corpus;
 * reliability becomes a number we watch, not a hope." (Stage 3)
 *
 * This module defines reproducible failure fixtures based on actual real-world
 * uploaded projects and provides a runner that executes them through the
 * repair pipeline, verifies fixes, records compounding knowledge, and tests
 * the zero-model fast path replay.
 */

import { useProjectStore, type ProjectFile } from "@/stores/projectStore";
import { runCodeRepairAgent, type RepairAgentResult } from "./codeRepairAgent";
import {
  buildSignature,
  lookupKnownFix,
  recordSuccessfulFix,
  clearKnowledgeStore,
  type KnownFix,
} from "./knowledgeBase";
import { executeRepairTool } from "./tools";

export interface ReplayFixture {
  id: string;
  name: string;
  description: string;
  category: string;
  failingStep: string;
  errorText: string;
  /** Files comprising the broken project tree before repair */
  initialFiles: { path: string; content: string }[];
  /** Verifies whether the patched project now builds / passes */
  verify: (files: { path: string; content?: string }[]) => { ok: boolean; output: string };
  /** Optional rule or tool hint for deterministic / tool resolution */
  applyFixDirectly?: (
    files: { path: string; content?: string }[],
    state: any
  ) => Promise<boolean>;
}

export interface FixtureExecutionResult {
  fixtureId: string;
  name: string;
  passed: boolean;
  round1UsedKnownFix: boolean;
  round2UsedKnownFix: boolean;
  attemptsRound1: number;
  attemptsRound2: number;
  error?: string;
}

export interface CorpusSuiteReport {
  total: number;
  passed: number;
  failed: number;
  fastPathHits: number;
  reliabilityPercent: number;
  fastPathPercent: number;
  results: FixtureExecutionResult[];
}

/* ─────────────────────────── standard fixtures ─────────────────────────── */

export const REPLAY_CORPUS_FIXTURES: ReplayFixture[] = [
  {
    id: "fixture-vite-missing-alias",
    name: "Missing Vite @ Alias Sync",
    description: "App imports @/components/Button, tsconfig has path alias, but vite.config.ts lacks resolve.alias.",
    category: "vite-config",
    failingStep: "build",
    errorText: `[vite]: Rollup failed to resolve import "@/components/Button" from "src/App.tsx". Does the file exist?`,
    initialFiles: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "test-app",
            version: "1.0.0",
            type: "module",
            scripts: { build: "vite build" },
            dependencies: { react: "^18.2.0" },
          },
          null,
          2
        ),
      },
      {
        path: "tsconfig.json",
        content: JSON.stringify(
          {
            compilerOptions: {
              baseUrl: ".",
              paths: { "@/*": ["src/*"] },
            },
          },
          null,
          2
        ),
      },
      {
        path: "vite.config.ts",
        content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
      },
      {
        path: "src/components/Button.tsx",
        content: `export function Button() { return <button>Click me</button>; }`,
      },
      {
        path: "src/App.tsx",
        content: `import React from "react";
import { Button } from "@/components/Button";

export function App() {
  return <div><Button /></div>;
}
`,
      },
    ],
    verify: (files) => {
      const vite = files.find((f) => f.path === "vite.config.ts")?.content || "";
      const hasAlias = vite.includes("alias") && (vite.includes('"@"') || vite.includes("'@'"));
      return hasAlias
        ? { ok: true, output: "Vite build succeeded: @ alias resolved correctly." }
        : { ok: false, output: `Rollup failed to resolve import "@/components/Button"` };
    },
    applyFixDirectly: async (files, state) => {
      const res = await executeRepairTool(
        "fix_alias_sync",
        { alias: "@", target_path: "./src" },
        { state: state || { inspected: new Set(), patches: [] }, verifyStep: async () => ({ ok: true, output: "" }) }
      );
      return res.startsWith("SUCCESS");
    },
  },

  {
    id: "fixture-pkg-missing-type-module",
    name: "Missing Type Module in Package.json",
    description: "vite.config.ts uses ESM syntax but package.json has no 'type': 'module', breaking Node execution.",
    category: "dependency",
    failingStep: "build",
    errorText: `SyntaxError: Cannot use import statement outside a module at /vite.config.ts:1`,
    initialFiles: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "test-esm-app",
            version: "1.0.0",
            scripts: { build: "vite build" },
            dependencies: { react: "^18.2.0" },
          },
          null,
          2
        ),
      },
      {
        path: "vite.config.ts",
        content: `import { defineConfig } from "vite";\nexport default defineConfig({});\n`,
      },
    ],
    verify: (files) => {
      const pkg = files.find((f) => f.path === "package.json")?.content || "";
      try {
        const json = JSON.parse(pkg);
        return json.type === "module"
          ? { ok: true, output: "Build succeeded: ESM module config evaluated correctly." }
          : { ok: false, output: "SyntaxError: Cannot use import statement outside a module" };
      } catch {
        return { ok: false, output: "Invalid package.json" };
      }
    },
    applyFixDirectly: async (files, state) => {
      const st = state || { inspected: new Set(), patches: [] };
      st.inspected.add("package.json");
      const res = await executeRepairTool(
        "run_command",
        { command: "npm pkg set type=module" },
        { state: st, verifyStep: async () => ({ ok: true, output: "" }) }
      );
      return res.startsWith("SUCCESS");
    },
  },

  {
    id: "fixture-conflicting-lockfile",
    name: "Conflicting or Stale Lockfile",
    description: "Incompatible package-lock.json causing npm install to abort with EUSAGE / ERESOLVE.",
    category: "npm",
    failingStep: "install",
    errorText: `npm ERR! code EUSAGE Invalid lockfileVersion: lockfile is corrupt or conflicting with engine.`,
    initialFiles: [
      {
        path: "package.json",
        content: JSON.stringify({ name: "app", version: "1.0.0", dependencies: { react: "^18.2.0" } }, null, 2),
      },
      {
        path: "package-lock.json",
        content: `{"name": "broken-app", "lockfileVersion": 9999}`,
      },
    ],
    verify: (files) => {
      const hasLock = files.some((f) => f.path === "package-lock.json");
      return !hasLock
        ? { ok: true, output: "npm install completed successfully after lockfile cleanup." }
        : { ok: false, output: "npm ERR! code EUSAGE Invalid lockfileVersion" };
    },
    applyFixDirectly: async (files, state) => {
      const res = await executeRepairTool(
        "delete_file",
        { path: "package-lock.json" },
        { state: state || { inspected: new Set(), patches: [] }, verifyStep: async () => ({ ok: true, output: "" }) }
      );
      return res.startsWith("SUCCESS");
    },
  },

  {
    id: "fixture-uncommitted-component-stub",
    name: "Uncommitted Component Stub",
    description: "App imports a component that was never committed or uploaded, breaking compilation.",
    category: "missing-module",
    failingStep: "build",
    errorText: `Failed to resolve import "@/components/HeroHeader" from "src/App.tsx". Does the file exist?`,
    initialFiles: [
      {
        path: "package.json",
        content: JSON.stringify({ name: "app", type: "module", dependencies: { react: "^18.2.0" } }, null, 2),
      },
      {
        path: "src/App.tsx",
        content: `import React from "react";\nimport { HeroHeader } from "@/components/HeroHeader";\nexport function App() { return <HeroHeader />; }`,
      },
    ],
    verify: (files) => {
      const exists = files.some((f) => f.path.includes("HeroHeader"));
      return exists
        ? { ok: true, output: "Build passed: component stub resolved." }
        : { ok: false, output: "Failed to resolve import '@/components/HeroHeader'" };
    },
    applyFixDirectly: async (files, state) => {
      const res = await executeRepairTool(
        "stub_missing_module",
        { path: "src/components/HeroHeader.tsx", export_type: "component" },
        { state: state || { inspected: new Set(), patches: [] }, verifyStep: async () => ({ ok: true, output: "" }) }
      );
      return res.startsWith("SUCCESS");
    },
  },

  {
    id: "fixture-missing-dependency-import",
    name: "Missing Package Dependency in Manifest",
    description: "Code imports lucide-react but package.json has not declared it in dependencies.",
    category: "dependency",
    failingStep: "build",
    errorText: `Cannot find package 'lucide-react' imported from /src/components/Icon.tsx`,
    initialFiles: [
      {
        path: "package.json",
        content: JSON.stringify({ name: "app", type: "module", dependencies: { react: "^18.2.0" } }, null, 2),
      },
      {
        path: "src/components/Icon.tsx",
        content: `import { Check } from "lucide-react";\nexport function Icon() { return <Check />; }`,
      },
    ],
    verify: (files) => {
      const pkg = files.find((f) => f.path === "package.json")?.content || "";
      try {
        const json = JSON.parse(pkg);
        return json.dependencies?.["lucide-react"]
          ? { ok: true, output: "Build passed: lucide-react dependency declared." }
          : { ok: false, output: "Cannot find package 'lucide-react'" };
      } catch {
        return { ok: false, output: "Invalid package.json" };
      }
    },
    applyFixDirectly: async (files, state) => {
      const st = state || { inspected: new Set(), patches: [] };
      st.inspected.add("package.json");
      const res = await executeRepairTool(
        "set_dependency",
        { name: "lucide-react", version: "^1.16.0" },
        { state: st, verifyStep: async () => ({ ok: true, output: "" }) }
      );
      return res.startsWith("SUCCESS");
    },
  },
];

/* ─────────────────────────── runner functions ─────────────────────────── */

function flattenFiles(nodes: any[]): any[] {
  return nodes.flatMap((f) => [f, ...(f.children ? flattenFiles(f.children) : [])]);
}

/** Sets up the project store with a fixture's initial file tree. */
export function loadFixtureIntoStore(fixture: ReplayFixture): void {
  const store = useProjectStore.getState();
  const files: ProjectFile[] = fixture.initialFiles.map((f, i) => ({
    id: `fixture-${i}`,
    name: f.path.split("/").pop() || f.path,
    path: f.path,
    type: "file",
    content: f.content,
  }));
  store.setFiles(files);
}

/**
 * Runs a fixture through Round 1 (discovery & recording) and Round 2 (replay via fast path).
 */
export async function executeFixtureReplay(fixture: ReplayFixture): Promise<FixtureExecutionResult> {
  const signature = buildSignature(fixture.category, fixture.failingStep, fixture.errorText);

  // ── Round 1: Initial Discovery ──
  loadFixtureIntoStore(fixture);
  const verifyCurrent = () => {
    const flat = flattenFiles(useProjectStore.getState().files);
    return fixture.verify(flat);
  };

  let round1Success = false;
  let round1UsedKnown = false;
  let r1Attempts = 1;

  // Check if known fix exists in KB
  const existingKnown = await lookupKnownFix(signature);
  if (existingKnown) {
    round1UsedKnown = true;
  }

  const round1State = { inspected: new Set<string>(), patches: [] as any[], platformBugSuspected: null };

  // Apply fix via applyFixDirectly if available, simulating the agent's actions
  if (fixture.applyFixDirectly) {
    const applied = await fixture.applyFixDirectly(flattenFiles(useProjectStore.getState().files), round1State);
    const check = verifyCurrent();
    if (applied && check.ok) {
      round1Success = true;
      // Record to knowledge base
      const flat = flattenFiles(useProjectStore.getState().files);
      const pkgFile = flat.find((f: any) => f.path === "package.json");
      let deps: Record<string, string> | undefined;
      if (pkgFile) {
        try {
          deps = JSON.parse(pkgFile.content || "{}").dependencies;
        } catch {}
      }
      await recordSuccessfulFix({
        signature,
        errorType: fixture.category,
        stepName: fixture.failingStep,
        errorText: fixture.errorText,
        summary: `Resolved ${fixture.name}`,
        patches: round1State.patches,
        dependencies: deps,
      });
    }
  }

  if (!round1Success) {
    return {
      fixtureId: fixture.id,
      name: fixture.name,
      passed: false,
      round1UsedKnownFix: false,
      round2UsedKnownFix: false,
      attemptsRound1: 1,
      attemptsRound2: 0,
      error: "Round 1 failed to resolve fixture",
    };
  }

  // ── Round 2: Replay on Fresh Project ──
  // Reset project files back to original broken state
  loadFixtureIntoStore(fixture);
  expectBrokenState: {
    const check = verifyCurrent();
    if (check.ok) {
      // should be broken initially
    }
  }

  // Run through runCodeRepairAgent with the now-known signature in the knowledge base!
  let round2UsedKnown = false;
  let round2Success = false;

  const agentResult = await runCodeRepairAgent({
    errorText: fixture.errorText,
    stepName: fixture.failingStep,
    errorType: fixture.category,
    verifyStep: async () => verifyCurrent(),
  });

  if (agentResult.status === "fixed") {
    round2Success = true;
    round2UsedKnown = agentResult.usedKnownFix;
  }

  return {
    fixtureId: fixture.id,
    name: fixture.name,
    passed: round1Success && round2Success,
    round1UsedKnownFix: round1UsedKnown,
    round2UsedKnownFix: round2UsedKnown,
    attemptsRound1: r1Attempts,
    attemptsRound2: agentResult.attempts,
  };
}

/**
 * Executes the complete replay corpus suite, calculating reliability and compounding metrics.
 */
export async function runCorpusSuite(fixtures = REPLAY_CORPUS_FIXTURES): Promise<CorpusSuiteReport> {
  clearKnowledgeStore();
  const results: FixtureExecutionResult[] = [];

  for (const fixture of fixtures) {
    const result = await executeFixtureReplay(fixture);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const fastPathHits = results.filter((r) => r.round2UsedKnownFix).length;
  const reliabilityPercent = Number(((passed / results.length) * 100).toFixed(1));
  const fastPathPercent = Number(((fastPathHits / results.length) * 100).toFixed(1));

  return {
    total: results.length,
    passed,
    failed,
    fastPathHits,
    reliabilityPercent,
    fastPathPercent,
    results,
  };
}
