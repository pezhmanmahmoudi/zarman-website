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
          <Link href={`/${locale}`} aria-label={isEn ? "Zarman Exchange home" : "صفحه اصلی صرافی زرمان"} className={styles.logoLink}>
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
            <h2 className={styles.colTitle}>{isEn ? "Quick Access" : "دسترسی سریع"}</h2>
            <ul className={styles.linkList}>
              <li><Link href={`/${locale}#rates`}>{isEn ? "Rate Calculator" : "ماشین‌حساب نرخ"}</Link></li>
              <li><Link href={`/${locale}/services`}>{isEn ? "Our Services" : "خدمات ما"}</Link></li>
              <li><Link href={`/${locale}/about`}>{isEn ? "About Zarman" : "درباره زرمان"}</Link></li>
              <li><Link href={`/${locale}/blog`}>{isEn ? "Transfer Guides" : "راهنما و مقالات حواله"}</Link></li>
              <li><Link href={`/${locale}#how-it-works`}>{isEn ? "How It Works" : "نحوه انتقال"}</Link></li>
              <li><Link href={`/${locale}#faq`}>{isEn ? "FAQ" : "سوالات متداول"}</Link></li>
            </ul>
          </div>

          {/* ستون دوم: قوانین و مقررات */}
          <div className={styles.linkCol}>
            <h2 className={styles.colTitle}>{isEn ? "Legal" : "قوانین و مقررات"}</h2>
            <ul className={styles.linkList}>
              <li><Link href={`/${locale}/legal/terms`}>{isEn ? "Terms of Use" : "شرایط و ضوابط استفاده"}</Link></li>
              <li><Link href={`/${locale}/legal/privacy-policy`}>{isEn ? "Privacy Policy" : "حریم خصوصی"}</Link></li>
              <li><Link href={`/${locale}/legal/dvs-notice`}>{isEn ? "Identity Verification Notice (DVS)" : "اطلاعیه تایید هویت (DVS)"}</Link></li>
            </ul>
          </div>

          {/* ستون سوم: ارتباط با ما */}
          <div className={styles.linkCol}>
            <h2 className={styles.colTitle}>{isEn ? "Contact" : "ارتباط با ما"}</h2>
            <ul className={styles.linkList}>
              <li className={styles.contactItem} dir="ltr">
                <span className={styles.contactIcon}>
                  <Image src="/globe.svg" alt="" width={16} height={16} className={styles.contactSvgIcon} />
                </span>
                <Link href={`/${locale}`}>www.zarman.com.au</Link>
              </li>
              <li className={styles.contactItem} dir="ltr">
                <span className={styles.contactIcon}>
                  {/* Phone icon as inline SVG */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </span>
                <a href="tel:+61497851631">+61 497 851 631</a>
              </li>
              <li className={styles.contactItem} dir="ltr">
                <a href="mailto:info@zarman.com.au">info@zarman.com.au</a>
              </li>
            </ul>
          </div>

        </div>

        {/* بخش اطلاعات حقوقی و سلب مسئولیت (جدید) */}
        <div className={styles.legalDisclaimer}>
          <strong>{isEn ? "Legal Information" : "اطلاعات حقوقی"}</strong>
          <p>
            {isEn
              ? "Zarman is operated by Zarman Exchange Pty Ltd, registered with AUSTRAC under IND100907570. Company identifiers: ABN 70 692 742 957 and ACN 692 742 957. AUSTRAC registration does not constitute an endorsement or a guarantee of a provider's services."
              : "زرمان توسط شرکت Zarman Exchange Pty Ltd اداره می‌شود و با شناسه IND100907570 در AUSTRAC ثبت شده است. شناسه‌های شرکت: ABN 70 692 742 957 و ACN 692 742 957. ثبت در AUSTRAC به معنای تأیید یا تضمین خدمات ارائه‌دهنده نیست."}
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
            
            <p dir={isEn ? "ltr" : "rtl"} className={styles.copyrightFa}>
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
