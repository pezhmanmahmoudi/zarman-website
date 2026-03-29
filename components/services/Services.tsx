"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import styles from "./Services.module.css";

// ✅ Unique alias name to avoid confusion with other globes
import ServicesNetworkCore from "./NetworkGlobe";

/* ===== Minimal premium SVG icons ===== */
function GraduationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3L2 9l10 6 10-6-10-6Z" />
      <path d="M6 12v5c3 2 9 2 12 0v-5" />
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3v4a4 4 0 0 0 8 0V3" />
      <path d="M10 11v3a5 5 0 0 0 10 0v-2" />
      <path d="M20 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3L3 8v2h18V8l-9-5Z" />
      <path d="M5 10v9M9 10v9M15 10v9M19 10v9M4 19h16" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z" />
      <path d="M9 7h6M9 11h6M9 15h5" />
    </svg>
  );
}

type ServiceItem = {
  title: string;
  text: string;
  Icon: React.ComponentType;
};

const SERVICES: ServiceItem[] = [
  {
    title: "تسهیلات ارزی در مسیر مهاجرت تحصیلی",
    text: "مدیریت جامع پرداخت‌های شهریه دانشگاهی و هزینه‌های اقامت دانشجویی در استرالیا با بهره‌گیری از نرخ‌های ترجیحی.",
    Icon: GraduationIcon,
  },
  {
    title: "خدمات تخصصی حواله‌های کادر درمان",
    text: "پشتیبانی کامل از پرداخت‌های آزمون AMC، هزینه‌های رجیستری و مهاجرت پزشکان؛ ما پیچیدگی‌های مالی شما را ساده می‌کنیم.",
    Icon: StethoscopeIcon,
  },
  {
    title: "زیرساخت انتقال سرمایه و دارایی شخصی",
    text: "امن‌ترین راهکار برای جابجایی مبالغ قابل توجه، فروش ملک و انتقال دارایی‌های خانوادگی بین ایران و استرالیا.",
    Icon: BankIcon,
  },
  {
    title: "مدیریت نقدینگی و حواله‌های تجاری (B2B)",
    text: "تامین ارز و پرداخت اینوویس‌های بازرگانی با نرخ‌های رقابتی بازار؛ همراه با صدور فاکتورهای رسمی جهت ارائه به مراجع مالیاتی.",
    Icon: ReceiptIcon,
  },
];

const EASE = [0.16, 1, 0.3, 1] as const;

/* ✅ AboutUs-like: different motions per block */
const highlightAnim = {
  initial: { opacity: 0, x: 22, filter: "blur(10px)" },
  whileInView: { opacity: 1, x: 0, filter: "blur(0px)" },
};

const titleAnim = {
  initial: { opacity: 0, y: 26, filter: "blur(12px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const textAnim = {
  initial: { opacity: 0, y: 18, filter: "blur(10px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
};

/* ✅ Cards: premium, subtle scale */
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.985, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: EASE },
  },
};

export default function Services() {
  return (
    <section id="zarman-services" className={styles.section}>
      <div className={styles.bgGrid} aria-hidden="true" />
      <div className={styles.bgVignette} aria-hidden="true" />

      <div className={styles.inner}>
        {/* ===== Desktop header ===== */}
        <header className={styles.top}>
          <motion.span
            className={styles.highlightText}
            {...highlightAnim}
            viewport={{ once: true}}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            
          >
            خدمات ویژه ما
          </motion.span>

          <motion.h2
            className={styles.title}
            {...highlightAnim}
            viewport={{ once: true}}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            اکوسیستم مالی زرمان
          </motion.h2>

          <motion.p
            className={styles.subtitle}
            {...highlightAnim}
            viewport={{ once: true}}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            راهکارهای هوشمند برای انتقال سرمایه بین ایران و استرالیا؛ با ساختاری شفاف،
                قابل پیگیری و پشتیبانی دقیق
          </motion.p>
        </header>

        <div className={styles.stage}>
          <div className={styles.crosshair} aria-hidden="true" />
          <div className={styles.rings} aria-hidden="true" />
          <div className={styles.verticalGuides} aria-hidden="true" />

          {/* ✅ STATIC center (no motion / no whileInView) */}
          <div className={styles.center} aria-hidden="true">
            <div className={styles.centerCore}>
              <div className={styles.pulseInner} />
              <div className={styles.pulseOuter} />
              <div className={styles.netWrap}>
                <ServicesNetworkCore />
              </div>
            </div>
          </div>

          {/* Desktop Quadrants (TL, TR, BL, BR) */}
          <div className={styles.quadDesktop}>
            {[1, 0, 2, 3].map((serviceIdx, i) => {
              const s = SERVICES[serviceIdx];
              const Icon = s.Icon;
              const posClass =
                i === 0 ? styles.tl : i === 1 ? styles.tr : i === 2 ? styles.bl : styles.br;

              return (
                <motion.article
                  key={s.title}
                  className={`${styles.item} ${posClass}`}
                  variants={cardVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ delay: 0.18 + i * 0.1 }}
                >
                  <div className={styles.iconOrb} aria-hidden="true">
                    <Icon />
                  </div>
                  <h3 className={styles.itemTitle}>{s.title}</h3>
                  <p className={styles.itemText}>{s.text}</p>
                </motion.article>
              );
            })}
          </div>

          {/* ===== Mobile ===== */}
          <div className={styles.mobileStack}>
            <div className={styles.mobileHero}>
              <div className={styles.mobileCenter} aria-hidden="true">
                <div className={styles.mobileRings} />
                <div className={styles.mobilePulseInner} />
                <div className={styles.mobilePulseOuter} />

                {/* ✅ STATIC network */}
                <div className={styles.mobileCore}>
                  <ServicesNetworkCore />
                </div>
              </div>

              {/* ✅ Mobile text colors match desktop */}
              <motion.span
                className={styles.highlightText}
                {...highlightAnim}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.78, ease: EASE }}
              >
                خدمات ویژه ما              
              </motion.span>
              

              <motion.h3
                className={styles.mobileTitle}
                viewport={{ once: true}}
                initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
              >
                اکوسیستم مالی زرمان
              </motion.h3>

              <motion.p
                className={styles.mobileText}
                viewport={{ once: true}}
                initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
              >
                راهکارهای هوشمند برای انتقال سرمایه بین ایران و استرالیا؛ با ساختاری شفاف،
                قابل پیگیری و پشتیبانی دقیق
              </motion.p>
            </div>

            <div className={styles.mobileList}>
              {SERVICES.map((s, idx) => {
                const Icon = s.Icon;
                return (
                  <motion.div
                    key={s.title}
                    className={styles.mobileRow}
                    variants={cardVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ delay: 0.22 + idx * 0.1 }}
                  >
                    <div className={styles.mobileIcon} aria-hidden="true">
                      <Icon />
                    </div>
                    <div className={styles.mobileCopy}>
                      <div className={styles.mobileRowTitle}>{s.title}</div>
                      <div className={styles.mobileRowText}>{s.text}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
