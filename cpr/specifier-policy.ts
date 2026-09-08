/**
 * CPR re-export of authoritative specifier policy.
 * Single source of truth is supabase/functions/_shared/specifierPolicy.ts.
 */
export {
  ALIAS_PREFIXES,
  NODE_BUILTINS,
  isAliasSpecifier,
  isBuiltinOrProtocolSpecifier,
  packageFromSpecifier,
  packageNameOf,
  bareSpecifier,
} from "../supabase/functions/_shared/specifierPolicy.ts";
