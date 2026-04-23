import React from "react";
import styles from "./FinalCTA.module.css";
import Button from "@/components/ui/Button/Button";
import {
  buildWhatsAppUrl,
  WHATSAPP_MESSAGE_SIGNUP_HELP,
} from "@/lib/constants/contact";

export default function FinalCTA() {
  const whatsappUrl = buildWhatsAppUrl(WHATSAPP_MESSAGE_SIGNUP_HELP);

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
