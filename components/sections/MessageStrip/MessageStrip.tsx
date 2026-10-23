"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useParams } from "next/navigation";
import {
  BadgePercent,
  CircleCheck,
  Lock,
  Pause,
  Play,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { STRIP_MESSAGES } from "./messages";
import type { StripIconType } from "./messages";
import styles from "./MessageStrip.module.css";

// ─── Icon registry ─────────────────────────────────────────────────────────
const ICON_MAP: Record<StripIconType, LucideIcon> = {
  shield: ShieldCheck,
  zap: Zap,
  star: Star,
  percent: BadgePercent,
  lock: Lock,
  users: Users,
  check: CircleCheck,
};

const COUNT = STRIP_MESSAGES.length;
const INTERVAL_MS = 6000;
const SWIPE_THRESHOLD = 40;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export default function MessageStrip() {
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";

  const [{ active, leaving }, setSlides] = useState({ active: 0, leaving: -1 });
  // null = the user hasn't chosen yet, so we follow the OS motion preference.
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const [held, setHeld] = useState(false);
  const [inView, setInView] = useState(true);

  const cardRef = useRef<HTMLDivElement>(null);
  const pointerStartX = useRef<number | null>(null);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );
  const paused = userPaused ?? reducedMotion;
  const playing = !paused && !hovered && !held && inView;

  const goTo = useCallback((index: number) => {
    setSlides((s) => (s.active === index ? s : { active: index, leaving: s.active }));
  }, []);

  const step = useCallback((delta: number) => {
    setSlides((s) => ({ active: (s.active + delta + COUNT) % COUNT, leaving: s.active }));
  }, []);

  // Stop the clock while the hero is scrolled out of view.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const handlePointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    pointerStartX.current = e.clientX;
    setHeld(true);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    setHeld(false);
    if (pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    // Swiping toward the start of the reading direction advances.
    const forward = isEn ? dx < 0 : dx > 0;
    step(forward ? 1 : -1);
  };

  const handlePointerCancel = () => {
    pointerStartX.current = null;
    setHeld(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const forward = (e.key === "ArrowRight") === isEn;
    step(forward ? 1 : -1);
  };

  const activeTone = STRIP_MESSAGES[active].icon;

  return (
    <div className={styles.root}>
      <div
        ref={cardRef}
        className={`${styles.card} ${styles[`tone_${activeTone}`]}`}
        dir={isEn ? "ltr" : "rtl"}
        role="region"
        aria-roledescription={isEn ? "carousel" : "نمایشگر پیام"}
        aria-label={isEn ? "Key messages from Zarman" : "پیام‌های کلیدی زرمان"}
        data-playing={playing}
        style={{ "--duration": `${INTERVAL_MS}ms` } as CSSProperties}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setHovered(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHovered(false);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        {/* Every slide shares one grid cell, so the card always fits the longest message */}
        <div className={styles.viewport} aria-live={playing ? "off" : "polite"}>
          {STRIP_MESSAGES.map((msg, i) => {
            const Icon = ICON_MAP[msg.icon];
            const state = i === active ? "active" : i === leaving ? "leaving" : "idle";
            return (
              <div
                key={msg.id}
                className={styles.slide}
                data-state={state}
                role="group"
                aria-roledescription={isEn ? "slide" : "پیام"}
                aria-label={isEn ? `${i + 1} of ${COUNT}` : `${i + 1} از ${COUNT}`}
                aria-hidden={i !== active}
              >
                <span
                  className={`${styles.icon} ${styles[`tone_${msg.icon}`]}`}
                  aria-hidden="true"
                >
                  <Icon size={17} strokeWidth={1.9} />
                </span>
                <p className={styles.text}>{isEn ? msg.en : msg.fa}</p>
              </div>
            );
          })}
        </div>

        <div className={styles.controls}>
          <div
            className={styles.dots}
            role="group"
            aria-label={isEn ? "Choose a message" : "انتخاب پیام"}
          >
            {STRIP_MESSAGES.map((msg, i) => (
              <button
                key={msg.id}
                type="button"
                className={styles.dot}
                onClick={() => goTo(i)}
                aria-label={isEn ? `Show message ${i + 1}` : `نمایش پیام ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
              >
                <span className={styles.dotTrack} aria-hidden="true">
                  {/* The fill's animation is the timer: when it completes, we advance */}
                  {i === active && (
                    <span className={styles.dotFill} onAnimationEnd={() => step(1)} />
                  )}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.toggle}
            onClick={() => setUserPaused(!paused)}
            aria-label={
              paused
                ? isEn ? "Play messages" : "پخش خودکار پیام‌ها"
                : isEn ? "Pause messages" : "توقف پیام‌ها"
            }
          >
            {paused ? (
              <Play size={12} fill="currentColor" strokeWidth={0} className={styles.playIcon} />
            ) : (
              <Pause size={12} fill="currentColor" strokeWidth={0} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
