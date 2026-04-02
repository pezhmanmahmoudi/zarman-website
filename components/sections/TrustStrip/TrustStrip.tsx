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
    title: "نرخ رقابتی و شفاف",
    text: "نرخ‌های رقابتی و لحظه‌ای به صورت آنلاین و کاملاً شفاف در دسترس شما هستند؛ بدون هیچ کارمزد پنهان.",
    icon: TrendingUp,
  },
  {
    id: "fast-settlement",
    title: "پرداخت و تسویه سریع",
    text: "ما تضمین می‌کنیم که جابه‌جایی و تسویه وجه شما در استرالیا و ایران در سریع‌ترین زمان ممکن انجام شود.",
    icon: Zap,
  },
  {
    id: "support-24-7",
    title: "پشتیبانی ۲۴ ساعته",
    text: "تیم پشتیبانی زرمان در تمام روزهای هفته، حتی روزهای تعطیل، با افتخار آماده پاسخگویی و رفع نیازهای شماست.",
    icon: Headset,
  },
  {
    id: "max-security",
    title: "نهایت امنیت و اعتماد",
    text: "حفظ حریم خصوصی و امنیت سرمایه شما خط قرمز ماست. ما از به‌روزترین استانداردهای امنیتی بهره می‌بریم.",
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
        { autoAlpha: 0, y: 30 },
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
          <p className={styles.eyebrow}>تفاوت زرمان اکسچنج</p>
          <h2 id="trust-strip-title" className={styles.title}>
            انتقال پول ساده، در کمترین زمان و حداکثر امنیت
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