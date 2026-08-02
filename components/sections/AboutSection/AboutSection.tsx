"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./About.module.css";
import Button from "@/components/ui/Button/Button";
import { WHATSAPP_NUMBER, WHATSAPP_MESSAGE_TRANSFER_HELP, buildWhatsAppUrl } from "@/lib/constants/contact";

const AboutGlobe = dynamic(() => import("./AboutGlobe"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="w-full h-full"
      style={{ minHeight: "400px", backgroundColor: "#080B12" }}
    >
      <span className="sr-only">Loading globe...</span>
    </div>
  ),
});

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.45 } as const;

export default function About() {
  const reduceMotion = useReducedMotion();
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";

  const serverSafeUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_TRANSFER_HELP)}`;
  const [whatsappUrl, setWhatsappUrl] = useState(serverSafeUrl);

  useEffect(() => {
    setWhatsappUrl(buildWhatsAppUrl(WHATSAPP_MESSAGE_TRANSFER_HELP));
  }, []);

  return (
    <section id="about" className={styles.about} aria-label={isEn ? "About Zarman" : "درباره زرمان"}>
      <section className={styles.section}>
        <div className={styles.card}>
          <div className={styles.cardSurface}>
            <div className={styles.borderBeam} />

            <div className={`${styles.layoutGrid} ${isEn ? styles.layoutGridEn : ""}`}>
              <div className={`${styles.contentArea} ${isEn ? styles.contentAreaEn : ""}`}>
                <motion.span
                  className={styles.highlightText}
                  viewport={VIEWPORT}
                  initial={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
                >
                  {isEn ? "About Zarman" : "درباره زرمان"}
                </motion.span>

                <motion.h2
                  className={`${styles.mainTitle} ${isEn ? styles.mainTitleEn : ""}`}
                  viewport={VIEWPORT}
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.0, ease: EASE, delay: 0.28 }}
                >
                  {isEn ? "A Bridge of Trust Between Two Countries" : "پل اعتماد میان دو کشور"}
                </motion.h2>

                <motion.p
                  className={`${styles.bodyText} ${isEn ? styles.bodyTextEn : ""}`}
                  viewport={VIEWPORT}
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.05, ease: EASE, delay: 0.42 }}
               >
                  {isEn ? (
                    <>
                      “Zarman Exchange” is an Iranian-Australian financial startup founded to provide secure, fast, and reliable financial transfer services between Iran and Australia. We understand the challenges of money transfers on this corridor firsthand, and we strive to create a simpler, more transparent, and more trustworthy experience for our community.
                      <br /><br />
                      Zarman is licensed for financial and currency services in Australia under registration number 100907570 and operates under Anti-Money Laundering and Counter-Terrorism Financing (AML/CTF) legislation.
                    </>
                  ) : (
                    <>
                      «صرافی  زرمان» یک استارتاپ مالی ایرانی–استرالیایی است که با هدف ارائه خدمات 
                      امن، سریع و قابل‌اعتماد برای نقل‌ و انتقالات مالی میان ایران و استرالیا 
                      شکل گرفته است. ما با چالش‌ها و دغدغه‌های انتقال پول در این مسیر به‌خوبی 
                      آشنا هستیم و تلاش می‌کنیم تجربه‌ای ساده‌تر، شفاف‌تر و مطمئن‌تر را برای 
                      هموطنان عزیز فراهم کنیم. 
                      <br /><br />
                      زرمان با اخذ مجوز رسمی خدمات مالی و ارزی در استرالیا به شماره 100907570
                      و تحت نظارت قوانین مبارزه با پول‌شویی و تأمین مالی تروریسم فعالیت می‌کند.
                    </>
                  )}
              </motion.p>

              <motion.div
                className={styles.actions}
                viewport={VIEWPORT}
                initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.95, ease: EASE, delay: 0.58 }}
              >
                  <Button href={`/${locale}/register`} variant="primary" size="lg" className={styles.actionBtn}>
                    {isEn ? "Get Started" : "شروع ثبت‌نام"}
                  </Button>
                  
                  <Button 
                    href={whatsappUrl} 
                    variant="ghost" 
                    size="lg" 
                    className={`${styles.actionBtn} ${styles.mobileDarkGhost}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {isEn ? "Contact Us" : "تماس با ما"}
                  </Button>
                </motion.div>
              </div>

              <motion.div
                className={`${styles.globeArea} ${isEn ? styles.globeAreaEn : ""}`}
                viewport={{ once: true, amount: 0.25 }}
                initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: EASE, delay: 0.34 }}
              >
                <div className={`${styles.globeWrapper} ${isEn ? styles.globeWrapperEn : ""}`}>
                  <AboutGlobe />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
