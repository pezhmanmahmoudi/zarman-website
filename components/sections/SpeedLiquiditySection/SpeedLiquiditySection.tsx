"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import styles from "./SpeedLiquiditySection.module.css";
// دکمه دقیقاً از مسیری که خواستید ایمپورت شد
import Button from "@/components/ui/Button/Button";
// ویژوال امواج به عنوان نماد جریان نقدینگی
import WaveVisuals from "./WaveVisuals";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function SpeedLiquiditySection() {
  return (
    <section className={styles.sectionContainer} aria-labelledby="speed-title">
      <div className={styles.backgroundEffect} aria-hidden="true" />

      <div className={styles.contentWrapper}>
        {/* LEFT: 3D Visual (Liquidity Waves) */}
        <motion.div
          className={styles.visualContainer}
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        >
          <WaveVisuals />
        </motion.div>

        {/* RIGHT: Text Content (RTL) */}
        <div className={styles.textContainer} dir="rtl">
          <motion.span
            className={styles.eyebrow}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.7 }}
          >
            کارایی عملیاتی
          </motion.span>

          <motion.h2
            id="speed-title"
            className={styles.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.7 }}
            transition={{ delay: 0.1 }}
          >
            سرعت در پردازش، <br />
            <span className={styles.accentTitle}>نقدینگی تضمین‌شده</span>
          </motion.h2>

          <motion.p
            className={styles.description}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.7 }}
            transition={{ delay: 0.2 }}
          >
            زیرساخت فنی و مالی زرمان برای نشست سریع وجه و مدیریت هوشمند جریان نقدی در کریدور ایران–استرالیا مهندسی شده است. ما با بهره‌گیری از عمق نقدینگی بازار، زمان تسویه را به حداقل می‌رسانیم تا سرمایه شما هرگز متوقف نشود.
          </motion.p>

          <motion.ul 
            className={styles.featuresList}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.7 }}
            transition={{ delay: 0.3 }}
          >
            <li>تثبیت فوری نرخ در لحظه ثبت</li>
            <li>سیستم تسویه شتاب‌یافته (Accelerated Settlement)</li>
            <li>پشتیبانی عمیق نقدینگی برای مبالغ کلان</li>
          </motion.ul>

          <motion.div 
            className={styles.actions}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.7 }}
            transition={{ delay: 0.4 }}
          >
            <Button href="/fa/register" variant="primary" size="lg">
              تجربه انتقال سریع
            </Button>
            <Button href="/fa#trust" variant="ghost" size="lg">
              مشاهده لایه‌های اعتماد
            </Button>
          </motion.div>
        </div>
      </div>
    </section>  
  );  
}