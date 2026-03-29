"use client";

import styles from "./RateSection.module.css";
// فرض می‌کنیم ConverterFa در مسیر زیر قرار دارد
import ConverterFa from "@/components/hero/ConverterFa"; 
import PriceChart from "./PriceChart"; // مسیر را چک کنید که درست باشد

export default function RateSection() {
  return (
    <section
      id="rates"
      className={styles.section}
      aria-labelledby="rate-section-title"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>نرخ و محاسبه‌گر</p>

          <h2 id="rate-section-title" className={styles.title}>
            محاسبه سریع و مشاهده روند نرخ
          </h2>

          <p className={styles.subtitle}>
            پیش از ثبت درخواست، مبلغ ارسالی، جزئیات محاسبه و روند تغییرات نرخ
            دلار استرالیا به تومان را در یک نمای روشن و قابل‌فهم مشاهده کنید.
          </p>
        </div>

        <div className={styles.grid}>
          {/* ستون راست: ماشین حساب */}
          <div className={styles.converterCol}>
            <div className={styles.converterFrame}>
              <ConverterFa />
            </div>
          </div>

          {/* ستون چپ: نمودار و پیام */}
          <div className={styles.chartCol}>
            <PriceChart />

            <div className={styles.noteCard}>
              <h3 className={styles.noteTitle}>چرا این بخش مهم است؟</h3>
              <p className={styles.noteText}>
                مشاهده هم‌زمان مبلغ، نرخ و روند تغییرات، به کاربر کمک می‌کند
                تصمیم روشن‌تری بگیرد و با ابهام کمتری وارد فرآیند ثبت درخواست شود.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}