"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import styles from "./FAQSection.module.css";

const faqsFa = [
  {
    q: "بهترین نرخ دلار استرالیا را از کجا بگیرم؟",
    a: "بهترین نرخ دلار استرالیا (AUD) در زرمان بر اساس یک سیستم هوشمند و در قالب «نرخ وفاداری» محاسبه می‌شود. در این مکانیزم، با افزایش حجم حواله‌های شما، نرخ اختصاصی بهتری اعمال خواهد شد. شما می‌توانید قیمت دلار استرالیا امروز را در ماشین‌حساب صفحه اصلی مشاهده کنید؛ اما به یاد داشته باشید که با ثبت تراکنش‌های مداوم، این نرخ به صورت خودکار بهبود یافته و به یک قیمت کاملاً شخصی سازی شده و رقابتی تبدیل می‌شود.",
  },
  {
    q: "حواله دلار بین استرالیا و ایران چگونه کار می‌کند؟",
    a: "حواله دلار استرالیا در زرمان به دلیل محدودیت‌های انتقال مستقیم، از طریق یک سیستم ایمن و یکپارچه به نام تسویه آفست (Offset Settlement) انجام می‌شود. در این روش، شما معادل ریالی یا دلاری وجه را به حساب‌های داخلی زرمان در ایران یا استرالیا واریز می‌کنید و سیستم تهاتر ما، مبلغ را در سوی دیگر کریدور به حساب مقصد منتقل می‌کند. این فرآیند کاملاً قانونی، سریع و شفاف بوده و منطبق بر استانداردهای صرافی‌های ثبت‌شده نزد AUSTRAC است.",
  },
  {
    q: "قیمت دلار استرالیا امروز چقدر است؟",
    a: "قیمت دلار استرالیا (AUD) نسبت به تومان (IRT) به صورت لحظه‌ای در بخش ماشین‌حساب زرمان در دسترس است. برای خرید و فروش دلار استرالیا با بهترین نرخ روز، کافی است مراحل ثبت‌نام و احراز هویت اولیه را در پلتفرم تکمیل کنید. پس از ورود به پنل کاربری، امکان ثبت درخواست، رصد نوسانات بازار و مدیریت حواله‌ها در بستری هوشمند برای شما فراهم خواهد بود تا بتوانید بهترین زمان را برای انتقال سرمایه خود انتخاب کنید.",
  },
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

const faqsEn = [
  {
    q: "Where can I get the best AUD exchange rate?",
    a: "The best Australian Dollar (AUD) rate at Zarman is calculated using a smart loyalty system. As your transaction volume grows, your personalised rate improves automatically. You can check today's live AUD rate in the calculator on our homepage — and with regular transactions, it keeps getting better.",
  },
  {
    q: "How does AUD remittance between Australia and Iran work?",
    a: "Due to direct transfer restrictions, Zarman processes AUD remittances through a secure, integrated Offset Settlement system. You deposit the equivalent amount into Zarman's domestic accounts in Australia or Iran, and our settlement system transfers the funds to the recipient's account on the other corridor. This process is fully legal, fast, transparent, and compliant with AUSTRAC-registered exchange standards.",
  },
  {
    q: "What is today's AUD price?",
    a: "The live AUD to Toman (IRT) rate is available at any time in Zarman's calculator. To buy or sell AUD at the best rate, simply complete registration and initial identity verification on the platform. Once you log into your user panel, you can submit requests, monitor market fluctuations, and manage remittances in a smart environment.",
  },
  {
    q: "What is a personalised rate?",
    a: "Zarman's Loyalty Rate system rewards your continued use. For every $5,000 in transactions, you earn loyalty credit. This credit significantly improves your exchange rate on future requests. Your final personalised rate is always displayed in your user panel before you confirm an order.",
  },
  {
    q: "Why do I need to complete identity verification (KYC)?",
    a: "Identity verification is required by AUSTRAC (Australia's financial intelligence agency) as part of Anti-Money Laundering and Counter-Terrorism Financing (AML/CTF) regulations. Simply enter your valid ID details and the system will verify your identity in the shortest possible time, allowing you to start transacting immediately.",
  },
  {
    q: "How can I trust an exchange service with my money?",
    a: (
      <span>
        A legitimate Australian exchange is identified by its registered company numbers (ABN and ACN) and AUSTRAC registration. As a registered financial entity, Zarman recommends always verifying exchange services on the official Australian government registry:{" "}
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
    q: "How does Zarman protect my banking and personal information?",
    a: "The Zarman platform uses advanced data encryption protocols and secure server infrastructure to protect your information. Your identity and banking data are processed solely for legal identity verification requirements and will never be shared with third parties under any circumstances.",
  },
];

/* ===== Animation config ===== */
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
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";
  const faqs = isEn ? faqsEn : faqsFa;

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
            {isEn ? "Your Questions Answered" : "پاسخ به ابهامات شما"}
          </motion.p>
          <motion.h2 
            id="faq-title" 
            className={styles.title}
            {...highlightAnim}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          >
            {isEn ? "Frequently Asked Questions" : "سوالات متداول"}
          </motion.h2>
        </div>

        <div className={styles.faqList}>
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={index}
                className={`${styles.faqItem} ${isOpen ? styles.isOpen : ""}`}
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

const faqs = [
    {
    q: "بهترین نرخ دلار استرالیا را از کجا بگیرم؟",
    a: "بهترین نرخ دلار استرالیا (AUD) در زرمان بر اساس یک سیستم هوشمند و در قالب «نرخ وفاداری» محاسبه می‌شود. در این مکانیزم، با افزایش حجم حواله‌های شما، نرخ اختصاصی بهتری اعمال خواهد شد. شما می‌توانید قیمت دلار استرالیا امروز را در ماشین‌حساب صفحه اصلی مشاهده کنید؛ اما به یاد داشته باشید که با ثبت تراکنش‌های مداوم، این نرخ به صورت خودکار بهبود یافته و به یک قیمت کاملاً شخصی سازی شده و رقابتی تبدیل می‌شود.",
  },
  {
    q: "حواله دلار بین استرالیا و ایران چگونه کار می‌کند؟",
    a: "حواله دلار استرالیا در زرمان به دلیل محدودیت‌های انتقال مستقیم، از طریق یک سیستم ایمن و یکپارچه به نام تسویه آفست (Offset Settlement) انجام می‌شود. در این روش، شما معادل ریالی یا دلاری وجه را به حساب‌های داخلی زرمان در ایران یا استرالیا واریز می‌کنید و سیستم تهاتر ما، مبلغ را در سوی دیگر کریدور به حساب مقصد منتقل می‌کند. این فرآیند کاملاً قانونی، سریع و شفاف بوده و منطبق بر استانداردهای صرافی‌های ثبت‌شده نزد AUSTRAC است.",
  },
  {
    q: "قیمت دلار استرالیا امروز چقدر است؟",
    a: "قیمت دلار استرالیا (AUD) نسبت به تومان (IRT) به صورت لحظه‌ای در بخش ماشین‌حساب زرمان در دسترس است. برای خرید و فروش دلار استرالیا با بهترین نرخ روز، کافی است مراحل ثبت‌نام و احراز هویت اولیه را در پلتفرم تکمیل کنید. پس از ورود به پنل کاربری، امکان ثبت درخواست، رصد نوسانات بازار و مدیریت حواله‌ها در بستری هوشمند برای شما فراهم خواهد بود تا بتوانید بهترین زمان را برای انتقال سرمایه خود انتخاب کنید.",
  },
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
