"use client";

import React, { useRef } from "react";
import { useParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TrendingUp, ShieldCheck, ArrowLeftRight, Calculator } from "lucide-react";
import styles from "./ExchangeHighlightSection.module.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const HIGHLIGHTS_FA = [
  {
    id: "highlight-1",
    number: "01",
    Icon: TrendingUp,
    stat: "نرخ شخصی‌سازی‌شده",
    label: "دلار استرالیا",
    body: "نرخ اختصاصی شما بر اساس سابقه و حجم تراکنش‌ها و تنظیمات جاری برنامه وفاداری محاسبه می‌شود. نرخ و کارمزد درخواست خود را پیش از تأیید در پنل بررسی کنید.",
  },
  {
    id: "highlight-2",
    number: "02",
    Icon: ShieldCheck,
    stat: "اطلاعات ثبتی",
    label: "Zarman Exchange Pty Ltd",
    body: "زرمان تحت نام حقوقی ZARMAN EXCHANGE PTY LTD با شماره ABN 70 692 742 957 فعالیت می‌کند. اطلاعات شرکت و وضعیت ثبت ارائه‌دهنده حواله را در سامانه‌های رسمی بررسی کنید.",
  },
  {
    id: "highlight-3",
    number: "03",
    Icon: ArrowLeftRight,
    stat: "پیگیری حواله",
    label: "دلار استرالیا به ایران",
    body: "درخواست حواله، اطلاعات گیرنده و مراحل احراز هویت را در پنل مدیریت کنید. پس از بررسی درخواست و تأیید دریافت وجه، وضعیت انتقال و تسویه از همان‌جا قابل پیگیری است.",
  },
  {
    id: "highlight-4",
    number: "04",
    Icon: Calculator,
    stat: "آخرین نرخ منتشرشده",
    label: "دلار استرالیا به تومان",
    body: "نرخ خرید و فروش دلار استرالیا و تاریخ به‌روزرسانی را روی سایت ببینید. ماشین‌حساب، مبلغ تبدیل را با نرخ نمایش‌داده‌شده برآورد می‌کند؛ نرخ نهایی هنگام درخواست ممکن است متفاوت باشد.",
  },
];

const HIGHLIGHTS_EN = [
  {
    id: "highlight-1",
    number: "01",
    Icon: TrendingUp,
    stat: "Personalised Rate",
    label: "Australian Dollar",
    body: "Your personalised rate reflects your transaction history and volume and the current loyalty program settings. Review the rate and fees for your request in your dashboard before confirming.",
  },
  {
    id: "highlight-2",
    number: "02",
    Icon: ShieldCheck,
    stat: "Business Details",
    label: "Zarman Exchange Pty Ltd",
    body: "Zarman operates as ZARMAN EXCHANGE PTY LTD, ABN 70 692 742 957. Check company information and remittance provider registration using the official government registers.",
  },
  {
    id: "highlight-3",
    number: "03",
    Icon: ArrowLeftRight,
    stat: "Track Your Transfer",
    label: "Australia to Iran",
    body: "Manage your request, recipient details and identity verification in your dashboard. After review and confirmation of funds, you can follow transfer and settlement progress in the same place.",
  },
  {
    id: "highlight-4",
    number: "04",
    Icon: Calculator,
    stat: "Latest Published Rates",
    label: "AUD to Toman",
    body: "Check the buying and selling rates and their update date. The calculator estimates your conversion using the displayed rate; the final rate for your request may differ.",
  },
];

export default function ExchangeHighlightSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";
  const highlights = isEn ? HIGHLIGHTS_EN : HIGHLIGHTS_FA;

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>{isEn ? "Why Zarman?" : "چرا زرمان؟"}</p>
          <h2 id="highlight-title" className={styles.title}>
            {isEn ? "AUD Exchange and Remittance" : "تبدیل دلار استرالیا و حواله"}
            <br />
            <span className={styles.titleAccent}>
              {isEn ? "For the Iranian Community in Australia" : "برای جامعه ایرانی در استرالیا"}
            </span>
          </h2>
          <p className={styles.subtitle}>
            {isEn
              ? "Review your exchange rate, fees and transfer status in one place, with support in Persian and English."
              : "نرخ تبدیل، کارمزد و وضعیت حواله خود را در یک پنل و با پشتیبانی فارسی و انگلیسی بررسی کنید."}
          </p>
        </div>

        <div className={styles.grid}>
          {highlights.map((item) => {
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
