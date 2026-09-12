"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./HowItWorks.module.css";
import Button from "@/components/ui/Button/Button";
import { UserPlus, ShieldCheck, CreditCard, Send } from "lucide-react";
import {
  buildWhatsAppUrl,
  WHATSAPP_MESSAGE_SIGNUP_HELP,
} from "@/lib/constants/contact";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const stepsFa = [
  {
    id: "step-1",
    number: "01",
    title: "ثبت درخواست تراکنش",
    text: "وارد حساب کاربری شوید و مبلغ و جهت حواله را در داشبورد وارد کنید. نرخ پیشنهادی و شرایط پرداخت را بررسی و سپس درخواست تراکنش را ثبت نمایید. برای راهنمایی می‌توانید از طریق واتس‌اپ با زرمان تماس بگیرید.",
    icon: UserPlus,
  },
  {
    id: "step-2",
    number: "02",
    title: "احراز هویت (KYC)",
    text: "زرمان پیش از پردازش حواله هویت شما را بررسی می‌کند. مدرک شناسایی معتبر و اطلاعات درخواستی را ارسال کنید؛ بسته به شرایط تراکنش ممکن است مدارک بیشتری لازم باشد.",
    icon: ShieldCheck,
  },
  {
    id: "step-3",
    number: "03",
    title: "واریز وجه",
    text: "پس از تایید هویت، اطلاعات حساب بانکی جهت واریز در اختیار شما قرار می‌گیرد. در این مرحله، کافیست مبلغ مشخص‌شده را در زمان مقرر به حساب زرمان واریز نمایید.",
    icon: CreditCard,
  },
  {
    id: "step-4",
    number: "04",
    title: "انتقال و تسویه نهایی",
    text: "پس از تأیید دریافت وجه و تکمیل بررسی‌های لازم، حواله برای تسویه پردازش می‌شود. زمان نهایی به شرایط بانکی و مشخصات تراکنش بستگی دارد. وضعیت و رسید تراکنش را در حساب کاربری پیگیری کنید.",
    icon: Send,
  },
];

const stepsEn = [
  {
    id: "step-1",
    number: "01",
    title: "Submit a Transaction Request",
    text: "Sign in and enter your transfer amount and direction in the dashboard. Review the offered rate and payment conditions before submitting a transaction request. Contact Zarman through WhatsApp if you need help.",
    icon: UserPlus,
  },
  {
    id: "step-2",
    number: "02",
    title: "Identity Verification (KYC)",
    text: "Zarman verifies your identity before processing a transfer. Provide a valid identity document and the requested details; additional documents may be needed depending on the transaction.",
    icon: ShieldCheck,
  },
  {
    id: "step-3",
    number: "03",
    title: "Deposit Funds",
    text: "Once your identity is verified, you will receive our bank account details for the deposit. Simply transfer the specified amount to Zarman's account within the agreed timeframe.",
    icon: CreditCard,
  },
  {
    id: "step-4",
    number: "04",
    title: "Transfer & Final Settlement",
    text: "After receipt of funds is confirmed and required checks are complete, the transfer is processed for settlement. Timing depends on banking availability and transaction details. Follow the status and receipt in your account.",
    icon: Send,
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";
  const steps = isEn ? stepsEn : stepsFa;

  const whatsappUrl = buildWhatsAppUrl(isEn
    ? "Hello, I found Zarman's website and need help with registration and a money transfer."
    : WHATSAPP_MESSAGE_SIGNUP_HELP);

  useGSAP(
    () => {
      const el = sectionRef.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
      )
      .fromTo(
        `.${styles.card}`,
        { autoAlpha: 0, y: 0 },
        { autoAlpha: 1, y: 0, stagger: 0.15, duration: 1 },
        "-=0.4"
      )
      .fromTo(
        `.${styles.ctaBanner}`,
        { autoAlpha: 0, scale: 0.96, y: 20 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 1 },
        "-=0.6"
      );
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="how-it-works-title"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>{isEn ? "How It Works" : "مراحل انتقال"}</p>
          <h2 id="how-it-works-title" className={styles.title}>
            {isEn ? "The Smart Path to Money Transfer at Zarman" : "مسیر هوشمند انتقال وجه در زرمان"}
          </h2>
          <p className={styles.subtitle}>
            {isEn
              ? "From request to completed transaction — designed for simplicity and speed. Zarman's dedicated user panel delivers a transparent, seamless, and modern experience for managing your currency affairs."
              : "مراحل ثبت درخواست تا تکمیل تراکنش، با تمرکز بر سادگی و سرعت طراحی شده است. پنل کاربری اختصاصی زرمان، تجربه‌ای شفاف، بی‌دردسر و مدرن از مدیریت امور ارزی را برای شما رقم می‌زند."}
          </p>
        </div>

        <div className={styles.grid}>
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.id} className={styles.card}>
                <span className={styles.watermarkNumber} aria-hidden="true">
                  {step.number}
                </span>

                <div className={styles.iconWrapper} aria-hidden="true">
                  <Icon size={28} strokeWidth={1.5} className={styles.icon} />
                </div>

                <div className={styles.cardContent}>
                  <h3 className={styles.cardTitle}>{step.title}</h3>
                  <p className={styles.cardText}>{step.text}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.ctaBanner}>
          <div className={styles.ctaGlow} aria-hidden="true" />
          <div className={styles.ctaContent}>
            <h3 className={styles.ctaTitle}>
              {isEn ? "Ready for a New Experience?" : "آماده‌ی یک تجربه جدید هستید؟"}
            </h3>
            <p className={styles.ctaText}>
              {isEn
                ? "It's time to focus on bigger goals and leave money transfer worries behind. Take the first step toward a seamless, modern experience."
                : "زمان آن رسیده که تمرکزتان را روی اهداف بزرگ‌تر بگذارید و دغدغه‌های جابه‌جایی پول را خط بزنید. اولین قدم را برای یک تجربه یکپارچه و مدرن بردارید."}
            </p>
          </div>

          <div className={styles.ctaActions}>
            <Button href={`/${locale}/register`} variant="primary" size="lg">
              {isEn ? "Sign up with Zarman" : "شروع ثبت‌نام در زرمان"}
            </Button>
            <Button href={whatsappUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="lg">
              {isEn ? "Request Consultation" : "درخواست مشاوره"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
