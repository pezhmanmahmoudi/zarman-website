"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./PriceChart.module.css";
import { useRates } from "@/context/RateContext";
import type { ChartDataPoint } from "@/lib/rates-types";

type Timeframe = "1W" | "1M" | "3M" | "1Y" | "3Y" | "ALL";

type PreparedChartPoint = ChartDataPoint & {
  timestamp: number;
  value: number;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: PreparedChartPoint }>;
};

const TABS: Array<{ id: Timeframe; label: string }> = [
  { id: "1W", label: "۱ هفته" },
  { id: "1M", label: "۱ ماه" },
  { id: "3M", label: "۳ ماه" },
  { id: "1Y", label: "۱ سال" },
  { id: "3Y", label: "۳ سال" },
  { id: "ALL", label: "همه" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateToTimestamp(date: string) {
  return new Date(`${date}T12:00:00Z`).getTime();
}

function formatDateForTooltip(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateForXAxis(date: string, timeframe: Timeframe) {
  const d = new Date(`${date}T12:00:00Z`);
  if (timeframe === "1W" || timeframe === "1M") {
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  } else if (timeframe === "3M" || timeframe === "1Y") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  } else {
    return d.toLocaleDateString("en-US", { year: "numeric" });
  }
}

function formatPrice(num: number) {
  const enFormatted = Number(num).toLocaleString("en-US");
  const faDigits = "۰۱۲۳۴۵۶۷۸۹";
  
  return enFormatted
    .replace(/\d/g, (d) => faDigits[Number(d)])
    .replace(/,/g, "،");
}

function calculateNiceTicks(rawMin: number, rawMax: number, maxTicks = 6) {
  if (rawMin === rawMax) {
    return { 
      min: rawMin - 1000, 
      max: rawMax + 1000, 
      ticks: [rawMin - 1000, rawMin, rawMax + 1000] 
    };
  }
  
  const range = rawMax - rawMin;
  const roughStep = range / (maxTicks - 1);
  
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalizedStep = roughStep / magnitude;
  
  let step;
  if (normalizedStep < 1.5) step = 1;
  else if (normalizedStep < 3.5) step = 2;
  else if (normalizedStep < 7.5) step = 5;
  else step = 10;
  
  step *= magnitude;
  
  const niceMin = Math.floor(rawMin / step) * step;
  const niceMax = Math.ceil(rawMax / step) * step;
  
  const ticks = [];
  for (let i = niceMin; i <= niceMax; i += step) {
    ticks.push(i);
  }
  
  return { min: niceMin, max: niceMax, ticks };
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>نرخ فروش</span>
          <span className={styles.tooltipDate}>
            {formatDateForTooltip(data.date)}
          </span>
        </div>
        <div className={styles.tooltipValueRow}>
          <span className={styles.tooltipValue}>{formatPrice(data.value)}</span>
          <span className={styles.tooltipCurrency}>تومان</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function PriceChart() {
  // 👈 تنها تغییر: پیش‌فرض برای ظاهر زیبای چارت روی 1W تنظیم شد
  const [timeframe, setTimeframe] = useState<Timeframe>("1W");
  const { chartDataDaily, isLoading } = useRates();

  const chartData = useMemo<PreparedChartPoint[]>(() => {
    if (!chartDataDaily || chartDataDaily.length === 0) return [];

    const timeSeriesData = chartDataDaily
      .map((item) => ({
        ...item,
        timestamp: parseDateToTimestamp(item.date),
        value: item.sell_aud, 
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (timeframe === "ALL") return timeSeriesData;

    const lastDataDate = timeSeriesData[timeSeriesData.length - 1].timestamp;

    let filterMs = 0;
    switch (timeframe) {
      case "1W": filterMs = 7 * DAY_MS; break;
      case "1M": filterMs = 30 * DAY_MS; break;
      case "3M": filterMs = 90 * DAY_MS; break;
      case "1Y": filterMs = 365 * DAY_MS; break;
      case "3Y": filterMs = 3 * 365 * DAY_MS; break;
    }

    const cutoff = lastDataDate - filterMs;
    return timeSeriesData.filter((d) => d.timestamp >= cutoff);
  }, [chartDataDaily, timeframe]);

  const yAxisConfig = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 100, ticks: [0, 50, 100] };
    const vals = chartData.map((d) => d.value);
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    
    return calculateNiceTicks(rawMin, rawMax, 6); 
  }, [chartData]);

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <span>در حال دریافت اطلاعات...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <h3 className={styles.mainTitle}>روند قیمت دلار استرالیا</h3>
          <p className={styles.subTitle}>تاریخچه نوسانات بازار </p>
        </div>

        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${timeframe === tab.id ? styles.activeTab : ""}`}
              onClick={() => setTimeframe(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartContainer}>
        {chartData.length === 0 ? (
          <div className={styles.emptyState}>داده‌ای برای این بازه یافت نشد.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 0, left: 15, bottom: 5 }}
            >
              <defs>
                <linearGradient id="priceAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="#1d2d47"
              />

              <XAxis
                dataKey="date"
                tickFormatter={(val) => formatDateForXAxis(val, timeframe)}
                axisLine={{ stroke: "#2b3b5c", strokeWidth: 1 }}
                tickLine={false}
                tickMargin={14}
                minTickGap={40}
                padding={{ left: 10, right: 10 }}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 11,
                  fontFamily: "var(--font-primary)",
                }}
              />

              <YAxis
                domain={[yAxisConfig.min, yAxisConfig.max]}
                ticks={yAxisConfig.ticks}
                orientation="right"
                width={75}
                tickFormatter={(value) => formatPrice(Number(value))}
                axisLine={{ stroke: "#2b3b5c", strokeWidth: 1 }}
                tickLine={false}
                tickMargin={12}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 11,
                  fontFamily: "var(--font-primary)",
                }}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "rgba(255, 255, 255, 0.15)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#4f46e5"
                strokeWidth={2.5}
                fill="url(#priceAreaFill)"
                fillOpacity={1}
                activeDot={{
                  r: 6,
                  fill: "#4f46e5",
                  stroke: "#090e17",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
