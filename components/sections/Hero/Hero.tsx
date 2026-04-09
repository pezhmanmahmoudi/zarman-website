"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Button from "@/components/ui/Button/Button";
import { Info } from "lucide-react"; 
import styles from "./Hero.module.css";
import { useRates } from "@/context/RateContext";

export default function Hero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { currentRates, isLoading } = useRates();

  const whatsappNumber = "61497851631"; 
  const whatsappMessage = encodeURIComponent("سلام، من از طریق وب‌سایت زرمان پیام می‌دهم و برای انتقال وجه نیاز به راهنمایی دارم.");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useGSAP(
    () => {
      // اگر صفحه هنوز لود نشده، انیمیشن اجرا نشود
      if (!mounted) return;

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      // انیمیشن‌های ارجینال شما
      tl.fromTo(`.${styles.eyebrow}`, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.65 })
        .fromTo(`.${styles.title}`, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.9 }, "-=0.35")
        .fromTo(`.${styles.subtitle}`, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.75 }, "-=0.5")
        .fromTo(`.${styles.actions}`, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7 }, "-=0.45")
        .fromTo(`.${styles.meta}`, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.45")
        .fromTo(
          `.${styles.rateWidget}`, 
          { autoAlpha: 0, x: -32, scale: 0.96 },
          { autoAlpha: 1, x: 0, scale: 1, duration: 1.2 },
          "-=0.75"
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
            {/* کلاس hiddenOnLoad باعث می‌شود قبل از انیمیشن GSAP چیزی چشمک نزند */}
            <p className={`${styles.eyebrow} ${styles.hiddenOnLoad}`}>صرافی زرمان</p>
            <h1 className={`${styles.title} ${styles.hiddenOnLoad}`}>
              از 
              <span className={styles.tooltipWrapper}>
                اولورو
                <Info size={16} className={styles.infoIcon} strokeWidth={2.5} />
                <span className={styles.tooltipText}>
                  اولورو (<span className={styles.uluruEnText}>Uluru</span>) صخره‌ایست مقدس و عظیم در قلب استرالیا، نماد دیرینه‌ی این سرزمین
                </span>
              </span>
              تا دماوند
              <br />
              <span className={styles.titleAccent}>تنها در چند ساعت...</span>
            </h1>
            <p className={`${styles.subtitle} ${styles.hiddenOnLoad}`}>
              ما تلاش می‌کنیم با تمرکز بر سرعت، شفافیت و پشتیبانی همیشگی، تجربه ثبت و پیگیری درخواست‌های مالی را برای شما آسان‌تر و روشن‌تر کنیم.
            </p>
            
            <div className={`${styles.actions} ${styles.hiddenOnLoad}`}>
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

            <div className={`${styles.meta} ${styles.hiddenOnLoad}`}>
              <span>سریع</span>
              <span className={styles.dot} />
              <span>شفاف</span>
              <span className={styles.dot} />
              <span>شخصی سازی قیمت</span>
              <span className={styles.dot} />
              <span>قابل اعتماد</span>
            </div>
          </div>

          <div className={styles.visual}>
            <div className={`${styles.rateWidget} ${styles.hiddenOnLoad}`} aria-label="نرخ لحظه‌ای ارز">
              
              {/* هدر تابلوی قیمت */}
              <div className={styles.widgetHeader}>
                <span className={styles.pulseDot}></span>
                <span className={styles.status}>
                  {isLoading ? "در حال دریافت..." : "نرخ لحظه‌ای دلار"}
                </span>
              </div>

              <div className={styles.splitCard}>
                
                {/* 👈 قرار دادن لوگو در ابتدا باعث می‌شود در دسکتاپ سمت راست و در موبایل بالا بیفتد */}
                <div className={styles.logoSection}>
                  <Image 
                    src="/images/Logo no text light.svg" 
                    alt="Zarman Exchange"
                    width={100}
                    height={100}
                    className={styles.boardLogo}
                  />
                </div>

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

              </div>
              
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}