"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import styles from "./Cursor.module.css";

type CursorProps = {
  enabled: boolean;
};

const CURRENCIES = ["AUD", "IRR", "USD", "EUR", "GBP", "TRY", "AED", "CAD"];

export default function Cursor({ enabled }: CursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<SVGCircleElement>(null);
  const symbolRef = useRef<HTMLSpanElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  // Math State (Refs only, no re-renders)
  const mouse = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  
  // Logic State
  const progressVal = useRef(0);
  const currencyIndex = useRef(0);
  const lastCurrencyTime = useRef(0);
  const lastProgressTime = useRef(0);

  const R = 34;
  const CIRC = 2 * Math.PI * R;

  const isDesktop = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches &&
    window.innerWidth >= 1024;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // 1. Initial Setup
  useLayoutEffect(() => {
    if (!isDesktop() || !enabled) return;

    // Start center-ish to avoid flying in from 0,0
    const initialX = window.innerWidth * 0.25;
    const initialY = window.innerHeight * 0.5;

    mouse.current = { x: initialX, y: initialY };
    pos.current = { x: initialX, y: initialY };

    if (cursorRef.current) {
      gsap.set(cursorRef.current, { x: initialX - 40, y: initialY - 40, opacity: 1 });
    }

    setMounted(true);
  }, [enabled]);

  // 2. The Single Performance Loop (GSAP Ticker)
  useEffect(() => {
    if (!mounted || !isDesktop()) return;

    const cursor = cursorRef.current;
    const circle = progressRef.current;
    const symbol = symbolRef.current;
    if (!cursor || !circle || !symbol) return;

    // ⚡️ OPTIMIZATION: QuickSetter (Bypasses CSS parsing overhead)
    const xSet = gsap.quickSetter(cursor, "x", "px");
    const ySet = gsap.quickSetter(cursor, "y", "px");

    // Mouse Listener
    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    window.addEventListener("mousemove", onMove);

    // Initial Visual State
    document.body.style.cursor = "none";
    gsap.set(cursor, { autoAlpha: 1, scale: 1 });
    if (glowRef.current) gsap.set(glowRef.current, { opacity: 1, scale: 0.8 });

    circle.style.strokeDasharray = `${CIRC}`;
    circle.style.strokeDashoffset = `${CIRC}`;

    // Ticker Function (Runs ~60fps synced with screen refresh)
    const tick = (time: number, deltaTime: number, frame: number) => {
      // A. Movement Physics (Lerp)
      const dt = 1.0 - Math.pow(1.0 - 0.15, deltaTime / 16); // Frame-rate independent lerp
      pos.current.x += (mouse.current.x - pos.current.x) * dt;
      pos.current.y += (mouse.current.y - pos.current.y) * dt;

      // Apply Transform
      xSet(pos.current.x - 40);
      ySet(pos.current.y - 40);

      if (!enabled) return; // Stop logic if done

      // B. Currency Switcher (Every ~180ms)
      if (time - lastCurrencyTime.current > 0.18) {
        lastCurrencyTime.current = time;
        currencyIndex.current = (currencyIndex.current + 1) % CURRENCIES.length;
        
        symbol.textContent = CURRENCIES[currencyIndex.current];
        
        // Lightweight GSAP animation instead of CSS class removal/void reflow
        gsap.fromTo(symbol, 
          { y: 5, autoAlpha: 0, },
          { y: 0, autoAlpha: 1, filter: "blur(0px)", duration: 0.15, ease: "power2.out", overwrite: true }
        );
      }

      // C. Progress Bar (Every ~70ms)
      if (time - lastProgressTime.current > 0.07) {
        lastProgressTime.current = time;
        progressVal.current = Math.min(progressVal.current + 1, 95);
        const offset = CIRC - (progressVal.current / 100) * CIRC;
        circle.style.strokeDashoffset = `${offset}`;
      }
    };

    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      gsap.ticker.remove(tick);
    };
  }, [mounted, enabled, CIRC]);

  // 3. Finish / Exit Animation
  useEffect(() => {
    if (!mounted || enabled) return; // Only run when enabled flips to false
    
    const cursor = cursorRef.current;
    if (!cursor) return;

    if (symbolRef.current) symbolRef.current.textContent = "READY";
    
    // Smooth exit
    const tl = gsap.timeline({
      onComplete: () => {
        document.body.style.cursor = "auto";
        setMounted(false);
      }
    });

    if (progressRef.current) {
      tl.to(progressRef.current, {
        strokeDashoffset: 0,
        duration: 0.3,
        ease: "power2.out"
      });
    }

    tl.to(cursor, {
      autoAlpha: 0,
      scale: 1.5,
      duration: 0.5,
      ease: "power2.in"
    });

  }, [mounted, enabled]);

  if (!portalReady || !mounted) return null;

  const node = (
    <div ref={cursorRef} className={styles.cursor} style={{ opacity: 0 }}>
      <div className={styles.inner}>
        <div ref={glowRef} className={styles.glow} />
        <svg className={styles.svg} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="34" className={styles.track} />
          <circle ref={progressRef} cx="50" cy="50" r="34" className={styles.progress} />
        </svg>
        <span ref={symbolRef} className={styles.symbol}>AUD</span>
        <div ref={orbitRef} className={styles.orbit}><span /></div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}