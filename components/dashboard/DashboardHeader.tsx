"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SlidersHorizontal, X, ShieldCheck, LogOut } from "lucide-react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref, type DashboardTab } from "@/lib/dashboard/navigation";
import type { Profile } from "@/app/[locale]/dashboard/dashboard.types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DashboardButton } from "./dashboard-ui";
import { DashboardInitials } from "./DashboardInitials";
import controls from "@/styles/dashboard/DashboardIdentity.module.css";

export function DashboardHeader({ activeTab, profile, privateAmounts, onTogglePrivacy, motion = true, onToggleMotion, sound = true, onToggleSound }: {
  activeTab: DashboardTab; profile: Profile | null; privateAmounts: boolean; onTogglePrivacy: () => void; motion?: boolean; onToggleMotion?: () => void; sound?: boolean; onToggleSound?: () => void;
}) {
  const locale = useLocale(), fa = locale === "fa", copy = dashboardCopy[locale], pathname = usePathname(), query = useSearchParams();
  const [preferences, setPreferences] = useState(false);
  const router = useRouter();
  const signingOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  async function signOut() {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true); setSignOutError(false);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      router.replace(`/${locale}/login`); router.refresh();
    } catch {
      signingOutRef.current = false;
      setSigningOut(false); setSignOutError(true);
    }
  }
  const targetLocale = fa ? "en" : "fa";
  const profileName = profile?.first_name?.trim() && profile?.last_name?.trim()
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.full_name?.trim() || profile?.first_name || profile?.last_name;
  const switchPath = pathname.replace(/^\/(en|fa)(?=\/|$)/, `/${targetLocale}`) + (query.toString() ? `?${query}` : "");
  return <>
    <header className="sticky top-0 z-20 mx-auto w-full max-w-[1256px] px-4 pt-4 sm:px-8 sm:pt-5 lg:px-10">
      <div className="flex min-h-[72px] items-center justify-between gap-2 rounded-3xl border border-white/90 bg-white/65 px-3 py-3 shadow-[0_8px_32px_-22px_#8c79af50,inset_0_1px_0_#fff] ring-1 ring-[#ded8ec]/35 backdrop-blur-xl sm:gap-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><Image src="/images/logo-no-text-light.svg" alt="Zarman" width={32} height={32} className="shrink-0 min-[900px]:hidden"/><div className="hidden min-w-0 min-[480px]:block"><span className="block truncate text-sm font-semibold text-[#453854]">{activeTab === "overview" ? fa ? "پنل مدیریت تراکنش" : "Transaction Management Panel" : activeTab === "feedback" ? fa ? "ثبت بازخورد" : "Submit Feedback" : copy[activeTab]}</span></div></div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {profile?.kyc_status === "approved" && <span className="me-2 hidden items-center gap-1.5 rounded-full bg-[#e6f6f0]/70 px-3 py-2 text-[11px] text-[#347963] lg:inline-flex"><ShieldCheck size={14} aria-hidden="true"/>{fa ? "هویت تأیید شده" : "Identity verified"}</span>}
        <Link className={`${controls.control} ${controls.language}`} href={switchPath} aria-label={targetLocale === "fa" ? "فارسی" : "English"} lang={targetLocale} dir={targetLocale === "fa" ? "rtl" : "ltr"}>{targetLocale === "fa" ? "فارسی" : "English"}</Link>
        <button type="button" className={`${controls.control} ${controls.settings}`} onClick={() => setPreferences(true)} aria-label={fa ? "تنظیمات نمایش" : "Display preferences"} title={fa ? "تنظیمات نمایش" : "Display preferences"}><SlidersHorizontal size={19} strokeWidth={1.7} aria-hidden="true"/></button>
        <Link className={controls.profileLink} href={dashboardHref(locale, "profile")} aria-label={copy.profile} title={copy.profile} aria-current={activeTab === "profile" ? "page" : undefined}>
          <span className={`${controls.control} ${controls.avatar}`}><DashboardInitials name={profileName}/></span>
        </Link>
        <button type="button" className={`${controls.control} ${controls.settings} ${controls.mobileSignOut}`} onClick={signOut} disabled={signingOut} aria-busy={signingOut} aria-label={copy.signOut} title={copy.signOut}><LogOut size={19} strokeWidth={1.7} aria-hidden="true"/></button>
      </div>
      </div>
      {signOutError && <p role="alert" className="mb-0 mt-2 rounded-xl border border-rose-200 bg-white p-3 text-sm text-rose-700 min-[900px]:hidden">{fa ? "خروج ناموفق بود. دوباره تلاش کنید." : "Sign out failed. Please retry."}</p>}
    </header>
    <Dialog open={preferences} onOpenChange={setPreferences}>
      <DialogContent showCloseButton={false} dir={fa ? "rtl" : "ltr"} className={`gap-0 rounded-3xl border-[#e9ecf0] bg-white p-6 text-[#182027] sm:max-w-sm ${!motion ? "animate-none!" : ""}`} overlayClassName={!motion ? "animate-none!" : undefined}>
        <div className="mb-1 flex items-center justify-between gap-4"><DialogTitle className="m-0! text-xl! leading-snug! text-[#182027]!">{fa ? "تنظیمات نمایش" : "Display preferences"}</DialogTitle><button className="grid size-11 place-items-center rounded-full hover:bg-[#f1f3f6]" onClick={() => setPreferences(false)} aria-label={fa ? "بستن" : "Close"}><X size={18}/></button></div>
        <DialogDescription className="mb-5 text-sm text-[#626a76]">{fa ? "نمایش داشبورد را مطابق سلیقه خود تنظیم کنید." : "Make this dashboard comfortable for you."}</DialogDescription>
        <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 border-b border-[#e9ecf0] py-3 text-sm"><span>{copy.privacy}</span><input type="checkbox" className="size-5 accent-[#635bff]" checked={privateAmounts} onChange={onTogglePrivacy}/></label>
        {onToggleMotion && <label className={`flex min-h-16 cursor-pointer items-center justify-between gap-4 py-3 text-sm ${onToggleSound ? "border-b border-[#e9ecf0]" : ""}`}><span>{fa ? "انیمیشن‌ها" : "Animations"}</span><input type="checkbox" className="size-5 accent-[#635bff]" checked={motion} onChange={onToggleMotion}/></label>}
        {onToggleSound && <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 py-3 text-sm"><span>{fa ? "صدای اعلان پیام‌ها" : "Message notification sound"}</span><input type="checkbox" className="size-5 accent-[#635bff]" checked={sound} onChange={onToggleSound}/></label>}
        <DashboardButton className="mt-5 w-full" onClick={() => setPreferences(false)}>{fa ? "انجام شد" : "Done"}</DashboardButton>
      </DialogContent>
    </Dialog>
  </>;
}
