"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ShieldCheck, Zap, Headset, TrendingUp } from "lucide-react";
import styles from "./TrustStrip.module.css";

// ثبت پلاگین اسکرول برای متحرک‌سازی هنگام اسکرول
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function TrustStrip() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";

  const trustItems = [
    {
      id: "competitive-rates",
      title: isEn ? "Personalised Rate" : "نرخ شخصی سازی شده",
      text: isEn
        ? "Review the rate offered for your account, transfer amount and direction before confirming a transaction."
        : "پیش از تأیید تراکنش، نرخ پیشنهادی متناسب با حساب کاربری، مبلغ و جهت حواله را بررسی کنید.",
      icon: TrendingUp,
    },
    {
      id: "fast-settlement",
      title: isEn ? "Transfer Tracking" : "پیگیری انتقال و تسویه",
      text: isEn
        ? "Follow your request through the account dashboard. Settlement timing depends on verification, receipt of funds and banking availability."
        : "وضعیت درخواست را در داشبورد حساب کاربری پیگیری کنید. زمان تسویه به احراز هویت، دریافت وجه و شرایط بانکی بستگی دارد.",
      icon: Zap,
    },
    {
      id: "transfer-support",
      title: isEn ? "Support for Your Transfer" : "پشتیبانی در مراحل حواله",
      text: isEn
        ? "Contact our team through WhatsApp for help with registration, documents and transfer updates."
        : "برای راهنمایی ثبت‌نام، مدارک و پیگیری حواله از طریق واتس‌اپ با تیم زرمان در ارتباط باشید.",
      icon: Headset,
    },
    {
      id: "max-security",
      title: isEn ? "Identity and Privacy" : "احراز هویت و حریم خصوصی",
      text: isEn
        ? "Identity checks form part of the transfer process. Our privacy policy explains how personal information is collected and used."
        : "بررسی هویت بخشی از فرایند حواله است. نحوه جمع‌آوری و استفاده از اطلاعات شخصی در سیاست حریم خصوصی توضیح داده شده است.",
      icon: ShieldCheck,
    },
  ];

  // انیمیشن نرم برای ظاهر شدن پلکانی (Staggered Reveal)
  useGSAP(
    () => {
      const el = sectionRef.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const tl = gsap.timeline({
        defaults: { ease: "power3.out", duration: 0.8 },
        scrollTrigger: {
          trigger: el,
          start: "top 80%", // شروع انیمیشن وقتی سکشن به 80% صفحه رسید
        },
      });

      // انیمیشن اول برای هدر سکشن
      tl.fromTo(
        `.${styles.header} > *`, 
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, stagger: 0.2 }
      )
      // انیمیشن دوم برای تک‌تک کارت‌ها با وقفه کوچک و استگر
      .fromTo(
        `.${styles.grid} > .${styles.card}`,
        { autoAlpha: 0, y: 0 },
        { autoAlpha: 1, y: 0, stagger: 0.15, duration: 1 },
        "-=0.4"
      );
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="trust"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="trust-strip-title"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>{isEn ? "Why Zarman?" : "چرا زرمان!\u061f"}</p>
          <h2 id="trust-strip-title" className={styles.title}>
            {isEn
              ? "Clear rates, transfer tracking and support"
              : "نرخ مشخص، پیگیری حواله و پشتیبانی"}
          </h2>
        </div>

        <div className={styles.grid}>
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.id} className={styles.card}>
                {/* بخش آیکون‌ها: پریمیوم، متمرکز و منظم */}
                <div className={styles.iconWrapper} aria-hidden="true">
                  {/* آیکون بزرگتر شد و در مرکز قرار گرفت */}
                  <Icon size={28} strokeWidth={1.5} className={styles.icon} />
                </div>
                
                <div className={styles.content}>
                  {/* تایپوگرافی با وزن‌های کنترل شده */}
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  <p className={styles.cardText}>{item.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
