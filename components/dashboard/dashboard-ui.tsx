"use client";

import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardMotion } from "./DashboardMotion";
import { MagicCard } from "@/components/ui/magic-card";
import { dashboardPalette, type DashboardTone } from "@/lib/dashboard/palette";

/** Shared customer surfaces. Use the same hierarchy from onboarding to settlement. */
export function DashboardCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Card data-dashboard-card className={cn("min-w-0 gap-0 rounded-3xl border border-white/90 bg-white/65 p-6 text-[#242137] shadow-[0_12px_40px_-24px_#796a9d40,inset_0_1px_0_#ffffff] ring-1 ring-[#dcd6ec]/40 backdrop-blur-xl sm:p-7", className)} {...props}>{children}</Card>;
}

export function DashboardMagicCard({ tone = "violet", motionEnabled, contentClassName, className, style, children, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: DashboardTone; motionEnabled?: boolean; contentClassName?: string }) {
  const enabled = useDashboardMotion();
  const colors = dashboardPalette[tone];
  return <MagicCard {...props} data-dashboard-card data-card-tone={tone} motionEnabled={(motionEnabled ?? true) && enabled}
    gradientColor={colors.glow} gradientFrom={colors.accent} gradientTo={colors.glow}
    className={cn("min-w-0 rounded-3xl text-[#242137] backdrop-blur-xl", className)} contentClassName={cn("p-6 sm:p-7", contentClassName)}
    style={{ background: `linear-gradient(135deg, #ffffffc9 12%, ${colors.soft}b8 100%)`, borderColor: `${colors.border}85`, boxShadow: `0 16px 48px -28px ${colors.accent}35, inset 0 1px 0 #ffffff`, ...style }}>{children}</MagicCard>;
}

export function DashboardButton({ tone = "primary", className, ...props }: ComponentProps<typeof Button> & { tone?: "primary" | "secondary" | "quiet" }) {
  return <Button data-dashboard-button className={cn(
    "h-auto min-h-12 gap-2 rounded-full px-6 py-3 text-sm font-semibold leading-5 whitespace-normal shadow-none transition-[background-color,color,border-color,box-shadow] duration-150 active:translate-y-0! focus-visible:ring-[#635bff]/25 motion-reduce:transition-none",
    tone === "primary" ? "border-white/20 bg-[#7048ca] bg-linear-to-b from-white/10 to-transparent text-white shadow-[0_6px_20px_-8px_#7048ca70,inset_0_1px_0_#ffffff30] hover:bg-[#633bbf]" : tone === "secondary" ? "border-white/80 bg-white/65 text-[#4f3980] shadow-[0_3px_14px_-8px_#796a9d40] hover:bg-white/90" : "border-transparent bg-transparent text-[#655381] hover:bg-[#f2ebfc] hover:text-[#49318b]",
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

export const dashboardInputClass = "min-h-12 w-full min-w-0 rounded-2xl border border-[#e2e6ec] bg-white px-4 py-3 text-base text-[#182027] outline-none transition-[border-color,box-shadow] placeholder:text-[#8a919c] focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10 read-only:bg-[#f7f8fa] disabled:opacity-60 aria-invalid:border-rose-400 aria-invalid:bg-rose-50/40";
