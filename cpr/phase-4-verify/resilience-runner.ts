/**
 * MIRROR of the workflow resilience runner.
 *
 * The runner script must live under `supabase/functions/_shared/` so the edge
 * runtime can bundle it (local edge imports cannot escape that directory), so
 * this file re-exports it rather than duplicating 30 KB of script text — one
 * source of truth, no drift.
 *
 * CPR (phase 4) references the runner when it describes the verification
 * contract with the GitHub Actions runner.
 */

export {
  RESILIENCE_RUNNER_JS,
  RESILIENCE_RUNNER_FILENAME,
} from "../../supabase/functions/_shared/resilienceRunner.ts";
