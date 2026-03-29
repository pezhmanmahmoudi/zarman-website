"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./FirstPage.module.css";
import { isMobile } from "@/lib/isMobile";
import ValuesMob from "../Hero.mob";

export default function Values({ onAllFinished }: { onAllFinished?: () => void }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLDivElement | null>(null);
  const headingContentRef = useRef<HTMLDivElement | null>(null);
  const finalBrandRef = useRef<HTMLDivElement | null>(null);
  const textARef = useRef<HTMLDivElement | null>(null);
  const textBRef = useRef<HTMLDivElement | null>(null);
  const textCRef = useRef<HTMLDivElement | null>(null);
  const textDRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      if (isMobile()) return;

      const section = sectionRef.current;
      const heading = headingRef.current;
      const headingContent = headingContentRef.current;
      const brand = finalBrandRef.current;
      const texts = [textARef.current, textBRef.current, textCRef.current, textDRef.current].filter(Boolean) as HTMLDivElement[];
      const rail = railRef.current;

      if (!section || !heading || !brand || texts.length < 4 || !rail || !headingContent) return;

      const [a, b, c, d] = texts;

      const gap = 16;
      const textHeight = a.getBoundingClientRect().height;

      const aRectInitial = a.getBoundingClientRect();
      const headingRectInitial = heading.getBoundingClientRect();

      const targetATop_Step2 = aRectInitial.top - (textHeight * 0.5);
      const overlap_Step2 = headingRectInitial.bottom - (targetATop_Step2 - gap);

      const h_Y_Step2 = overlap_Step2 > 0 ? -overlap_Step2 : 0;
      const h_Y_Step3 = h_Y_Step2 - textHeight;
      const h_Y_Step4 = h_Y_Step3 - textHeight;
      const h_Y_Step5 = h_Y_Step4 - textHeight;

      const yFromPercent = (el: HTMLElement, percent: number) =>
        (percent / 100) * el.getBoundingClientRect().height;

      gsap.set(brand, { autoAlpha: 0 });
      gsap.set(texts, { x: 0 });
      gsap.set(heading, { autoAlpha: 1, y: 0 });
      gsap.set(headingContent, { yPercent: 105 });

      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
          onAllFinished?.();
        },
      });

      tl.to(headingContent, {
        yPercent: 0,
        duration: 0.9,
        ease: "power3.out",
        delay: 1,
      });

      // ✅ removed filter blur (expensive)
      tl.fromTo(
        a,
        { autoAlpha: 0, y: () => yFromPercent(a, 100) },
        {
          autoAlpha: 1,
          y: () => yFromPercent(a, -50),
          duration: 0.5,
          ease: "expo.out",
        },
        "+=0.4"
      );

      if (h_Y_Step2 !== 0) {
        tl.to(heading, { y: h_Y_Step2, duration: 0.5, ease: "expo.out" }, "<");
      }

      tl.to(
        a,
        { y: () => yFromPercent(a, -150), duration: 0.5, ease: "power4.inOut" },
        "+=0.2"
      );

      tl.to(heading, { y: h_Y_Step3, duration: 0.5, ease: "power4.inOut" }, "<");

      tl.fromTo(
        b,
        { opacity: 0, y: () => yFromPercent(b, 100) },
        { opacity: 1, y: () => yFromPercent(b, -50), duration: 0.5, ease: "power4.inOut" },
        "<"
      );

      tl.to(heading, { y: h_Y_Step4, duration: 0.5, ease: "power4.inOut" }, "+=0.2");
      tl.to(a, { y: () => yFromPercent(a, -250), duration: 0.5, ease: "power4.inOut" }, "<");
      tl.to(b, { y: () => yFromPercent(b, -150), duration: 0.5, ease: "power4.inOut" }, "<");
      tl.fromTo(c, { opacity: 0, y: () => yFromPercent(c, 100) }, { opacity: 1, y: () => yFromPercent(c, -50), duration: 0.5, ease: "power4.inOut" }, "<");

      tl.to(heading, { y: h_Y_Step5, duration: 0.5, ease: "power4.inOut" }, "+=0.2");
      tl.to(a, { y: () => yFromPercent(a, -350), duration: 0.5, ease: "power4.inOut" }, "<");
      tl.to(b, { y: () => yFromPercent(b, -250), duration: 0.5, ease: "power4.inOut" }, "<");
      tl.to(c, { y: () => yFromPercent(c, -150), duration: 0.5, ease: "power4.inOut" }, "<");
      tl.fromTo(d, { opacity: 0, y: () => yFromPercent(d, 100) }, { opacity: 1, y: () => yFromPercent(d, -50), duration: 0.5, ease: "power4.inOut" }, "<");

      tl.to(
        headingContent,
        { yPercent: -105, autoAlpha: 0, duration: 0.7, ease: "power3.in" },
        "+=0.15"
      );

      const alignRightToRail = (el: HTMLElement) => {
        const railRect = rail.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const currentX = (gsap.getProperty(el, "x") as number) || 0;
        const dx = railRect.right - elRect.right;
        return currentX + dx;
      };

      tl.to(
        texts,
        {
          x: (i, target) => alignRightToRail(target as HTMLElement),
          duration: 1.1,
          ease: "expo.inOut",
          stagger: 0.045,
        },
        "<"
      );

      const getCSlidePx = (el: HTMLElement) => {
        const w = el.getBoundingClientRect().width;
        return Math.max(110, Math.min(280, w * 0.2));
      };

      tl.to(
        c,
        {
          x: (i, target) => {
            const el = target as HTMLElement;
            const currentX = (gsap.getProperty(el, "x") as number) || 0;
            return currentX - getCSlidePx(el);
          },
          duration: 1.05,
          ease: "expo.inOut",
        },
        "+=0.32"
      );

      tl.add(() => {
        const sRect = section.getBoundingClientRect();
        const cRect = c.getBoundingClientRect();
        const rRect = rail.getBoundingClientRect();
        gsap.set(brand, {
          top: cRect.top - sRect.top + cRect.height / 2,
          left: rRect.right - sRect.left - 15,
          xPercent: -100,
          yPercent: -50,
        });
      }, "<");

      tl.fromTo(
        brand,
        { autoAlpha: 0, x: 8 },
        { autoAlpha: 1, x: 0, duration: 0.5, ease: "circ.out" },
        "<+=0.5"
      );
    },
    { scope: sectionRef }
  );

  if (isMobile()) return <ValuesMob onAllFinished={onAllFinished} />;

  return (
    <section ref={sectionRef} className={styles.section} style={{ background: "transparent" }}>
      <div ref={headingRef} className={styles.initialHeading}>
        <div className={styles.headingMask}>
          <div ref={headingContentRef} className={styles.headingLine}>
            <h1>صرافی زرمان</h1>
            <h2>ZARMAN EXCHANGE</h2>
          </div>
        </div>
      </div>

      <div className={styles.railContainer} aria-hidden="true">
        <div className={styles.railInner}>
          <div ref={railRef} className={styles.rightRail} />
        </div>
      </div>

      <div ref={finalBrandRef} className={styles.finalBrand}>
        <h1>صرافی زرمان</h1>
        <h2>ZARMAN EXCHANGE</h2>
      </div>

      <div className={styles.stackContainer}>
        <div className={styles.stackInner}>
          <div ref={textARef} className={styles.redText}>بهترین نرخ تبدیل</div>
          <div ref={textBRef} className={styles.redText}>سریعترین حالت ممکن</div>
          <div ref={textCRef} className={styles.redText}>امنیت کامل</div>
          <div ref={textDRef} className={styles.redText}>بالاترین حس رضایت</div>
        </div>
      </div>
    </section>
  );
}
