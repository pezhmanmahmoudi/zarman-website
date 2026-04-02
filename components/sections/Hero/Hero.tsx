"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Button from "@/components/ui/Button/Button";
import { Info } from "lucide-react"; // آیکون ظریف راهنما
import styles from "./Hero.module.css";
// وارد کردن هوک نرخ‌های زنده از دیتاسنتری که دیشب ساختیم
import { useRates } from "@/context/RateContext";

export default function Hero() {
  const heroRef = useRef<HTMLElement | null>(null);

  // دریافت اطلاعات زنده از دیتابیس
  const { currentRates, isLoading } = useRates();

  // تنظیمات واتس‌اپ
  const whatsappNumber = "61497851631"; 
  const whatsappMessage = encodeURIComponent("سلام، من از طریق وب‌سایت زرمان پیام می‌دهم و برای انتقال وجه نیاز به راهنمایی دارم.");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  useGSAP(
    () => {
      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      tl.fromTo(`.${styles.eyebrow}`, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.65 })
        .fromTo(`.${styles.title}`, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.9 }, "-=0.35")
        .fromTo(`.${styles.subtitle}`, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.75 }, "-=0.5")
        .fromTo(`.${styles.actions}`, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7 }, "-=0.45")
        .fromTo(`.${styles.meta}`, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.45")
        
        .fromTo(
          `.${styles.rateWidget}`, // انیمیشن روی کل ویجت جدید اعمال می‌شود
          { autoAlpha: 0, x: -32, scale: 0.96 },
          { autoAlpha: 1, x: 0, scale: 1, duration: 1.2 },
          "-=0.75"
        );
    },
    { scope: heroRef }
  );

  return (
    <section id="hero" ref={heroRef} className={styles.hero} aria-label="معرفی زرمان">
      {/* بک‌گراندها دقیقاً همون کد شماست */}
      <div className={styles.bgBase} aria-hidden="true" />
      <div className={styles.bgGlow} aria-hidden="true" />

      <div className={styles.container}>
        <div className={styles.layout}>
          
          <div className={styles.content}>
            <p className={styles.eyebrow}>صرافی زرمان</p>
            <h1 className={styles.title}>
              از 
              {/* اعمال تول‌تیپ دقیقاً روی کلمه اولورو */}
              <span className={styles.tooltipWrapper}>
                &nbsp;اولورو&nbsp;
                <Info size={16} className={styles.infoIcon} strokeWidth={2.5} />
                
                <span className={styles.tooltipText}>
                  اولورو (<span className={styles.uluruEnText}>Uluru</span>)صخره‌ای مقدس و عظیم در قلب استرالیا، نماد دیرینه‌ی این سرزمین  </span>
              </span>
              تا دماوند
              <br />
              <span className={styles.titleAccent}>تنها در چند ساعت...</span>
            </h1>
            <p className={styles.subtitle}>
              ما تلاش می‌کنیم با تمرکز بر سرعت، شفافیت و پشتیبانی همیشگی، تجربه ثبت و پیگیری درخواست‌های مالی را برای شما آسان‌تر و روشن‌تر کنیم.
            </p>
            
            <div className={styles.actions}>
              <Button href="/fa/register" variant="primary" size="lg" className={styles.btn}>
                شروع ثبت‌نام
              </Button>
              
              <Button 
                href={whatsappUrl} 
                variant="secondary" 
                size="lg" 
                className={styles.btn}
                target="_blank"
                rel="noopener noreferrer"
              >
                تماس با ما
              </Button>
            </div>

            <div className={styles.meta}>
              <span>سریع</span>
              <span className={styles.dot} />
              <span>شفاف</span>
              <span className={styles.dot} />
              <span>شخصی سازی قیمت</span>
              <span className={styles.dot} />
              <span>قابل اعتماد</span>
            </div>
            {/* meta2 که مربوط به توضیح ستاره بود حذف شد چون در تول‌تیپ قرار گرفت */}
          </div>

          <div className={styles.visual}>
            {/* ویجت پرمیوم جدید با ساختار اسپلیت (لوگو چپ، تابلو راست) */}
            <div className={styles.rateWidget} aria-label="نرخ لحظه‌ای ارز">
              
              {/* هدر بالای ویجت */}
              <div className={styles.widgetHeader}>
                <span className={styles.pulseDot}></span>
                <span className={styles.status}>
                  {isLoading ? "در حال دریافت..." : "نرخ لحظه‌ای دلار"}
                </span>
              </div>

              {/* کارت اصلی ترکیبی */}
              <div className={styles.splitCard}>
                
                {/* بخش راست کارت: تابلوی قیمت‌ها */}
                <div className={styles.ratesData}>
                  <div className={styles.rateCol}>
                    <span className={styles.label}>فروش دلار استرالیا</span>
                    <strong className={styles.value}>
                      {isLoading 
                        ? "---" 
                        : currentRates.sellAUD.toLocaleString("fa-IR")} 
                      <span className={styles.currency}>تومان</span>
                    </strong>
                  </div>

                  <div className={styles.rateDivider}></div>

                  <div className={styles.rateCol}>
                    <span className={styles.label}>خرید دلار استرالیا</span>
                    <strong className={styles.value}>
                      {isLoading 
                        ? "---" 
                        : currentRates.buyAUD.toLocaleString("fa-IR")} 
                      <span className={styles.currency}>تومان</span>
                    </strong>
                  </div>
                </div>

                {/* بخش چپ کارت: کانتینر اختصاصی لوگو */}
                <div className={styles.logoSection}>
                  <Image 
                    src="/images/Logo no text light.svg" 
                    alt="Zarman Exchange"
                    width={100}
                    height={100}
                    className={styles.boardLogo}
                  />
                </div>

              </div>
              
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}