"use client";

import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardMotion } from "./DashboardMotion";

/** Shared customer surfaces. Use the same hierarchy from onboarding to settlement. */
export function DashboardCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Card data-dashboard-card className={cn("min-w-0 gap-0 rounded-3xl border border-[#e9ecf0] bg-white p-6 text-[#182027] shadow-none ring-0 sm:p-7", className)} {...props}>{children}</Card>;
}

export function DashboardButton({ tone = "primary", className, ...props }: ComponentProps<typeof Button> & { tone?: "primary" | "secondary" | "quiet" }) {
  return <Button data-dashboard-button className={cn(
    "h-auto min-h-12 gap-2 rounded-full px-6 py-3 text-sm font-semibold leading-5 whitespace-normal shadow-none transition-[background-color,color,border-color,box-shadow] duration-150 active:translate-y-0! focus-visible:ring-[#635bff]/25 motion-reduce:transition-none",
    tone === "primary" ? "border-transparent bg-[#20242c] text-white hover:bg-[#373d48]" : tone === "secondary" ? "border-transparent bg-[#f1f3f6] text-[#20242c] hover:bg-[#e7eaf0]" : "border-transparent bg-transparent text-[#626a76] hover:bg-[#f1f3f6] hover:text-[#182027]",
    className,
  )} {...props}/>;
}

export function DashboardPageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="flex flex-col items-start justify-between gap-5 pb-1 sm:flex-row sm:items-end">
    <div className="min-w-0">{eyebrow && <p className="m-0 mb-2 text-sm text-[#626a76]">{eyebrow}</p>}<h1 className="m-0! text-[clamp(1.75rem,3vw,2.25rem)]! font-semibold leading-tight! tracking-[-.035em] text-[#182027]! rtl:leading-relaxed! rtl:tracking-normal">{title}</h1>{description && <p className="m-0 mt-3 max-w-xl text-sm leading-6 text-[#626a76]">{description}</p>}</div>
    {action && <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">{action}</div>}
  </header>;
}

export function DashboardReveal({ children, className, motionEnabled }: { children: ReactNode; className?: string; motionEnabled?: boolean }) {
  const reduced = useReducedMotion();
  const dashboardMotion = useDashboardMotion();
  const animate = (motionEnabled ?? dashboardMotion) && reduced === false;
  return <motion.div className={className} initial={animate ? { opacity: 0, filter: "blur(3px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: animate ? .32 : 0, ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}

export function StatusBadge({ tone = "neutral", children, className }: { tone?: "neutral" | "attention" | "success" | "danger" | "brand"; children: ReactNode; className?: string }) {
  const tones = { neutral: "bg-[#f1f3f6] text-[#586270]", attention: "bg-[#fff6e4] text-[#8a5200]", success: "bg-[#ecf9f2] text-[#177549]", danger: "bg-[#fff0f2] text-[#b4344c]", brand: "bg-[#eeedff] text-[#554dc4]" };
  return <span data-status-tone={tone} className={cn("inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium leading-5", tones[tone], className)}>{children}</span>;
}

export const dashboardInputClass = "min-h-12 w-full min-w-0 rounded-2xl border border-[#e2e6ec] bg-white px-4 py-3 text-base text-[#182027] outline-none transition-[border-color,box-shadow] placeholder:text-[#8a919c] focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10 read-only:bg-[#f7f8fa] disabled:opacity-60 aria-invalid:border-rose-400 aria-invalid:bg-rose-50/40";
