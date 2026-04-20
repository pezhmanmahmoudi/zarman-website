import React from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer} aria-label="پاورقی سایت">
      <div className={styles.container}>
        
        {/* بخش بالایی: برند و معرفی (وسط‌چین) */}
        <div className={styles.brandSection}>
          <Link href="#hero" aria-label="بازگشت به بالای صفحه" className={styles.logoLink}>
            <Image
              src="/images/logo-white-text-and-ring.svg" /* 👈 آدرس تصویر قبلی شما برگردانده شد */
              alt="لوگوی زرمان اکسچنج"
              width={220}
              height={100}
              className={styles.logoImg}
            />
          </Link>
          <p className={styles.brandDesc}>
            پلتفرم نوین خدمات ارزی و انتقال سرمایه میان ایران و استرالیا. <br />
            طراحی شده برای امنیت، شفافیت و سرعت در تک‌تک تراکنش‌های مالی شما.
          </p>
        </div>

        {/* بخش میانی: لینک‌ها (سه ستون وسط‌چین) */}
        <div className={styles.linksGrid}>
          
          {/* ستون اول: دسترسی سریع */}
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>دسترسی سریع</h4>
            <ul className={styles.linkList}>
              {/* 👈 لینک ماشین حساب تصحیح شد */}
              <li><Link href="#rates">ماشین‌حساب نرخ</Link></li>
              <li><Link href="#services">خدمات ما</Link></li>
              <li><Link href="#how-it-works">نحوه انتقال</Link></li>
              <li><Link href="#faq">سوالات متداول</Link></li>
            </ul>
          </div>

          {/* ستون دوم: قوانین و مقررات */}
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>قوانین و مقررات</h4>
            <ul className={styles.linkList}>
              <li><Link href="/en/legal/terms">شرایط و ضوابط استفاده</Link></li>
              <li><Link href="/en/legal/privacy-policy">حریم خصوصی</Link></li>
              <li><Link href="/en/legal/dvs-notice">اطلاعیه تایید هویت (DVS)</Link></li>
            </ul>
          </div>

          {/* ستون سوم: ارتباط با ما */}
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>ارتباط با ما</h4>
            <ul className={styles.linkList}>
              {/* هر سه خط اکنون از کلاس contactItem استفاده می‌کنند تا کاملاً یک شکل باشند */}
              <li className={styles.contactItem} dir="ltr">
                +61 497 851 631
              </li>
              <li className={styles.contactItem} dir="ltr">
                info@zarman.com.au
              </li>
              <li className={styles.contactItem} dir="ltr">
                Unit 2608, 108 Donnison St<br />
                Gosford 2250 NSW
              </li>
            </ul>
          </div>

        </div>

        {/* بخش پایینی: کپی‌رایت */}
        <div className={styles.bottom}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} Zarman Exchange Pty Ltd.
            <br className={styles.mobileBreak} />
            کلیه حقوق مادی، معنوی و محتوای این وب‌سایت محفوظ و متعلق به صرافی زرمان می‌باشد.
          </p>
        </div>
      </div>
    </footer>
  );
}