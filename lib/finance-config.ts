/**
 * Public (non-authenticated) cached fetcher for financial configuration.
 *
 * Uses Next.js `unstable_cache` tagged with "system-settings" so that
 * `revalidateTag("system-settings")` in the admin action immediately
 * busts this cache across the entire deployment.
 *
 * Revalidation: tag-based (instant) + 1-hour background revalidation.
 * Falls back to hard-coded defaults when the DB row has no value yet.
 */
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { FINANCE_CONFIG_DEFAULTS, type FinanceConfig } from "@/lib/pricing";

function buildDefaultConfig(): FinanceConfig {
  return {
    discount_step_volume: FINANCE_CONFIG_DEFAULTS.DISCOUNT_STEP_VOLUME,
    discount_percent_per_step: FINANCE_CONFIG_DEFAULTS.DISCOUNT_PERCENT_PER_STEP,
    max_discount_percent: FINANCE_CONFIG_DEFAULTS.MAX_DISCOUNT_PERCENT,
    fee_threshold: FINANCE_CONFIG_DEFAULTS.FEE_THRESHOLD,
    applied_fee: FINANCE_CONFIG_DEFAULTS.APPLIED_FEE,
  };
}

async function _fetchFinanceConfig(): Promise<FinanceConfig> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return buildDefaultConfig();
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data } = await supabase
      .from("rates_history")
      .select(
        "discount_step_volume, discount_percent_per_step, max_discount_percent, fee_threshold, applied_fee",
      )
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      discount_step_volume:
        data?.discount_step_volume ?? FINANCE_CONFIG_DEFAULTS.DISCOUNT_STEP_VOLUME,
      discount_percent_per_step:
        data?.discount_percent_per_step ?? FINANCE_CONFIG_DEFAULTS.DISCOUNT_PERCENT_PER_STEP,
      max_discount_percent:
        data?.max_discount_percent ?? FINANCE_CONFIG_DEFAULTS.MAX_DISCOUNT_PERCENT,
      fee_threshold:
        data?.fee_threshold ?? FINANCE_CONFIG_DEFAULTS.FEE_THRESHOLD,
      applied_fee:
        data?.applied_fee ?? FINANCE_CONFIG_DEFAULTS.APPLIED_FEE,
    };
  } catch {
    return buildDefaultConfig();
  }
}

/**
 * `getFinanceConfig()` — call this in any Server Component or Server Action.
 *
 * Results are cached in the Next.js Data Cache under the "system-settings" tag.
 * The admin `updateSystemSettings` action calls `revalidateTag("system-settings")`
 * so every consumer picks up new values immediately after an admin save.
 */
export const getFinanceConfig = unstable_cache(
  _fetchFinanceConfig,
  ["finance-config-v1"],
  { tags: ["system-settings"], revalidate: 3600 },
);
