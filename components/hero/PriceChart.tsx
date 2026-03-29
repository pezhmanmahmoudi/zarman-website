"use client";

import { useMemo, useId } from "react";
import styles from "./PriceChart.module.css";

type Point = { day: string; price: number };

function formatToman(n: number) {
  return `${n.toLocaleString("fa-IR")} تومان`;
}

export default function USDPriceChart() {
  const titleId = useId();
  const descId = useId();

  const data: Point[] = useMemo(
    () => [
      { day: "Sat", price: 82500 },
      { day: "Sun", price: 83200 },
      { day: "Mon", price: 82800 },
      { day: "Tue", price: 84500 },
      { day: "Wed", price: 85200 },
      { day: "Thu", price: 84800 },
      { day: "Fri", price: 86000 },
    ],
    []
  );

  const computed = useMemo(() => {
    const prices = data.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Guard for flat data (max === min) to avoid division by zero
    const range = max - min || 1;

    const points = data
      .map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d.price - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(" ");

    // Area path (optional): move to first point, line through all points, close to bottom
    const firstX = 0;
    const lastX = 100;

    const areaPath = `M ${firstX},100 L ${points.replaceAll(" ", " L ")} L ${lastX},100 Z`;

    const last = data[data.length - 1]?.price ?? 0;

    return { min, max, last, points, areaPath };
  }, [data]);

  const labelText = "قیمت روز دلار";
  const lastPriceText = formatToman(computed.last);

  return (
    <section className={styles.chartCard} aria-labelledby={titleId}>
      {/* SEO-friendly visible header */}
      <header className={styles.header}>
        <h3 id={titleId} className={styles.label}>
          {labelText}
        </h3>
        <div className={styles.price}>{lastPriceText}</div>
      </header>

      {/* Extra indexable summary for SEO (optional but useful) */}
      <p className={styles.srOnly} id={descId}>
        {labelText}: کمترین {formatToman(computed.min)}، بیشترین {formatToman(computed.max)}،
        آخرین {lastPriceText}.
      </p>

      <div className={styles.chartWrap}>
        <svg
          className={styles.chart}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          focusable="false"
        >
          <title>{labelText}</title>
          <desc>
            نمودار هفتگی قیمت دلار. کمترین {formatToman(computed.min)} و بیشترین {formatToman(computed.max)}.
          </desc>

          {/* Optional area fill */}
          <path d={computed.areaPath} className={styles.area} />

          <polyline
            points={computed.points}
            fill="none"
            vectorEffect="non-scaling-stroke"
            className={styles.line}
          />
        </svg>
      </div>

      {/* Optional: structured data (simple) */}
      <script
        type="application/ld+json"
        // Keep JSON-LD stable and minimal
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: "USD price chart (weekly)",
            description: "Weekly USD price in Toman shown as a lightweight SVG line chart.",
            variableMeasured: "price",
            measurementTechnique: "visualization",
            creator: "Zarman Exchange",
          }),
        }}
      />
    </section>
  );
}
