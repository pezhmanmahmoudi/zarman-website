"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { FINANCE_CONFIG_DEFAULTS, type FinanceConfig } from "@/lib/pricing";

const defaultFinanceConfig: FinanceConfig = {
  discount_step_volume: FINANCE_CONFIG_DEFAULTS.DISCOUNT_STEP_VOLUME,
  discount_percent_per_step: FINANCE_CONFIG_DEFAULTS.DISCOUNT_PERCENT_PER_STEP,
  max_discount_percent: FINANCE_CONFIG_DEFAULTS.MAX_DISCOUNT_PERCENT,
  fee_threshold: FINANCE_CONFIG_DEFAULTS.FEE_THRESHOLD,
  applied_fee: FINANCE_CONFIG_DEFAULTS.APPLIED_FEE,
};

const FinanceConfigContext = createContext<FinanceConfig>(defaultFinanceConfig);

export function FinanceConfigProvider({
  children,
  initialConfig,
}: {
  children: ReactNode;
  initialConfig?: FinanceConfig;
}) {
  return (
    <FinanceConfigContext.Provider value={initialConfig ?? defaultFinanceConfig}>
      {children}
    </FinanceConfigContext.Provider>
  );
}

/** Consume the finance config in any client component below MarketProviders. */
export function useFinanceConfig(): FinanceConfig {
  return useContext(FinanceConfigContext);
}
