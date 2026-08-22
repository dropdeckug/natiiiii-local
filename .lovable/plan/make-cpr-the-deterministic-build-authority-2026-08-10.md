m# Make CPR the deterministic build authority

## Honest assessment

The current CPR is not yet the deep canonicalization system described.

- It is mostly a fast, in-browser metadata scan and string-rewrite pipeline. Each phase has a deliberate 420 ms display delay, so a roughly five-second completion is expected; it is not spending 30â60 seconds installing, compiling, moving a full project, or opening the result in a browser.
- Its verification phase is currently skipped: the runner records `emptyVerifyResult()` rather than executing the install/build/headless contract.
- AI is not part of CPR. AI runs later in plugin wiring and post-failure repair. This separation is partly correct: AI should help understand unusual source code, but it should not choose foundational Node, Capacitor, Gradle, or package versions nondeterministically.
- CPR declares Node 20 and Capacitor 7, while another version matrix declares Capacitor 6.2.0, and several generated workflows hardcode Node 20 with Capacitor 6.2 fallbacks. The build system therefore has multiple competing version authorities.
- CPR can rewrite `package.json`âincluding dependencies, Node engines, package-manager metadata, and missing importsâwithout regenerating the matching lockfile. Phase 1 then selects `npm ci` whenever `package-lock.json` exists. A stale lockfile/manifest pair is a direct deterministic reason for dependency installation to fail.
- The client build runner still calls Capacitor normalization before every build, and generated workflows delete Capacitor config files and recreate native setup. That conflicts with the intended ownership rule that cleanup and canonical Capacitor configuration belong to CPR.
- The two-phase setup path does not consume the stored CPR blueprint. Only a separate source-build workflow reads CPR hints, so existing projects can build with hardcoded defaults instead of the canonical contract created at project creation.
- `dependency-install.log` is created fresh in CI and is diagnostic output, not an install input. The likely âlog file conflictâ is actually a **lockfile conflict**. The exact npm error for a particular failed run still needs to be confirmed from that runâs raw Phase 1 log before naming its package-level cause.

The realistic reliability target is: builds that pass CPRâs real verification should be highly repeatable. No system can promise 98% across arbitrary broken or server-only user code, but CPR can prevent platform-induced failures and clearly separate those from user-code failures.

## Target architecture

```text
Immutable user source
        |
        v
CPR detect + compatibility gate
        |
        v
Deterministic canonical workspace
  - one version matrix
  - one package manager
  - matched manifest + lockfile
  - canonical Capacitor config
  - generated native files removed/rebuilt by ownership rules
        |
        v
Real isolated verification
  install -> web build -> output checks -> headless render
        |
        v
Versioned CPR snapshot + sealed blueprint
        |
        v
Thin Android runner consumes blueprint verbatim
  cap sync -> Gradle build -> artifacts
```

## Implementation plan

### 1. Capture the exact Phase 1 failure before changing behavior

- Export the newest failed runâs complete `dependency-install.log`, package-manager error code, selected Node/package-manager versions, manifest hash, lockfile hash, app root, and workflow revision.
- Group failures into stale lockfile, unsupported Node engine, nonexistent package/version, peer conflict, private registry/authentication, workspace/root selection, or network failure.
- Add a run-scoped diagnostic header so every future failure identifies the exact CPR revision and compatibility matrix that produced it.
- Preserve the original package-manager stderr as the terminal error; do not replace it with a generic âinstall dependencies failedâ message.

### 2. Establish one compatibility matrix

- Replace the separate CPR and Android matrices plus workflow literals with one shared, versioned platform release definition.
- Validate the release definition against official Node, Capacitor, Android Gradle Plugin, Gradle, JDK, Android SDK, and package-manager compatibility documentation before selecting versions.
- Move from Node 20 to the supported stable LTS baselineâexpected to be Node 24, subject to that compatibility validationânot the newest Current release.
- Pin exact platform tool versions for a CPR release: Node major, package-manager version, Capacitor core/CLI/Android/plugin major, JDK, AGP, Gradle, compile SDK, target SDK, and minimum SDK.
- Reject impossible combinations during CPR with an actionable report instead of discovering them in Gradle or npm.
- Permit a legacy project profile only when its existing framework cannot run on the current baseline; that profile must still be internally coherent and explicitly versioned.

### 3. Turn CPR into a real canonical workspace builder

- Preserve the uploaded source as an immutable original snapshot.
- Build a separate canonical workspace rather than repeatedly mutating the editorâs current tree.
- Introduce deterministic, framework-specific canonical profiles for currently supported Vite, CRA, and static HTML projects. Preserve application architecture instead of blindly converting every project to React/Vite.
- Materialize declared file moves for plain HTML and future migrations, rewrite references with parser/AST-aware transforms, and record every move, edit, generated file, and retained exception in a machine-readable manifest.
- Remove generated output (`dist`, `build`, `www`), caches, old CI files, and generated native platforms from the canonical workspace. Do not delete authored source.
- Treat custom native changes separately: preserve them as explicit overlay patches or block automatic regeneration when they cannot be safely replayed.
- Generate the canonical Capacitor config, platform dependency declarations, native capability file, and ownership manifest inside CPR. The build runner must no longer clean or reinterpret them.

### 4. Make dependency resolution reproducible

- Detect the package manager from the selected app root and pin its exact version with Corepack or the appropriate official setup action.
- Never write `latest`, never copy the core packageâs patch version onto every Capacitor plugin, and never silently switch package managers.
- Resolve required NativeForge/Capacitor packages against the selected compatibility profile before CI.
- If CPR does not change dependencies, preserve the original matching lockfile and use frozen installation.
- If CPR changes dependencies, regenerate exactly one matching lockfile in an isolated CPR verification job using the same Node and package-manager versions the Android runner will use.
- Store manifest and lockfile hashes in the blueprint; Phase 1 must fail before installation if they do not match the sealed CPR snapshot.
- Remove default `--legacy-peer-deps`, `--force`, lockfile deletion, broad package pruning, and registry-driven mutation. Use an explicit compatibility exception only when CPR has validated and recorded it.
- Support npm, pnpm, Yarn, and Bun through separate frozen commands; never restore an npm-only `node_modules` cache into another package managerâs run.

### 5. Add real CPR verification and meaningful duration

- Implement the existing verification contract instead of returning a skipped result.
- In an isolated fresh workspace, run: frozen install, production web build, output-directory validation, `index.html` and asset validation, and a headless browser render with console/network capture.
- Run a minimal Capacitor config validation after the web build so incompatible plugin/config combinations are rejected before project creation completes.
- Allow one deterministic retry only for a classified transient network failure; source or version errors must not be hidden by retries.
- Expect this verified CPR path to take approximately 30â90 seconds for normal projects, based on real workânot artificial waiting. Cache only immutable package downloads, never `node_modules` or generated project state.
- Mark a project âCPR readyâ only after verification passes, and persist the verified snapshot, report, tool versions, hashes, and logs.

### 6. Migrate existing projects safely

- Before the next Android build, compare each projectâs CPR revision and matrix revision with the current release.
- For stale or missing CPR data, rerun CPR from the immutable source and present the migration report before replacing the canonical snapshot.
- Do not run the current client-side `normalizeCapacitor` step during build. Partial Capacitor cleanup occurs once inside CPR under ownership rules.
- Preserve the last verified canonical snapshot so users can roll back if a new CPR release fails their project.
- Never mix files downloaded from a previous Phase 1 Android artifact into the next canonical web source; native outputs and user/canonical source need separate artifact namespaces.

### 7. Make the Android runner intentionally thin

- Pass the persisted CPR blueprint into setup, rebuild, uploaded-source, and repository-source workflows.
- Delete duplicated root detection, output guessing, Node literals, Capacitor fallbacks, package mutation, and config deletion from workflow templates.
- Start every run in a fresh workspace and generate fresh run-scoped logs and native build output.
- Execute the blueprintâs pinned package-manager install and build commands verbatim, verify the sealed hashes, then run only the required native operations such as `cap sync android` and Gradle packaging.
- Reuse download caches keyed by matrix revision plus lockfile hash; do not cache `node_modules`, Android source, or stale generated files.
- Keep Phase 1 only if it has a distinct artifact boundary. Otherwise merge setup into a single verified Android build to reduce divergent paths.

### 8. Constrain AI to grounded, reviewable repair

- Use deterministic CPR rules for versions, package ownership, installs, file moves, and native generation.
- Use AI only for ambiguous source understanding or a repair proposal after deterministic analysis cannot resolve the issue.
- Give AI the exact failing command, raw log, relevant files, dependency graph, compatibility matrix, and prior patch fingerprint.
- Validate every proposed edit, regenerate the lockfile when dependencies change, rerun CPR verification, and accept the repair only if it produces a new passing canonical snapshot.
- Permit one unique repair attempt per failure fingerprint; never cycle through repeated package mutations.

### 9. Regression and reliability coverage

- Add fixtures for existing Capacitor 6/7/current-major projects, stale and matching npm lockfiles, pnpm/Yarn/Bun, workspaces, private registries, plain HTML, Vite, CRA, and projects with custom native overlays.
- Assert every workflow variant uses the same matrix and blueprint with no hardcoded Node/Capacitor/Gradle fallbacks.
- Assert CPR dependency changes always produce a matching lockfile and frozen install succeeds from a clean checkout.
- Assert generated native/config files are cleaned only by CPR, original source remains immutable, and runner retries cannot mutate the canonical snapshot.
- Add end-to-end tests from import through CPR verification and Android workflow rendering, including intentional dependency and user-code failures with exact diagnostics.

## Technical scope

- CPR: `cpr/versions`, detect/validate/transform/verify/report phases, templates, types, and `src/lib/cpr/runner.ts`.
- Creation and persistence: project creation flow, `create-project`, and `project_cpr` metadata/versioning.
- Android execution: `src/lib/twoPhaseBuildRunner.ts`, `build-apk`, Capacitor normalizer ownership, repair runner, and log ingestion.
- Tests: CPR unit fixtures, workflow render tests, clean-install integration tests, and end-to-end verification fixtures.
- No unrelated UI redesign. UI changes are limited to CPR progress, migration review, exact compatibility diagnostics, and verified/blocked status.

## Delivery sequence

1. Failure forensics and run diagnostics.
2. Unified compatibility matrix and lockfile correctness hotfix.
3. Blueprint propagation and removal of build-time mutation/cleanup.
4. Existing-project CPR migration path.
5. Real install/build/headless CPR verification.
6. Framework-specific canonical workspace transforms and constrained AI repair.
7. Full fixture matrix and staged rollout with rollback to the previous verified CPR release.