"use client";

import React from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, Variants } from "framer-motion";
import styles from "./ServiceSection.module.css";

// کامپوننت شبکه مرکزی
const ServicesNetworkCore = dynamic(() => import("./NetworkGlobe"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="w-full h-full"
      style={{ backgroundColor: "#080B12" }}
    >
      <span className="sr-only">در حال بارگذاری گلوب شبکه</span>
    </div>
  ),
});

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

const SERVICES_FA: ServiceItem[] = [
  {
    title: "تسهیلات ارزی در مسیر مهاجرت تحصیلی",
    text: "تمرکز خود را روی تحصیل بگذارید و دغدغه‌های مالی را به ما بسپارید. انجام کلیه امور ارزی دانشجویان شامل پرداخت شهریه (Tuition Fee)، هزینه‌های ویزا، اقامت و بیمه (OSHC) با بهترین نرخ و بدون هیچ‌گونه کارمزد.",
    Icon: GraduationIcon,
  },
  {
    title: "خدمات ارزی و پرداخت‌های کادر درمان",
    text: "صفر تا صد پرداخت‌های مسیر مهاجرت و رجیستری کادر درمان در استرالیا را به زرمان بسپارید. انجام سریع و بدون کارمزد هزینه‌ آزمون‌های پزشکی (AMC, PESCI)، دندان‌پزشکی (ADC)، پرستاری (NCLEX, OSCE)، آزمون زبان (OET) و تمامی هزینه‌های سازمان‌ (AHPRA).",
    Icon: StethoscopeIcon,
  },
  {
    title: "انتقال امن سرمایه و دارایی‌های خانوادگی",
    text: "دغدغه جابه‌جایی مبالغ بالا را فراموش کنید. ما بستری امن و سریع برای انتقال سرمایه‌های شخصی، فروش ملک و دارایی‌های خانوادگی شما فراهم کرده‌ایم تا ارزش سرمایه‌تان در مسیر ایران و استرالیا حفظ شود.",
    Icon: BankIcon,
  },
  {
  title: "زیرساخت پرداخت‌های تجاری ",
  text: "تسهیل مبادلات تجاری و مدیریت نقدینگی فرامرزی با تمرکز بر سرعت در انتقال. ",
    Icon: ReceiptIcon,
  },
];

const SERVICES_EN: ServiceItem[] = [
  {
    title: "Currency Services for Student Migration",
    text: "Focus on your studies while we handle your financial transfers. We cover tuition fee payments, visa costs, accommodation, and OSHC insurance at competitive rates with no hidden fees.",
    Icon: GraduationIcon,
  },
  {
    title: "Currency Services for Healthcare Professionals",
    text: "End-to-end payments for healthcare migration and registration in Australia, including AMC, PESCI, ADC, NCLEX, OSCE, OET, and AHPRA-related costs, processed quickly and transparently.",
    Icon: StethoscopeIcon,
  },
  {
    title: "Secure Transfer of Personal and Family Assets",
    text: "Move large amounts with confidence. We provide a secure and fast channel for transferring personal capital, property sale proceeds, and family assets between Iran and Australia.",
    Icon: BankIcon,
  },
  {
    title: "Commercial Payment Infrastructure",
    text: "Simplify cross-border business transactions and liquidity management with reliable execution and fast settlement.",
    Icon: ReceiptIcon,
  },
];

const EASE = [0.16, 1, 0.3, 1] as const;

/* Animations */
const highlightAnim = {
  initial: { opacity: 0, y: 15, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: EASE },
  },
};

export default function Services() {
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";
  const SERVICES = isEn ? SERVICES_EN : SERVICES_FA;
  return (
    <section id="services" className={styles.section} aria-labelledby="services-title">
      <div className={styles.bgGrid} aria-hidden="true" />
      <div className={styles.bgVignette} aria-hidden="true" />

      <div className={styles.inner}>
        {/* ===== Header ===== */}
        {/* 👈 className changed to styles.header */}
        <header className={styles.header}>
          <motion.p
            className={styles.eyebrow}
            {...highlightAnim}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            {isEn ? "Our Specialised Services" : "خدمات ویژه ما"}
          </motion.p>

          <motion.h2
            id="services-title"
            className={styles.title}
            {...highlightAnim}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          >
            {isEn ? "Zarman Financial Ecosystem" : "اکوسیستم مالی زرمان"}
          </motion.h2>

          <motion.p
            className={styles.subtitle}
            {...highlightAnim}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          >
            {isEn
              ? "A smart, secure path for capital transfers and currency payments to Australia."
              : "مسیری هوشمند و امن برای انتقال سرمایه و پرداخت‌های ارزی به استرالیا."}
          </motion.p>
        </header>

        <div className={styles.stage}>
          <div className={styles.verticalGuides} aria-hidden="true" />
          <div className={styles.rings} aria-hidden="true" />

          {/* ===== Center Core (Static Network) ===== */}
          <div className={styles.center} aria-hidden="true">
            <div className={styles.centerCore}>
              <div className={styles.pulseInner} />
              <div className={styles.pulseOuter} />
              <div className={styles.netWrap}>
                <ServicesNetworkCore />
              </div>
            </div>
          </div>

          {/* ===== Desktop Quadrants ===== */}
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
                  transition={{ delay: 0.15 + i * 0.1 }}
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

          {/* ===== Mobile View ===== */}
          <div className={styles.mobileStack}>
            <div className={styles.mobileHero}>
              <div className={styles.mobileCenter} aria-hidden="true">
                <div className={styles.mobileRings} />
                <div className={styles.mobilePulseInner} />
                <div className={styles.mobilePulseOuter} />
                <div className={styles.mobileCore}>
                  <ServicesNetworkCore />
                </div>
              </div>

              {/* ===== Mobile header ===== */}
              <motion.p
                className={styles.eyebrow}
                {...highlightAnim}
                viewport={{ once: true }}
                transition={{ duration: 0.78, ease: EASE }}
              >
                {isEn ? "Our Specialised Services" : "خدمات ویژه ما"}
              </motion.p>
              
              <motion.h3
                className={styles.mobileTitle}
                {...highlightAnim}
                viewport={{ once: true }}
                transition={{ duration: 0.78, ease: EASE, delay: 0.1 }}
              >
                {isEn ? "Zarman Financial Ecosystem" : "اکوسیستم مالی زرمان"}
              </motion.h3>

              <motion.p
                className={styles.mobileText}
                {...highlightAnim}
                viewport={{ once: true }}
                transition={{ duration: 0.78, ease: EASE, delay: 0.2 }}
              >
                {isEn
                  ? "A smart, secure path for capital transfers and currency payments to Australia."
                  : "مسیری هوشمند و امن برای انتقال سرمایه و پرداخت‌های ارزی به استرالیا."}
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
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ delay: 0.15 + idx * 0.1 }}
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