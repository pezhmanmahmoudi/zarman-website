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

export type RateSnapshot = {
  currentRates: CurrentRates;
  chartDataDaily: ChartDataPoint[];
};
