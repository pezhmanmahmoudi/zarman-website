"use client";

import { useId, useMemo } from "react";
import styles from "./PriceChart.module.css";

type Point = {
  label: string;
  price: number;
};

// تبدیل اعداد به فرمت پولی ایران (همراه با کاما)
function formatToman(value: number) {
  return `${value.toLocaleString("fa-IR")}`;
}

export default function PriceChart() {
  const titleId = useId();
  const descId = useId();

  const data: Point[] = useMemo(
    () => [
      { label: "شنبه", price: 70500 },
      { label: "یکشنبه", price: 71200 },
      { label: "دوشنبه", price: 70850 },
      { label: "سه‌شنبه", price: 71800 },
      { label: "چهارشنبه", price: 72150 },
      { label: "پنج‌شنبه", price: 71650 },
      { label: "جمعه", price: 71250 },
    ],
    []
  );

  const computed = useMemo(() => {
    const prices = data.map((item) => item.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const points = data
      .map((item, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((item.price - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(" ");

    const areaPath = `M 0,100 L ${points.replaceAll(" ", " L ")} L 100,100 Z`;
    const last = data[data.length - 1]?.price ?? 0;

    return { min, max, last, points, areaPath };
  }, [data]);

  return (
    <section className={styles.chartCard} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>روند نرخ</p>
          <h3 id={titleId} className={styles.title}>
            دلار استرالیا به تومان
          </h3>
        </div>

        <div className={styles.lastPriceBox}>
          <span className={styles.lastPriceValue}>{formatToman(computed.last)}</span>
          <span className={styles.currency}>تومان</span>
        </div>
      </header>

      <p id={descId} className={styles.description}>
        نمایی از تغییرات هفتگی نرخ AUD به تومان برای درک بهتر روند اخیر.
      </p>

      <div className={styles.chartWrap}>
        <svg
          className={styles.chart}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title>روند هفتگی نرخ دلار استرالیا به تومان</title>
          <desc>
            کمترین نرخ {formatToman(computed.min)} و بیشترین نرخ{" "}
            {formatToman(computed.max)} بوده است.
          </desc>

          {/* اختصاص رنگ‌ها از طریق CSS */}
          <path d={computed.areaPath} className={styles.area} />
          <polyline
            points={computed.points}
            fill="none"
            vectorEffect="non-scaling-stroke"
            className={styles.line}
          />
        </svg>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>کمترین</span>
          <strong className={styles.statValue}>
            {formatToman(computed.min)} <span className={styles.currencySmall}>تومان</span>
          </strong>
        </div>

        <div className={styles.stat}>
          <span className={styles.statLabel}>بیشترین</span>
          <strong className={styles.statValue}>
            {formatToman(computed.max)} <span className={styles.currencySmall}>تومان</span>
          </strong>
        </div>

        <div className={styles.stat}>
          <span className={styles.statLabel}>آخرین نرخ</span>
          <strong className={styles.statValue}>
            {formatToman(computed.last)} <span className={styles.currencySmall}>تومان</span>
          </strong>
        </div>
      </div>

      <div className={styles.labels}>
        {data.map((item) => (
          <span key={item.label} className={styles.label}>
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}