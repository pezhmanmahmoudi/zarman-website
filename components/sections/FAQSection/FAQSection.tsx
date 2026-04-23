"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./FAQSection.module.css";

const faqs = [
  {
    q: "چگونه می‌توانم نرخ دقیق و کارمزد را پیش از انتقال ببینم؟",
    a: "در بخش محاسبه‌گر صفحه اصلی و همچنین در پنل کاربری، با وارد کردن مبلغ مبدا یا مقصد، نرخ لحظه‌ای و کارمزد دقیق (بدون هیچ هزینه پنهان) به صورت شفاف نمایش داده می‌شود.",
  },
  {
    q: "فرآیند تایید هویت (KYC) چقدر زمان می‌برد؟",
    a: "تایید هویت اولیه برای رعایت قوانین بین‌المللی مبارزه با پولشویی (AML) الزامی است. این فرآیند با بارگذاری مدارک معتبر، معمولاً در کمتر از چند ساعت کاری بررسی و تایید می‌شود.",
  },
  {
    q: "آیا می‌توانم وضعیت تراکنش خود را لحظه‌به‌لحظه پیگیری کنم؟",
    a: "بله، از لحظه ثبت درخواست تا زمان نشستن وجه به حساب مقصد در استرالیا یا ایران، تمامی مراحل به صورت گام‌به‌گام در داشبورد کاربری شما قابل رهگیری است.",
  },
  {
    q: "امنیت اطلاعات بانکی و هویتی من چگونه تامین می‌شود؟",
    a: "زرمان از استانداردهای رمزنگاری ۲۵۶ بیتی بانکی و زیرساخت‌های سرور بسیار امن استفاده می‌کند. اطلاعات هویتی شما صرفاً جهت احراز هویت قانونی استفاده شده و در اختیار هیچ شخص ثالثی قرار نمی‌گیرد.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // اولین مورد پیش‌فرض باز باشد

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>پاسخ به ابهامات شما</p>
          <h2 id="faq-title" className={styles.title}>سوالات متداول</h2>
        </div>

        <div className={styles.faqList}>
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            const panelId = `faq-panel-${index}`;
            return (
              <div
                key={index}
                className={`${styles.faqItem} ${isOpen ? styles.isOpen : ""}`}
              >
                <button
                  className={styles.questionBtn}
                  onClick={() => toggleFAQ(index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <span className={styles.questionText}>{faq.q}</span>
                  <span className={styles.icon} aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                
                <div id={panelId} className={styles.answerWrapper}>
                  <div className={styles.answerInner}>
                    <p className={styles.answerText}>{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
