"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
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

/* ===== تنظیمات انیمیشن پدیدار شدن (کپی شده از Service) ===== */
const EASE = [0.16, 1, 0.3, 1] as const;

const highlightAnim = {
  initial: { opacity: 0, y: 15, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.85, ease: EASE },
  },
};

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <motion.p 
            className={styles.eyebrow}
            {...highlightAnim}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            پاسخ به ابهامات شما
          </motion.p>
          <motion.h2 
            id="faq-title" 
            className={styles.title}
            {...highlightAnim}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          >
            سوالات متداول
          </motion.h2>
        </div>

        <div className={styles.faqList}>
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={index}
                className={`${styles.faqItem} ${isOpen ? styles.isOpen : ""}`}
                /* اعمال انیمیشن پدیدار شدن سکشن سرویس */
                variants={itemVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: 0.15 + index * 0.1 }}
              >
                <button
                  className={styles.questionBtn}
                  onClick={() => toggleFAQ(index)}
                  aria-expanded={isOpen}
                >
                  <span className={styles.questionText}>{faq.q}</span>
                  <span className={styles.icon} aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className={styles.answerWrapper}
                      style={{ overflow: "hidden" }}
                    >
                      <div className={styles.answerInner}>
                        <p className={styles.answerText}>{faq.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}