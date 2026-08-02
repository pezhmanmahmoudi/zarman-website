"use client";

import { useRef, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Button from "@/components/ui/Button/Button";
import { Info, Clock } from "lucide-react"; 
import styles from "./Hero.module.css";
import { useRates } from "@/context/RateContext";
import {
  WHATSAPP_NUMBER, 
  buildWhatsAppUrl,
  WHATSAPP_MESSAGE_TRANSFER_HELP,
} from "@/lib/constants/contact";
import MessageStrip from "@/components/sections/MessageStrip/MessageStrip";

export default function Hero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";
  const { currentRates, isLoading } = useRates();

  const serverSafeUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_TRANSFER_HELP)}`;
  const [whatsappUrl, setWhatsappUrl] = useState(serverSafeUrl);
  
  // متغیر mounted را همچنان برای جلوگیری از Hydration Error نگه می‌داریم، 
  // اما دیگر آن را به GSAP پاس نمی‌دهیم.
  const [mounted, setMounted] = useState(false);

  const formattedLastUpdated = (() => {
    if (!currentRates.lastUpdated) return null;
    try {
      const d = new Date(currentRates.lastUpdated);
      if (isNaN(d.getTime())) return null;
      
      // فقط استخراج و نمایش تاریخ
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    setMounted(true);
    setWhatsappUrl(buildWhatsAppUrl(WHATSAPP_MESSAGE_TRANSFER_HELP));
  }, []);

  useGSAP(
    () => {
      // استفاده از autoAlpha به جای opacity برای کنترل هوشمند رندر در مرورگر
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.8 } });

      tl.fromTo(`.${styles.eyebrow}`, 
          { autoAlpha: 0, y: 20 }, 
          { autoAlpha: 1, y: 0 }
        )
        .fromTo(`.${styles.title}`, 
          { autoAlpha: 0, y: 25 }, 
          { autoAlpha: 1, y: 0 }, 
          "-=0.6"
        )
        .fromTo(`.${styles.subtitle}`, 
          { autoAlpha: 0, y: 20 }, 
          { autoAlpha: 1, y: 0 }, 
          "-=0.6"
        )
        .fromTo(`.${styles.actions} > *`, 
          { autoAlpha: 0, y: 15 }, 
          { autoAlpha: 1, y: 0, stagger: 0.15 }, 
          "-=0.6"
        )
        .fromTo(`.${styles.stripContainer}`, 
          { autoAlpha: 0, y: 15 }, 
          { autoAlpha: 1, y: 0 }, 
          "-=0.6"
        )
        .fromTo(`.${styles.rateWidget}`, 
          { autoAlpha: 0, x: -20, scale: 0.96 }, 
          { autoAlpha: 1, x: 0, scale: 1, duration: 1.2 }, 
          "-=0.5"
        )
        .fromTo(`.${styles.meta} > span`, 
          { autoAlpha: 0, y: 10 }, 
          { autoAlpha: 1, y: 0, stagger: 0.08 },
          "-=0.6"
        );
    },
    { scope: heroRef } 
  );

  return (
    <section id="hero" ref={heroRef} className={styles.hero} aria-label={isEn ? "Zarman Exchange" : "معرفی زرمان"}>
      <div className={styles.bgBase} aria-hidden="true" />
      <div className={styles.bgGlow} aria-hidden="true" />

      <div className={styles.container}>
        <div className={styles.layout}>
          
          <div className={styles.content}>
            <h1 className={styles.eyebrow}>{isEn ? "Zarman Exchange" : "صرافی زرمان"}</h1>
            {isEn ? (
              <h2 className={styles.title}>
                From{' '}
                <span
                  className={styles.tooltipWrapper}
                  tabIndex={0}
                  aria-label="Uluru is a sacred and massive sandstone monolith in the heart of Australia"
                >
                  <span>Uluru</span>
                  <Info className={styles.infoIcon} strokeWidth={2.5} aria-hidden="true" />
                  <span className={styles.tooltipText}>
                    Uluru is a sacred and massive sandstone monolith in the heart of Australia
                  </span>
                </span>
                <br />
                <span className={styles.titleLineTwo}>to Damavand</span>
                <br />
                <span className={`${styles.titleAccent} ${styles.titleAccentEn}`}>in just a few hours...</span>
              </h2>
            ) : (
              <h2 className={styles.title}>
                از{' '}
                <span
                  className={styles.tooltipWrapper}
                  tabIndex={0}
                  aria-label="اولورو صخره‌ایست مقدس و عظیم در قلب استرالیا"
                >
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
            )}
            <p className={styles.subtitle}>
              {isEn
                ? "We focus on speed, transparency, and round-the-clock support to make your financial transfer requests easier and more straightforward."
                : "ما تلاش می‌کنیم با تمرکز بر سرعت، شفافیت و پشتیبانی همیشگی، تجربه ثبت و پیگیری درخواست‌های مالی را برای شما آسان‌تر و روشن‌تر کنیم."}
            </p>
            
            <div className={styles.actions}>
              <Button href={`/${locale}/register`} variant="primary" size="lg" className={styles.btn}>
                {isEn ? "Get Started" : "شروع ثبت‌نام"}
              </Button>
              <Button href={whatsappUrl} variant="secondary" size="lg" className={styles.btn} target="_blank" rel="noopener noreferrer">
                {isEn ? "Contact Us" : "تماس با ما"}
              </Button>
            </div>

            <div className={styles.meta}>
              {isEn ? (
                <>
                  <span>Fast</span><span className={styles.dot} />
                  <span>Transparent</span><span className={styles.dot} />
                  <span>Personalised Rate</span><span className={styles.dot} />
                  <span>Trusted</span>
                </>
              ) : (
                <>
                  <span>سریع</span><span className={styles.dot} />
                  <span>شفاف</span><span className={styles.dot} />
                  <span>شخصی سازی قیمت</span><span className={styles.dot} />
                  <span>قابل اعتماد</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.stripContainer}>
            <MessageStrip />
          </div>

          <div className={styles.visual}>
            <div className={styles.rateWidget} aria-label={isEn ? "Live exchange rate" : "نرخ لحظه‌ای ارز"}>
              <div className={styles.widgetHeader}>
                <span className={styles.pulseDot}></span>
                <span className={styles.status}>
                  {isLoading
                    ? (isEn ? "Loading..." : "در حال دریافت...")
                    : (isEn ? "Live AUD Rate" : "نرخ لحظه‌ای دلار")}
                </span>
              </div>

              <div className={styles.splitCard}>
                <div className={styles.logoSection}>
                  <Image src="/images/logo-no-text-light.svg" alt="Zarman Exchange" width={100} height={100} style={{ height: 'auto' }} className={styles.boardLogo} />
                </div>

                <div className={styles.ratesData}>
                  <div className={styles.rateCol}>
                    <span className={styles.label}>{isEn ? "Sell AUD" : "فروش دلار استرالیا"}</span>
                    <strong className={styles.value}>
                      {isLoading ? (
                        <span style={{ fontSize: 'var(--text-body-md)' }}>{isEn ? "Loading..." : "در حال دریافت..."}</span>
                      ) : currentRates.sellAUD ? (
                        <>
                          {isEn
                            ? currentRates.sellAUD!.toLocaleString("en-AU")
                            : currentRates.sellAUD!.toLocaleString("fa-IR")}
                          <span className={styles.currency}>{isEn ? "Toman" : "تومان"}</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 'var(--text-card-title)', color: 'var(--warning)' }}>{isEn ? "Contact us" : "تماس بگیرید"}</span>
                      )}
                    </strong>
                  </div>

                  <div className={styles.rateDivider}></div>

                  <div className={styles.rateCol}>
                    <span className={styles.label}>{isEn ? "Buy AUD" : "خرید دلار استرالیا"}</span>
                    <strong className={styles.value}>
                      {isLoading ? (
                        <span style={{ fontSize: 'var(--text-body-md)' }}>{isEn ? "Loading..." : "در حال دریافت..."}</span>
                      ) : currentRates.buyAUD ? (
                        <>
                          {isEn
                            ? currentRates.buyAUD!.toLocaleString("en-AU")
                            : currentRates.buyAUD!.toLocaleString("fa-IR")}
                          <span className={styles.currency}>{isEn ? "Toman" : "تومان"}</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 'var(--text-card-title)', color: 'var(--warning)' }}>{isEn ? "Contact us" : "تماس بگیرید"}</span>
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              {!isLoading && formattedLastUpdated && (
                <div className={styles.lastUpdated} aria-live="polite">
                  <Clock size={13} className={styles.clockIcon} />
                  <span className={styles.lastUpdatedLabel}>{isEn ? "Last updated:" : "آخرین به‌روزرسانی:"}</span>
                  <span className={styles.lastUpdatedTime} dir="ltr">{formattedLastUpdated}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}