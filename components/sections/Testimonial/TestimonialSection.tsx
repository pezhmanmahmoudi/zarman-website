"use client";

import React, { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Star } from "lucide-react"; 
import { supabase } from "@/lib/supabase"; 
import styles from "./TestimonialSection.module.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const QuoteIcon = () => (
  <svg className={styles.quoteSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10 11C10 13.2091 8.20914 15 6 15C3.79086 15 2 13.2091 2 11V7H6C8.20914 7 10 8.79086 10 11ZM22 11C22 13.2091 20.2091 15 18 15C15.7909 15 14 13.2091 14 11V7H18C20.2091 7 22 8.79086 22 11Z" fill="currentColor" />
  </svg>
);

// 🛡️ دیتای مجازی - فیلد volume کاملاً حذف شد
const fallbackReviews = [
  { name: "علیرضا م.", rating: 5, text: "پرداخت شهریه دانشگاه همیشه پر از استرس بود، اما با زرمان، هم نرخ شفاف بود و هم دقیقاً در زمان مقرر وجه به حساب نشست." },
  { name: "سارا ت.", rating: 5, text: "برای انتقال پس‌اندازم به استرالیا وسواس زیادی داشتم. سیستم پیگیری مرحله‌به‌مرحله باعث شد در تمام مسیر خیالم راحت باشد." },
  { name: "شرکت بازرگانی آ.", rating: 4, text: "سرعت در تسویه اینوویس‌ها برای ما حیاتی است. زرمان نه‌تنها نقدینگی را تامین کرد، بلکه فاکتورهای رسمی برای مالیات ارائه داد." },
  { name: "محمد ح.", rating: 5, text: "بهترین صرافی برای انتقال مبالغ بالا. کارمزدها بسیار شفاف است و تیم پشتیبانی در تمام مراحل همراه شما هستند." },
  { name: "ندا ش.", rating: 5, text: "فرایند احراز هویت خیلی سریع و حرفه‌ای بود. پولی که فرستادم در کمتر از چند ساعت در حساب مقصدم در استرالیا بود." },
  { name: "امید ر.", rating: 5, text: "پشتیبانی واتس‌اپ فوق‌العاده است. حتی در روزهای تعطیل هم پاسخ دادند و مشکل من را در لحظه حل کردند. بی‌نظیر بود." },
  { name: "رضا ک.", rating: 5, text: "سیستم اعلان‌ها و پیگیری زرمان به من آرامش خاطر میده. همیشه می‌دونم پولم کجاست و کی به مقصد می‌رسه." },
  { name: "مریم ا.", rating: 4, text: "بهترین ریت دلار رو همیشه از زرمان می‌گیرم. رابط کاربری سایت هم انقدر جذابه که کار کردن باهاش لذت بخشه." },
  { name: "پیمان م.", rating: 5, text: "بدون هیچ هزینه پنهانی. دقیقاً همون مبلغی که در ماشین‌حساب سایت دیدم، بدون یک سنت کم و کاست به حسابم واریز شد." }
];

const ReviewCard = ({ review }: { review: any }) => (
  <figure className={styles.card}>
    <div className={styles.cardHeaderFlex}>
      <div className={styles.cardRating}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={16} fill={star <= review.rating ? "currentColor" : "none"} className={star <= review.rating ? styles.starFilled : styles.starEmpty} />
        ))}
      </div>
      <QuoteIcon />
    </div>
    
    <blockquote className={styles.textWrap}>
      <p className={styles.text}>{review.text}</p>
    </blockquote>
    
    <figcaption className={styles.authorBox}>
      <div className={styles.avatar} aria-hidden="true">
        {review.name.charAt(0).toUpperCase()}
      </div>
      
      <div className={styles.authorInfo}>
        <h4 className={styles.name} dir="auto">{review.name}</h4>
      </div>
    </figcaption>
  </figure>
);

export default function TestimonialSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [reviews, setReviews] = useState<any[]>(fallbackReviews);
  const [stats, setStats] = useState({ avg: 4.8, total: fallbackReviews.length });

  useEffect(() => {
    async function fetchTestimonials() {
      try {
        // 🛡️ فقط دریافت نظرات تایید شده توسط ادمین
        const { data: testData, error: testError } = await supabase
          .from('testimonials')
          .select('rating, message, profiles(first_name, last_name)')
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (testError) throw testError;

        if (testData && testData.length > 0) {
          
          const liveReviews = testData.map((item: any) => {
            const fName = item.profiles?.first_name || "کاربر";
            const lName = item.profiles?.last_name ? ` ${item.profiles.last_name.charAt(0)}.` : "";
            
            return {
              name: fName + lName,
              text: item.message,
              rating: item.rating || 5
            };
          });

          const average = liveReviews.reduce((sum, rev) => sum + rev.rating, 0) / liveReviews.length;
          
          setReviews(liveReviews);
          setStats({ avg: Number(average.toFixed(1)), total: liveReviews.length });
        }
      } catch (err) {
        console.warn("استفاده از دیتای مجازی به دلیل خطا یا خالی بودن دیتابیس.", err);
      }
    }
    fetchTestimonials();
  }, []);

  const col1 = reviews.filter((_, i) => i % 3 === 0);
  const col2 = reviews.filter((_, i) => i % 3 === 1);
  const col3 = reviews.filter((_, i) => i % 3 === 2);

  useGSAP(() => {
    const el = sectionRef.current;
    if (!el) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.8 }, scrollTrigger: { trigger: el, start: "top 75%" } });
    tl.fromTo(`.${styles.header} > *`, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, stagger: 0.15 })
      .fromTo(`.${styles.carouselMask}`, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.2 }, "-=0.4");
  }, { scope: sectionRef });

  return (
    <section className={styles.section} ref={sectionRef} aria-labelledby="test-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>تجربه کاربران</span>
          <h2 id="test-title" className={styles.title}>اعتمادی که ساخته‌ایم</h2>
          
          <div className={styles.headerStats}>
            <div className={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} fill={star <= Math.round(stats.avg) ? "currentColor" : "none"} className={styles.headerStar} />
              ))}
            </div>
            <span className={styles.statsText}>
              <strong>{stats.avg.toLocaleString("fa-IR")} از ۵</strong> (بر اساس {stats.total.toLocaleString("fa-IR")} نظر ثبت شده)
            </span>
          </div>
        </div>

        <div className={styles.carouselMask}>
          <div className={styles.columnsContainer}>
            <div className={styles.column}>
              <div className={`${styles.track} ${styles.scrollUp}`}>{col1.map((r, i) => <ReviewCard key={`c1-a-${i}`} review={r} />)}</div>
              <div className={`${styles.track} ${styles.scrollUp}`} aria-hidden="true">{col1.map((r, i) => <ReviewCard key={`c1-b-${i}`} review={r} />)}</div>
            </div>
            <div className={styles.column}>
              <div className={`${styles.track} ${styles.scrollDown}`}>{col2.map((r, i) => <ReviewCard key={`c2-a-${i}`} review={r} />)}</div>
              <div className={`${styles.track} ${styles.scrollDown}`} aria-hidden="true">{col2.map((r, i) => <ReviewCard key={`c2-b-${i}`} review={r} />)}</div>
            </div>
            <div className={styles.column}>
              <div className={`${styles.track} ${styles.scrollUp}`}>{col3.map((r, i) => <ReviewCard key={`c3-a-${i}`} review={r} />)}</div>
              <div className={`${styles.track} ${styles.scrollUp}`} aria-hidden="true">{col3.map((r, i) => <ReviewCard key={`c3-b-${i}`} review={r} />)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}