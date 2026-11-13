"use client";

import dynamic from "next/dynamic";
import { fmtAUD } from "@/lib/accounting-engine";
import type { ProfitTrendPoint } from "@/lib/profit-statement";
import s from "@/styles/admin/ProfitStatement.module.css";

const ProfitTrendChart = dynamic(() => import("./ProfitTrendChart"), {
  ssr: false,
  loading: () => <div className={s.chartLoading} role="status">در حال بارگذاری نمودار…</div>,
});

const WINDOW = 3;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Recent pace: the last three complete months against the three before them. */
export function profitPace(points: ProfitTrendPoint[]) {
  const complete = points.filter(point => !point.partial);
  const recent = average(complete.slice(-WINDOW).map(point => point.netAUD));
  const before = complete.length > WINDOW ? average(complete.slice(-2 * WINDOW, -WINDOW).map(point => point.netAUD)) : null;
  const change = recent !== null && before !== null && before > 0 ? (recent - before) / before : null;
  const best = complete.reduce<ProfitTrendPoint | null>((top, point) => !top || point.netAUD > top.netAUD ? point : top, null);
  return { recent, before, change, best, recentMonths: Math.min(WINDOW, complete.length) };
}

function Amount({ value }: { value: number }) {
  return <span className={value < 0 ? s.negative : undefined}>{fmtAUD(value)}</span>;
}

export default function ProfitTrendSection({ points, selected }: { points?: ProfitTrendPoint[]; selected: string }) {
  if (!points || points.length < 2) return null;
  const pace = profitPace(points);
  const last = points.at(-1)!;
  const changeText = pace.change === null ? null
    : `${pace.change >= 0 ? "+" : "−"}${Math.abs(pace.change * 100).toLocaleString("en-AU", { maximumFractionDigits: 0 })}%`;

  return (
    <section className={s.card} aria-labelledby="profit-trend-title">
      <div className={s.trendHeader}>
        <h3 id="profit-trend-title">روند رشد سود</h3>
        <small>همه ماه‌ها به دلار؛ ستون هر ماه همان سود خالص صورت سود آن ماه است.</small>
      </div>

      <dl className={s.paceGrid}>
        <div className={s.pace}>
          <dt>میانگین سود ماهانه · {pace.recentMonths} ماه کامل اخیر</dt>
          <dd>{pace.recent === null ? "—" : <><Amount value={pace.recent} /> <span className={s.unit}>AUD</span></>}</dd>
          {pace.before !== null && (
            <small>
              {changeText ? <span className={pace.change! >= 0 ? s.paceUp : s.paceDown}>{changeText}</span> : null}
              {" "}نسبت به {WINDOW} ماه قبل از آن (<bdi dir="ltr">{fmtAUD(pace.before)}</bdi> AUD)
            </small>
          )}
        </div>
        <div className={s.pace}>
          <dt>بهترین ماه</dt>
          <dd>{pace.best ? <><Amount value={pace.best.netAUD} /> <span className={s.unit}>AUD</span></> : "—"}</dd>
          {pace.best && <small>{pace.best.label}</small>}
        </div>
        <div className={s.pace}>
          <dt>سود انباشته تا امروز</dt>
          <dd><Amount value={last.cumulativeAUD} /> <span className={s.unit}>AUD</span></dd>
          <small>در {points.length} ماه فعالیت؛ خالص دارایی <bdi dir="ltr">{fmtAUD(last.netAssetsAUD)}</bdi> AUD</small>
        </div>
      </dl>

      <ProfitTrendChart points={points} selected={selected} />

      <details className={s.trendTable}>
        <summary>نمایش جدول ماهانه</summary>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th scope="col">ماه</th><th scope="col">سود خالص ماه (AUD)</th><th scope="col">سود انباشته (AUD)</th></tr></thead>
            <tbody>
              {[...points].reverse().map(point => (
                <tr key={point.month}>
                  <th scope="row">{point.label}{point.partial && <small>تا امروز؛ با نرخ امروز</small>}</th>
                  <td><Amount value={point.netAUD} /></td>
                  <td><Amount value={point.cumulativeAUD} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
