# FINGERPRINT.md — how this codebase is written

The house style. Match it; do not introduce a second way of doing something that already has one.

## Language & structure
- TypeScript strict-ish; explicit exported types; `interface` for object shapes, `type` for unions.
- Pure logic in `src/lib/**` and `cpr/**` — no React imports there, so it stays testable and reusable in Deno.
- React components are presentational; side effects in hooks (`src/hooks/**`) or stores.
- File names: components `PascalCase.tsx`, logic `camelCase.ts`, folders lowercase.
- Named exports everywhere except route/page components.

## Directory contract
| Path | Contains |
| --- | --- |
| `cpr/phase-1-detect` | detection only, no mutation |
| `cpr/phase-2-validate` | provable dependency/version policy |
| `cpr/phase-3-transform` | module system, tsconfig, config transforms |
| `cpr/phase-4-verify` | runner scripts, retry, post-install checks |
| `cpr/phase-5-report` | report assembly |
| `src/lib/repair` | agent scope, tools, platform context, knowledge base, orchestration |
| `src/lib/generators` | per-engine output (capacitor, electron, tauri, twa, webview) |
| `src/lib/resilience` | error classification + native package tables |
| `supabase/functions/_shared` | code shared by edge functions (gateway, indexer, knowledge, runner scripts) |

## Conventions
- Comments explain *why* (platform constraint, runner quirk), never *what*.
- Errors: throw typed errors in lib code; edge functions return `{ error: { code, message } }` with real messages; UI surfaces the real message.
- AI gateway retries only on 429/5xx with backoff; 400/402/403 surface immediately.
- Long shell scripts for the runner live as template strings in one place and are mirrored — keep both copies byte-aligned.
- Styling: Tailwind + semantic tokens from `src/index.css`; shadcn variants for state; never `text-white`/`bg-[#...]`.
- Tests in `src/test/*.test.ts` with vitest; reliability fixes get a fixture from the real failing project.
- Logging goes through `src/lib/logs/logSink.ts`, never bare `console.log` in shipped paths.

## Review checklist
- [ ] Correct layer for the change
- [ ] Mirrored runner scripts updated together
- [ ] Migration has GRANTs + RLS + policies
- [ ] Timeline events emitted for anything the user should see
- [ ] Patched files reach the resealed ZIP (checksum changes)
- [ ] Test added; typecheck clean
