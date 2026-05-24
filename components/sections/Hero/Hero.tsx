"use client";

import { useRef, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Button from "@/components/ui/Button/Button";
import { Info } from "lucide-react"; 
import styles from "./Hero.module.css";
import { useRates } from "@/context/RateContext";
import {
  WHATSAPP_NUMBER, 
  buildWhatsAppUrl,
  WHATSAPP_MESSAGE_TRANSFER_HELP,
} from "@/lib/constants/contact";

export default function Hero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { locale } = useParams<{ locale: string }>();
  const { currentRates, isLoading } = useRates();

  const serverSafeUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_TRANSFER_HELP)}`;
  const [whatsappUrl, setWhatsappUrl] = useState(serverSafeUrl);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setWhatsappUrl(buildWhatsAppUrl(WHATSAPP_MESSAGE_TRANSFER_HELP));
  }, []);

  useGSAP(
    () => {

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.to(`.${styles.eyebrow}`, { autoAlpha: 1, y: 0, duration: 0.65 })
        .to(
          `.${styles.rateWidget}`,
          { autoAlpha: 1, x: 0, scale: 1, duration: 1.2 },
          "-=0.5"
        );
    },
    { scope: heroRef, dependencies: [mounted] }
  );

  return (
    <section id="hero" ref={heroRef} className={styles.hero} aria-label="معرفی زرمان">
      <div className={styles.bgBase} aria-hidden="true" />
      <div className={styles.bgGlow} aria-hidden="true" />

      <div className={styles.container}>
        <div className={styles.layout}>
          
          <div className={styles.content}>
            <h1 className={styles.eyebrow}>صرافی زرمان</h1>
            <h2 className={styles.title}>
              از{' '}
              <span className={styles.tooltipWrapper}>
                اولورو
                <Info className={styles.infoIcon} strokeWidth={2.5} />
                <span className={styles.tooltipText}>
                  اولورو (<span className={styles.uluruEnText}>Uluru</span>) صخره‌ایست مقدس و عظیم در قلب استرالیا
                </span>
              </span>
              {' '}تا دماوند
              <br />
              <span className={styles.titleAccent}>تنها در چند ساعت...</span>
            </h2>
            <p className={styles.subtitle}>
              ما تلاش می‌کنیم با تمرکز بر سرعت، شفافیت و پشتیبانی همیشگی، تجربه ثبت و پیگیری درخواست‌های مالی را برای شما آسان‌تر و روشن‌تر کنیم.
            </p>
            
            <div className={styles.actions}>
              <Button href={`/${locale}/register`} variant="primary" size="lg" className={styles.btn}>
                شروع ثبت‌نام
              </Button>
              <Button href={whatsappUrl} variant="secondary" size="lg" className={styles.btn} target="_blank" rel="noopener noreferrer">
                تماس با ما
              </Button>
            </div>

            <div className={styles.meta}>
              <span>سریع</span><span className={styles.dot} />
              <span>شفاف</span><span className={styles.dot} />
              <span>شخصی سازی قیمت</span><span className={styles.dot} />
              <span>قابل اعتماد</span>
            </div>
          </div>

          <div className={styles.visual}>
            <div className={styles.rateWidget} aria-label="نرخ لحظه‌ای ارز">
              <div className={styles.widgetHeader}>
                <span className={styles.pulseDot}></span>
                <span className={styles.status}>
                  {isLoading ? "در حال دریافت..." : "نرخ لحظه‌ای دلار"}
                </span>
              </div>

              <div className={styles.splitCard}>
                <div className={styles.logoSection}>
                  <Image src="/images/logo-no-text-light.svg" alt="Zarman Exchange" width={100} height={100} className={styles.boardLogo} />
                </div>

                <div className={styles.ratesData}>
                  <div className={styles.rateCol}>
                    <span className={styles.label}>فروش دلار استرالیا</span>
                    <strong className={styles.value}>
                      {/* 👈 در اینجا سایزهای خطی به کلاس‌های توکن تغییر کردند */}
                      {isLoading ? (
                        <span style={{ fontSize: 'var(--text-body-md)' }}>در حال دریافت...</span>
                      ) : currentRates.sellAUD ? (
                        <>
                          {currentRates.sellAUD!.toLocaleString("fa-IR")} 
                          <span className={styles.currency}>تومان</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 'var(--text-card-title)', color: 'var(--warning)' }}>تماس بگیرید</span>
                      )}
                    </strong>
                  </div>

                  <div className={styles.rateDivider}></div>

                  <div className={styles.rateCol}>
                    <span className={styles.label}>خرید دلار استرالیا</span>
                    <strong className={styles.value}>
                      {/* 👈 در اینجا سایزهای خطی به کلاس‌های توکن تغییر کردند */}
                      {isLoading ? (
                        <span style={{ fontSize: 'var(--text-body-md)' }}>در حال دریافت...</span>
                      ) : currentRates.buyAUD ? (
                        <>
                          {currentRates.buyAUD!.toLocaleString("fa-IR")} 
                          <span className={styles.currency}>تومان</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 'var(--text-card-title)', color: 'var(--warning)' }}>تماس بگیرید</span>
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}