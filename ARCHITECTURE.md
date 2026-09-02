# NativeForge — Architecture

Companion files: `ARCHITECTURE_ESSENTIALS.md` (the short version), `STABILIZATION_GOAL.md` (the target architecture for AI stabilization), `AGENTS.md` (how agents behave), `FINGERPRINT.md` (code conventions).

## 1. Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind CSS 3, shadcn/ui, semantic tokens in `src/index.css` |
| State | Zustand (`src/stores/projectStore.ts`, `buildStore.ts`), TanStack Query for server data |
| Backend | Lovable Cloud (Supabase): Postgres + RLS, Storage, Realtime, Edge Functions (Deno) |
| AI | AI Gateway via `supabase/functions/_shared/aiGateway.ts`; Google AI Studio (`GEMINI_API_KEY`) preferred for `google/*`, Lovable AI as fallback. Default `google/gemini-2.5-flash` |
| CI | GitHub Actions runners; generated workflows per project |
| Native | Capacitor (Android first, iOS next), Electron/Tauri desktop, TWA/PWA |

## 2. System map

```text
┌────────────── Client (React SPA) ──────────────┐
│ Create wizard · Project dashboard · Action     │
│ Panel timeline · Logs explorer · Analytics     │
│ projectStore (in-memory file tree)             │
└───────────┬───────────────────────┬────────────┘
            │ supabase-js           │ invoke()
            ▼                       ▼
   Postgres + RLS + Storage   Edge Functions (Deno)
            ▲                       │
            │ realtime events       ├─ github-clone / index-project
            │                       ├─ analyze-project / analyze-with-ai
            │                       ├─ ai-readiness-repair
            │                       ├─ code-repair-agent
            │                       ├─ ai-wire-plugins / ai-configure-android
            │                       ├─ build-apk / build-desktop-*
            │                       └─ verify-render / project-api
            │                               │ dispatch + callbacks
            │                               ▼
            └──────────────── GitHub Actions build runners
```

## 3. The pipeline

```text
Import → L1 Detect → L2 Normalize (CPR) → L3 AI Stabilize → L4 Specialize → CI Build → Artifact → Install
                                   ▲                                            │
                                   └──── classify → fix → retry (≤3) ───────────┘
```

### 3.1 L1 Detect — `cpr/phase-1-detect`
Finds the **frontend root**. Monorepo packages are classified `isFrontend` / `isBackend` by dependency and file hints (`vite`/`react`/`index.html` vs `express`/`fastify`/`prisma`). The frontend wins even when nested (`apps/web`, `packages/client`, `frontend/`). `appRoot` drives install dir, build dir, output dir, and every downstream path. Backend folders are excluded from build inputs and from dependency auditing.

### 3.2 L2 Normalize — `cpr/phase-2-validate`, `cpr/phase-3-transform`
Deterministic, provable rewrites only:
- specifier sanitization, invalid names, `npm:`/`esm.sh` removal
- package-manager conflicts, script rewrites, lockfile normalization
- Capacitor major alignment + plugin compatibility matrix (`cpr/plugins/registry.ts`)
- build-tool pinning, duplicate React dedupe, Node built-in / server-only detection with Buffer polyfill
- module-system and tsconfig transforms
- output: **canonical `package.json`** + patch list + findings + notes

### 3.3 L3 AI Stabilize
See `STABILIZATION_GOAL.md`. Consumes the canonical representation and the CI contract, edits files through anchored patches, and **verifies by executing** install/build/dev-smoke in a CI-identical sandbox. Outputs a stabilized tree plus a diff against the immutable baseline. Current code: `src/lib/repair/*` (`codeRepairAgent`, `readinessAgent`, `tools`, `scope`, `platformContext`, `knowledgeBase`), `supabase/functions/ai-readiness-repair`, `supabase/functions/code-repair-agent`.

### 3.4 L4 Specialize + Build — `src/lib/generators/*`, `supabase/functions/build-apk`
Capacitor config with correct `webDir`, plugin packages + permissions + Gradle resolution strategies, icons/splash (`src/lib/appearance/*`), signing, workflow generation, artifact upload, callbacks.

### 3.5 Resilience — `src/lib/resilience/*`, `cpr/phase-4-verify/*`
Classify error → apply targeted fix → retry (≤3) → output-dir fallback search → platform callback with a plain-English outcome. Nothing terminates cryptically.

## 4. Data model (Supabase, `public` schema, RLS + explicit GRANTs)

| Table | Purpose | Key columns |
| --- | --- | --- |
| `projects` | one per uploaded app | `id`, `user_id`, `slug`, `name`, `framework`, `app_root`, `engine`, `settings` |
| `project_files` / Storage `project-sources` | baseline + stabilized trees | `project_id`, `path`, `content_hash`, `revision` |
| `project_revisions` | immutable snapshots | `project_id`, `kind` (`baseline`\|`normalized`\|`stabilized`), `checksum`, `diff` |
| `builds` | one per build attempt | `id`, `project_id`, `status`, `attempt`, `source_checksum`, `apk_url`, `run_url`, timings |
| `build_events` | timeline rows | `build_id`, `phase`, `kind` (`narration`\|`tool`\|`edit`\|`command`\|`error`), `payload` |
| `build_logs` | raw CI log ingestion | `build_id`, `stream`, `line`, `ts`, `json` |
| `repair_sessions` | agent audit trail | `build_id`, `transcript`, `patches`, `outcome`, `attempts` |
| `repair_knowledge` | signature → known fix | `signature`, `patch`, `success_count`, `scope` |
| `plugins` / `project_plugins` / `plugin_secrets` | plugin catalog + per-project config | ids, `enabled`, encrypted values |
| `user_ai_preferences` | persistent per-user defaults | `user_id`, `agent_mode`, `effort`, `default_model`, `provider` |
| `user_roles` + `app_role` enum + `has_role()` | authorization | never on profiles |

Rules: roles live only in `user_roles`; every new public table ships `GRANT`s in the same migration; `service_role` granted for edge-function access; `anon` only where a policy allows public reads.

## 5. Key flows

**Create project:** upload/import → index → L1/L2 → readiness findings → *Fix with AI* (L3, streamed timeline) → re-scan → target + plugins → create → build.

**Build:** seal stabilized ZIP (record `source_checksum`) → dispatch workflow → runner streams phases via callbacks → `build_events`/`build_logs` → artifact to Storage → `builds.apk_url`.

**Repair retry:** classify → deterministic fix or agent → **persist patched tree → new checksum** → re-enter Phase 1 with the new ZIP. A retry with an unchanged checksum is a bug and is refused.

**Install to device:** resolve latest build with non-null `apk_url` (realtime + poll), download through Storage SDK, fall back to the GitHub run URL for oversized artifacts.

## 6. Observability
`src/lib/logs/logSink.ts` + `LogsExplorer` (per-event Overview tab and syntax-highlighted JSON tab), `AnalyticsDashboard` for success rate/duration/engine breakdown, `repair_sessions` for agent forensics.

## 7. Security
Secrets only in Supabase secrets/`plugin_secrets`; AI never reads or writes secrets, keystores, or `.github/workflows/**`; scope guard in `src/lib/repair/scope.ts` is the single enforcement point; RLS on every table; signed URLs for artifacts.

## 8. Open risks
1. Sandbox execution fidelity vs. the GitHub runner (Node version, network, native toolchain).
2. Agent latency and cost per stabilization; knowledge-base fast path is the mitigation.
3. Monorepos with multiple frontends — needs explicit user disambiguation.
4. Plugin matrix drift as Capacitor releases.
5. Very large uploads (tree size limits, ZIP sealing time).
