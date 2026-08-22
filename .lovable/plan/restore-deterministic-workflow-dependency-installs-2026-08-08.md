m# Restore deterministic workflow dependency installs

## Confirmed diagnosis

- Every generated Android workflow hardcodes `push.branches: [main]`, while dispatch already resolves the repositoryÃÂ¢ÃÂÃÂs actual default branch. A repository whose default branch is not `main` therefore does not receive the expected push trigger.
- The workflow now runs a ÃÂ¢ÃÂÃÂdependency doctorÃÂ¢ÃÂÃÂ before installation. It can delete dependencies after an npm `404`, replace valid project-pinned ranges with a different release, and delete `package-lock.json`.
- The install wrapper also deletes Bun, Yarn, and pnpm lockfiles, retries against a changing `package.json`, and finally uses `--force`. This discards the dependency graph that previously built successfully.
- Before CI, the client normalizer changes partial Capacitor plugin versions to `latest`; plugin reconciliation can remove known plugin packages not selected in the platform UI even when they came from the userÃÂ¢ÃÂÃÂs project.
- Phase 1 allows two AI repair retries and Phase 3 allows three. Each retry is then passed through the same dependency mutators, so an AI package fix can be overwritten and the same failure can repeat.

## Implementation

1. **Trigger on the real default branch**
   - Pass the resolved repository default branch into every generated Android workflow.
   - Render `push.branches` with that branch instead of hardcoded `main`, while retaining `workflow_dispatch` as the reliable explicit build trigger.
   - Keep dispatch and run matching on the same resolved branch and commit SHA.

2. **Restore the projectÃÂ¢ÃÂÃÂs reproducible dependency graph**
   - Remove the mutating dependency-doctor/fixer steps from setup, rebuild, uploaded-source, and repository-source workflow variants.
   - Preserve the projectÃÂ¢ÃÂÃÂs package manifest and matching lockfile; never delete a dependency merely because a registry request returns `404` because it may be private or temporarily unavailable.
   - Detect the checked-in package manager from its lockfile and use its frozen install mode when no NativeBridge package changes are required (`npm ci`, `pnpm --frozen-lockfile`, Yarn immutable/frozen, or Bun frozen lockfile).
   - When NativeBridge must add a Capacitor plugin, install only that explicit package, update the corresponding lockfile with the same package manager, and fail with the original package-manager diagnostics rather than falling back to `--force`.

3. **Stop destructive Capacitor and plugin cleanup**
   - Preserve all user-declared dependencies and versions.
   - Replace `latest` rewrites with a compatibility check against the projectÃÂ¢ÃÂÃÂs existing Capacitor major; only add a missing enabled plugin at a verified compatible version.
   - Do not uninstall a plugin solely because it is not selected in NativeBridge unless it is recorded as NativeBridge-owned.

4. **Break the AI repair loop**
   - Fingerprint the failing phase, step, normalized npm error, and resulting package patch.
   - Retry a phase only when the repair produces a new, validated change; stop immediately when the same failure or patch recurs.
   - Validate AI-proposed package names and semver without mutating unrelated entries, persist the accepted patch and lockfile, then rerun only the failed phase.
   - Surface the unchanged second failure as a terminal diagnostic instead of cycling through every repair attempt.

5. **Regression coverage**
   - Render and parse every Android workflow variant for `main`, `master`, and a custom default branch.
   - Add fixture projects for npm, pnpm, Yarn, Bun, private registry packages, and existing Capacitor/plugin versions; assert manifests and lockfiles are preserved.
   - Verify a dependency failure retains its original log, a valid AI patch survives the retry, and an identical failure cannot loop.

## Technical scope

- Primary files: `supabase/functions/build-apk/index.ts`, `src/lib/twoPhaseBuildRunner.ts`, `src/lib/tools/capacitorNormalizer.ts`, `src/lib/buildRepairRunner.ts`, and focused workflow/dependency tests.
- No UI redesign, database migration, or unrelated package upgrades.