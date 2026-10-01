"use client";

import { useState, type ComponentProps, type HTMLAttributes, type ReactNode } from "react";
import { DashboardLottieReplay } from "./DashboardLottieReplay";
import { motion, useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardMotion } from "./DashboardMotion";
import { MagicCard } from "@/components/ui/magic-card";
import { dashboardPalette, type DashboardTone } from "@/lib/dashboard/palette";

/** Shared customer surfaces. Use the same hierarchy from onboarding to settlement. */
export function DashboardCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Card data-dashboard-card className={cn("min-w-0 gap-0 rounded-3xl border border-[#eae8f2] bg-white p-6 text-[#242137] shadow-[0_1px_2px_#1a1a2e08,0_10px_28px_-20px_#1a1a2e26] sm:p-7", className)} {...props}>{children}</Card>;
}

/** Hover depth for clickable cards, without moving them; `!` beats the card's inline resting shadow. */
export const dashboardCardHover = "transition-shadow duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:shadow-[0_2px_6px_#1a1a2e0a,0_22px_44px_-28px_#1a1a2e52]! motion-reduce:transition-none";

/** Text-link action inside a card (Transaction details, Send money). */
export const dashboardCardLink = "inline-flex min-h-10 items-center gap-1 rounded-lg text-sm font-semibold text-[#4f46c8] no-underline outline-none transition-colors duration-150 hover:text-[#3730a3] focus-visible:ring-2 focus-visible:ring-[#635bff]/40 motion-reduce:transition-none";

export function DashboardMagicCard({ tone = "violet", motionEnabled, pointerEffect = true, contentClassName, className, style, children, replayLottieOnHover = false, onPointerEnter, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: DashboardTone; motionEnabled?: boolean; pointerEffect?: boolean; contentClassName?: string; replayLottieOnHover?: boolean }) {
  const enabled = useDashboardMotion();
  const reduced = useReducedMotion();
  const [replay, setReplay] = useState(0);
  const colors = dashboardPalette[tone];
  return <MagicCard {...props} data-dashboard-card data-card-tone={tone} motionEnabled={pointerEffect && enabled && motionEnabled !== false && reduced === false}
    mode="gradient" gradientSize={260} gradientOpacity={.20} edgeOpacity={.10}
    gradientColor={colors.glow} gradientFrom={colors.accent} gradientTo={colors.glow}
    onPointerEnter={event => {
      if (replayLottieOnHover && enabled && motionEnabled !== false && reduced === false && event.pointerType === "mouse") setReplay(value => value + 1);
      onPointerEnter?.(event);
    }}
    className={cn("min-w-0 rounded-3xl text-[#242137]", className)} contentClassName={cn("p-6 sm:p-7", contentClassName)}
    style={{ background: `linear-gradient(160deg, #ffffff 22%, ${colors.soft} 100%)`, borderColor: colors.border, boxShadow: `0 1px 2px #1a1a2e08, 0 10px 28px -22px ${colors.accent}2e`, ...style }}><DashboardLottieReplay.Provider value={replay}>{children}</DashboardLottieReplay.Provider></MagicCard>;
}

export function DashboardButton({ tone = "primary", className, ...props }: ComponentProps<typeof Button> & { tone?: "primary" | "secondary" | "quiet" }) {
  return <Button data-dashboard-button className={cn(
    "h-auto min-h-11 gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold leading-5 whitespace-normal shadow-none transition-[background-color,color,border-color,box-shadow] duration-150 ease-out focus-visible:ring-[#635bff]/30 motion-reduce:transition-none",
    tone === "primary"
      ? "border border-transparent bg-[#635bff] text-white shadow-[0_1px_2px_#1a1a2e0d,0_1px_3px_#1a1a2e1a] hover:bg-[#584fef] hover:shadow-[0_1px_2px_#1a1a2e0d,0_6px_16px_-4px_#4338ca4d] active:bg-[#4c44d1]"
      : tone === "secondary"
      ? "border border-[#e2e6ec] bg-white text-[#32363f] shadow-[0_1px_2px_#1a1a2e0a] hover:border-[#c8cdd8] hover:bg-[#fafbfc] active:bg-[#f3f4f6]"
      : "border border-transparent bg-transparent text-[#586270] hover:bg-[#f1f3f6] hover:text-[#182027] active:bg-[#e9ecf0]",
    className,
  )} {...props}/>;
}

export function DashboardPageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: ReactNode; description?: string; action?: ReactNode }) {
  return <header className="flex flex-col items-start justify-between gap-5 pb-1 sm:flex-row sm:items-end">
    <div className="min-w-0">{eyebrow && <p className="m-0 mb-2 text-sm text-[#626a76]">{eyebrow}</p>}<h1 className="m-0! [overflow-wrap:anywhere] text-[clamp(1.75rem,3vw,2.25rem)]! font-semibold leading-tight! tracking-[-.035em] text-[#182027]! rtl:leading-relaxed! rtl:tracking-normal">{title}</h1>{description && <p className="m-0 mt-3 max-w-xl text-sm leading-6 text-[#626a76]">{description}</p>}</div>
    {action && <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">{action}</div>}
  </header>;
}

export function DashboardReveal({ children, className, motionEnabled }: { children: ReactNode; className?: string; motionEnabled?: boolean }) {
  const reduced = useReducedMotion();
  const dashboardMotion = useDashboardMotion();
  const animate = (motionEnabled ?? true) && dashboardMotion && reduced === false;
  return <motion.div className={className} initial={animate ? { opacity: 0, filter: "blur(3px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: animate ? .32 : 0, ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}

export function StatusBadge({ tone = "neutral", children, className }: { tone?: "neutral" | "attention" | "success" | "danger" | "brand"; children: ReactNode; className?: string }) {
  const tones = { neutral: "bg-[#f1f3f6] text-[#586270]", attention: "bg-[#fff6e4] text-[#8a5200]", success: "bg-[#ecf9f2] text-[#177549]", danger: "bg-[#fff0f2] text-[#b4344c]", brand: "bg-[#eeedff] text-[#554dc4]" };
  return <span data-status-tone={tone} className={cn("inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium leading-5", tones[tone], className)}>{children}</span>;
}

export const dashboardInputClass = "min-h-12 w-full min-w-0 rounded-2xl border border-[#e2e6ec] bg-white px-4 py-3 text-base text-[#182027] outline-none transition-[border-color,box-shadow] placeholder:text-[#8a919c] focus:border-[#8970b6] focus:ring-2 focus:ring-[#7667bd]/10 read-only:bg-[#f7f8fa] disabled:opacity-60 aria-invalid:border-rose-400 aria-invalid:bg-rose-50/40";
