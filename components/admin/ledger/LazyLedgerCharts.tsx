"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type LedgerChartsComponent from "./LedgerCharts";
import styles from "@/styles/admin/AdminPageState.module.css";

function ChartPlaceholder() {
  return (
    <div className={styles.chartLoadingGrid} role="status" aria-label="Loading activity charts">
      <div className={styles.chartPlaceholder}><span className={styles.loadingLabel}>Loading activity charts…</span></div>
      <div className={styles.chartPlaceholder} aria-hidden="true"><span className={styles.skeletonValue} /></div>
    </div>
  );
}

const LedgerCharts = dynamic(() => import("./LedgerCharts"), {
  ssr: false,
  loading: ChartPlaceholder,
});

export default function LazyLedgerCharts(props: ComponentProps<typeof LedgerChartsComponent>) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const hasData = props.dailyData.length > 0;

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasData]);

  if (!hasData) return null;

  return <div ref={container}>{visible ? <LedgerCharts {...props} /> : <ChartPlaceholder />}</div>;
}
