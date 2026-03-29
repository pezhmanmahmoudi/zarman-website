"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import styles from "./SecuritySection.module.css";
import CardsVisuals from "./CardsVisuals";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, ease: "easeOut" },
  },
};

export default function SecuritySection() {
  return (
    <section className={styles.sectionContainer} id="security">
      <div className={styles.backgroundGlow} aria-hidden="true" />
      <div className={styles.backgroundGlow2} aria-hidden="true" />

      <div className={styles.contentWrapper}>
        {/* LEFT: 3D */}
        <motion.div
          className={styles.visualContainer}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 1.2 }}
        >
          <CardsVisuals />
        </motion.div>

        {/* RIGHT: Text */}
        <div className={styles.textContainer} dir="rtl">
          <motion.span
            className={styles.subtitle}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
          >
            امنیت و شفافیت
          </motion.span>

          <motion.h2
            className={styles.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.08 }}
          >
            تراکنش‌هایی به شفافیت <br />
            <span className={styles.gradientTitle}>شیشه، با امنیت بانک</span>
          </motion.h2>

          <motion.div
            className={styles.description}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.16 }}
          >
            <p>
              در زرمان، ما امنیت دارایی شما را با هیچ چیز معامله نمی‌کنیم. ما از
              زیرساخت‌های رمزنگاری‌شده چندلایه و پروتکل‌های امنیتی در سطح بانکداری
              جهانی استفاده می‌کنیم تا هر تراکنش، مانند یک بلوک شیشه‌ای، شفاف اما
              غیرقابل نفوذ باشد.
            </p>
          </motion.div>

          <div className={styles.badges}>
            <div className={styles.badge}>
              <div className={`${styles.badgeIcon} ${styles.badgeIconBlue}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className={styles.badgeLabel}>رمزنگاری ۲۵۶ بیتی</span>
            </div>

            <div className={styles.badge}>
              <div className={`${styles.badgeIcon} ${styles.badgeIconPurple}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M21 12V7H5a2 2 0 010-4h14v4" />
                  <path d="M3 5v14a2 2 0 002 2h16v-5" />
                  <path d="M18 12a2 2 0 000 4h4v-4h-4z" />
                </svg>
              </div>
              <span className={styles.badgeLabel}>دفتر کل توزیع‌شده</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
