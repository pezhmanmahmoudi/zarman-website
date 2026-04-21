"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import type { CurrentRates, ChartDataPoint, RateSnapshot } from "@/lib/rates-types";

type RateContextType = {
  currentRates: CurrentRates;
  chartDataDaily: ChartDataPoint[];
  isLoading: boolean;
};

const defaultCurrentRates: CurrentRates = {
  sellAUD: null,
  buyAUD: null,
  lastUpdated: null,
};

const RateContext = createContext<RateContextType>({
  currentRates: defaultCurrentRates,
  chartDataDaily: [],
  isLoading: true,
});

export function RateProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData?: Partial<RateSnapshot>;
}) {
  const currentRates = initialData?.currentRates ?? defaultCurrentRates;
  const chartDataDaily = initialData?.chartDataDaily ?? [];

  return (
    <RateContext.Provider value={{ currentRates, chartDataDaily, isLoading: false }}>
      {children}
    </RateContext.Provider>
  );
}

export function useRates() { return useContext(RateContext); }
