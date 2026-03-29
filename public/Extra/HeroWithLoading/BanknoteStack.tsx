"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import styles from "./BanknoteStack.module.css";

const STRIPE_EASE = [0.16, 1, 0.3, 1] as const;

export default function BanknoteStack({ intervalMs = 4500 }) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  const cards = useMemo(() => [
    "/images/card-1.png", "/images/card-2.png", 
    "/images/card-3.png", "/images/card-4.png"
  ], []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => setActive((p) => (p + 1) % cards.length), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, cards.length, reduceMotion]);

  const visibleStack = [
    { pos: 0, idx: active },
    { pos: 1, idx: (active + 1) % cards.length },
    { pos: 2, idx: (active + 2) % cards.length },
  ];

  return (
    <figure className={styles.container}>
      {/* Persian & English SEO targeting Remittance Searches */}
      <figcaption className={styles['sr-only']}>
        Zarman Exchange - Premium Iran to Australia money transfers.
        زرمان اکسچنج - صرافی و انتقال پول بین ایران و استرالیا با بهترین نرخ ارز.
      </figcaption>

      <AnimatePresence mode="popLayout" initial={false}>
        {visibleStack.slice().reverse().map(({ pos, idx }) => {
          // Stripe Logic: Pos 0 is front-bottom. y is % based for mobile responsiveness.
          const yPercent = (2 - pos) * 48; 
          const scale = 1 - pos * 0.04;

          return (
            <motion.div
              key={cards[idx]}
              className={styles.card}
              style={{ zIndex: 10 - pos }}
              initial={{ opacity: 0, y: "-10%", scale: scale - 0.05 }}
              animate={{ opacity: 1, y: `${yPercent}%`, scale }}
              exit={{ 
                opacity: 0, 
                y: `${yPercent + 40}%`, 
                scale: 1.05,
                zIndex: 20,
                transition: { duration: 0.7, ease: "easeIn" } 
              }}
              transition={{ duration: 1.2, ease: STRIPE_EASE, delay: pos === 2 ? 0 : 0.15 }}
            >
              <Image
                src={cards[idx]}
                alt="Zarman Exchange Card - کارت صرافی زرمان"
                fill
                draggable={false}
                sizes="(max-width: 768px) 100vw, 420px"
                priority={pos === 0}
                className={styles.image}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </figure>
  );
}