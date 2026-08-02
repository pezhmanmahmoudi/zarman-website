"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/context/LocaleContext";
import styles from "./Footer.module.css";

export default function Footer() {
  const locale = useLocale();
  const isEn = locale === "en";

  return (
    <footer className={styles.footer} aria-label={isEn ? "Website footer" : "پاورقی سایت"}>
      <div className={styles.container}>
        
        {/* بخش بالایی: برند و معرفی (وسط‌چین) */}
        <div className={styles.brandSection}>
          <Link href="#hero" aria-label={isEn ? "Back to top" : "بازگشت به بالای صفحه"} className={styles.logoLink}>
            <Image
              src="/images/logo-white-text-and-ring.svg"
              alt={isEn ? "Zarman logo" : "لوگوی زرمان"}
              width={220}
              height={100}
              className={styles.logoImg}
            />
          </Link>
          <p className={styles.brandDesc}>
            {isEn
              ? "A comprehensive platform for managing payments and cross-border remittances."
              : "پلتفرم جامع مدیریت پرداخت‌ها و حوالجات ارزی."}
            <br />
            {isEn
              ? "We are here to deliver a seamless, compliant, and worry-free currency experience."
              : "ما اینجاییم تا تجربه‌ای بی‌مرز، قانونمند و آسوده از خدمات ارزی را برای شما رقم بزنیم."}
          </p>
        </div>

        {/* بخش میانی: لینک‌ها (سه ستون وسط‌چین) */}
        <div className={styles.linksGrid}>
          
          {/* ستون اول: دسترسی سریع */}
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>{isEn ? "Quick Access" : "دسترسی سریع"}</h4>
            <ul className={styles.linkList}>
              <li><Link href="#rates">{isEn ? "Rate Calculator" : "ماشین‌حساب نرخ"}</Link></li>
              <li><Link href="#services">{isEn ? "Our Services" : "خدمات ما"}</Link></li>
              <li><Link href="#how-it-works">{isEn ? "How It Works" : "نحوه انتقال"}</Link></li>
              <li><Link href="#faq">{isEn ? "FAQ" : "سوالات متداول"}</Link></li>
            </ul>
          </div>

          {/* ستون دوم: قوانین و مقررات */}
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>{isEn ? "Legal" : "قوانین و مقررات"}</h4>
            <ul className={styles.linkList}>
              <li><Link href={`/${locale}/legal/terms`}>{isEn ? "Terms of Use" : "شرایط و ضوابط استفاده"}</Link></li>
              <li><Link href={`/${locale}/legal/privacy-policy`}>{isEn ? "Privacy Policy" : "حریم خصوصی"}</Link></li>
              <li><Link href={`/${locale}/legal/dvs-notice`}>{isEn ? "Identity Verification Notice (DVS)" : "اطلاعیه تایید هویت (DVS)"}</Link></li>
            </ul>
          </div>

          {/* ستون سوم: ارتباط با ما */}
          <div className={styles.linkCol}>
            <h4 className={styles.colTitle}>{isEn ? "Contact" : "ارتباط با ما"}</h4>
            <ul className={styles.linkList}>
              <li className={styles.contactItem} dir="ltr">
                <span className={styles.contactIcon}>
                  <Image src="/globe.svg" alt="website" width={16} height={16} className={styles.contactSvgIcon} />
                </span>
                www.zarman.com.au
              </li>
              <li className={styles.contactItem} dir="ltr">
                <span className={styles.contactIcon}>
                  {/* Phone icon as inline SVG */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </span>
                +61 497 851 631
              </li>
              <li className={styles.contactItem} dir="ltr">
                info@zarman.com.au
              </li>
            </ul>
          </div>

        </div>

        {/* بخش اطلاعات حقوقی و سلب مسئولیت (جدید) */}
        <div className={styles.legalDisclaimer}>
          <strong>{isEn ? "Legal Information" : "اطلاعات حقوقی"}</strong>
          <p>
            {isEn
              ? "Zarman operates under the legal entity Zarman Exchange Pty Ltd. As a licensed financial institution, we are registered with AUSTRAC under IND100907570. Company registration identifiers: ABN 70 692 742 957 and ACN 692 742 957."
              : "پلتفرم مالی زرمان تحت مالکیت حقوقی Zarman Exchange Pty Ltd فعالیت می‌کند. ما به‌عنوان یک موسسه مالی مجاز، با کد IND100907570 در سازمان اطلاعات مالی استرالیا (AUSTRAC) به ثبت رسیده‌ایم. شماره‌های ثبت تجاری و مالیاتی شرکت عبارتند از: ABN 70 692 742 957 و ACN 692 742 957."}
          </p>
          <p>
            {isEn
              ? "This website provides general information only and does not constitute financial advice. Please assess your personal circumstances before taking action. Continued use of this website indicates full acceptance of Zarman's Terms of Use and Privacy Policy."
              : "اطلاعات این وب‌سایت صرفاً آگاهی‌بخشیِ عمومی است و توصیه مالی تلقی نمی‌شود؛ لذا پیش از هر اقدامی شرایط شخصی خود را بسنجید. تداوم استفاده شما از این وب‌سایت، نشان‌دهنده موافقت کامل با «شرایط و مقررات استفاده» و «خط‌مشی حریم خصوصی» زرمان خواهد بود."}
          </p>
        </div>

        {/* بخش پایینی: کپی‌رایت */}
        <div className={styles.bottom}>
          <div className={styles.copyrightWrapper}>
            <p dir="ltr" className={styles.copyrightEn}>
              &copy; {new Date().getFullYear()} Zarman. {isEn ? "All rights reserved." : "All rights reserved."}
              {<span className={styles.poweredBy}> {isEn ? "Designed by Zarman Team" : "Designed by Zarman Team"}</span> }
            </p>
            
            <p dir="rtl" className={styles.copyrightFa}>
              {isEn
                ? "All intellectual and material rights of this website are reserved for Zarman Platform."
                : "کلیه حقوق مادی و معنوی این وب‌سایت محفوظ و متعلق به پلتفرم زرمان می‌باشد."}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}