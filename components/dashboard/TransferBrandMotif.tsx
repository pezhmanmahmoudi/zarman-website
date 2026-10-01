"use client";

import { useId, useRef } from "react";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { dashboardPalette, dashboardStageTones } from "@/lib/dashboard/palette";
import type { RequestLocale } from "@/lib/requests/types";
import { useDashboardMotion } from "./DashboardMotion";

export const LOGO_ORBIT_DURATION = 7;

export type TransferBrandMotifProps = {
  stage?: number;
  /** Retained for existing callers; amounts and currencies belong to the transfer summary. */
  from?: string;
  to?: string;
  locale: RequestLocale;
  motionEnabled?: boolean;
  quiet?: boolean;
  /** Loops while data is on its way, then plays the intro once. */
  loading?: boolean;
  compact?: boolean;
  /** Change for an explicit refresh or a new process, never for background polling. */
  replayKey?: string | number;
  className?: string;
};

const rays = Array.from({ length: 12 }, (_, index) => index * 30);
const settle = [0.22, 1, 0.36, 1] as const;
const centre = { transformOrigin: "160px 120px" };
const loop = (duration: number, delay = 0) => ({ duration, delay, ease: "linear" as const, repeat: Infinity });
const breathe = (duration: number, delay = 0) => ({ duration, delay, ease: "easeInOut" as const, repeat: Infinity });

/** Decorative light only: the orbit never implies payment speed or completion. */
function LogoOrbit({ stage, animate, loading, compact, quiet }: { stage: number; animate: boolean; loading: boolean; compact: boolean; quiet: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const id = useId().replace(/:/g, "");
  const tone = dashboardPalette[dashboardStageTones[stage]];
  const looping = animate && inView && loading, intro = animate && inView && !loading;
  const still = { duration: 0 };

  return <div ref={ref} className="relative grid h-full aspect-[4/3] max-w-full place-items-center" data-orbit-motion={looping ? "loading" : intro ? "playing" : "still"}>
    <motion.div className="pointer-events-none absolute inset-0" initial={false}
      animate={looping ? { opacity: [0.55, 1, 0.55] } : intro ? { opacity: [0, 1] } : { opacity: 1 }}
      transition={looping ? breathe(2.4) : intro ? { duration: 1.2, ease: settle } : still}
      style={{ background: `radial-gradient(ellipse at center, ${tone.glow}70 0%, ${tone.glow}35 35%, ${tone.glow}00 70%)` }} />
    <motion.div className="absolute aspect-square w-[68%] rounded-full" initial={false}
      animate={looping ? { rotate: 360, opacity: 0.55 } : intro ? { rotate: [0, 160], opacity: [0, 0.8, 0.25], scale: [0.8, 1.06, 1] } : { opacity: 0.22 }}
      transition={looping ? loop(6) : intro ? { duration: 2.6, ease: settle } : still}
      style={{ maskImage: "radial-gradient(circle, #000 25%, #0009 48%, transparent 70%)", WebkitMaskImage: "radial-gradient(circle, #000 25%, #0009 48%, transparent 70%)", background: `conic-gradient(from 15deg, transparent 0deg, ${tone.glow} 25deg, transparent 55deg, transparent 95deg, #a5f3fc66 123deg, transparent 158deg, transparent 220deg, ${tone.glow} 252deg, transparent 286deg, transparent 310deg, #fcd34d33 340deg, transparent 360deg)` }} />
    <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 320 240" fill="none" focusable="false">
      <defs>
        <radialGradient id={`orbit-rays-${id}`} gradientUnits="userSpaceOnUse" cx="160" cy="120" r="125">
          <stop offset="20%" stopColor={tone.accent} stopOpacity="0" />
          <stop offset="58%" stopColor={tone.accent} stopOpacity="0.5" />
          <stop offset="100%" stopColor={tone.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`orbit-ring-${id}`} x1="1" y1="0.5" x2="0" y2="1">
          <stop stopColor={tone.accent} />
          <stop offset="0.55" stopColor="#38bdf8" stopOpacity="0.6" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.g style={centre} initial={false}
        animate={looping ? { rotate: 360, opacity: 0.45 } : intro ? { rotate: [-30, 20], opacity: [0, 0.75, 0.3] } : { rotate: 20, opacity: 0.3 }}
        transition={looping ? loop(24) : intro ? { duration: 2.4, ease: settle } : still}>
        {rays.map((angle) => <path key={angle} d="M 160 26 L 160 2" transform={`rotate(${angle} 160 120)`} stroke={`url(#orbit-rays-${id})`} strokeWidth={angle % 90 === 0 ? "2" : "1"} strokeLinecap="round" />)}
      </motion.g>
      <circle cx="160" cy="120" r="99" stroke={tone.border} strokeWidth="0.75" strokeDasharray="1 9" />
      <circle cx="160" cy="120" r="85" stroke={tone.border} strokeWidth="0.75" opacity="0.6" />
      {(looping || intro) && [0, 1].map(index => <motion.circle key={index} cx="160" cy="120" r="66" stroke={tone.accent} strokeWidth="1" style={centre}
        initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: [0.7, 1.6], opacity: [0.5, 0] }}
        transition={looping ? { duration: 2.4, delay: index * 1.2, ease: "easeOut", repeat: Infinity } : { duration: 1.8, delay: 0.2 + index * 0.4, ease: "easeOut" }} />)}
      <motion.circle cx="160" cy="120" r="99" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" strokeDasharray="38 584" style={centre} initial={false}
        animate={looping ? { rotate: 360, opacity: 0.7 } : intro ? { rotate: [140, 400], opacity: [0, 0.8, 0.35] } : { rotate: 40, opacity: 0.35 }}
        transition={looping ? loop(3.2) : intro ? { duration: 2.4, ease: settle } : still} />
      <motion.g style={centre} initial={false}
        animate={looping ? { rotate: -360, opacity: 1 } : intro ? { rotate: [90, -250], opacity: [0, 1, 0.6] } : { rotate: -250, opacity: 0.6 }}
        transition={looping ? loop(1.6) : intro ? { duration: 2.2, ease: settle } : still}>
        <circle cx="160" cy="120" r="85" stroke={`url(#orbit-ring-${id})`} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="120 414" />
        <circle cx="245" cy="120" r="3.5" fill="white" stroke={tone.accent} strokeWidth="2" />
      </motion.g>
      <motion.g style={centre} initial={false}
        animate={looping ? { rotate: 360 } : intro ? { rotate: [-140, 0] } : { rotate: 0 }}
        transition={looping ? loop(5) : intro ? { duration: 2.4, ease: settle } : still}>
        <circle cx="160" cy="21" r="4" fill={tone.accent} stroke="white" strokeWidth="2" />
        <circle cx="246" cy="169.5" r="3" fill="#38bdf8" stroke="white" strokeWidth="1.5" />
        <circle cx="74" cy="169.5" r="2.5" fill="#f6bd4f" stroke="white" strokeWidth="1.5" />
      </motion.g>
    </svg>
    <motion.div className={cn("relative grid aspect-square place-items-center rounded-full border border-white/95 bg-white/75 backdrop-blur-sm", compact ? "w-[48%]" : "w-[45%] max-w-36")} initial={false}
      animate={looping ? { scale: [1, 1.04, 1] } : intro ? { scale: [0.86, 1.03, 1], opacity: [0, 1, 1] } : { scale: 1 }}
      transition={looping ? breathe(2.4) : intro ? { duration: 1.1, ease: settle } : still}
      style={{ boxShadow: `0 0 0 1px ${tone.border}80, 0 0 0 8px #ffffff35, 0 8px 28px ${tone.glow}55, inset 0 1px 0 #fff`, opacity: quiet ? 0.75 : 1 }}>
      <div className="absolute inset-2 rounded-full border border-white" />
      <Image src="/images/logo-no-text-light.svg" alt="" width={112} height={112} draggable={false}
        className="relative block h-auto w-[76%] object-contain" style={{ transform: "none" }} />
    </motion.div>
  </div>;
}

/** A new stage remounts only the decorative orbit; financial content stays untouched. */
export default function TransferBrandMotif({ stage = 0, motionEnabled = true, quiet = false, loading = false, compact = false, replayKey = "", className }: TransferBrandMotifProps) {
  const systemReducedMotion = useReducedMotion();
  const dashboardMotion = useDashboardMotion();
  const safeStage = Number.isFinite(stage) ? Math.max(0, Math.min(4, Math.floor(stage))) : 0;
  const animate = motionEnabled && dashboardMotion && systemReducedMotion === false && !quiet;

  return <div aria-hidden="true" dir="ltr" data-stage={safeStage} data-quiet={quiet} data-logo-orbit="true" data-duration={LOGO_ORBIT_DURATION}
    className={cn("pointer-events-none relative isolate grid min-w-0 select-none place-items-center", compact ? "size-20" : "h-52 w-full sm:h-60", className)}>
    <LogoOrbit key={`${safeStage}-${replayKey}-${loading}`} stage={safeStage} animate={animate} loading={loading} compact={compact} quiet={quiet} />
  </div>;
}
