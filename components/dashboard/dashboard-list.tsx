"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, X, type LucideIcon } from "lucide-react";
import type { DashboardLottieSceneName } from "@/lib/dashboard/lottie-scenes";
import type { RequestLocale } from "@/lib/requests/types";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { DASHBOARD_PAGE_SIZE } from "@/lib/dashboard/paging";
import { cn } from "@/lib/utils";
import { DashboardLottieScene } from "./DashboardLottieScene";

/** Heading for the list cards on Transactions and Recipients; the scene is the page's only animation. */
export function DashboardListHeader({ title, description, scene, motionEnabled }: { title: string; description: string; scene: DashboardLottieSceneName; motionEnabled: boolean }) {
  return <header className="flex min-w-0 items-center justify-between gap-4 px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
    <div className="min-w-0">
      <h2 className="m-0! text-lg! font-semibold leading-snug! text-[#24243f]! sm:text-xl!">{title}</h2>
      <p className="mb-0 mt-1.5 max-w-xl text-sm leading-6 text-[#66617a]">{description}</p>
    </div>
    <span aria-hidden="true" className="relative flex size-[72px] shrink-0 items-center justify-center rounded-full border border-[#d5cde7] bg-white/75 shadow-[0_8px_24px_-14px_#4d3a7360,inset_0_0_0_4px_#ffffff80] sm:size-20"><DashboardLottieScene name={scene} size={64} motionEnabled={motionEnabled} /></span>
  </header>;
}

export function DashboardEmptyState({ icon: Icon, title, description, action, role }: {
  icon?: LucideIcon; title: string; description?: string; action?: ReactNode; role?: "alert" | "status";
}) {
  return <div role={role} className="flex flex-col items-center px-5 py-12 text-center sm:py-14">
    {Icon && <span aria-hidden="true" className="mb-5 grid size-14 place-items-center rounded-2xl border border-[#ddd6f3] bg-white text-[#635bff] shadow-[0_8px_20px_-14px_#4d3a7360]"><Icon size={24} strokeWidth={1.7} /></span>}
    <h3 className="m-0! text-base! font-semibold leading-relaxed! text-[#25213e]!">{title}</h3>
    {description && <p className="mb-0 mt-1.5 max-w-md text-sm leading-6 text-[#66617a]">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>;
}

export function DashboardListToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 border-y border-[#e8e3f1] bg-white/80 px-4 py-4 sm:px-7 xl:flex-row xl:items-center xl:justify-between">{children}</div>;
}

export function DashboardFilterPills<T extends string>({ label, options, value, onChange, dataKey, locale }: {
  label: string; options: readonly { value: T; label: string; shortLabel?: string; count: number; attention?: boolean }[]; value: T; onChange: (value: T) => void; dataKey: `data-${string}`; locale: RequestLocale;
}) {
  return <div className="flex w-full max-w-full gap-0.5 overflow-x-auto rounded-full bg-[#eceef3] p-1 [scrollbar-width:none] sm:gap-1 xl:w-fit [&::-webkit-scrollbar]:hidden" role="group" aria-label={label}>
    {options.map(option => {
      const active = value === option.value;
      return <button type="button" key={option.value} {...{ [dataKey]: option.value }} aria-pressed={active} onClick={() => onChange(option.value)} className={cn("flex min-h-9 flex-1 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]/30 sm:min-h-10 sm:flex-none sm:gap-2 sm:px-4 sm:text-xs", active ? "bg-white text-[#182027] shadow-sm" : "text-[#626a76] hover:text-[#182027]")}>
        {option.shortLabel ? <><span className="sm:hidden">{option.shortLabel}</span><span className="hidden sm:inline">{option.label}</span></> : <span>{option.label}</span>}
        <span className={cn("min-w-4 rounded-full px-1 text-center text-[10px] leading-4 tabular-nums sm:min-w-5 sm:px-1.5 sm:text-[11px] sm:leading-5", option.attention && option.count > 0 ? "bg-[#fff6e4] text-[#8a5200]" : active ? "bg-[#eeedff] text-[#554dc4]" : "bg-white/70 text-[#7d8490]")}>{dashboardNumber(option.count, locale)}</span>
      </button>;
    })}
  </div>;
}

export function DashboardSearchInput({ value, onChange, label, placeholder, clearLabel }: { value: string; onChange: (value: string) => void; label: string; placeholder: string; clearLabel: string }) {
  return <div className="relative min-w-0 xl:w-72">
    <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-[#7d8490]" aria-hidden="true" />
    <input type="search" value={value} onChange={event => onChange(event.target.value)} aria-label={label} placeholder={placeholder} className="h-12 w-full rounded-2xl border border-[#e2e6ec] bg-white pe-11 ps-11 text-sm text-[#182027] outline-none placeholder:text-[#7d8490] focus:border-[#8970b6] focus:ring-2 focus:ring-[#7667bd]/10 [&::-webkit-search-cancel-button]:appearance-none" />
    {value && <button type="button" aria-label={clearLabel} onClick={() => onChange("")} className="absolute end-0 top-0 grid size-12 place-items-center rounded-full text-[#626a76]"><X size={16} /></button>}
  </div>;
}

export function pageSlice<T>(items: readonly T[], page: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / DASHBOARD_PAGE_SIZE)), current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * DASHBOARD_PAGE_SIZE;
  return { page: current, pageCount, start, total: items.length, items: items.slice(start, start + DASHBOARD_PAGE_SIZE) };
}

export function DashboardPagination({ page, pageCount, onChange, label, locale, className }: { page: number; pageCount: number; onChange: (page: number) => void; label: string; locale: RequestLocale; className?: string }) {
  if (pageCount <= 1) return null;
  const fa = locale === "fa", Prev = fa ? ChevronRight : ChevronLeft, Next = fa ? ChevronLeft : ChevronRight;
  const button = "grid size-10 place-items-center rounded-full border border-[#e2e6ec] bg-white text-[#3f3a55] outline-none transition-colors hover:border-[#c9c2ec] hover:text-[#4f46c8] focus-visible:ring-2 focus-visible:ring-[#635bff]/30 disabled:pointer-events-none disabled:opacity-40";
  return <nav aria-label={label} className={cn("flex items-center gap-2", className)}>
    <button type="button" className={button} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={fa ? "صفحه قبل" : "Previous page"} data-page-prev><Prev size={18} aria-hidden="true" /></button>
    <span className="min-w-20 text-center text-xs font-medium text-[#66617a]">{fa ? `صفحه ${dashboardNumber(page, locale)} از ${dashboardNumber(pageCount, locale)}` : `Page ${dashboardNumber(page, locale)} of ${dashboardNumber(pageCount, locale)}`}</span>
    <button type="button" className={button} disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label={fa ? "صفحه بعد" : "Next page"} data-page-next><Next size={18} aria-hidden="true" /></button>
  </nav>;
}

export function DashboardListFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <footer className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-[#e8e3f1] bg-white/60 px-5 py-4 sm:px-7", className)}>{children}</footer>;
}
