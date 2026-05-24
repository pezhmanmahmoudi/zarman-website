"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TrendingUp, ShieldCheck, ArrowLeftRight, Calculator } from "lucide-react";
import styles from "./ExchangeHighlightSection.module.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const HIGHLIGHTS = [
  {
    id: "highlight-1",
    number: "01",
    Icon: TrendingUp,
    stat: "بهترین نرخ",
    label: "دلار استرالیا",
    body: "با بهره‌گیری از الگوریتم «نرخ وفاداری»، با افزایش حجم تراکنش‌های شما، کارمزدها به صورت هوشمند کاهش یافته و بهترین نرخ دلار استرالیا برای شما اعمال می‌شود.",
  },
  {
    id: "highlight-2",
    number: "02",
    Icon: ShieldCheck,
    stat: "مجوز رسمی",
    label: "صرافی قانونی استرالیا",
    body: "امنیت سرمایه شما مرز اولویت‌های ماست. زرمان به عنوان یک نهاد مالی رسمی و ثبت‌شده نزد سازمان AUSTRAC استرالیا، تمامی الزامات قانونی را ایفا می‌کند.",
  },
  {
    id: "highlight-3",
    number: "03",
    Icon: ArrowLeftRight,
    stat: "حواله مطمئن",
    label: "دلار استرالیا به ایران",
    body: "به کمک زیرساخت تسویه آفست (Offset Settlement)، محدودیت‌های انتقال بانکی را پشت سر بگذارید. زرمان مسیری سریع و با ضمانت کامل قانونی هموار کرده است.",
  },
  {
    id: "highlight-4",
    number: "04",
    Icon: Calculator,
    stat: "قیمت لحظه‌ای",
    label: "دلار استرالیا به تومان",
    body: "نوسانات بازار را به صورت زنده رصد کنید. پلتفرم ما در روزهای مختلف، نرخ‌های ویژه‌ای را آزاد می‌کند که فرصت شکار بهترین قیمت را فراهم خواهد کرد.",
  },
];

export default function ExchangeHighlightSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const el = sectionRef.current;
      if (!el) return;

      const tl = gsap.timeline({
        defaults: { ease: "power3.out", duration: 0.8 },
        scrollTrigger: {
          trigger: el,
          start: "top 75%",
        },
      });

      tl.fromTo(
        `.${styles.header} > *`,
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, stagger: 0.15 }
      ).fromTo(
        `.${styles.card}`,
        { autoAlpha: 0, y: 0 },
        { autoAlpha: 1, y: 0, stagger: 0.15, duration: 1 },
        "-=0.4"
      );
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="exchange-highlight"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="highlight-title"
      dir="rtl"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>چرا زرمان؟</p>
          <h2 id="highlight-title" className={styles.title}>
            بهترین نرخ دلار استرالیا
            <br />
            <span className={styles.titleAccent}>برای جامعه ایرانی در استرالیا</span>
          </h2>
          <p className={styles.subtitle}>
            خرید و فروش دلار استرالیا با بهترین نرخ، به صورت قانونی و کاملاً شفاف در بستری مدرن.
          </p>
        </div>

        <div className={styles.grid}>
          {HIGHLIGHTS.map((item) => {
            const Icon = item.Icon;
            return (
              <article key={item.id} className={styles.card}>
                <div className={styles.iconWrapper}>
                  <Icon size={28} strokeWidth={1.5} className={styles.icon} />
                </div>

                <div className={styles.cardContent}>
                  <div className={styles.statGroup}>
                    <h3 className={styles.cardTitle}>{item.stat}</h3>
                    <span className={styles.statLabel}>{item.label}</span>
                  </div>
                  <p className={styles.cardText}>{item.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}