bb# Zero-user-effort builds: the strategy to 98%+

## The direct answer to "can we predict 100%?"

No. Static analysis alone can never promise a green build. It can only prove that a project is *broken*, never that it is *whole* â a config can be valid, every dependency declared, every path relative, and the build still dies on a transitive peer conflict, a postinstall script, or a plugin that only resolved on the author's machine.

Prediction by rules stops at roughly 80-85%. The remaining 15% is an infinite tail.

**Certainty only comes from execution.** The only honest statement of "this project will build" is "this project *did* build, minutes ago, in a sandbox identical to CI". So the strategy is not better prediction â it is **making a real build cheap enough to run before the user commits to anything**, with an agent in the loop that keeps editing until it is green.

That gives us two things at once: a truthful verdict, and a stabilized tree we can reuse for the actual Android build.

## The shape we should adopt

```text
Import
  â
  ââ L1 Detect        facts only: frontend root, framework, entry, output dir, PM
  ââ L2 Normalize     deterministic, provable rewrites (no guessing)
  â
  ââ L3 PREFLIGHT     â the missing layer. A real, web-only build in CI:
  â                     npm install â npm run build â dev-server smoke â assert outDir
  â                     agent edits â real stderr, up to 4 bounded rounds
  â                     verdict: GREEN (stabilized tree sealed) | BLOCKED (one plain action)
  â
  ââ L4 Specialize    only after GREEN: Capacitor, plugins, permissions, Gradle, signing
```

Preflight is the whole answer to the user's question. The web build is what breaks in 90% of cases and it costs ~60-90s on a runner â far cheaper than a full Android build. Android failures after a GREEN preflight are a much smaller, enumerable set (Gradle, SDK, plugin manifests), which is where the plugin work comes in later.

## What the AI is allowed to write (already the right list, needs enforcing)

Bundler config (`vite.config.*` and friends), `tsconfig` paths, `index.html`, `package.json` (deps/scripts only), `.env` / `.env.example`, missing entry or referenced module stubs, asset relocation, manifest / service-worker / notification files, deletion of conflicting lockfiles and configs, removal of dead imports.

Never: `.github/workflows/**`, keystores, secret values, backend directories, product behaviour or UI intent, mass reformatting, unrequested dependency upgrades.

## What is actually blocking us today (verified in the code, not assumed)

1. **The repair agent is dead code.** `runCodeRepairAgent` in `src/lib/repair/codeRepairAgent.ts` â the tool-calling loop with `patch_file`, sessions, `run_build_check`, knowledge base â has **zero callers**. The live pipeline (`src/lib/twoPhaseBuildRunner.ts`) instead uses the much simpler `runRepair()` in `src/lib/buildRepairRunner.ts`. So the "powerful agent" we designed has never run once.
2. **Vite aliases are never synced.** `cpr/phase-3-transform/tsconfig.ts` adds `paths["@/*"]` to `tsconfig.json`, but nothing ever adds `resolve.alias["@"]` to a *valid* `vite.config.ts`. That single gap produces `Rollup failed to resolve import "@/â¦"` â and it is unfixable by any current retry path.
3. **That error is then misclassified as a missing npm package.** `bareSpecifier` in `supabase/functions/_shared/resilienceRunner.ts` does not exclude `@/` or `~/`, so `@/components/Foo` is looked up on the npm registry, 404s, and the retry loop burns all 3 attempts on the same failure.
4. **Four divergent copies of "package name from specifier"** (`cpr/phase-2-validate/index.ts`, `cpr/phase-4-verify/build-retry.ts`, `runner-steps.ts`, `resilienceRunner.ts`) with three different bug states. No single source of truth, no tests on the copy that ships to CI.
5. **No no-progress detection** in `resilienceRunner`'s retry loop: identical stderr twice is not detected, so a no-op "fix" is recorded as success.
6. **Durable snapshot lags repairs.** Phase 1's retry loop never re-calls `persistBuildSource`, so a restored source can be one or more repair rounds behind the bytes that built.
7. `resilienceRunner.ts` logic lives inside one opaque template string, so none of it is unit-testable â which is why 2-5 went unnoticed.

## The checklist, in the order it must be done

### Stage 0 â stop the bleeding (foundation for everything else)
- [ ] Extract one shared `specifierPolicy` module: `isAliasSpecifier`, `packageFromSpecifier`, alias prefixes (`@/`, `~/`, `#`). Make all four call sites import it; delete the copies.
- [ ] Parity test over a fixed input table so any future drift fails CI.
- [ ] Pull `classifyError` / `bareSpecifier` / `applyFix` out of the `RESILIENCE_RUNNER_JS` template string into a real module the runner script imports, so they are testable.
- [ ] New CPR transform: sync `resolve.alias` in a valid `vite.config.*` with the tsconfig paths, scoped to `appRoot` (works for nested roots).
- [ ] No-progress guard: identical stderr fingerprint on consecutive attempts â stop the loop, escalate to the agent instead of retrying.
- [ ] Re-persist the source snapshot after every successful repair round in Phase 1.

### Stage 1 â the Preflight job (the core of the strategy)
- [ ] New workflow, web-only, no Android toolchain: extract stabilized tree â install â build â boot dev server + fetch `/` â assert `index.html` in the declared output dir.
- [ ] Every step streams real stdout/stderr back as `build_events` so the timeline reconstructs the session.
- [ ] Preflight verdict persisted on the project: `GREEN` + sealed checksum, or `BLOCKED` + the one plain-English action.
- [ ] Run Preflight automatically at project creation. The user sees "Checking your projectâ¦", never a config question.

### Stage 2 â wire the real agent into Preflight
- [ ] Call `runCodeRepairAgent` from the Preflight failure branch (and from `twoPhaseBuildRunner`'s `!isRepairable` branches), with the canonical representation + real stderr as evidence.
- [ ] Enforce grounding order in the prompt and in tool gating: `package.json` â bundler config â entry/`index.html`/tsconfig â env & URLs â assets â app source **last**.
- [ ] Enforce the persistence chain with assertions: `patch_file â projectStore â persist â reseal ZIP â new checksum`. Same checksum on retry â abort as a bug, never re-run.
- [ ] Bounded loop: max 4 rounds; identical patch twice â stop with a blocker.
- [ ] Decide the codeRepairAgent's fate explicitly â wire it (preferred) or delete it. No third state.

### Stage 3 â compounding knowledge (how 90% becomes 98%)
- [ ] Record every `(error signature â patch)` pair in `repair_knowledge` on success.
- [ ] Fast path: known signature â apply, verify, done, no model call. Cheaper and faster each week.
- [ ] Replay corpus: every real failed project becomes a fixture. CI runs the corpus; reliability becomes a number we watch, not a hope.

### Stage 4 â Android + plugins (next conversation)
Only meaningful once Preflight is GREEN-reliable: Gradle/SDK/AGP matrix, plugin manifest + permission merging, icon/splash generation, signing. The failure set here is finite and enumerable, so deterministic rules genuinely can cover it.

### Stage 5 â iOS
Same L4 slot, different generator. No stabilization work should be repeated.

## Technical notes

- Preflight and the Android build share the same sealed stabilized tree and checksum; Android never re-litigates L2/L3 decisions.
- Runner executes, AI analyses. The existing `repairPlanContract.ts` whitelist model is correct and stays: no shell strings, no metacharacters, destructive commands limited to dependency artifacts.
- `supabase/functions/_shared/resilienceRunner.ts`, `cprRunnerScripts.ts` and `cprPostInstall.ts` are currently missing from the repo while being imported by `build-apk` and `cpr/phase-4-verify` â Stage 0 must reconcile that or `build-apk` cannot deploy.
- Mirrored files (`cpr/phase-4-verify/runner-steps.ts` â `supabase/functions/_shared/cprRunnerScripts.ts`) are always patched together.
- Every reliability fix ships with a fixture reproducing the real failing project.

## What I would build first if you approve

Stage 0 in full (it is small, and it removes a class of unfixable failures), then Stage 1's Preflight job. Stage 2 depends on both.
