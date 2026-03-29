"use client";

import { useEffect, useMemo, useRef } from "react";
import { Gradient } from "./Gradient.js";
import styles from "./HeroRibbon.module.css";

type FlagItem = { code: string; src: string; alt: string };

export default function HeroRibbon() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const FLAGS: FlagItem[] = useMemo(() => [
    { code: "IRR", src: "/images/flags/ir.svg", alt: "پرچم ایران" },
    { code: "AUD", src: "/images/flags/au.svg", alt: "پرچم استرالیا" },
    { code: "EUR", src: "/images/flags/eu.svg", alt: "پرچم اتحادیه اروپا" },
    { code: "USD", src: "/images/flags/us.svg", alt: "پرچم ایالات متحده" },
    { code: "GBP", src: "/images/flags/gb.svg", alt: "پرچم بریتانیا" },
    { code: "CAD", src: "/images/flags/ca.svg", alt: "پرچم کانادا" },
    { code: "AED", src: "/images/flags/ae.svg", alt: "پرچم امارات" },
    { code: "TRY", src: "/images/flags/tr.svg", alt: "پرچم ترکیه" },
    { code: "IRR", src: "/images/flags/ir.svg", alt: "پرچم ایران" },
    { code: "AUD", src: "/images/flags/au.svg", alt: "پرچم استرالیا" },
    { code: "EUR", src: "/images/flags/eu.svg", alt: "پرچم اتحادیه اروپا" },
    { code: "USD", src: "/images/flags/us.svg", alt: "پرچم ایالات متحده" },
    { code: "GBP", src: "/images/flags/gb.svg", alt: "پرچم بریتانیا" },
    { code: "CAD", src: "/images/flags/ca.svg", alt: "پرچم کانادا" },
  ], []);

  useEffect(() => {
    // 1. Initialize Stripe Gradient
    const gradient = new Gradient();
    // @ts-ignore - Using the ID defined in the canvas element below
    gradient.initGradient("#stripe-canvas");

    // 2. Scroll Animation Logic
    const section = sectionRef.current;
    const pill = pillRef.current;
    const track = trackRef.current;
    if (!section || !pill || !track) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let enabled = false;
    let baseY = 0;
    let initialWidth = 0;
    let ticking = false;

    const clamp01 = (v: number) => Math.max(0, Math.min(v, 1));
    const getConfig = () => {
      const isMobile = window.innerWidth <= 768;
      return {
        START_AFTER: isMobile ? 50 : 160,
        MAX_REL: isMobile ? 360 : 520,
        MAX_EXPAND: isMobile ? 240 : 460,
        MAX_MOVE: isMobile ? 240 : 460,
        MAX_ROT: isMobile ? 120 : 180,
      };
    };

    const apply = (rel: number) => {
      const { MAX_REL, MAX_EXPAND, MAX_MOVE, MAX_ROT } = getConfig();
      const p = clamp01(rel / MAX_REL);
      pill.style.width = `${initialWidth + p * MAX_EXPAND}px`;
      track.style.transform = `translate3d(${p * MAX_MOVE}px, 0, 0)`;
      const rot = p * MAX_ROT;
      section.querySelectorAll<HTMLImageElement>(`.${styles.rollingImg}`).forEach((img) => {
        img.style.transform = `rotate(${rot}deg)`;
      });
    };

    const onScroll = () => {
      if (!enabled || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const { START_AFTER } = getConfig();
        apply(window.scrollY - baseY - START_AFTER);
        ticking = false;
      });
    };

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || enabled) continue;
        enabled = true;
        baseY = window.scrollY;
        initialWidth = pill.getBoundingClientRect().width;
        window.addEventListener("scroll", onScroll, { passive: true });
      }
    }, { threshold: 0.15 });

    io.observe(section);

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
      // Clean up gradient if your JS version supports it, otherwise it stays in memory
    };
  }, []);

  return (
    <div ref={sectionRef} className={styles.ribbonWrapper} aria-label="ارزهای مورد حمایت">
      {/* ADDED CANVAS HERE */}
      <canvas id="stripe-canvas" className={styles.gradientCanvas} data-js-darken-top />
      
      <div ref={pillRef} className={styles.brandPill} aria-hidden="true">
        <div className={styles.arrowCircle}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>

      <div ref={trackRef} className={styles.ribbonTrack}>
        {FLAGS.map((f, i) => (
          <div key={`${f.code}-${i}`} className={styles.flagCircle} title={f.code}>
            <img src={f.src} alt={f.alt} className={styles.rollingImg} draggable={false} loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}