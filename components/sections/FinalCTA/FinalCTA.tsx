"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import styles from "./FinalCTA.module.css";
import Button from "@/components/ui/Button/Button";
import {
  WHATSAPP_NUMBER,
  buildWhatsAppUrl,
  WHATSAPP_MESSAGE_SIGNUP_HELP,
} from "@/lib/constants/contact";

export default function FinalCTA() {
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";
  const serverSafeUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_SIGNUP_HELP)}`;
  const [whatsappUrl, setWhatsappUrl] = useState(serverSafeUrl);

  useEffect(() => {
    setWhatsappUrl(buildWhatsAppUrl(WHATSAPP_MESSAGE_SIGNUP_HELP));
  }, []);

  return (
    <section id="contact" className={styles.section} aria-label={isEn ? "Final sign up" : "ثبت نام نهایی"}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.glowBg} aria-hidden="true" />
          <div className={styles.header}>
            <h2 className={styles.title}>
              {isEn ? "Financial management — borderless, worry-free." : "مدیریت مالی؛ بدون مرز، بدون دغدغه."}
            </h2>
            <p className={styles.subtitle}>
              {isEn
                ? "Forget complex traditional processes. Take full control of your currency transactions in one integrated ecosystem — right now."
                : "فرآیندهای پیچیده‌ی سنتی را فراموش کنید. همین حالا کنترل کامل تراکنش‌های ارزی خود را در یک اکوسیستم یکپارچه به دست بگیرید."}
            </p>
            <div className={styles.actions}>
              <Button href={`/${locale}/register`} variant="primary" size="lg">
                {isEn ? "Create Account" : "ایجاد حساب کاربری"}
              </Button>
              <Button 
                href={whatsappUrl} 
                variant="secondary" 
                size="lg"
                target="_blank" 
                rel="noopener noreferrer"
              >
                {isEn ? "I need consultation" : "نیاز به مشاوره دارم"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}