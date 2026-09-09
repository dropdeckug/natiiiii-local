/**
 * CPR post-install verification script.
 * Source of truth lives under supabase/functions/_shared/ so the edge runtime
 * can bundle it (local edge imports cannot escape that directory).
 */
export { POST_INSTALL_JS } from "../../supabase/functions/_shared/cprPostInstall.ts";
