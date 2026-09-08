l# AGENTS.md â how agents work inside this project

Applies to (a) coding agents editing this repo and (b) the runtime agents we ship (Stabilization Agent, Code Repair Agent, Readiness Agent, plugin wiring).

Read first: `ARCHITECTURE_ESSENTIALS.md`, then `STABILIZATION_GOAL.md`.

## Part A â agents editing this repo

1. Read before writing. Never patch a file you have not read.
2. Layer discipline: detection in `cpr/phase-1-detect`, provable rewrites in `phase-2/3`, judgement in `src/lib/repair/*`, platform output in `src/lib/generators/*`. Do not smear responsibilities.
3. Mirrored runner scripts (`cpr/phase-4-verify/runner-steps.ts` â `supabase/functions/_shared/cprRunnerScripts.ts`) must be patched **together**.
4. UI: reuse `ChatTimeline`/`CopilotTimeline`; semantic tokens only; no hardcoded colors.
5. DB: migration order = `CREATE TABLE` â `GRANT` â `ENABLE RLS` â policies. Roles only via `user_roles` + `has_role()`.
6. AI calls go through `supabase/functions/_shared/aiGateway.ts`. No direct provider fetches.
7. Add a test for every reliability fix â ideally a fixture reproducing the real failing project.
8. Verify by running: typecheck + `vitest run` for the touched area.

## Part B â runtime agents

### B.1 Mission
Make an arbitrary uploaded web project build. Not to improve it, refactor it, or restyle it. **Preserve product behavior.**

### B.2 Input
A canonical representation (facts + CI contract + selected file contents) â never a raw dump of the tree. Read more only through tools.

### B.3 Grounding order (fixed)
`package.json` â bundler config â entry / `index.html` / tsconfig aliases â env usage & hardcoded URLs â public assets â application source **last**, and only when the error names it.

### B.4 Loop
```text
plan (list the findings you will fix and the file for each)
  â edit (anchored patches, one concern per patch)
  â run install â run build â boot dev server â assert output dir
  â green? record knowledge, finish
  â red? use the REAL stderr as evidence, one bounded correction round
  â same patch twice, or 4 rounds: stop and emit a plain-English blocker
```
Never claim success without a green execution result.

### B.5 Allowed writes
bundler/build config, `.env` and `.env.example`, missing entry or referenced module stubs, `index.html` path fixes, asset moves, web manifest / service-worker / notification config, `package.json` edits, deletion of conflicting lockfiles/config, removal of dead imports.

### B.6 Forbidden, always
`.github/workflows/**`, keystores, any secret value, backend directories, product behavior/UI intent changes, mass reformatting, dependency upgrades that are not required by a finding.

### B.7 Output contract
```json
{
  "plan": [{ "finding": "...", "file": "...", "action": "..." }],
  "fileEdits": [{ "path": "...", "before": "...", "after": "...", "why": "..." }],
  "fileDeletes": ["..."],
  "packageJsonPatch": {},
  "verification": [{ "command": "npm run build", "ok": true, "output": "..." }],
  "unresolved": [{ "finding": "...", "userAction": "plain English, one sentence" }]
}
```

### B.8 Timeline obligations
Emit a `build_events` row for every narration, tool call, edit (with diff), command (with output) and error. The user must be able to reconstruct the whole session from the timeline.

### B.9 Persistence obligation
An edit is not done until it is in `projectStore`, persisted, and inside the resealed source ZIP with a new `source_checksum`. Retrying with an unchanged checksum is a bug: abort and report it.

### B.10 Tone in user-facing text
Plain English, no stack traces in the summary, one concrete action when the user is needed.
