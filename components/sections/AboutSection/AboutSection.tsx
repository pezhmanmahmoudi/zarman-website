"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./About.module.css";
import Button from "@/components/ui/Button/Button";
import {
  buildWhatsAppUrl,
  WHATSAPP_MESSAGE_TRANSFER_HELP,
} from "@/lib/constants/contact";

const AboutGlobe = dynamic(() => import("./AboutGlobe"), {
  ssr: false,
  loading: () => <div style={{ height: "400px", opacity: 0.1 }} />,
});

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEWPORT = { once: true, amount: 0.45 } as const;

export default function About() {
  const reduceMotion = useReducedMotion();

  const whatsappUrl = buildWhatsAppUrl(WHATSAPP_MESSAGE_TRANSFER_HELP);

  return (
    <section id="about" className={styles.about} aria-label="درباره زرمان">
      <section className={styles.section}>
        <div className={styles.card}>
          <div className={styles.cardSurface}>
            <div className={styles.borderBeam} />

            <div className={styles.layoutGrid}>
              <div className={styles.contentArea}>
                <motion.span
                  className={styles.highlightText}
                  viewport={VIEWPORT}
                  initial={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
                >
                  درباره زرمان
                </motion.span>

                <motion.h2
                  className={styles.mainTitle}
                  viewport={VIEWPORT}
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.0, ease: EASE, delay: 0.28 }}
                >
                  انتقال پول بین ایران و استرالیا
                </motion.h2>

                <motion.p
                  className={styles.bodyText}
                  viewport={VIEWPORT}
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.05, ease: EASE, delay: 0.42 }}
                >
                  زرمان پلتفرمی مدرن است که با هدف ساده‌سازی فرآیند انتقال ارز برای ایرانیان
                  مقیم استرالیا طراحی شده است.
                </motion.p>

                <motion.div
                  className={styles.actions}
                  viewport={VIEWPORT}
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.95, ease: EASE, delay: 0.58 }}
                >
                  <Button href="/fa/register" variant="primary" size="lg" className={styles.actionBtn}>
                    شروع ثبت‌نام
                  </Button>
                  
                  {/* 👇 دکمه تماس با ما به واتس‌اپ متصل شد */}
                  <Button 
                    href={whatsappUrl} 
                    variant="ghost" 
                    size="lg" 
                    className={`${styles.actionBtn} ${styles.mobileDarkGhost}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    تماس با ما
                  </Button>
                </motion.div>
              </div>

              <motion.div
                className={styles.globeArea}
                viewport={{ once: true, amount: 0.25 }}
                initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: EASE, delay: 0.34 }}
              >
                <div className={styles.globeWrapper}>
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
