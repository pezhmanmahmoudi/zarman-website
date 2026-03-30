"use client";

import React from "react";
// دقت کنید: نام فایل باید دقیقا با این مطابقت داشته باشد
import styles from "./TestimonialSection.module.css";

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

const reviews = [
  {
    name: "علیرضا م.",
    role: "دانشجوی مقطع دکتری",
    text: "پرداخت شهریه دانشگاه همیشه پر از استرس بود، اما با زرمان، هم نرخ شفاف بود و هم دقیقاً در زمان مقرر وجه به حساب دانشگاه نشست. پشتیبانی عالی بود.",
  },
  {
    name: "سارا ت.",
    role: "مهاجر کاری",
    text: "برای انتقال پس‌اندازم به استرالیا وسواس زیادی داشتم. سیستم پیگیری مرحله‌به‌مرحله زرمان باعث شد در تمام طول مسیر خیالم راحت باشد.",
  },
  {
    name: "شرکت بازرگانی آ.",
    role: "مشتری شرکتی (B2B)",
    text: "سرعت در تسویه اینوویس‌ها برای ما حیاتی است. زرمان نه‌تنها نقدینگی لازم را تامین کرد، بلکه فاکتورهای رسمی دقیق برای امور مالیاتی ارائه داد.",
  },
];

export default function TestimonialSection() {
  return (
    <section className={styles.section} aria-labelledby="test-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>تجربه کاربران</span>
          <h2 id="test-title" className={styles.title}>اعتمادی که ساخته‌ایم</h2>
        </div>

        <div className={styles.grid}>
          {reviews.map((review, i) => (
            <figure key={i} className={styles.card}>
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
          ))}
        </div>
      </div>
    </section>
  );
}