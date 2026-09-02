# Architecture Essentials

Quick reference. Full detail: `ARCHITECTURE.md`. Target-state reasoning: `STABILIZATION_GOAL.md`.

## Stack
React 18 + Vite 5 + TS + Tailwind + shadcn · Zustand + TanStack Query · Supabase (Postgres/RLS/Storage/Realtime/Edge Functions) · AI Gateway (`google/gemini-2.5-flash` default, Google AI Studio first, Lovable AI fallback) · GitHub Actions · Capacitor.

## Pipeline
`Import → L1 Detect → L2 Normalize (deterministic CPR) → L3 AI Stabilize (agent + real execution) → L4 Specialize (platform + plugins) → CI Build → Artifact`

## Ten rules that must never break
1. **Frontend root wins.** Monorepo detection classifies frontend vs backend; `appRoot` drives every path. Backend dirs never enter the build.
2. **Baseline is immutable.** Stabilized tree = baseline + auditable diff.
3. **Deterministic first, AI for the tail.** L2 only does provable rewrites; L3 handles everything else.
4. **Stability is proven by execution**, not by rules: install + build + dev-smoke + output-dir assertion.
5. **Grounding order:** `package.json` → bundler config → entry/`index.html`/tsconfig → env & URLs → assets → app source last.
6. **Patched files must reach the retry.** `patch_file → store → persist → reseal ZIP → new checksum`. Same checksum on retry = abort as bug.
7. **Stabilization is platform-agnostic**; platform/plugin concerns come only in L4.
8. **AI never touches** `.github/workflows/**`, keystores, secrets, or backend code (`src/lib/repair/scope.ts`).
9. **No cryptic failure.** Every terminal state is auto-fixed or a plain-English single action.
10. **Every fix is recorded** in `repair_knowledge` for a no-model fast path next time.

## Core tables
`projects`, `project_revisions` (baseline/normalized/stabilized + checksum), `builds` (`source_checksum`, `apk_url`), `build_events`, `build_logs`, `repair_sessions`, `repair_knowledge`, `project_plugins`/`plugin_secrets`, `user_ai_preferences`, `user_roles` (+ `has_role()`).

## Non-negotiables in code
- New public table ⇒ `GRANT`s in the same migration, then RLS, then policies.
- Roles only in `user_roles`; never on profiles.
- Colors/shadows/gradients only via semantic tokens.
- Timeline UI reuses `ChatTimeline` / `CopilotTimeline` — no new timeline designs.

## Targets
Android + plugins ≥98% (incl. auto-repair) by **2026-09-30**; launch **2026-11-17**.
