import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { ChartDataPoint, RateSnapshot } from "@/lib/rates-types";

type HistoricalRateRow = {
  id: number | null;
  created_at: string | null;
  date: string | null;
  buy_aud: number | null;
  sell_aud: number | null;
};

const HISTORY_WINDOW_DAYS = 365 * 5;
const MAX_HISTORY_ROWS = 4000;

const emptySnapshot: RateSnapshot = {
  currentRates: {
    sellAUD: null,
    buyAUD: null,
    lastUpdated: null,
  },
  chartDataDaily: [],
};

function toSafePositiveNumber(value: number | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRows(rows: HistoricalRateRow[]): ChartDataPoint[] {
  return rows
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
      } satisfies ChartDataPoint;
    })
    .filter((item): item is ChartDataPoint => item !== null)
    .filter((item) => {
      const dateMs = new Date(`${item.date}T12:00:00`).getTime();
      return Number.isFinite(dateMs);
    });
}

async function fetchRatesSnapshot(): Promise<RateSnapshot> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return emptySnapshot;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const fromDate = new Date();
    fromDate.setUTCDate(fromDate.getUTCDate() - HISTORY_WINDOW_DAYS);
    const fromDateISO = fromDate.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("rates_history")
      .select("id, created_at, date, buy_aud, sell_aud")
      .gte("date", fromDateISO)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(MAX_HISTORY_ROWS);

    if (error) {
      return emptySnapshot;
    }

    const normalizedData = normalizeRows((data ?? []) as HistoricalRateRow[]).sort((a, b) => {
      const dateA = new Date(`${a.date}T12:00:00`).getTime();
      const dateB = new Date(`${b.date}T12:00:00`).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.id - b.id;
    });
    if (normalizedData.length === 0) {
      return emptySnapshot;
    }

    const latest = normalizedData[normalizedData.length - 1];
    return {
      currentRates: {
        sellAUD: latest.sell_aud,
        buyAUD: latest.buy_aud,
        lastUpdated: latest.date,
      },
      chartDataDaily: normalizedData,
    };
  } catch {
    return emptySnapshot;
  }
}

export const getRatesSnapshot = unstable_cache(fetchRatesSnapshot, ["rates-snapshot-v1"], {
  revalidate: 300,
});
