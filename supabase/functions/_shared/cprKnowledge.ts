/**
 * CPR + build pipeline knowledge pack injected into the ForgeAI agent prompt.
 * Keep this in sync with cpr/ and the build edge functions.
 */
export const CPR_KNOWLEDGE = `
════════ NATIVEBRIDGE PLATFORM KNOWLEDGE (authoritative) ════════

WHAT THE PLATFORM DOES
A user brings a web project (upload, GitHub import, or URL). NativeBridge turns it into a native
Android/iOS/desktop app. Every conversion goes through CPR — the Canonical Project Representation
pipeline — and then through the cloud build pipeline. CPR is the deterministic build authority: if
CPR says a project is red, the build WILL fail. Never advise a user to "just build and see".

CPR PIPELINE — five phases (source in cpr/, browser conductor in src/lib/cpr/runner.ts)
  parse/            Module-graph parsing. Strips comments/strings before scanning imports, so
                    commented-out or template-literal imports are NOT treated as real dependencies.
                    An AST parser can be registered via setAstParser().
  phase-1-detect/   quickScan(): framework (react, next, vue, svelte, angular, preact, remix, html…),
                    build tool (vite, webpack, next, cra, parcel, none…), package manager
                    (npm/yarn/pnpm/bun), monorepo layout + project root, server-side flags
                    (SSR/API routes — these block static export), and a TypeScript readiness probe.
  phase-2-validate/ Metadata-only validation — NO install, NO network. auditDependencies() finds
                    version conflicts, peer-dependency gaps (peer-deps.ts) and Capacitor plugin
                    conflicts (plugin-conflicts.ts, plus gradleResolutionSnippet for native clashes).
                    Also decides installCommandFor()/runCommandFor(). Anything that would explode
                    during npm install is decided here.
  phase-3-transform/ Normalization + canonical output as FULL-FILE patches. Eliminates blank-screen
                    causes (bad base paths, absolute asset URLs, router basename, localhost API URLs
                    rewritten to apiBaseUrl, missing index.html root node), fixes module system
                    (module-system.ts: ESM/CJS mismatch), ensures tsconfig (tsconfig.ts), and emits
                    canonical files: capacitor.config, README, native flag file, Capacitor deps.
  phase-4-verify/   CPR never runs npm or a browser itself. It builds the dispatch contract for the
                    'cpr-verify' GitHub Actions runner, classifies build errors, and interprets the
                    result. build-retry.ts auto-retries on unresolved-module errors by installing the
                    missing package (MAX_AUTO_BUILD_RETRIES); MAX_BUILD_RETRIES=3, MAX_HEADLESS_RETRIES=2.
  phase-5-report/   buildPreflightReport(): GREEN = auto-handled, AMBER = needs user input before
                    targets can be created, RED = blocks CPR. Report items cite the phase + file.

VERSION MATRIX (cpr/versions/index.ts)
A project is processed by the LOWEST CPR version that supports its (framework, buildTool) pair.
CURRENT_CPR_VERSION gates what ships today; higher versions are "coming soon" with a date; unlisted
pairs are "not supported" with an explanation. PLATFORM_NODE_VERSION and PLATFORM_CAPACITOR_MAJOR
come from supabase/functions/_shared/platformRelease.ts — never hardcode Node/Capacitor versions,
always quote the platform release constants.

BUILD PIPELINE (after CPR emits the canonical workspace + blueprint)
  1. Source bundled (src/lib/tools/sourceBundler.ts) and pushed to a scratch GitHub repo.
  2. Edge functions build-apk / build-ios / build-desktop dispatch a GitHub Actions workflow that
     consumes the CPR blueprint VERBATIM. The workflow patches SDK/AGP/Gradle versions from the
     version matrix, runs the install command CPR chose, runs the web build, then npx cap sync,
     then Gradle assemble/bundle.
  3. Artifacts (APK/AAB) are downloaded (artifactDownloader) and validated (apkValidator).
  4. Failures are classified by buildErrorParser and streamed to the log store; ai-repair-build can
     propose a patch, ai-wire-plugins wires plugin code, ai-configure-android patches native config.

BREAKAGE RULES YOU MUST APPLY WHEN JUDGING A CHANGE
  • Editing the CPR-canonical files (capacitor.config.*, the native flag file, generated tsconfig,
    vite/webpack base path) by hand can desync the workspace from the blueprint — prefer changing
    the source project so CPR regenerates them.
  • SSR / API routes / server middleware cannot be statically exported → red, needs a static or
    prerendered target, or an external API base URL.
  • Localhost or relative-to-dev-server API URLs break in the WebView → must be an absolute https URL.
  • Absolute asset paths ("/assets/x.png") break under the capacitor:// scheme → base must be "./".
  • Adding a Capacitor plugin means: npm dependency + npx cap sync + Android permissions in the
    manifest + sometimes Gradle/MainActivity changes. Missing any of these = runtime crash, not a
    build failure, so never call a plugin "installed" until all layers are wired.
  • Mixing package managers (a bun lockfile with an npm install) or ESM/CJS mismatch is a classic
    red; CPR normalizes it in phase 3 — check that before hand-patching.
  • Placeholders: canonical templates contain platform placeholders (app id, app name, API base URL,
    icons). Leaving a placeholder unresolved produces a build that installs but shows a blank or
    default screen. Always check placeholders are filled before declaring a fix complete.

HOW TO USE THIS
When the user asks "why is my build failing" or "will this break", compare the ORIGINAL project
against the CPR output: read the preflight report / logs first (buildFailureReport, queryLogs),
map the finding to the phase that owns it, then ground into the exact file and line and fix the
SOURCE cause, not the symptom.`;
