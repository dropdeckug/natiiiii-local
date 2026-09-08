/**
 * COMPONENT 1 — ERROR CLASSIFIER (platform-side mirror)
 *
 * Single source of truth is now in `supabase/functions/_shared/resilienceLogic.ts`
 * to guarantee that the GitHub Actions resilience runner and the platform
 * always share identical classifications, bare specifiers, and fix actions.
 */

export {
  classifyError,
  bareSpecifier,
  applyFix,
  computeStderrFingerprint,
  hasProgress,
  type ResilienceErrorType,
  type ResilienceFixAction,
  type ResilienceClassification,
  type ResilienceClassification as ErrorClassification,
  type FixExecutionContext,
  type FixResult,
} from "../../../supabase/functions/_shared/resilienceLogic";
