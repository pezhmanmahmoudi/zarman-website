"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import styles from "./FAQSection.module.css";

const faqs = [
  {
    q: "منظور از نرخ شخصی‌سازی‌شده چیست؟",
    a: "زرمان برای قدردانی از همراهی شما، سیستم «نرخ وفاداری» را طراحی کرده است. با ثبت‌نام در زرمان، به ازای هر ۵۰۰۰ دلار تراکنش، اعتبار وفاداری دریافت می‌کنید. این اعتبار در درخواست‌های بعدی باعث بهبود چشمگیر نرخ تبدیل ارز به نفع شما می‌شود. نرخ نهایی و اختصاصی شما همیشه پیش از تایید نهایی سفارش، در پنل کاربری به شما نمایش داده می‌شود.",
  },
  {
    q: "چرا باید احراز هویت (KYC) انجام دهم؟",
    a: "احراز هویت جهت رعایت قوانین مبارزه با پول‌شویی (AML/CTF) از الزامات سازمان اطلاعات مالی استرالیا (AUSTRAC) است. طبق استانداردهای جدید، تنها با وارد کردن مشخصات کارت شناسایی معتبر خود، سیستم در کوتاه‌ترین زمان هویت شما را تایید کرده و می‌توانید بلافاصله تراکنش‌هایتان را آغاز کنید.",
  },
  {
    q: "چگونه می‌توانم به یک صرافی برای انتقال سرمایه خود اعتماد کنم؟",
    a: (
      <span>
        اعتبار یک صرافی رسمی در استرالیا، از طریق داشتن شماره‌های ثبت شرکتی (ABN و ACN) و تاییدیه سازمان اطلاعات مالی استرالیا (AUSTRAC) مشخص می‌شود. زرمان به‌عنوان یک نهاد مالی ثبت‌شده، پیشنهاد می‌کند برای اطمینان خاطر، همواره نام صرافی‌ها را در سامانه رسمی دولت استرالیا از طریق لینک زیر بررسی کنید:{" "}
        <a 
          href="https://online.apps.austrac.gov.au/rsr/" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: "#3b82f6", textDecoration: "underline", direction: "ltr", display: "inline-block" }}
        >
          https://online.apps.austrac.gov.au/rsr/
        </a>
      </span>
    ),
  },
  {
    q: "امنیت اطلاعات بانکی و هویتی من در زرمان چگونه تامین می‌شود؟",
    a: "پلتفرم زرمان از پیشرفته‌ترین پروتکل‌های رمزنگاری داده‌ها و زیرساخت‌های سرور امن برای محافظت از اطلاعات شما استفاده می‌کند. اطلاعات هویتی و بانکی شما منحصراً برای الزامات قانونی احراز هویت پردازش شده و تحت هیچ شرایطی در اختیار اشخاص ثالث قرار نخواهد گرفت.",
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