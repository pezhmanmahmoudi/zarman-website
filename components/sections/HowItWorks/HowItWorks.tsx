"use client";

import styles from "./HowItWorks.module.css";
import Button from "@/components/ui/Button/Button";

const steps = [
  {
    number: "۰۱",
    title: "ثبت دقیق درخواست",
    text: "تعیین مبلغ و ثبت مشخصات گیرنده در بستری یکپارچه و به دور از پیچیدگی‌های معمول.",
  },
  {
    number: "۰۲",
    title: "اعتبارسنجی و قفل نرخ",
    text: "بررسی فوری درخواست توسط کارشناسان و قفل شدن نرخ تبدیل برای تضمین شفافیت مالی.",
  },
  {
    number: "۰۳",
    title: "پردازش و تبادل ایمن",
    text: "انجام تبادل مالی با رعایت بالاترین استانداردهای امنیتی و اعلام دقیق جزئیات واریز.",
  },
  {
    number: "۰۴",
    title: "رهگیری لحظه‌ای",
    text: "امکان رصد گام‌به‌گام وضعیت تراکنش در پنل کاربری تا زمان نشستن وجه به حساب مقصد.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
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

        <div className={styles.stepsWrap}>
          {/* خط اتصال بین مراحل */}
          <div className={styles.connector} aria-hidden="true" />

          <div className={styles.grid}>
            {steps.map((step) => (
              <article key={step.number} className={styles.card}>
                <div className={styles.stepTop}>
                  <span className={styles.number}>{step.number}</span>
                  <span className={styles.dot} aria-hidden="true" />
                </div>

                <h3 className={styles.cardTitle}>{step.title}</h3>
                <p className={styles.cardText}>{step.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.notePanel}>
          <div className={styles.noteContent}>
            <h3 className={styles.noteTitle}>اطمینان در هر تراکنش</h3>
            <p className={styles.noteText}>
              تعهد ما ارائه تجربه‌ای بدون ابهام و فاقد هزینه‌های پنهان است. همین حالا با خیالی آسوده اولین انتقال خود را آغاز کنید.
            </p>
          </div>

          <div className={styles.noteActions}>
            <Button href="/fa/register" variant="primary" size="lg">
              شروع ثبت‌نام
            </Button>
            <Button href="/fa#contact" variant="secondary" size="lg">
              تماس با ما
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}