"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./TestimonialSection.module.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// آیکون پریمیوم نقل قول
const QuoteIcon = () => (
  <svg 
    className={styles.quoteSvg} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path 
      d="M10 11C10 13.2091 8.20914 15 6 15C3.79086 15 2 13.2091 2 11V7H6C8.20914 7 10 8.79086 10 11ZM22 11C22 13.2091 20.2091 15 18 15C15.7909 15 14 13.2091 14 11V7H18C20.2091 7 22 8.79086 22 11Z" 
      fill="currentColor" 
    />
  </svg>
);

// دیتای نظرات (توسعه یافته برای اسکرول بی‌نهایت)
const allReviews = [
  {
    name: "علیرضا م.", role: "دانشجوی مقطع دکتری",
    text: "پرداخت شهریه دانشگاه همیشه پر از استرس بود، اما با زرمان، هم نرخ شفاف بود و هم دقیقاً در زمان مقرر وجه به حساب نشست.",
  },
  {
    name: "سارا ت.", role: "مهاجر کاری",
    text: "برای انتقال پس‌اندازم به استرالیا وسواس زیادی داشتم. سیستم پیگیری مرحله‌به‌مرحله باعث شد در تمام مسیر خیالم راحت باشد.",
  },
  {
    name: "شرکت بازرگانی آ.", role: "مشتری شرکتی (B2B)",
    text: "سرعت در تسویه اینوویس‌ها برای ما حیاتی است. زرمان نه‌تنها نقدینگی را تامین کرد، بلکه فاکتورهای رسمی برای مالیات ارائه داد.",
  },
  {
    name: "محمد ح.", role: "سرمایه‌گذار",
    text: "بهترین صرافی برای انتقال مبالغ بالا. کارمزدها بسیار شفاف است و تیم پشتیبانی در تمام مراحل همراه شما هستند.",
  },
  {
    name: "ندا ش.", role: "توسعه‌دهنده نرم‌افزار",
    text: "فرایند احراز هویت خیلی سریع و حرفه‌ای بود. پولی که فرستادم در کمتر از چند ساعت در حساب مقصدم در استرالیا بود.",
  },
  {
    name: "امید ر.", role: "مهاجر تحصیلی",
    text: "پشتیبانی واتس‌اپ فوق‌العاده است. حتی در روزهای تعطیل هم پاسخ دادند و مشکل من را در لحظه حل کردند. بی‌نظیر بود.",
  },
  {
    name: "رضا ک.", role: "تاجر مستقل",
    text: "سیستم اعلان‌ها و پیگیری زرمان به من آرامش خاطر میده. همیشه می‌دونم پولم کجاست و کی به مقصد می‌رسه.",
  },
  {
    name: "مریم ا.", role: "فریلنسر",
    text: "بهترین ریت دلار رو همیشه از زرمان می‌گیرم. رابط کاربری سایت هم انقدر جذابه که کار کردن باهاش لذت بخشه.",
  },
  {
    name: "پیمان م.", role: "مدیر پروژه",
    text: "بدون هیچ هزینه پنهانی. دقیقاً همون مبلغی که در ماشین‌حساب سایت دیدم، بدون یک سنت کم و کاست به حسابم واریز شد.",
  }
];

// تقسیم دیتا به سه ستون برای کاروسل عمودی
const col1 = [allReviews[0], allReviews[3], allReviews[6]];
const col2 = [allReviews[1], allReviews[4], allReviews[7]];
const col3 = [allReviews[2], allReviews[5], allReviews[8]];

// کامپوننت داخلی کارت نظر
const ReviewCard = ({ review }: { review: any }) => (
  <figure className={styles.card}>
    <QuoteIcon />
    <blockquote className={styles.textWrap}>
      <p className={styles.text}>{review.text}</p>
    </blockquote>
    <figcaption className={styles.authorBox}>
      <div className={styles.avatar} aria-hidden="true">
        {review.name.charAt(0)}
      </div>
      <div className={styles.authorInfo}>
        <h4 className={styles.name}>{review.name}</h4>
        <span className={styles.role}>{review.role}</span>
      </div>
    </figcaption>
  </figure>
);

export default function TestimonialSection() {
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
      ).fromTo(
        `.${styles.carouselMask}`,
        { autoAlpha: 0, y: 40 },
        { autoAlpha: 1, y: 0, duration: 1.2 },
        "-=0.4"
      );
    },
    { scope: sectionRef }
  );

  return (
    <section className={styles.section} ref={sectionRef} aria-labelledby="test-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>تجربه کاربران</span>
          <h2 id="test-title" className={styles.title}>اعتمادی که ساخته‌ایم</h2>
        </div>

        {/* ماسک محو‌کننده بالا و پایین */}
        <div className={styles.carouselMask}>
          <div className={styles.columnsContainer}>
            
            {/* ستون اول: اسکرول به بالا */}
            <div className={`${styles.column}`}>
              <div className={`${styles.track} ${styles.scrollUp}`}>
                {col1.map((r, i) => <ReviewCard key={`c1-a-${i}`} review={r} />)}
              </div>
              <div className={`${styles.track} ${styles.scrollUp}`} aria-hidden="true">
                {col1.map((r, i) => <ReviewCard key={`c1-b-${i}`} review={r} />)}
              </div>
            </div>

            {/* ستون دوم (وسط): اسکرول به پایین */}
            <div className={`${styles.column}`}>
              <div className={`${styles.track} ${styles.scrollDown}`}>
                {col2.map((r, i) => <ReviewCard key={`c2-a-${i}`} review={r} />)}
              </div>
              <div className={`${styles.track} ${styles.scrollDown}`} aria-hidden="true">
                {col2.map((r, i) => <ReviewCard key={`c2-b-${i}`} review={r} />)}
              </div>
            </div>

            {/* ستون سوم: اسکرول به بالا */}
            <div className={`${styles.column}`}>
              <div className={`${styles.track} ${styles.scrollUp}`}>
                {col3.map((r, i) => <ReviewCard key={`c3-a-${i}`} review={r} />)}
              </div>
              <div className={`${styles.track} ${styles.scrollUp}`} aria-hidden="true">
                {col3.map((r, i) => <ReviewCard key={`c3-b-${i}`} review={r} />)}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}