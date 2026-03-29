"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./SecondPage.module.css";

export default function SecondPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      const highlight = ".sp_highlight";
      const title = ".sp_title";
      const subtitle = ".sp_subtitle";
      const mouse = ".sp_mouse";

      tl.fromTo(
        highlight,
        { autoAlpha: 0, x: 20 },
        { autoAlpha: 1, x: 0, duration: 0.9, delay: 0.2 }
      );

      tl.fromTo(
        title,
        { autoAlpha: 0, y: 40 },
        { autoAlpha: 1, y: 0, duration: 1.0 },
        "-=0.7"
      );

      tl.fromTo(
        subtitle,
        { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, duration: 1.0 },
        "-=0.8"
      );

      tl.fromTo(
        mouse,
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.9 },
        "-=0.6"
      );

      return () => {
        tl.kill();
      };
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.content}>
        <p className={`${styles.highlightText} sp_highlight`}>صرافی زرمان</p>

        <h1 className={`${styles.title} sp_title`}>کشف امکان های تازه برای انتقال پول</h1>

        <p className={`${styles.subtitle} sp_subtitle`}>
          بهترین نرخ واقعی، شفافیت کامل، بدون کارمزد پنهان
        </p>
      </div>

      <div className={`${styles.mouseScroll} sp_mouse`} aria-hidden="true">
        <div className={styles.mouseWheel} />
      </div>
    </div>
  );
}
