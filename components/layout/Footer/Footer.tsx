import React from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer} aria-label="پاورقی سایت">
      <div className={styles.container}>
        <div className={styles.grid}>
          
          {/* ستون اول: برند و معرفی */}
          <div className={styles.brandCol}>
            <Link href="/fa" aria-label="Zarman Exchange — صفحه اصلی" className={styles.logoLink}>
              <Image
                /* مهم: برای فوتر سفید، باید از لوگوی نسخه تیره/رنگی استفاده کنید */
                src="/images/logo-vertical-light-bg.svg" 
                alt="لوگوی زرمان اکسچنج"
                width={200}
                height={120}
                className={styles.logoImg}
              />
            </Link>
            <p className={styles.brandDesc}>
              پلتفرم نوین خدمات ارزی و انتقال سرمایه میان ایران و استرالیا. 
              طراحی شده برای امنیت، شفافیت و سرعت در تک‌تک تراکنش‌های مالی شما.
            </p>
          </div>

          {/* ستون دوم: دسترسی سریع */}
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>دسترسی سریع</h4>
            <ul className={styles.linkList}>
              <li><Link href="#hero">ماشین‌حساب نرخ</Link></li>
              <li><Link href="#services">خدمات ما</Link></li>
              <li><Link href="#how-it-works">نحوه انتقال</Link></li>
              <li><Link href="#faq">سوالات متداول</Link></li>
            </ul>
          </div>

          {/* ستون سوم: قوانین و مقررات */}
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>قوانین و مقررات</h4>
            <ul className={styles.linkList}>
              <li><Link href="/terms">شرایط و ضوابط استفاده</Link></li>
              <li><Link href="/privacy">حریم خصوصی</Link></li>
              <li><Link href="/aml-policy">مبارزه با پولشویی (AML/CTF)</Link></li>
            </ul>
          </div>

          {/* ستون چهارم: ارتباط با ما */}
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>ارتباط با ما</h4>
            <ul className={styles.linkList}>
              <li className={styles.contactItem} dir="ltr">+61 497 851 631</li>
              <li className={styles.contactItem} dir="ltr">info@zarman.com.au</li>
              <li className={styles.contactItemEn} dir="ltr">
                Unit W2608, 108 Donnison St<br />
                Gosford 2250 NSW
              </li>
            </ul>
          </div>

        </div>

        {/* بخش کپی‌رایت پایین */}
        <div className={styles.bottom}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} Zarman Exchange Pty Ltd
            .تمامی حقوق محفوظ است
          </p>
        </div>
      </div>
    </footer>
  );
}