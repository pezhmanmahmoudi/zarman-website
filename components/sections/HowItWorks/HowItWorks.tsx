"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./HowItWorks.module.css";
import Button from "@/components/ui/Button/Button";
import { UserPlus, ShieldCheck, CreditCard, Send } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const steps = [
  {
    id: "step-1",
    number: "01",
    title: "ثبت درخواست تراکنش",
    text: "برای دریافت بهترین نرخ تبدیل، پیشنهاد می‌شود وارد حساب کاربری خود شده و مبلغ مورد نظر را در داشبورد وارد کنید. پس از مشاهده نرخ لحظه‌ای، درخواست تراکنش را ثبت نمایید. همچنین امکان ثبت درخواست مستقیم از طریق واتس‌اپ نیز فراهم است.",
    icon: UserPlus,
  },
  {
    id: "step-2",
    number: "02",
    title: "احراز هویت (KYC)",
    text: "مطابق با قوانین مالی استرالیا، پیش از انجام تراکنش، احراز هویت شما توسط زرمان الزامی است. این فرآیند ساده شامل ارسال تصویر مدرک شناسایی معتبر و تاییدیه محل سکونت می‌باشد.",
    icon: ShieldCheck,
  },
  {
    id: "step-3",
    number: "03",
    title: "واریز وجه",
    text: "پس از تایید هویت، اطلاعات حساب بانکی جهت واریز در اختیار شما قرار می‌گیرد. در این مرحله، کافیست مبلغ مشخص‌شده را در زمان مقرر به حساب معتمد زرمان واریز نمایید.",
    icon: CreditCard,
  },
  {
    id: "step-4",
    number: "04",
    title: "انتقال و تسویه نهایی",
    text: "به محض تایید دریافت وجه در حساب ما، فرآیند انتقال به حساب مقصد با بالاترین سرعت انجام پذیرفته و رسید رسمی تراکنش به ایمیل شما ارسال می‌گردد.",
    icon: Send,
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const el = sectionRef.current;
      if (!el) return;

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

  // 👈 متن آماده برای پیام واتس‌اپ
  const whatsappMessage = "سلام. وقت بخیر. من برای ثبت‌نام و انجام تراکنش در صرافی زرمان نیاز به راهنمایی دارم.";
  const whatsappLink = `https://wa.me/61497851631?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="how-it-works-title"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>مراحل انتقال</p>
          <h2 id="how-it-works-title" className={styles.title}>
            فرآیند انتقال مالی؛ ساده، امن و شفاف
          </h2>
          <p className={styles.subtitle}>
            مراحل ثبت تا تکمیل تراکنش در زرمان به گونه‌ای مهندسی شده است تا در هر لحظه، کنترل و آگاهی کاملی بر وضعیت سرمایه خود داشته باشید.
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

                <div className={styles.cardHeader}>
                  <div className={styles.iconWrapper}>
                    <Icon size={24} strokeWidth={1.5} className={styles.icon} />
                  </div>
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
            <h3 className={styles.ctaTitle}>آماده‌ی یک انتقال امن هستید؟</h3>
            <p className={styles.ctaText}>
              تعهد ما ارائه تجربه‌ای بدون ابهام و فاقد هزینه‌های پنهان است. همین حالا با خیالی آسوده اولین تراکنش خود را آغاز کنید.
            </p>
          </div>

          <div className={styles.ctaActions}>
            <Button href="/fa/register" variant="primary" size="lg">
              شروع ثبت‌نام در زرمان
            </Button>
            {/* 👈 استفاده از استایل مجاز ghost برای رفع ارور تایپ‌اسکریپت */}
            <Button href={whatsappLink} target="_blank" variant="ghost" size="lg">
              درخواست مشاوره
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}