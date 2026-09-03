# Runner-Executed AI Repair (Plan → Commands → Verify)

## The problem, as the code actually is today

Phase 1 install is a single shell step (`smartInstallStep`, `supabase/functions/build-apk/index.ts:621`) that
picks an install strategy from which lockfile exists and the `NB_LOCKFILE_POLICY` env value. When it fails, the
job dies. Repair then happens entirely in the browser: `src/lib/twoPhaseBuildRunner.ts:596-645` runs an AI repair
loop that edits files in the project tree, persists them, re-zips and dispatches Phase 1 again.

That loop can only edit files. It cannot delete a lockfile inside the runner, cannot regenerate one, cannot clear
an npm cache, cannot re-run install with `--legacy-peer-deps`. So for lockfile-drift and peer-conflict classes
it re-uploads a slightly different tree and hits the identical failure — which is the repeat-failure behaviour
you saw. The `dependency doctor` step (`:613`) is deliberately a no-op echo, so nothing between the contract
check and the install can act either.

Diagnostics already exist and are uploaded (`cpr-dependency-diagnostics`: `cpr-dependency-contract.log`,
`dependency-install.log`, manifest and lockfiles). Nothing consumes them for repair.

## The change

Move execution into the runner. The AI stays an analyst that emits `repair-plan.json`; the runner is the only
thing that runs commands, from a strict whitelist, with attempt limits and verification.

Two additions, in the same Phase 1 job (not a separate job — a separate job would lose `node_modules`, the
extracted project root and the caches, and would need the whole source re-materialised):

```text
Phase 1 - Install npm dependencies          (continue-on-error, writes dependency-install.log, exit code recorded)
        ↓ if it failed
Phase 1 - AI repair: request plan            curl → edge fn ai-repair-plan → repair-plan.json
Phase 1 - AI repair: execute plan            whitelist-guarded executor, per-command logging
Phase 1 - AI repair: verify                  npm ls --depth=0 / node_modules present / lockfile valid JSON
        ↓ still failing and attempts < 3 → loop back to "request plan" with the new log + tried commands
        ↓ exhausted → fail with the repair report attached
Phase 1 - continue (Capacitor, plugins, bundle)
```

## Files touched

**New — `supabase/functions/ai-repair-plan/index.ts`**
The analyst. Input: `{ projectId, buildId, attempt, phase, installLog, contractLog, packageJson, lockfilePresent,
lockfileName, packageManager, nodeVersion, previousCommands[], previousResults[] }`. Output: the
`{ diagnosis, commands[], verify[], rollback[] }` contract from your spec. It runs a deterministic classifier
first (LOCKFILE_MISMATCH / DEPENDENCY_CONFLICT / MISSING_FILE / SCRIPT_FAILURE / REGISTRY_404 / ENGINE_MISMATCH)
and only calls the model through `_shared/aiGateway.ts` for `UNKNOWN` or when a deterministic plan has already
been tried and failed. Every emitted command is re-validated server-side against the whitelist before it is
returned, so a hallucinated command never reaches the runner. It also persists the plan as a `build_events` row
so the timeline can render it. Auth: same JWT-optional pattern as the other build functions, plus the
`NB_CALLBACK_SECRET` header the runner already carries.

**New — `supabase/functions/_shared/repairPlanContract.ts`**
Single source of truth shared by the edge function and the runner script: the command whitelist
(`rm -f <lockfile>`, `rm -rf node_modules`, `npm cache clean --force`, `npm install …`, `npm ci …`,
`npm dedupe`, `npm ls`, `node <script in workspace>`, `mkdir -p`, `touch`), the argument validator (no `&&`,
`|`, `;`, backticks, `$(`, no path escaping the workspace, no `sudo`/`curl`), the diagnosis enum, and the
JSON schema. Also exports the executor script text (`REPAIR_EXECUTOR_JS`) the workflow base64-inlines, following
the existing `RESILIENCE_RUNNER_JS` pattern.

**`cpr/phase-4-verify/repair-plan.ts` (new) + `cpr/phase-4-verify/index.ts`**
CPR-side mirror/re-export of the contract so phase 4 describes the repair loop as part of the verification
contract, matching the mirroring rule in AGENTS.md (mirrored files patched together).

**`supabase/functions/build-apk/index.ts`**
- `smartInstallStep`: add `continue-on-error: true` plus `echo "NB_INSTALL_EXIT=$?" >> $GITHUB_ENV`, and always
  write `dependency-install.log` (currently it only exists if `tee` ran).
- New `aiRepairLoopStep(label)` emitted immediately after the install step in `getSetupWorkflow`, guarded by
  `if: env.NB_INSTALL_EXIT != '0'`. It base64-inlines the executor, loops up to `NB_REPAIR_MAX_ATTEMPTS` (3),
  curls `ai-repair-plan`, executes, verifies, and stops early on a repeated command signature.
- Pass `callbackCfgFor(body)` into `getSetupWorkflow` (today Phase 1 is the only workflow that does not receive
  it, so it has no callback URL) and add `NB_CALLBACK_URL`/`NB_CALLBACK_SECRET`/`NB_PROJECT_ID`/`NB_BUILD_ID`
  to its `env:` block via the existing `resilienceEnv` helper.
- Upload `repair-plan.json` + `repair-execution.log` into the existing `cpr-dependency-diagnostics` artifact and
  as a dedicated `ai-repair-report` artifact.
- Add the same loop after the Phase 3 `npm ci` restore step in `getRebuildWorkflow`, sharing one helper.
- Kill the placeholder: `depDoctorStep` becomes a real pre-install probe that only *reports* (lockfile presence,
  drift, engine range, invalid specifiers) into `cpr-dependency-contract.log`, giving the analyst better evidence.

**`src/lib/twoPhaseBuildRunner.ts`**
The browser loop stops fighting the runner. Before starting a client-side AI repair attempt it checks whether the
failure carries a `runner_repair_exhausted` marker or a `repair-plan` build event for the same fingerprint; if
the runner already tried and failed the same diagnosis, it does not re-upload the same tree. Client repair is
reserved for source-code failures (imports, TS, Vite config), which is what it is actually good at. Runner-domain
diagnoses (lockfile, peers, cache, registry) are left to the in-runner loop, and the phase result surfaces the
runner's repair report instead of a generic error.

**`src/lib/repair/deterministicRepairMatrix.ts` / `src/lib/repair/platformContext.ts`**
Add the diagnosis→commands mapping so the client-side agent and the runner agree on vocabulary, and teach the
platform context that command execution belongs to the runner, so the chat/agent AI stops proposing file edits
for lockfile problems.

**`src/lib/tools/buildErrorParser.ts`**
Add the diagnosis codes as first-class categories so fingerprints distinguish "lockfile mismatch, attempt 2"
from "lockfile mismatch, attempt 1" and the loop guard in `twoPhaseBuildRunner.ts:610` stays accurate.

## UI — how it appears in the action panel

The runner already streams checkpoints back through the resilience runner; the repair loop emits the same event
shape, so the panel updates live rather than only at the end.

- `src/components/dashboard/ActionTrackerPanel.tsx` and `src/components/timeline/CopilotTimeline.tsx` gain a
  `repair` entry kind rendered as one collapsible group per attempt:
  header `AI repair · attempt 1/3 · Lockfile mismatch`, with the orb in `solving` state while running,
  `working` while commands execute, then a terminal check or cross.
- Inside the group: a one-line diagnosis with its evidence lines quoted from the real log, then each command as
  its own compact row — `rm -f package-lock.json`, `npm install --package-lock-only`, `npm ci` — each with its
  runtime, exit status and an expandable output tail. Command rows reuse the existing command-entry styling, so
  no new visual language.
- A final verification row (`npm ls --depth=0` → package count) and, on exhaustion, a plain-English blocker line
  with one concrete user action, per the AGENTS.md tone rule.
- `src/components/logs/LogsExplorer.tsx` gets `repair-plan` as a log type so the raw JSON is inspectable in the
  Overview/JSON tabs already built there.
- `src/stores/buildStore.ts` gains the `repairAttempts` slice feeding both panels.

## Safety rules enforced in code, not in the prompt

1. Whitelist validation happens twice — in the edge function before returning, and in the executor before
   running. The executor never uses a shell string; it `execFile`s a parsed argv.
2. Max 3 attempts; a command signature that has already been executed and failed aborts the loop immediately.
3. Destructive commands are limited to `node_modules`, lockfiles and the npm cache — never a path outside the
   workspace, never `.github/`, never a keystore.
4. `npm ci --dry-run` runs first where the plan allows it, before the real install.
5. Rollback: lockfiles are copied to `/tmp/nb-repair-backup/` before deletion and restored if the plan's critical
   command fails.
6. On exhaustion the job fails loudly with the report attached — never a silent green.

## Verification

- Unit tests for the whitelist validator and the deterministic classifier, fed the real log excerpts
  (`npm ci can only install…`, `Missing: typescript@7.0.2`, `ERESOLVE`, `ENOENT`, `ELIFECYCLE`), under
  `src/test/`, per the AGENTS.md rule that every reliability fix ships a fixture.
- A workflow-render snapshot test asserting the repair steps are emitted for both Phase 1 and Phase 3 and that
  the install step is `continue-on-error`.
- `tsgo` typecheck plus `vitest run` on the touched areas.
