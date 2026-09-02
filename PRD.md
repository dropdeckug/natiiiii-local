# NativeForge — Product Requirements Document

Last updated: 2026-09-02 · Launch target: **2026-11-17** · Reliability milestone: **Android build + plugins at 98% success by 2026-09-30**

## 1. What we are building

NativeForge turns an *arbitrary* web project — uploaded as a ZIP or imported from GitHub — into a shippable native app (Android APK/AAB first, then iOS, desktop, PWA/TWA), without the user touching Gradle, Xcode, Capacitor config, or CI.

The core promise: **you give us any web project, we give you a working app.** Not "a build attempt". A working app.

## 2. Who it is for

| Persona | Situation | What they need |
| --- | --- | --- |
| **AI-app builder** (primary) | Built a React/Vite app in Lovable, v0, Bolt, Cursor, or AI Studio. Never shipped mobile. | Zero-config native builds; failures explained in plain English or silently fixed. |
| **Solo indie dev** | Hand-written Vite/Next/Vue app, maybe a monorepo with an Express backend. | Correct frontend detection, plugin wiring, signing, store-ready artifacts. |
| **Small agency / studio** | Many client projects, repeated builds. | Repeatability, build history, logs, analytics, per-project signing. |
| **Backend-heavy team** | `apps/web` + `apps/api` monorepo. | The pipeline must build the frontend and ignore the server. |

## 3. The problem we actually solve

Uploaded projects are **not ours**. Unlike Supabase or Expo, we do not own the SDK the developer built against. Projects arrive with:

- invalid dependency specifiers (`npm:`, `https://esm.sh/...`, `latest`, typos)
- dev-only Vite config (`lovable-tagger`, host-bound HMR, proxies, absolute `base`)
- missing env vars, hardcoded `localhost` / `ws://` URLs
- monorepos where `package.json` at root is a backend or a workspace stub
- absolute `/asset` paths, missing public assets, wrong output dir
- Node built-ins and server-only packages imported into frontend code
- Capacitor plugin/major mismatches and Gradle conflicts

Deterministic normalization (CPR) fixes the *known* shapes. It cannot fix the long tail. **The long tail is where builds die today.**

## 4. Product requirements

### 4.1 Must have for launch (2026-11-17)
1. Import: ZIP upload, GitHub import, GitSync.
2. Frontend root detection that is right on monorepos (frontend wins over backend, nested or not).
3. **AI Stabilization Pass** (see `STABILIZATION_GOAL.md`) that runs before the first build, edits the project, and verifies with real commands (`install`, `build`, dev-server smoke) until it passes.
4. Capacitor Android build in CI with plugin wiring, permissions, icons/splash, signing (debug + user keystore).
5. Self-healing workflow: classify → fix → retry (3 attempts) → clear human-readable outcome.
6. Live Action Panel timeline: narration, tool calls, file diffs, command output — the user sees exactly what the AI changed.
7. Logs explorer with per-event Overview + syntax-highlighted JSON.
8. Install-to-device flow that always resolves the latest artifact.
9. Build history, analytics, per-project settings persisted per user (model, effort, agent mode).

### 4.2 Should have
- iOS build path, Electron/Tauri desktop, TWA/PWA.
- Plugin marketplace with secrets management + OAuth provider config.
- Repair knowledge base that makes each fix cheaper platform-wide.

### 4.3 Explicitly out of scope
- Hosting the user's backend.
- Editing `.github/workflows/**`, keystores, or secrets by AI.
- Supporting non-web frameworks (Flutter/native source input).

## 5. Success metrics

| Metric | Now | 2026-09-30 | Launch |
| --- | --- | --- | --- |
| Android build success, first attempt | ~55% | **≥90%** | ≥93% |
| Android build success, incl. auto-repair retries | ~70% | **≥98%** | ≥98% |
| Plugin-enabled builds succeeding | unknown | **≥98%** | ≥98% |
| Failures with plain-English, actionable message | partial | **100%** | 100% |
| Median stabilization time | n/a | ≤4 min | ≤3 min |
| Repeat builds of a stabilized project | n/a | ≥99% | ≥99% |

## 6. Non-negotiable UX rules
- Never a cryptic failure. Every terminal state is either "fixed" or "here is the one thing you must do".
- Never a silent edit. Every AI change is a visible diff against a preserved baseline.
- Never lose the user's original upload. The baseline snapshot is immutable.
- Target platform is chosen by the user *after* stabilization — stabilization must be platform-agnostic and only then specialized.

## 7. Timeline

| Window | Focus |
| --- | --- |
| Sep 1–14 | Stabilization agent v1: canonical representation, sandbox verification (`install`/`build`), grounded config+dependency editing, diffs, persistence into the build ZIP. |
| Sep 15–24 | Plugin reliability: matrix, Gradle resolution, permissions, native asset generation; retry loop hardening. |
| Sep 25–30 | Reliability push: replay corpus of real failed projects, drive to 98%. |
| Oct | iOS + desktop, plugin marketplace, knowledge base compounding, polish. |
| Nov 1–16 | Freeze, docs, pricing, launch prep. |
| **Nov 17** | Launch. |
