"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type CurrentRates = {
  sellAUD: number | null;
  buyAUD: number | null;
  lastUpdated: string | null;
};

export type ChartDataPoint = {
  id: number;
  created_at: string | null;
  date: string; 
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
  sellAUD: null,
  buyAUD: null,
  lastUpdated: null,
};

const RateContext = createContext<RateContextType>({
  currentRates: defaultCurrentRates,
  chartDataDaily: [],
  isLoading: true,
});

function toSafePositiveNumber(value: number | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function RateProvider({ children }: { children: ReactNode }) {
  const [currentRates, setCurrentRates] = useState<CurrentRates>(defaultCurrentRates);
  const [chartDataDaily, setChartDataDaily] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRates() {
      try {
        // 🚀 دریافت ۱۵۰۰ روز اخیر (حدود ۴ سال) در یک درخواست بسیار سریع و یکپارچه
        // این کار هم نمودار را کامل می‌کند و هم سایت را سبک نگه می‌دارد
        const { data, error } = await supabase
          .from("rates_history")
          .select("id, created_at, date, buy_aud, sell_aud")
          .order("date", { ascending: false })
          .limit(1500);

        if (error) throw error;
        const fetchedRows = (data ?? []) as HistoricalRateRow[];

        // 🛡️ ترمیم و فیلتر کردن دیتاها
        const normalizedData: ChartDataPoint[] = fetchedRows
          .filter((item) => Boolean(item?.date))
          .map((item) => {
            const buyAud = toSafePositiveNumber(item.buy_aud);
            const sellAud = toSafePositiveNumber(item.sell_aud);
            if (buyAud === null || sellAud === null) return null;
            return {
              id: Number(item.id ?? 0),
              created_at: item.created_at ?? null,
              date: item.date as string, 
              buy_aud: buyAud,
              sell_aud: sellAud,
              mid_aud: (buyAud + sellAud) / 2,
            } as ChartDataPoint;
          })
          .filter((item): item is ChartDataPoint => item !== null)
          .filter((item) => {
            const dateMs = new Date(`${item.date}T12:00:00`).getTime();
            return Number.isFinite(dateMs);
          })
          // 🚀 مرتب‌سازی صعودی دیتاها تا نمودارها از چپ به راست (قدیم به جدید) درست رسم شوند
          .sort((a, b) => {
            const aMs = new Date(`${a.date}T12:00:00Z`).getTime();
            const bMs = new Date(`${b.date}T12:00:00Z`).getTime();
            return aMs - bMs;
          });

        if (normalizedData.length > 0) {
          const latest = normalizedData[normalizedData.length - 1];
          setCurrentRates({
            sellAUD: latest.sell_aud,
            buyAUD: latest.buy_aud,
            lastUpdated: latest.date, 
          });
          setChartDataDaily(normalizedData);
        } else {
          setChartDataDaily([]);
          setCurrentRates(defaultCurrentRates); 
        }
      } catch {
        setChartDataDaily([]);
        setCurrentRates(defaultCurrentRates);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRates();
  }, []);

  return <RateContext.Provider value={{ currentRates, chartDataDaily, isLoading }}>{children}</RateContext.Provider>;
}

export function useRates() { return useContext(RateContext); }