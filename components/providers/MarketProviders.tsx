"use client";

import type { ReactNode } from "react";
import SmoothScrollProvider from "@/components/providers/SmoothScrollProvider";
import { RateProvider } from "@/context/RateContext";
import type { RateSnapshot } from "@/lib/rates-types";

export default function MarketProviders({
  children,
  initialData,
  withSmoothScroll = true,
}: {
  children: ReactNode;
  initialData: RateSnapshot;
  withSmoothScroll?: boolean;
}) {
  const wrappedChildren = <RateProvider initialData={initialData}>{children}</RateProvider>;

  if (!withSmoothScroll) return wrappedChildren;

  return <SmoothScrollProvider>{wrappedChildren}</SmoothScrollProvider>;
}
