"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Shield,
  Zap,
  Star,
  Percent,
  Lock,
  Users,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { STRIP_MESSAGES } from "./messages";
import type { StripIconType } from "./messages";
import styles from "./MessageStrip.module.css";

// ─── Icon registry ─────────────────────────────────────────────────────────
type IconProps = { size?: number; strokeWidth?: number };
const ICON_MAP: Record<StripIconType, React.ComponentType<IconProps>> = {
  shield: Shield,
  zap: Zap,
  star: Star,
  percent: Percent,
  lock: Lock,
  users: Users,
  check: Check,
};

const INTERVAL_MS = 5500;

export default function MessageStrip() {
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const touchStartX = useRef<number | null>(null);
  const count = STRIP_MESSAGES.length;

  const goTo = useCallback((index: number) => {
    setActive(index);
    setAnimKey((k) => k + 1);
  }, []);

  const next = useCallback(
    () => goTo((active + 1) % count),
    [active, count, goTo]
  );
  const prev = useCallback(
    () => goTo((active - 1 + count) % count),
    [active, count, goTo]
  );

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(next, INTERVAL_MS);
    return () => clearTimeout(t);
  }, [active, paused, next]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) delta > 0 ? prev() : next();
    touchStartX.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") isEn ? prev() : next();
    if (e.key === "ArrowRight") isEn ? next() : prev();
  };

  const msg = STRIP_MESSAGES[active];
  const text = isEn ? msg.en : msg.fa;
  const IconComponent = ICON_MAP[msg.icon];

  return (
    <div className={styles.wrapper}>
      <div className={styles.pill}>
        {/* Beam lives here — outside overflow:hidden strip, so corners render cleanly */}
        <span className={styles.borderBeam} aria-hidden="true" />

        <div
          className={styles.strip}
          dir={isEn ? "ltr" : "rtl"}
          role="region"
          aria-label={isEn ? "Key messages from Zarman" : "پیام‌های کلیدی زرمان"}
          tabIndex={0}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onKeyDown={handleKeyDown}
        >

        {/* Message row */}
        <div className={styles.inner}>
          <button
            className={styles.navBtn}
            onClick={isEn ? prev : next}
            aria-label={isEn ? "Previous message" : "پیام قبلی"}
            tabIndex={-1}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>

          <div className={styles.track} aria-live="polite" aria-atomic="true">
            <div key={`${active}-${animKey}`} className={styles.message}>
              <span
                className={`${styles.iconWrap} ${styles[`icon_${msg.icon}`]}`}
                aria-hidden="true"
              >
                <IconComponent size={16} strokeWidth={2} />
              </span>
              <span className={styles.text}>{text}</span>
            </div>
          </div>

          <button
            className={styles.navBtn}
            onClick={isEn ? next : prev}
            aria-label={isEn ? "Next message" : "پیام بعدی"}
            tabIndex={-1}
          >
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Progress indicators */}
        <div
          className={styles.dots}
          role="tablist"
          aria-label={isEn ? "Navigate messages" : "انتخاب پیام"}
        >
          {STRIP_MESSAGES.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === active ? styles.dotActive : ""}`}
              onClick={() => goTo(i)}
              role="tab"
              aria-selected={i === active}
              aria-label={`${isEn ? "Message" : "پیام"} ${i + 1}`}
            >
              {i === active && !paused && (
                <span
                  className={styles.dotFill}
                  key={`fill-${animKey}`}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}