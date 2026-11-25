import Image from "next/image";
import { Clock } from "lucide-react";
import { formatLocalizedNumber } from "@/lib/numbers";
import type { ChartDataPoint } from "@/lib/rates-types";
import styles from "./RateBoard.module.css";

type Props = {
  locale: string;
  buyAUD: number | null;
  sellAUD: number | null;
  lastUpdated: string | null;
  updatedText: string | null;
  history: ChartDataPoint[];
};

const SPARK_DAYS = 30;
const W = 240;
const H = 46;
const PAD = 4;

function sparkline(values: number[]) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = max === min ? H / 2 : PAD + (1 - (v - min) / span) * (H - PAD * 2);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  return { line, area: `${line} L${W} ${H} L0 ${H} Z`, end: pts[pts.length - 1], min, max };
}

function change(values: number[]) {
  if (values.length < 2) return null;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (!prev) return null;
  return { delta: last - prev, pct: ((last - prev) / prev) * 100 };
}

function RateRow({
  id, label, hint, value, values, locale,
}: { id: string; label: string; hint: string; value: number | null; values: number[]; locale: string }) {
  const isEn = locale === "en";
  const num = (v: number, d = 0) => formatLocalizedNumber(v, locale, { maximumFractionDigits: d });
  const spark = sparkline(values);
  const diff = change(values);
  const dir = !diff || diff.delta === 0 ? "flat" : diff.delta > 0 ? "up" : "down";

  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.label}>{label}</span>
        {diff && (
          <span className={styles.change} data-dir={dir} title={isEn ? "Change since the previous published rate" : "تغییر نسبت به نرخ قبلی"}>
            <span aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : "●"}</span>
            {dir === "flat"
              ? (isEn ? "No change" : "بدون تغییر")
              : `${num(Math.abs(diff.delta))} (${num(Math.abs(diff.pct), 2)}${isEn ? "%" : "٪"})`}
          </span>
        )}
      </div>
      <span className={styles.hint}>{hint}</span>
      <strong className={styles.value}>
        {value ? num(value) : (isEn ? "Contact us" : "تماس بگیرید")}
        {value ? <span className={styles.currency}>{isEn ? "toman" : "تومان"}</span> : null}
      </strong>
      {spark && (
        <div className={styles.sparkWrap}>
          <div className={styles.sparkBox} dir="ltr">
          <svg className={styles.spark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
            aria-label={isEn ? `Last ${SPARK_DAYS} published rates` : `${num(SPARK_DAYS)} نرخ اخیر`}>
            <defs>
              <linearGradient id={`${id}-stroke`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="45%" stopColor="#4f46e5" />
                <stop offset="80%" stopColor="#c026d3" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
              <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={spark.area} fill={`url(#${id}-fill)`} />
            <path d={spark.line} fill="none" stroke={`url(#${id}-stroke)`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className={styles.endDot} style={{ top: `calc(${((spark.end[1] / H) * 100).toFixed(2)}% - 4px)` }} aria-hidden="true" />
          </div>
          <span className={styles.range}>
            {isEn ? "30-day low " : "کمترین ۳۰ روز "}
            <b>{num(spark.min)}</b>
            <span className={styles.rangeSep} aria-hidden="true">·</span>
            {isEn ? "high " : "بیشترین "}
            <b>{num(spark.max)}</b>
          </span>
        </div>
      )}
    </div>
  );
}

export default function RateBoard({ locale, buyAUD, sellAUD, lastUpdated, updatedText, history }: Props) {
  const isEn = locale === "en";
  const recent = history.slice(-SPARK_DAYS);

  return (
    <div className={styles.board}>
      <div className={styles.pill}>
        <span className={styles.pulse} aria-hidden="true" />
        <span>{isEn ? "Latest AUD rates" : "آخرین نرخ دلار استرالیا"}</span>
      </div>

      <div className={styles.card}>
        <div className={styles.logoPanel} aria-hidden="true">
          <span className={styles.sheen} />
          <Image src="/images/logo-no-text-light.svg" alt="" width={96} height={96} className={styles.logo} />
          <span className={styles.pair}>AUD · IRT</span>
        </div>

        <div className={styles.rates}>
          <RateRow
            id="sell"
            locale={locale}
            label={isEn ? "Sell AUD" : "فروش دلار استرالیا"}
            hint={isEn ? "For transfers Iran → Australia" : "برای حواله ایران ← استرالیا"}
            value={sellAUD}
            values={recent.map((p) => p.sell_aud)}
          />
          <div className={styles.divider} />
          <RateRow
            id="buy"
            locale={locale}
            label={isEn ? "Buy AUD" : "خرید دلار استرالیا"}
            hint={isEn ? "For transfers Australia → Iran" : "برای حواله استرالیا ← ایران"}
            value={buyAUD}
            values={recent.map((p) => p.buy_aud)}
          />
        </div>
      </div>

      {updatedText && (
        <div className={styles.footer}>
          <Clock size={14} className={styles.clock} aria-hidden="true" />
          <span>{isEn ? "Last updated:" : "آخرین به‌روزرسانی:"}</span>
          <time dateTime={lastUpdated ?? undefined}>{updatedText}</time>
        </div>
      )}
    </div>
  );
}
