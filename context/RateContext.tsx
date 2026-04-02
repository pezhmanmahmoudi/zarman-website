"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";

export type CurrentRates = {
  sellAUD: number;
  buyAUD: number;
  lastUpdated: string;
};

export type ChartDataPoint = {
  id: number;
  created_at: string | null;
  date: string; // Gregorian date from DB: YYYY-MM-DD
  buy_aud: number;
  sell_aud: number;
  mid_aud: number;
};

type RateContextType = {
  currentRates: CurrentRates;
  chartDataDaily: ChartDataPoint[];
  isLoading: boolean;
};

type HistoricalRateRow = {
  id: number | null;
  created_at: string | null;
  date: string | null;
  buy_aud: number | null;
  sell_aud: number | null;
};

const defaultCurrentRates: CurrentRates = {
  sellAUD: 71250,
  buyAUD: 70800,
  lastUpdated: new Date().toISOString(),
};

const RateContext = createContext<RateContextType>({
  currentRates: defaultCurrentRates,
  chartDataDaily: [],
  isLoading: true,
});

function toSafePositiveNumber(
  value: number | null | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function RateProvider({ children }: { children: ReactNode }) {
  const [currentRates, setCurrentRates] =
    useState<CurrentRates>(defaultCurrentRates);
  const [chartDataDaily, setChartDataDaily] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRates() {
      try {
        const pageSize = 1000;
        let from = 0;
        let hasMore = true;
        const allRows: HistoricalRateRow[] = [];

        while (hasMore) {
          const { data, error } = await supabase
            .from("rates_history")
            .select("id, created_at, date, buy_aud, sell_aud")
            .order("date", { ascending: true })
            .range(from, from + pageSize - 1);

          if (error) throw error;

          const batch = (data ?? []) as HistoricalRateRow[];
          allRows.push(...batch);

          if (batch.length < pageSize) {
            hasMore = false;
          } else {
            from += pageSize;
          }
        }

        const normalizedData: ChartDataPoint[] = allRows
          .filter((item) => Boolean(item?.date))
          .map((item) => {
            const buyAud = toSafePositiveNumber(
              item.buy_aud,
              defaultCurrentRates.buyAUD
            );
            const sellAud = toSafePositiveNumber(
              item.sell_aud,
              defaultCurrentRates.sellAUD
            );

            return {
              id: Number(item.id ?? 0),
              created_at: item.created_at ?? null,
              date: item.date as string, // keep raw Gregorian date
              buy_aud: buyAud,
              sell_aud: sellAud,
              mid_aud: (buyAud + sellAud) / 2,
            };
          })
          .filter((item) => {
            const dateMs = new Date(`${item.date}T12:00:00`).getTime();
            return Number.isFinite(dateMs);
          });

        if (normalizedData.length > 0) {
          const latest = normalizedData[normalizedData.length - 1];

          setCurrentRates({
            sellAUD: latest.sell_aud,
            buyAUD: latest.buy_aud,
            lastUpdated: latest.date, // still Gregorian
          });

          setChartDataDaily(normalizedData);
        } else {
          console.warn(
            "rates_history returned no usable rows. Falling back to default current rates."
          );
          setChartDataDaily([]);
          setCurrentRates(defaultCurrentRates);
        }
      } catch (err) {
        console.error("Error while fetching rates_history from Supabase:", err);
        setChartDataDaily([]);
        setCurrentRates(defaultCurrentRates);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRates();
  }, []);

  return (
    <RateContext.Provider value={{ currentRates, chartDataDaily, isLoading }}>
      {children}
    </RateContext.Provider>
  );
}

export function useRates() {
  return useContext(RateContext);
}