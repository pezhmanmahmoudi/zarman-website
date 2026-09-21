"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SlidersHorizontal, UserRound, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref, type DashboardTab } from "@/lib/dashboard/navigation";
import type { Profile } from "@/app/[locale]/dashboard/dashboard.types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DashboardButton } from "./dashboard-ui";

export function DashboardHeader({ activeTab, profile, privateAmounts, onTogglePrivacy, motion = true, onToggleMotion }: {
  activeTab: DashboardTab; profile: Profile | null; privateAmounts: boolean; onTogglePrivacy: () => void; motion?: boolean; onToggleMotion?: () => void;
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale], pathname = usePathname(), query = useSearchParams();
  const [preferences, setPreferences] = useState(false);
  const targetLocale = fa ? "en" : "fa";
  const switchPath = pathname.replace(/^\/(en|fa)(?=\/|$)/, `/${targetLocale}`) + (query.toString() ? `?${query}` : "");
  return <>
    <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-3 border-b border-[#ded8eb]/80 bg-[#faf8ff]/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
      <div className="flex min-w-0 items-center gap-3"><Image src="/images/logo-no-text-light.svg" alt="Zarman" width={30} height={30} className="shrink-0 min-[900px]:hidden"/><span className="truncate text-sm font-medium text-[#626a76]">{copy[activeTab]}</span></div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <Link className="flex min-h-11 items-center rounded-full px-2.5 text-xs font-medium text-[#626a76] hover:bg-[#eef0f4]" href={switchPath} aria-label={targetLocale === "fa" ? "فارسی" : "English"} lang={targetLocale}>{targetLocale === "fa" ? "فارسی" : "English"}</Link>
        <button type="button" className="grid size-11 place-items-center rounded-full text-[#626a76] hover:bg-[#eef0f4]" onClick={() => setPreferences(true)} aria-label={fa ? "تنظیمات نمایش" : "Display preferences"}><SlidersHorizontal size={18} aria-hidden="true"/></button>
        <Link className="grid size-11 place-items-center rounded-full border border-[#e1e4eb] bg-white text-sm font-semibold text-[#20242c]" href={dashboardHref(locale, "profile")} aria-label={copy.profile}>{profile?.first_name?.trim().slice(0, 1).toLocaleUpperCase() || <UserRound size={18} aria-hidden="true"/>}</Link>
      </div>
    </header>
    <Dialog open={preferences} onOpenChange={setPreferences}>
      <DialogContent showCloseButton={false} dir={fa ? "rtl" : "ltr"} className={`gap-0 rounded-3xl border-[#e9ecf0] bg-white p-6 text-[#182027] sm:max-w-sm ${!motion ? "animate-none!" : ""}`} overlayClassName={!motion ? "animate-none!" : undefined}>
        <div className="mb-1 flex items-center justify-between gap-4"><DialogTitle className="m-0! text-xl! leading-snug! text-[#182027]!">{fa ? "تنظیمات نمایش" : "Display preferences"}</DialogTitle><button className="grid size-11 place-items-center rounded-full hover:bg-[#f1f3f6]" onClick={() => setPreferences(false)} aria-label={fa ? "بستن" : "Close"}><X size={18}/></button></div>
        <DialogDescription className="mb-5 text-sm text-[#626a76]">{fa ? "نمایش داشبورد را مطابق سلیقه خود تنظیم کنید." : "Make this dashboard comfortable for you."}</DialogDescription>
        <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 border-b border-[#e9ecf0] py-3 text-sm"><span>{copy.privacy}</span><input type="checkbox" className="size-5 accent-[#635bff]" checked={privateAmounts} onChange={onTogglePrivacy}/></label>
        {onToggleMotion && <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 py-3 text-sm"><span>{fa ? "انیمیشن‌ها" : "Animations"}</span><input type="checkbox" className="size-5 accent-[#635bff]" checked={motion} onChange={onToggleMotion}/></label>}
        <DashboardButton className="mt-5 w-full" onClick={() => setPreferences(false)}>{fa ? "انجام شد" : "Done"}</DashboardButton>
      </DialogContent>
    </Dialog>
  </>;
}
