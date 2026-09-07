/**
 * MIRROR of the runner-executed repair-plan contract.
 *
 * The contract must live under `supabase/functions/_shared/` so the edge
 * runtime can bundle it (local edge imports cannot escape that directory), so
 * this file re-exports it rather than duplicating the whitelist, classifier and
 * executor script — one source of truth, no drift.
 *
 * CPR (phase 4) references it when it describes the verification contract with
 * the GitHub Actions runner: the AI analyses, the runner executes.
 */

export {
  ALLOWED_BINARIES,
  classifyInstallFailure,
  parseArgv,
  planSignature,
  sanitizePlan,
  validateCommand,
  REPAIR_EXECUTOR_FILENAME,
  REPAIR_EXECUTOR_JS,
  type ClassifierInput,
  type RepairCommand,
  type RepairDiagnosis,
  type RepairDiagnosisType,
  type RepairPlan,
  type ValidationResult,
} from "../../supabase/functions/_shared/repairPlanContract.ts";
