"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./About.module.css";
import Button from "@/components/ui/Button/Button";
import { WHATSAPP_MESSAGE_TRANSFER_HELP, buildWhatsAppUrl } from "@/lib/constants/contact";

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

  const whatsappUrl = buildWhatsAppUrl(isEn
    ? "Hello, I found Zarman online and would like help with a money transfer."
    : WHATSAPP_MESSAGE_TRANSFER_HELP);

  return (
    <section id="about" className={styles.about} aria-label={isEn ? "About Zarman" : "درباره زرمان"}>
      <noscript>
        <style>{`#about .${styles.contentArea} > * { opacity: 1 !important; visibility: visible !important; transform: none !important; }`}</style>
      </noscript>
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
                      Zarman Exchange is an Iranian-Australian platform for remittance requests between Australia and Iran. View Australian dollar to toman rates, submit your request and follow its progress, with support in Persian and English.
                      <br /><br />
                      The service is operated by ZARMAN EXCHANGE PTY LTD (ABN 70 692 742 957). Requests are subject to identity verification and transaction review. <Link href="/en/about">Read our business and registration information.</Link>
                    </>
                  ) : (
                    <>
                      صرافی زرمان یک پلتفرم ایرانی–استرالیایی برای ثبت درخواست حواله بین استرالیا و ایران است. نرخ دلار استرالیا به تومان را ببینید، درخواست خود را ثبت کنید و با پشتیبانی فارسی و انگلیسی، مراحل آن را پیگیری کنید.
                      <br /><br />
                      این خدمات توسط شرکت ZARMAN EXCHANGE PTY LTD با شماره ABN 70 692 742 957 ارائه می‌شود. انجام درخواست‌ها منوط به احراز هویت و بررسی تراکنش است. <Link href="/fa/about">اطلاعات شرکت و ثبت ارائه‌دهنده حواله را بخوانید.</Link>
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
