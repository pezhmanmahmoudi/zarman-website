"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import styles from "./RateSection.module.css";
import ConverterFa from "./ConverterFa"; 
import PriceChart from "./PriceChart"; 
import { registerGsapPlugins } from "@/lib/gsap";

// ثبت پلاگین اسکرول
registerGsapPlugins();

export default function RateSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  // انیمیشن نرم برای ظاهر شدن (Reveal) المان‌ها هنگام اسکرول
  useGSAP(
    () => {
      const el = sectionRef.current;
      if (!el) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top 75%", // وقتی بالای سکشن به 75% صفحه رسید شروع می‌شود
        },
        defaults: { ease: "power3.out", duration: 0.8 },
      });

      // انیمیشن متون هدر
      tl.fromTo(`.${styles.eyebrow}`, { autoAlpha: 0, y: 15 }, { autoAlpha: 1, y: 0 })
        .fromTo(`.${styles.title}`, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0 }, "-=0.6")
        .fromTo(`.${styles.subtitle}`, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0 }, "-=0.6")
        
        // انیمیشن کارت‌ها (مبدل و نمودار)
        .fromTo(
          `.${styles.grid} > div`,
          { autoAlpha: 0, y: 40 },
          { autoAlpha: 1, y: 0, stagger: 0.15, duration: 1 },
          "-=0.4"
        );
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="rates"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="rate-section-title"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>نرخ لحظه‌ای و محاسبه‌گر</p>

          <h2 id="rate-section-title" className={styles.title}>
            محاسبه سریع، شفافیت در روند
          </h2>

          <p className={styles.subtitle}>
            مبلغ ارسالی و دریافتی خود را با نرخ‌های واقعی و بدون هزینه‌های پنهان محاسبه کنید. 
            نمودار زیر تغییرات نرخ ارز را برای تصمیم‌گیری بهتر شما نمایش می‌دهد.
          </p>
        </div>

        <div className={styles.grid}>
          {/* ستون راست: ماشین حساب تاریک */}
          <div className={styles.converterCol}>
            <ConverterFa />
          </div>

          {/* ستون چپ: نمودار تعاملی تاریک */}
          <div className={styles.chartCol}>
            <PriceChart />
          </div>
        </div>
      </div>
    </section>
  );
}