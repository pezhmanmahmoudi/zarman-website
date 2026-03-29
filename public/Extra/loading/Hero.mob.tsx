"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import mob from "./Hero.mob.module.css";
// 1. Import the SecondPage component
import SecondPage from "./pages/SecondPage";

const PERSIAN_VALUES = [
  "بهترین نرخ تبدیل",
  "سریعترین حالت ممکن",
  "امنیت کامل",
  "بالاترین حس رضایت",
];

export default function ValuesMob({
  onAllFinished,
}: {
  onAllFinished?: () => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const brandRef = useRef<HTMLDivElement | null>(null);
  const brandLineRefs = useRef<(HTMLSpanElement | null)[]>([]); 
  const placeholderRef = useRef<HTMLDivElement>(null);
  const secondPageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const lines = lineRefs.current.filter(Boolean) as HTMLDivElement[];
      const brand = brandRef.current;
      const brandLines = brandLineRefs.current.filter(Boolean) as HTMLSpanElement[];
      const lineC = lines[2]; 

      if (!section || lines.length < 4 || !brand || !lineC) return;

      const getBrandTopCenteredOnLine = (
        sectionEl: HTMLElement,
        lineEl: HTMLElement,
        brandEl: HTMLElement
      ) => {
        const sRect = sectionEl.getBoundingClientRect();
        const lRect = lineEl.getBoundingClientRect();
        const bRect = brandEl.getBoundingClientRect();
        const lineCenterY = lRect.top - sRect.top + lRect.height / 2;
        return lineCenterY - bRect.height / 2;
      };

      // --- INITIAL STATE ---
      gsap.set(lines, {
        autoAlpha: 0,
        yPercent: 100,
        willChange: "transform, opacity",
      });

      gsap.set(brandLines, {
        autoAlpha: 0,
        xPercent: 100,
        willChange: "transform, opacity",
      });

      // We animate the wrapper (secondPageRef), so the SecondPage component inside
      // will fade in and move up automatically.
      gsap.set([placeholderRef.current, secondPageRef.current], {
        autoAlpha: 0,
        y: 16,
        filter: "blur(8px)",
      });

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          gsap.to([placeholderRef.current, secondPageRef.current], {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.9,
            stagger: 0.18,
          });
          onAllFinished?.();
        },
      });

      tl.delay(1);

      // 1. Reveal Persian Stack
      tl.to(lines, {
        autoAlpha: 1,
        yPercent: 0,
        duration: 0.7,
        stagger: 0.18,
      });

      // 2. Slide Line C
      tl.to(lineC, {
        x: () => {
          const brandWidth = brand.getBoundingClientRect().width;
          const safeBrandWidth = brandWidth > 0 ? brandWidth : 120;
          const buffer = 0; 
          return -(safeBrandWidth + buffer);
        },
        duration: 1.15,
        ease: "expo.inOut",
      }, "+=0.25");

      // 3. Position the Brand container
      tl.add(() => {
        gsap.set(brand, {
          top: getBrandTopCenteredOnLine(section, lineC, brand),
          right: 0, 
          opacity: 1, 
        });
      }, "<");

      // 4. Reveal Brand Lines
      tl.to(brandLines, {
        autoAlpha: 1,
        xPercent: 0,
        duration: 0.8,
        stagger: 0.1,
      }, "<+=0.3");
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className={mob.mobSection} dir="rtl">
      <div className={mob.mobIntroArea}>
        <div className={mob.mobTopWrap}>
          <div className={mob.mobStack}>
            {PERSIAN_VALUES.map((val, i) => (
              <div key={i} className={mob.lineMask}>
                <div
                  ref={(el) => { lineRefs.current[i] = el; }}
                  className={mob.mobLine}
                >
                  {val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- BRAND NAME --- */}
        <div ref={brandRef} className={mob.mobBrand} style={{ opacity: 0 }}>
          <h1 className={mob.brandFa}>
            <div className={mob.brandMask}>
              <span ref={(el) => { brandLineRefs.current[0] = el; }}>صرافی</span>
            </div>
            <div className={mob.brandMask}>
              <span ref={(el) => { brandLineRefs.current[1] = el; }}>زرمان</span>
            </div>
          </h1>
          <h2 className={mob.brandEn}>
            <div className={mob.brandMask}>
              <span ref={(el) => { brandLineRefs.current[2] = el; }}>ZARMAN</span>
            </div>
            <div className={mob.brandMask}>
              <span ref={(el) => { brandLineRefs.current[3] = el; }}>EXCHANGE</span>
            </div>
          </h2>
        </div>

        <div ref={placeholderRef} className={mob.placeholderWrapper}>
          <div className={mob.placeholderBox}>Z</div>
        </div>
      </div>

      {/* --- SECOND PAGE LINKED HERE --- */}
      {/* We keep the wrapper ref so GSAP can animate the entrance */}
      <div ref={secondPageRef} className={mob.secondPageWrapper}>
         <SecondPage />
      </div>
    </section>
  );
}