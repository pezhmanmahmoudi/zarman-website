"use client";

import React, { useState, useEffect } from "react";
import styles from "./FinalCTA.module.css";
import Button from "@/components/ui/Button/Button";
import {
  WHATSAPP_NUMBER,
  buildWhatsAppUrl,
  WHATSAPP_MESSAGE_SIGNUP_HELP,
} from "@/lib/constants/contact";

export default function FinalCTA() {
  // ۱. مقدار اولیه امن برای رندر سرور (SSR) تا ارور Hydration نگیریم
  const serverSafeUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_SIGNUP_HELP)}`;
  const [whatsappUrl, setWhatsappUrl] = useState(serverSafeUrl);

  // ۲. آپدیت شدن لینک بر اساس دستگاه کاربر، بلافاصله پس از لود شدن در مرورگر
  useEffect(() => {
    setWhatsappUrl(buildWhatsAppUrl(WHATSAPP_MESSAGE_SIGNUP_HELP));
  }, []);

  return (
    <section id="contact" className={styles.section} aria-label="ثبت نام نهایی">
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.glowBg} aria-hidden="true" />
          
          <div className={styles.content}>
            <h2 className={styles.title}>آماده‌اید تا تجربه مالی متفاوتی داشته باشید؟</h2>
            <p className={styles.subtitle}>
              همین حالا حساب کاربری خود را بسازید و اولین انتقال خود را با امنیت، سرعت و شفافیت کامل انجام دهید.
            </p>
            <div className={styles.actions}>
              <Button href="/fa/register" variant="primary" size="lg">
                ایجاد حساب کاربری
              </Button>
              
              <Button 
                href={whatsappUrl} 
                variant="secondary" 
                size="lg"
                target="_blank" 
                rel="noopener noreferrer"
              >
                نیاز به مشاوره دارم
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}