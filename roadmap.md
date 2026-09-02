# Roadmap

Docs: `PRD.md` · `STABILIZATION_GOAL.md` · `ARCHITECTURE.md` · `ARCHITECTURE_ESSENTIALS.md` · `AGENTS.md` · `FINGERPRINT.md` · `SCAFFOLD.md`

## Now — Android + plugins to 98% by 2026-09-30
- [ ] `cpr/canonical/`: canonical representation + CI contract + stability checks
- [ ] `src/lib/repair/persistence.ts`: patch → store → persist → reseal ZIP → checksum guard (retry with same checksum aborts)
- [ ] `src/lib/repair/verification.ts`: real install / build / dev-smoke with stderr fed back to the agent
- [ ] `src/lib/repair/grounding.ts`: fixed grounding order (package.json → bundler config → entry/tsconfig → env/URLs → assets → source)
- [ ] `supabase/functions/stabilize-project` + `_shared/stabilizationPrompt.ts`
- [ ] `StabilizationStep.tsx` in the create flow (reuse ChatTimeline, diffs vs baseline)
- [ ] Replay corpus test of real failed projects

## Next (Oct)
- [ ] Plugin/Gradle specialization hardening; permissions + native assets
- [ ] iOS + desktop paths; plugin marketplace; knowledge-base fast path metrics

## Launch (Nov 17)
- [ ] Freeze, docs, pricing, launch prep
