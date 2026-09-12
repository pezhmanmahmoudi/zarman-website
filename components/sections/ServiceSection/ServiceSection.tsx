"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, useInView, useReducedMotion, Variants } from "framer-motion";
import styles from "./ServiceSection.module.css";

// کامپوننت شبکه مرکزی
const ServicesNetworkCore = dynamic(() => import("./NetworkGlobe"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full"
      style={{ backgroundColor: "#080B12" }}
    />
  ),
});

function ServiceGlobe() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "200px" });
  const reducedMotion = useReducedMotion();

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }} aria-hidden="true">
      {inView && !reducedMotion ? <ServicesNetworkCore /> : null}
    </div>
  );
}

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
  slug: string;
  title: string;
  text: string;
  Icon: React.ComponentType;
};

const SERVICES_FA: ServiceItem[] = [
  {
    slug: "student-remittance",
    title: "تسهیلات ارزی در مسیر مهاجرت تحصیلی",
    text: "پرداخت شهریه دانشگاه (Tuition Fee)، هزینه ویزا، اقامت و بیمه دانشجویی (OSHC) در استرالیا. نرخ تبدیل، هزینه‌ها و زمان تخمینی پرداخت را پیش از تأیید حواله با تیم زرمان بررسی کنید.",
    Icon: GraduationIcon,
  },
  {
    slug: "healthcare-professional-payments",
    title: "خدمات ارزی و پرداخت‌های کادر درمان",
    text: "پرداخت هزینه آزمون‌ها و ثبت‌نام کادر درمان در استرالیا، از جمله AMC، PESCI، ADC، NCLEX، OSCE، OET و AHPRA. امکان انجام هر پرداخت و مهلت آن پیش از پذیرش درخواست بررسی می‌شود.",
    Icon: StethoscopeIcon,
  },
  {
    slug: "capital-and-asset-transfer",
    title: "انتقال سرمایه و دارایی‌های خانوادگی",
    text: "هماهنگی انتقال سرمایه شخصی، عواید فروش ملک و دارایی‌های خانوادگی بین ایران و استرالیا. نرخ، زمان و مدارک مورد نیاز بر اساس مبلغ و شرایط هر حواله بررسی می‌شود.",
    Icon: BankIcon,
  },
  {
  slug: "business-payment-infrastructure",
  title: "زیرساخت پرداخت‌های تجاری ",
  text: "هماهنگی پرداخت‌های تجاری بین ایران و استرالیا با بررسی مشخصات طرفین، مدارک معامله و شرایط هر درخواست.",
    Icon: ReceiptIcon,
  },
];

const SERVICES_EN: ServiceItem[] = [
  {
    slug: "student-remittance",
    title: "Currency Services for Student Migration",
    text: "Arrange Australian university tuition, visa, accommodation and OSHC insurance payments. Review the exchange rate, costs and estimated payment time with Zarman before confirming your transfer.",
    Icon: GraduationIcon,
  },
  {
    slug: "healthcare-professional-payments",
    title: "Currency Services for Healthcare Professionals",
    text: "Arrange payments for Australian healthcare exams and registration, including AMC, PESCI, ADC, NCLEX, OSCE, OET and AHPRA. Payment availability and deadlines are reviewed before a request is accepted.",
    Icon: StethoscopeIcon,
  },
  {
    slug: "capital-and-asset-transfer",
    title: "Transfer of Personal and Family Assets",
    text: "Coordinate transfers of personal capital, property sale proceeds and family assets between Iran and Australia. Rates, timing and supporting documents depend on the amount and circumstances of each transfer.",
    Icon: BankIcon,
  },
  {
    slug: "business-payment-infrastructure",
    title: "Commercial Payment Infrastructure",
    text: "Coordinate business payments between Iran and Australia, subject to review of the parties, transaction documents and the circumstances of each request.",
    Icon: ReceiptIcon,
  },
];

const EASE = [0.16, 1, 0.3, 1] as const;

/* Animations */
const highlightAnim = {
  "data-service-reveal": "",
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
      <noscript>
        <style>{`#services [data-service-reveal] { opacity: 1 !important; visibility: visible !important; transform: none !important; filter: none !important; }`}</style>
      </noscript>
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
                <ServiceGlobe />
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
                  data-service-reveal=""
                  variants={cardVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                >
                  <div className={styles.iconOrb} aria-hidden="true">
                    <Icon />
                  </div>
                  <h3 className={styles.itemTitle}><Link href={`/${locale}/services/${s.slug}`} className={styles.serviceLink}>{s.title}</Link></h3>
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
                  <ServiceGlobe />
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
              
              <motion.h2
                className={styles.mobileTitle}
                {...highlightAnim}
                viewport={{ once: true }}
                transition={{ duration: 0.78, ease: EASE, delay: 0.1 }}
              >
                {isEn ? "Zarman Financial Ecosystem" : "اکوسیستم مالی زرمان"}
              </motion.h2>

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
                    data-service-reveal=""
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
                      <h3 className={styles.mobileRowTitle}><Link href={`/${locale}/services/${s.slug}`} className={styles.serviceLink}>{s.title}</Link></h3>
                      <p className={styles.mobileRowText}>{s.text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
        <div className={styles.allServices}>
          <Link href={`/${locale}/services`} className={styles.serviceLink}>
            {isEn ? "Explore all transfer services" : "مشاهده همه خدمات حواله زرمان"}
          </Link>
        </div>
      </div>
    </section>
  );
}
