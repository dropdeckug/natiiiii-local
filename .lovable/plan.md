# AI Readiness Agent in the Create-Project Flow

## Goal
When the Source step reports blockers (missing env vars, hardcoded localhost URLs, Vite base path, unresolved imports, config conflicts), "Next" no longer dead-ends. It hands the project to a powerful Gemini-backed repair agent that reads the canonical project representation, edits/creates/deletes the files that matter, verifies the result, and only then lets the project be created — with the same Action Panel timeline the build repair uses, streaming every step live.

## What changes for the user

1. **Source step (Step 5)**: the readiness panel keeps listing findings, but the primary action becomes **"Fix with AI"**. "Proceed anyway" stays as an escape hatch.
2. **New Step: "AI Repair"** inserted between Source and Plan. It shows the Copilot-style timeline (narration, tool lines, edit lines with real diffs, command boxes) as the agent works:
   - Building canonical representation (framework, entry, build tool, output dir, env usage, workflow expectations)
   - Reading the files each finding points at
   - Editing / creating / deleting files (each shown as an expandable diff)
   - Compatibility verification pass
   - Summary: N files changed, M findings resolved, remaining acknowledged items
3. Every finding gets a live status chip: `pending → fixing → fixed / needs-you`.
4. When the agent finishes, the readiness scan re-runs on the patched tree. If it comes back clean, **Next** unlocks automatically; anything still failing is listed with the reason, and the user can re-run the agent or proceed anyway.
5. The patched tree is what gets zipped and uploaded on Create — the original import is preserved as a baseline snapshot so the diff stays auditable.

## Scope of the agent's fixes

Driven by findings, not free-roaming:
- **Env vars**: create/extend `.env` and `.env.example` with the referenced `VITE_*` keys, add safe fallbacks at read sites so undefined values can't blank-screen the app.
- **Hardcoded localhost/ws URLs**: replace with env-driven base URLs behind a `import.meta.env.DEV` guard (cleartext is blocked on Android release).
- **Vite config**: force `base: "./"` for native packaging, align `build.outDir` with the wizard's output dir, strip dev-server-only assumptions (proxy, host-bound HMR) from the production path.
- **package.json**: add genuinely-imported-but-undeclared dependencies with real pinned versions, remove specifiers that can't resolve in CI (`npm:`/`https://esm.sh/`), keep the build script consistent with the pipeline's install command.
- **Routing**: switch to hash routing / add SPA fallback when the target shell needs it.
- **Assets & entry**: fix absolute `/asset` paths in `index.html` to relative, create missing referenced public assets or drop dead references.
- **Cleanup**: delete stale lockfiles/config that conflict with the CI install strategy.

Never touched: `.github/workflows/**`, keystores, secrets.

## Workflow parity (near-zero build failure)

The agent is given the exact CI contract — Node version, Capacitor major, install command, build command, expected output dir, excluded globs — from the existing platform release/CPR constants, and every edit is validated against it. A verification pass after patching re-runs the deterministic checks (readiness scan, compatibility check, dependency resolution, entry/output resolution) and reports pass/fail per check as command-style rows in the timeline. If a check still fails, the agent gets one bounded correction round with that failure as evidence; repeated identical patches stop the loop instead of re-dispatching.

## Technical notes

- **New edge function** `ai-readiness-repair`: takes the canonical representation, the findings, and the relevant file contents; returns `{ fileEdits[], fileDeletes[], packageJsonPatch, envFile, notes }` through a strict tool-call schema, streaming stage events. It reuses `supabase/functions/_shared/aiGateway.ts`, so `google/*` models go straight to Google AI Studio with `GEMINI_API_KEY` and fall back to the Lovable gateway. Model: `google/gemini-3.1-pro-preview` (the strongest Gemini in the supported list) with `google/gemini-3.6-flash` as fallback.
- **Canonical representation** is assembled client-side from the existing `scanProject`, `projectIndexer` entry candidates, `scanReactReadiness`, `checkCompatibility` and `resolveDependencies` outputs, plus the CI contract constants — one JSON object the agent sees instead of raw file dumps. Only files named by findings (plus `package.json`, `vite.config.*`, `index.html`, entry modules) are sent with content.
- **Timeline reuse**: no new timeline design. A new `AIRepairStep` renders `ChatTimeline` (`src/components/chat/ChatTimeline.tsx`), which already wraps `Narration`, `ToolLine`, `EditLine`, `CommandBox` and `TimelineGroup` from `src/components/timeline/CopilotTimeline.tsx`. Repair stages map onto `ChatTimelineStep` objects, with `diffAdded`/`diffRemoved` filled from before/after content.
- **Patching** goes through `useProjectStore` (`updateFileContent`, plus add/delete) so the in-memory tree stays the single source of truth; `filesToZip` on Create then uploads the patched tree unchanged. Baseline content is kept in component state for the diff view.
- **Wizard changes** in `src/components/projects/CreateProjectWizard.tsx`: `STEPS` gains `"AI Repair"`; `handleAutoFix` is replaced by the agent run; `readinessSatisfied()` additionally accepts "resolved by agent"; the repair summary is attached to the `create-project` payload alongside `scanResult`.
- Gateway errors follow the existing semantics: only 429/5xx retry with backoff; 402/403/400 surface in the timeline as an error row with the real message and stop.

## Validation
- Unit tests for canonical-representation assembly and for mapping repair results into timeline steps with correct diffs.
- Re-run of the readiness/compatibility checks on the patched tree asserted in a test fixture that reproduces the screenshot's findings (missing `VITE_*` vars, localhost in `src/utils/getAppUrl.ts`, unset Vite base).
