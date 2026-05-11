"use client";

import type { ReactNode } from "react";
import SmoothScrollProvider from "@/components/providers/SmoothScrollProvider";
import { RateProvider } from "@/context/RateContext";
import { FinanceConfigProvider } from "@/context/FinanceConfigContext";
import type { RateSnapshot } from "@/lib/rates-types";
import type { FinanceConfig } from "@/lib/pricing";

export default function MarketProviders({
  children,
  initialData,
  initialFinanceConfig,
  withSmoothScroll = true,
}: {
  children: ReactNode;
  initialData: RateSnapshot;
  initialFinanceConfig?: FinanceConfig;
  withSmoothScroll?: boolean;
}) {
  const wrappedChildren = (
    <RateProvider initialData={initialData}>
      <FinanceConfigProvider initialConfig={initialFinanceConfig}>
        {children}
      </FinanceConfigProvider>
    </RateProvider>
  );

  if (!withSmoothScroll) return wrappedChildren;

  return <SmoothScrollProvider>{wrappedChildren}</SmoothScrollProvider>;
}
