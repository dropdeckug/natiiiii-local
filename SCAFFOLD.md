# SCAFFOLD.md — project map and the files the stabilization work needs

Existing tree (abridged) plus **[NEW]** placeholders to create for the L3 stabilization architecture.

```text
cpr/
  phase-1-detect/index.ts            frontend-vs-backend root detection
  phase-2-validate/                  index.ts · dependency-policy.ts · peer-deps.ts · plugin-conflicts.ts
  phase-3-transform/                 index.ts · module-system.ts · tsconfig.ts
  phase-4-verify/                    index.ts · runner-steps.ts · build-retry.ts · post-install.ts · resilience-runner.ts
  phase-5-report/index.ts
  plugins/registry.ts   templates/index.ts   versions/index.ts   parse/index.ts   types/index.ts
  canonical/                         [NEW] canonical representation assembly + CI contract
    representation.ts                [NEW] facts + findings + selected file contents → one JSON
    ciContract.ts                    [NEW] node/install/build/outputDir/capacitor/platform constraints
    stabilityChecks.ts               [NEW] the five "definition of stable" assertions

src/lib/
  repair/
    scope.ts                         allow/deny paths (enforcement point)
    platformContext.ts               static platform standards for the agent
    tools.ts                         inspect/read_lines/search_code/list_files/patch_file/...
    knowledgeBase.ts                 signature → known patch
    codeRepairAgent.ts               build-failure repair loop
    readinessAgent.ts                pre-build readiness repair
    deterministicRepairMatrix.ts
    stabilizationAgent.ts            [NEW] L3 orchestrator (platform-agnostic, execution-verified)
    verification.ts                  [NEW] install/build/dev-smoke runner + evidence capture
    persistence.ts                   [NEW] patch → store → persist → reseal ZIP → checksum guard
    grounding.ts                     [NEW] fixed grounding priority + file selection
  resilience/                        errorClassifier.ts · nativePackages.ts
  generators/                        capacitor · electron · tauri · twa · webview · plugins · versionMatrix
  tools/                             projectScanner · dependencyResolver · projectIndexer · compatibility
  logs/logSink.ts   cpr/runner.ts   twoPhaseBuildRunner.ts   buildRepairRunner.ts   projectPersistence.ts

src/components/
  create/            CreateFlow · GitHubImport · AIRepairStep · AIActionFeed · SetupScreen
  create/StabilizationStep.tsx       [NEW] streams the L3 timeline, shows diffs vs baseline
  chat/ChatTimeline.tsx  timeline/CopilotTimeline.tsx     (reuse — do not fork)
  logs/LogsExplorer.tsx  logs/JsonHighlight.tsx
  dashboard/ · builds/ · plugins/ · analytics/ · wizard/steps/

supabase/functions/
  _shared/           aiGateway.ts · projectIndexer.ts · cprKnowledge.ts · androidKnowledge.ts · platformRelease.ts · logTools.ts
  _shared/stabilizationPrompt.ts     [NEW] the system prompt driving the L3 agent
  ai-readiness-repair/ · code-repair-agent/ · ai-repair-build/ · ai-wire-plugins/
  stabilize-project/                 [NEW] L3 edge function (streams stages, returns output contract)
  build-apk/ · build-desktop-electron/ · build-desktop-tauri/ · verify-render/ · project-api/
  index-project/ · analyze-project/ · analyze-with-ai/ · github-clone/

src/test/
  stabilization.replay.test.ts       [NEW] corpus of real failed projects, asserts stable output
  persistenceChecksum.test.ts        [NEW] retry must use a new source checksum
  frontendRootDetection.test.ts      grounding.test.ts   buildFailureFingerprint.test.ts
```

## Data models to add
- `project_revisions(id, project_id, kind: baseline|normalized|stabilized, checksum, diff, created_at)`
- `builds.source_checksum` (guard for retry re-entry)
- `stabilization_sessions(id, project_id, representation, plan, edits, verification, outcome, model, duration_ms)`

Each new public table: `GRANT` → `ENABLE ROW LEVEL SECURITY` → policies, in the same migration.

## Build order
1. `cpr/canonical/*` + `ciContract` + `stabilityChecks`
2. `repair/persistence.ts` + checksum guard + `persistenceChecksum.test.ts`
3. `repair/verification.ts` (install/build/dev smoke with real evidence)
4. `_shared/stabilizationPrompt.ts` + `stabilize-project` function + `repair/stabilizationAgent.ts`
5. `StabilizationStep.tsx` wired into the create flow
6. `stabilization.replay.test.ts` corpus → push to 98%
