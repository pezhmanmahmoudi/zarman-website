"use client";

import { useRouter } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ProfitTrendPoint } from "@/lib/profit-statement";
import { profitPeriodHref } from "@/lib/treasury-navigation";
import s from "@/styles/admin/ProfitStatement.module.css";

// Polarity (validated for colour-vision deficiency); sign is also carried by bar direction.
const GAIN = "#047857";
const LOSS = "#b91c1c";
const CUMULATIVE = "#4f46e5";
const GRID = "var(--border-soft, #e2e8f0)";
const INK_DIM = "var(--text-dim, #64748b)";

const aud = (value: number) => value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (value: number) => {
  const abs = Math.abs(value);
  const text = abs >= 1000 ? `${(abs / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 })}k` : Math.round(abs).toString();
  return `${value < 0 ? "−" : ""}$${text}`;
};
/** "نوامبر 2026" → "نوامبر 26" keeps ticks short while a 13-month history stays unambiguous. */
const tick = (label: string) => label.replace(/ (\d{2})(\d{2})$/, " $2");

type Row = ProfitTrendPoint & { tick: string };

function TrendTooltip({ active, payload, field }: {
  active?: boolean; payload?: { payload: Row }[]; field: "netAUD" | "cumulativeAUD";
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={s.chartTooltip} dir="rtl">
      <strong>{row.label}{row.partial ? " · تا امروز" : ""}</strong>
      <span>{field === "netAUD" ? "سود خالص ماه" : "سود انباشته"}: <bdi dir="ltr">{aud(row[field])} AUD</bdi></span>
      {field === "netAUD" && <span>سود انباشته: <bdi dir="ltr">{aud(row.cumulativeAUD)} AUD</bdi></span>}
    </div>
  );
}

const axisProps = {
  tick: { fontSize: 11, fill: INK_DIM },
  axisLine: false,
  tickLine: false,
} as const;

export default function ProfitTrendChart({ points, selected }: { points: ProfitTrendPoint[]; selected: string }) {
  const router = useRouter();
  const rows: Row[] = points.map(point => ({ ...point, tick: tick(point.label) }));
  const focus = selected !== "all" && rows.some(row => row.month === selected);

  return (
    <div className={s.trendCharts}>
      <figure className={s.chartPanel}>
        <figcaption>سود خالص هر ماه <small>AUD · برای دیدن صورت سود هر ماه روی ستون آن بزنید</small></figcaption>
        <div className={s.chartArea}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="tick" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
              <YAxis {...axisProps} tickFormatter={compact} width={52} />
              <ReferenceLine y={0} stroke={INK_DIM} strokeWidth={1} />
              <Tooltip cursor={{ fill: "rgba(99, 102, 241, .08)" }} content={<TrendTooltip field="netAUD" />} />
              <Bar dataKey="netAUD" radius={[4, 4, 4, 4]} maxBarSize={36} cursor="pointer"
                onClick={(data: { payload?: Row }) => data.payload && router.push(profitPeriodHref(data.payload.month))}>
                {rows.map(row => (
                  <Cell key={row.month} fill={row.netAUD < 0 ? LOSS : GAIN}
                    fillOpacity={(focus && row.month !== selected) || row.partial ? 0.45 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <figure className={s.chartPanel}>
        <figcaption>سود انباشته از ابتدا <small>AUD · هر نقطه با نرخ خرید پایان همان ماه</small></figcaption>
        <div className={s.chartArea}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="tick" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
              <YAxis {...axisProps} tickFormatter={compact} width={52} />
              <ReferenceLine y={0} stroke={INK_DIM} strokeWidth={1} />
              <Tooltip cursor={{ stroke: INK_DIM, strokeDasharray: "3 3" }} content={<TrendTooltip field="cumulativeAUD" />} />
              <Line type="monotone" dataKey="cumulativeAUD" stroke={CUMULATIVE} strokeWidth={2}
                dot={{ r: 4, fill: CUMULATIVE, stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: CUMULATIVE, stroke: "#fff", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}
