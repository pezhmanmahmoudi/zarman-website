"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import styles from "./Hero.module.css";

import ConverterFa from "./ConverterFa";
import USDPriceChart from "./PriceChart";

gsap.registerPlugin(ScrollTrigger);

export default function Hero() {
  const containerRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      // ✅ cheap, transform-only reveal
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 65%",
          once: true, // ⬅️ مهم: فقط یک بار اجرا شود
        },
      });

      tl.fromTo(
        ".hero_visual__reveal",
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }
      );

      tl.fromTo(
        ".hero_converter__reveal",
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" },
        "-=0.5"
      );
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      className={styles.heroMaster}
      aria-label="تبدیل ارز و خدمات"
    >
      <div className={styles.contentContainer}>
        <div className={styles.grid}>
          {/* Visual Column (Chart) */}
          <div className={styles.colVisual}>
            <div className={`${styles.imgWrapper} hero_visual__reveal`}>
              <USDPriceChart />
            </div>
          </div>

          {/* Converter Column */}
          <div className={styles.colConverter}>
            <div className="hero_converter__reveal">
              <ConverterFa />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
