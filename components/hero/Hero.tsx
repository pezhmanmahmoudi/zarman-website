"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import styles from "./Hero.module.css";
import ConverterFa from "./ConverterFa";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function Hero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const blueContentRef = useRef<HTMLDivElement | null>(null);
  const curvePathRef = useRef<SVGPathElement | null>(null);
  const curvePathBackRef = useRef<SVGPathElement | null>(null);
  const whiteLayerRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      // 1. PARALLAX & CURVE (Scrub Logic)
      const maxDepth = 180;
      
      ScrollTrigger.create({
        trigger: heroRef.current,
        start: "top top",
        end: "600px top",
        scrub: 0.2,
        onUpdate: (self) => {
          const progress = self.progress;
          const currentDepth = progress * maxDepth;

          // Update SVG Paths
          if (curvePathRef.current) {
            curvePathRef.current.setAttribute(
              "d",
              `M0,100 L0,0 Q720,${currentDepth} 1440,0 L1440,100 Z`
            );
          }
          if (curvePathBackRef.current) {
            curvePathBackRef.current.setAttribute(
              "d",
              `M0,100 L0,0 Q720,${currentDepth * 0.8} 1440,0 L1440,100 Z`
            );
          }

          // Update Blue Content Parallax
          if (blueContentRef.current) {
            gsap.set(blueContentRef.current, {
              opacity: 1 - progress,
              y: -(progress * 200),
            });
          }
        },
      });

      // 2. HERO CONTENT REVEAL
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(".hero_highlight__reveal", { autoAlpha: 0, x: 20 }, { autoAlpha: 1, x: 0, duration: 0.9, delay: 0.1 });
      tl.fromTo(".hero_title__reveal", { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.0 }, "-=0.7");
      tl.fromTo(".hero_subtitle__reveal", { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1.0 }, "-=0.8");
      tl.fromTo(".hero_mouse__reveal", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9 }, "-=0.6");

      // 3. WHITE LAYER REVEALS
      const whiteTl = gsap.timeline({
        scrollTrigger: {
          trigger: whiteLayerRef.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        },
      });

      whiteTl.fromTo(
        ".hero_visual__reveal",
        { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, duration: 1.0 }
      );

      whiteTl.fromTo(
        ".hero_converter__reveal",
        { autoAlpha: 0, y: 30 },
        { autoAlpha: 1, y: 0, duration: 1.0 },
        "-=0.8"
      );
    },
    { scope: heroRef }
  );


  return (
    <section
      ref={heroRef}
      className={styles.heroMaster}
      aria-label="معرفی زرمان اکسچنج"
    >
      {/* Upper Blue Layer */}
      <div className={styles.blueLayer}>
        {/* Background DNA layers */}
        <div className={styles.bgGrid} aria-hidden="true" />
        <div className={styles.bgVignette} aria-hidden="true" />

        {/* Content */}
        <div ref={blueContentRef} className={styles.blueContent}>
          <p className={`${styles.highlightText} hero_highlight__reveal`}>
            صرافی زرمان
          </p>

          <h1 className={`${styles.title} hero_title__reveal`}>
            کشف امکان های تازه برای انتقال پول
          </h1>

          <p className={`${styles.subtitle} hero_subtitle__reveal`}>
            بهترین نرخ واقعی، شفافیت کامل، بدون کارمزد پنهان
          </p>
        </div>

        {/* Mouse indicator */}
        <div className={`${styles.mouseScroll} hero_mouse__reveal`} aria-hidden="true">
          <div className={styles.mouseWheel} />
        </div>

        {/* Pattern */}
        <div className={styles.pattern} aria-hidden="true" />
      </div>

      {/* Lower White Layer */}
      <div ref={whiteLayerRef} className={styles.whiteLayer}>
        <div className={styles.curveContainer} aria-hidden="true">
          <svg
            className={styles.curveSvg}
            viewBox="0 0 1440 100"
            preserveAspectRatio="none"
          >
            <path
              ref={curvePathBackRef}
              d="M0,100 L0,0 Q720,0 1440,0 L1440,100 Z"
              fill="rgba(255,255,255,0.72)"
            />
            <path
              ref={curvePathRef}
              d="M0,100 L0,0 Q720,0 1440,0 L1440,100 Z"
              fill="#ffffff"
            />
          </svg>
        </div>

        <div className={styles.panelContent}>
          <div className={styles.grid}>
            {/* Visual Column */}
            <div className={styles.colVisual}>
              <div className={`${styles.imgWrapper} hero_visual__reveal`}>
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
      </div>
    </section>
  );
}