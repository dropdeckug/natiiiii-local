# The Stabilization Goal — the architecture we actually need

Status: **target architecture, not yet the built one.** This is the file to read before touching CPR, the repair agent, or the build pipeline.

Deadline: Android + plugins at **98% reliability by 2026-09-30**. Launch **2026-11-17**.

---

## 1. The honest diagnosis

CPR (deterministic Canonical Project Repair) is **necessary but not sufficient**.

CPR is a rule engine. It fixes shapes we enumerated: bad specifiers, Capacitor majors, lockfile conflicts, package-manager fields, Node built-ins, output dirs. Every rule we add covers one more finite case. Real uploads are an **infinite tail**: a Vite plugin that only exists in the author's editor, an alias that resolves through a tsconfig path we never parsed, an entry file importing a component that was never committed, a `postinstall` that shells out, a Tailwind v4 config in a v3 project.

Rules cannot enumerate that. **CPR is guessing at the edges, and guesses fail the build.**

What works — observed in Google AI Studio importing a GitHub project — is a different shape:

> A powerful agent reads the whole project, *writes* the missing/broken parts (config, bundler config, entry, package manifest, asset wiring, notification/manifest files), then **runs the real commands** (`npm install`, `npm run build`, dev server) and iterates on the actual output until it is green.

That is the architecture we need: **determinism for the known, an autonomous agent for the unknown, and real execution as the only judge of "stable".**

## 2. The model: platform vs. project ownership

Supabase owns its SDK; developers build on top of it. We do not own anything the user uploads. So we cannot standardize by API design — we must standardize by **transformation**.

```text
user upload (immutable baseline)
        │
        ▼
Canonical Project Representation (CPR-normalized tree + facts)
        │
        ▼
AI Stabilization Pass  ── edits ──▶ Stabilized Tree (platform-agnostic, provably buildable)
        │
        ▼
Target Specialization (Android / iOS / desktop / PWA + plugins)
        │
        ▼
CI build
```

Two invariants:
1. **The baseline is never mutated.** Every stabilized tree is `baseline + auditable diff`.
2. **Stabilization is platform-agnostic.** At stabilization time we may not know the target. Only after "the web app builds and boots" do we layer Capacitor/Gradle/Xcode concerns.

## 3. The four layers (and who owns what)

| Layer | Owner | Decides | Never does |
| --- | --- | --- | --- |
| **L1 Detect** | CPR phase 1 | frontend root, framework, entry, build tool, output dir, package manager, env usage, monorepo shape | repair anything |
| **L2 Normalize** | CPR phases 2–3 | deterministic, provable rewrites (specifiers, version pins, lockfiles, module system, tsconfig, plugin matrix) | guess; touch business logic |
| **L3 Stabilize (AI)** | Stabilization Agent | everything L2 could not prove: config authoring, missing files, alias/entry repair, asset wiring, dead-import removal, dev-server sanity | edit workflows, keystores, secrets; change product behavior |
| **L4 Specialize + Build** | generators + CI | Capacitor config, plugins, permissions, icons, Gradle, signing, artifacts | re-litigate L2/L3 decisions |

**Rule: L3 only runs on what L2 could not prove, and L3 must prove its own work by execution.**

## 4. The Stabilization Agent

### 4.1 Inputs (the agent never gets a raw file dump)
A single **canonical representation** JSON:
- facts from L1/L2: framework, entry candidates, build tool, output dir, package manager, monorepo layout with `isFrontend`/`isBackend`, env keys referenced, deterministic findings and what L2 already changed
- the **CI contract**: Node version, install command, build command, expected output dir, Capacitor major, excluded globs, platform constraints (no cleartext HTTP on Android release, `base` must be relative, SPA fallback needs)
- file contents *only* for: `package.json`, bundler config, `index.html`, entry modules, tsconfig, files named by a finding, plus anything the agent explicitly reads via tools

### 4.2 Grounding priority (fixed order, non-negotiable)
1. `package.json` (specifiers, scripts, type, engines)
2. bundler config (`vite.config.*`, webpack/rollup/next/nuxt/astro/svelte)
3. `index.html` / entry module + `tsconfig` paths & aliases
4. env usage and hardcoded URLs
5. public/asset references
6. **only then** application source

Application business logic is the last resort, touched only when the error text points directly at it.

### 4.3 Tools
`inspect`, `list_files`, `get_file_structure`, `read_lines`, `search_code`, `patch_file`, `write_file`, `delete_file`, `run_command` (sandboxed: install/build/dev smoke), `get_platform_context`, `record_knowledge`.

Every mutation is verbatim-anchored and produces a diff row in the timeline.

### 4.4 Verification loop — the part CPR lacks
```text
plan → edit → run install → run build → boot dev server + fetch "/" → assert output dir has index.html
   ↳ fail → feed REAL stderr/stdout back as evidence → bounded correction round
   ↳ identical patch twice → stop, escalate with plain-English blocker
```
Stability is defined by execution, never by "the rules passed". Max 4 rounds, then a human-readable blocker.

### 4.5 What the agent may write
config files, `.env` / `.env.example`, missing entry or referenced module stubs, `index.html` fixes, asset relocation, manifest/notification/service-worker files, package manifest edits, deletion of conflicting lockfiles/config, removal of dead imports.

### 4.6 Hard prohibitions
`.github/workflows/**`, keystores, secrets, backend directories, anything that changes product behavior or UI intent.

## 5. Persistence contract (today's top bug)

The failure mode we hit: the agent patched files, but the retry rebuilt the *old* ZIP.

Required chain, enforced with assertions:
```text
patch_file → in-memory tree (projectStore) → persistProject → resealed source ZIP
          → checksum recorded → CI re-entry uses THAT checksum
```
- Every retry logs `sourceChecksum`; if it equals the previous attempt's checksum, the retry is **aborted as a bug**, not attempted.
- Phase 1 re-runs on the stabilized tree, never on the baseline.

## 6. Knowledge compounding
Every successful (signature → patch) pair is recorded. Next occurrence takes the fast path: apply known fix, verify, done — no model call. This is how 90% becomes 98% and how cost falls over time.

## 7. Definition of "stable"
A tree is stable when, in the CI-identical sandbox:
1. install succeeds with the contract's command,
2. build succeeds and writes `index.html` into the declared output dir,
3. the dev server boots and serves `/` without a fatal console error,
4. no absolute-path/cleartext/base violations remain,
5. every deterministic check re-runs clean on the patched tree.

Only then may the user pick a target platform.

## 8. Milestones to 98%
| Date | Deliverable |
| --- | --- |
| Sep 7 | Canonical representation + CI contract assembled; persistence chain asserted; checksum guard live. |
| Sep 12 | Sandbox verification (install/build/dev smoke) wired into the agent loop with real stderr feedback. |
| Sep 18 | Grounding priority enforced; config/dependency authoring covers the top 20 observed failure signatures. |
| Sep 24 | Plugin/Gradle specialization hardened; retry loop + plain-English blockers everywhere. |
| Sep 30 | Replay corpus of every real failed project green at ≥98%. |
