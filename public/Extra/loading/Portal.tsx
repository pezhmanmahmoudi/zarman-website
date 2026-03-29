"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";

import styles from "./Portal.module.css";
import Background from "./Background";
import FirstPage from "@/components/loading/pages/FirstPage";
import HeroMob from "@/components/loading/Hero.mob";
import SecondPage from "./pages/SecondPage";
import { isMobile } from "@/lib/isMobile";
import Cursor from "@/components/loading/Cursor";

gsap.registerPlugin(ScrollTrigger);

export default function HeroPortal({ onReady }: { onReady?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const placeholderWrapRef = useRef<HTMLDivElement>(null);

  const [hasMounted, setHasMounted] = useState(false);
  const [mobileView, setMobileView] = useState(false);
  const [canScroll, setCanScroll] = useState(false);

  const lenis = useLenis();

  useEffect(() => {
    setHasMounted(true);
    const checkMobile = () => {
      setMobileView(isMobile() || window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;

    if (mobileView) {
      lenis?.start();
      document.body.style.overflow = "auto";
      return;
    }

    if (!canScroll) {
      lenis?.stop();
      document.body.style.overflow = "hidden";
    } else {
      lenis?.start();
      document.body.style.overflow = "auto";
    }
  }, [canScroll, lenis, mobileView, hasMounted]);

  // ✅ ensure we only flip canScroll once
  const didEnableScrollRef = useRef(false);
  const handleValuesFinished = useCallback(() => {
    if (didEnableScrollRef.current) return;
    didEnableScrollRef.current = true;
    setCanScroll(true);
    onReady?.();
  }, [onReady]);

  // Fade-in placeholder (remove blur - heavy during pin/scroll)
  useGSAP(
    () => {
      if (!hasMounted || mobileView) return;

      gsap.set(placeholderWrapRef.current, { autoAlpha: 0 });

      if (!canScroll) return;

      gsap.to(placeholderWrapRef.current, {
        autoAlpha: 1,
        duration: 0.6,
        ease: "power2.out",
      });
    },
    { dependencies: [canScroll, mobileView, hasMounted] }
  );

  /**
   * Smooth Horizontal + Snap (structure preserved)
   */
  useGSAP(
    () => {
      if (!hasMounted || mobileView || !canScroll) return;

      const page1 = page1Ref.current;
      const page2 = page2Ref.current;
      const container = containerRef.current;

      if (!page1 || !page2 || !container) return;

      const END = 2000;
      const SNAP_THRESHOLD = 0.8;
      const LOCK_PROGRESS = 1;

      // promote only the moving layers
      gsap.set([page1, page2], { force3D: true });
      gsap.set(page1, { xPercent: 0 });
      gsap.set(page2, { xPercent: -100, visibility: "visible" });

      let locked = false;
      let armed = false;

      const onWheel = (e: WheelEvent) => {
        if (!locked) return;
        const intent = Math.abs(e.deltaY) > 18;
        if (!intent) return;

        if (!armed) {
          armed = true;
          return;
        }

        locked = false;
        armed = false;
      };

      window.addEventListener("wheel", onWheel, { passive: true });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: `+=${END}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          snap: {
            snapTo: (value) => {
              if (value >= SNAP_THRESHOLD) return LOCK_PROGRESS;
              return 0;
            },
            duration: { min: 0.18, max: 0.32 },
            delay: 0,
            ease: "power3.out",
            inertia: false,
          },
          onUpdate: (self) => {
            if (self.progress >= LOCK_PROGRESS && !locked) {
              locked = true;
              armed = false;
            }
            if (locked && self.progress < LOCK_PROGRESS) {
              locked = false;
              armed = false;
            }
          },
        },
      });

      tl.to(page1, { xPercent: 100 }, 0);
      tl.to(page2, { xPercent: 0 }, 0);

      return () => {
        window.removeEventListener("wheel", onWheel);
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
    { dependencies: [canScroll, mobileView, hasMounted], scope: containerRef }
  );

  if (!hasMounted) return <div className={styles.viewport}><Background /></div>;

  const viewportClassName = [
    mobileView ? styles.mobileViewport : styles.viewport,
    !mobileView && !canScroll ? styles.viewportLoading : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className={viewportClassName}>
      <Background />

      {!mobileView && <Cursor enabled={!canScroll} />}

      {mobileView ? (
        <main className={styles.mobileViewport}>
          <HeroMob onAllFinished={handleValuesFinished} />
        </main>
      ) : (
        <>
          <div ref={page1Ref} className={styles.pageLayer} style={{ zIndex: 5 }}>
            <div ref={placeholderWrapRef} className={styles.leftSideElement}>
              <div className={styles.placeholderBox}>Z</div>
            </div>
            <FirstPage onAllFinished={handleValuesFinished} />
          </div>

          <div
            ref={page2Ref}
            className={styles.pageLayer}
            style={{ zIndex: 10, visibility: "hidden" }}
          >
            <SecondPage />
          </div>
        </>
      )}
    </div>
  );
}
