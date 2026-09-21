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
  compact?: boolean;
  /** Change for an explicit refresh or a new process, never for background polling. */
  replayKey?: string | number;
  className?: string;
};

const rays = Array.from({ length: 12 }, (_, index) => index * 30);
const flourish = { duration: LOGO_ORBIT_DURATION, ease: "easeInOut" as const, times: [0, 0.22, 0.72, 1] };

/** Decorative light only: the orbit never implies payment speed or completion. */
function LogoOrbit({ stage, animate, compact, quiet }: { stage: number; animate: boolean; compact: boolean; quiet: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const id = useId().replace(/:/g, "");
  const tone = dashboardPalette[dashboardStageTones[stage]];
  const play = animate && inView;

  return <div ref={ref} className="relative grid size-full place-items-center" data-orbit-motion={play ? "playing" : "still"}>
    <div className="absolute inset-0 rounded-full opacity-75" style={{ background: `radial-gradient(ellipse at center, ${tone.soft} 0%, ${tone.glow} 28%, transparent 68%)` }} />
    <motion.div className="absolute aspect-square w-[92%] max-w-72 rounded-full"
      initial={false}
      animate={play ? { opacity: [0.2, 0.85, 0.5, 0.22], scale: [0.82, 1.06, 1, 1] } : { opacity: 0.22, scale: 1 }}
      transition={play ? flourish : { duration: 0 }}
      style={{ background: `conic-gradient(from 15deg, transparent 0deg, ${tone.glow} 25deg, transparent 55deg, transparent 95deg, #a5f3fc66 123deg, transparent 158deg, transparent 220deg, ${tone.glow} 252deg, transparent 286deg, transparent 310deg, #fcd34d33 340deg, transparent 360deg)` }} />
    <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 320 240" fill="none" focusable="false">
      <defs>
        <radialGradient id={`orbit-rays-${id}`} gradientUnits="userSpaceOnUse" cx="160" cy="120" r="125">
          <stop offset="20%" stopColor={tone.accent} stopOpacity="0" />
          <stop offset="58%" stopColor={tone.accent} stopOpacity="0.5" />
          <stop offset="100%" stopColor={tone.accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`orbit-ring-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={tone.accent} />
          <stop offset="0.5" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <motion.g style={{ transformOrigin: "160px 120px" }} initial={false}
        animate={play ? { rotate: [0, 24, 100, 130], opacity: [0.3, 0.8, 0.55, 0.3] } : { rotate: 130, opacity: 0.3 }}
        transition={play ? flourish : { duration: 0 }}>
        {rays.map((angle) => <path key={angle} d="M 160 26 L 160 2" transform={`rotate(${angle} 160 120)`} stroke={`url(#orbit-rays-${id})`} strokeWidth={angle % 90 === 0 ? "2" : "1"} strokeLinecap="round" />)}
      </motion.g>
      <circle cx="160" cy="120" r="99" stroke={tone.border} strokeWidth="0.75" strokeDasharray="1 9" />
      <circle cx="160" cy="120" r="85" stroke={tone.border} strokeWidth="0.75" opacity="0.6" />
      <motion.circle cx="160" cy="120" r="85" stroke={`url(#orbit-ring-${id})`} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="74 460"
        style={{ transformOrigin: "160px 120px" }} initial={false}
        animate={play ? { rotate: [-130, -35, 180, 230], opacity: [0.25, 0.9, 0.65, 0.4] } : { rotate: 230, opacity: 0.4 }}
        transition={play ? flourish : { duration: 0 }} />
      <motion.g style={{ transformOrigin: "160px 120px" }} initial={false}
        animate={play ? { rotate: [-35, 30, 190, 270] } : { rotate: 270 }}
        transition={play ? flourish : { duration: 0 }}>
        <circle cx="160" cy="21" r="4" fill={tone.accent} stroke="white" strokeWidth="2" />
        <circle cx="246" cy="169.5" r="3" fill="#38bdf8" stroke="white" strokeWidth="1.5" />
        <circle cx="74" cy="169.5" r="2.5" fill="#f6bd4f" stroke="white" strokeWidth="1.5" />
      </motion.g>
    </svg>
    <div className={cn("relative grid aspect-square place-items-center rounded-full border border-white/95 bg-white/75 backdrop-blur-sm", compact ? "w-[48%]" : "w-[45%] max-w-36")}
      style={{ boxShadow: `0 0 0 1px ${tone.border}, 0 0 0 9px #ffffff80, 3px 5px 0 ${tone.border}, 0 18px 35px ${tone.glow}`, opacity: quiet ? 0.75 : 1 }}>
      <div className="absolute inset-2 rounded-full border border-white" />
      <Image src="/images/logo-no-text-light.svg" alt="" width={112} height={112} draggable={false}
        className="relative block h-auto w-[76%] object-contain" style={{ transform: "none" }} />
    </div>
  </div>;
}

/** A new stage remounts only the decorative orbit; financial content stays untouched. */
export default function TransferBrandMotif({ stage = 0, motionEnabled = true, quiet = false, compact = false, replayKey = "", className }: TransferBrandMotifProps) {
  const systemReducedMotion = useReducedMotion();
  const dashboardMotion = useDashboardMotion();
  const safeStage = Number.isFinite(stage) ? Math.max(0, Math.min(4, Math.floor(stage))) : 0;
  const animate = motionEnabled && dashboardMotion && systemReducedMotion === false && !quiet;

  return <div aria-hidden="true" dir="ltr" data-stage={safeStage} data-quiet={quiet} data-logo-orbit="true" data-duration={LOGO_ORBIT_DURATION}
    className={cn("pointer-events-none relative isolate min-w-0 select-none overflow-hidden", compact ? "size-20" : "h-52 w-full sm:h-60", className)}>
    <LogoOrbit key={`${safeStage}-${replayKey}`} stage={safeStage} animate={animate} compact={compact} quiet={quiet} />
  </div>;
}
