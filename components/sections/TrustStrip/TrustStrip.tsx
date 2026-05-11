"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ShieldCheck, Zap, Headset, TrendingUp } from "lucide-react";
import styles from "./TrustStrip.module.css";

// ثبت پلاگین اسکرول برای متحرک‌سازی هنگام اسکرول
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const trustItems = [
  {
    id: "competitive-rates",
    title: "نرخ شخصی سازی شده",
    text: "در زرمان نرخ با شما رشد می کند. هر تراکنش، یک قدم به نرخ بهتر نزدیک تر.",
    icon: TrendingUp,
  },
  {
    id: "fast-settlement",
    title: "پرداخت و تسویه سریع",
    text: "درخواست بدهید مابقی با ماست، تسویه در کمترین زمان ممکن.",
    icon: Zap,
  },
  {
    id: "support-24-7",
    title: "همیشه در کنار شما",
    text: "تیم زرمان حتی در تعطیلات هم بیکار نیست. سوال دارید؟ ما اینجاییم، هر روز و هر ساعت.",
    icon: Headset,
  },
  {
    id: "max-security",
    title: "خیالتان راحت، امن‌ترین انتخاب",
    text: "حفظ حریم خصوصی و امنیت سرمایه شما خط قرمز ماست. با شماییم از ابتدا تا انتها.",
    icon: ShieldCheck,
  },
];

export default function TrustStrip() {
  const sectionRef = useRef<HTMLElement | null>(null);

  // انیمیشن نرم برای ظاهر شدن پلکانی (Staggered Reveal)
  useGSAP(
    () => {
      const el = sectionRef.current;
      if (!el) return;

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
          <p className={styles.eyebrow}>چرا زرمان!؟</p>
          <h2 id="trust-strip-title" className={styles.title}>
            انتقال پول در کمترین زمان، حداکثر امنیت و بهترین قیمت
          </h2>
        </div>

        <div className={styles.grid}>
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.id} className={styles.card}>
                {/* بخش آیکون‌ها: پریمیوم، متمرکز و منظم */}
                <div className={styles.iconWrapper}>
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