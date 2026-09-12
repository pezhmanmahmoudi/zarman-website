"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import styles from "./RateSection.module.css";
import ConverterFa from "./ConverterFa"; 
import PriceChart from "./PriceChart"; 

// ثبت پلاگین اسکرول
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function RateSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";

  // انیمیشن نرم برای ظاهر شدن (Reveal) المان‌ها هنگام اسکرول
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
          <p className={styles.eyebrow}>{isEn ? "Exchange Rates & Calculator" : "نرخ ارز و محاسبه‌گر حواله"}</p>

          <h2 id="rate-section-title" className={styles.title}>
            {isEn ? "Calculate Instantly, Stay Transparent" : "محاسبه سریع، شفافیت در روند"}
          </h2>

          <p className={styles.subtitle}>
            {isEn
              ? "Estimate your send and receive amounts using the latest published rates. The chart shows historical rate changes."
              : "مبلغ ارسالی و دریافتی خود را با آخرین نرخ منتشرشده برآورد کنید و تغییرات نرخ را در نمودار تاریخی ببینید."}
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
