"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Button from "@/components/common/Button";
import styles from "./Hero.module.css";

export default function Hero() {
  const heroRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      // انیمیشن محتوای متنی (سمت راست)
      tl.fromTo(`.${styles.eyebrow}`, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.65 })
        .fromTo(`.${styles.title}`, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.9 }, "-=0.35")
        .fromTo(`.${styles.subtitle}`, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.75 }, "-=0.5")
        .fromTo(`.${styles.actions}`, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7 }, "-=0.45")
        .fromTo(`.${styles.meta}`, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.45")
        
        // انیمیشن بورد قیمت (سمت چپ)
        .fromTo(
          `.${styles.rateBoard}`,
          { autoAlpha: 0, x: -32, scale: 0.96 },
          { autoAlpha: 1, x: 0, scale: 1, duration: 1.2 },
          "-=0.75"
        );
    },
    { scope: heroRef }
  );

  return (
    <section id="hero" ref={heroRef} className={styles.hero} aria-label="معرفی زرمان">
      {/* Background Environment */}
      <div className={styles.bgBase} aria-hidden="true" />
      <div className={styles.bgGlow} aria-hidden="true" />

      <div className={styles.container}>
        <div className={styles.layout}>
          
          {/* 1. CONTENT (Text - Right Side) */}
          <div className={styles.content}>
            <p className={styles.eyebrow}>صرافی زرمان</p>
            <h1 className={styles.title}>
              انتقال پول بین ایران و استرالیا
              <br />
              <span className={styles.titleAccent}>شفاف و سریع</span>
            </h1>
            <p className={styles.subtitle}>
              ما تلاش میکنیم با تمرکز بر سرعت، شفافیت و پشتیبانی همیشگی، تجربه ثبت و پیگیری درخواست‌های مالی را برای شما آسان تر کنیم.
            </p>
            <div className={styles.actions}>
              <Button href="/fa/register" variant="primary" className={styles.btn}>
                شروع ثبت‌نام
              </Button>
              <Button href="/fa#contact" variant="secondary" className={styles.btn}>
                تماس با ما
              </Button>
            </div>
            <div className={styles.meta}>
              <span>مطمئن و با امنیت بالا</span>
              <span className={styles.dot} />
              <span>بدون پیچیدگی اضافی</span>
            </div>
          </div>

          {/* 2. VISUAL (Live Rate Board - Left Side) */}
          <div className={styles.visual}>
            <div className={styles.rateBoard} aria-label="نرخ لحظه‌ای ارز">
              
              <div className={styles.boardHeader}>
                <span className={styles.pulseDot}></span>
                <span className={styles.status}>نرخ لحظه‌ای امروز</span>
              </div>

              <div className={styles.ratesGrid}>
                {/* ستون فروش */}
                <div className={styles.rateCol}>
                  <span className={styles.label}>فروش دلار استرالیا</span>
                  <strong className={styles.value}>
                    {(71250).toLocaleString("fa-IR")} <span className={styles.currency}>تومان</span>
                  </strong>
                </div>

                {/* خط جداکننده */}
                <div className={styles.rateDivider}></div>

                {/* ستون خرید */}
                <div className={styles.rateCol}>
                  <span className={styles.label}>خرید دلار استرالیا</span>
                  <strong className={styles.value}>
                    {(70800).toLocaleString("fa-IR")} <span className={styles.currency}>تومان</span>
                  </strong>
                </div>
              </div>
              
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}