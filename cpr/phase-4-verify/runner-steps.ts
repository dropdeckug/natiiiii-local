/**
 * CPR runner scripts.
 * Source of truth lives under supabase/functions/_shared/ so the edge runtime
 * can bundle it (local edge imports cannot escape that directory).
 */
export {
  PEER_AUDIT_JS,
  BUILD_RETRY_JS,
  BUILD_INTEGRITY_JS,
  MAX_AUTO_BUILD_RETRIES,
} from "../../supabase/functions/_shared/cprRunnerScripts.ts";
