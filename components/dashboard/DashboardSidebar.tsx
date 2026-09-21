"use client";
import Link from "next/link";
import Image from "next/image";
import { House, Send, History, UserRound, UsersRound, MessageCircle, LogOut } from "lucide-react";
import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/context/LocaleContext";
import { dashboardCopy, dashboardHref, type DashboardTab } from "@/lib/dashboard/navigation";
import { cn } from "@/lib/utils";

export function DashboardSidebar({ activeTab, motionEnabled = true }: { activeTab: DashboardTab; motionEnabled?: boolean }) {
  const locale = useLocale(), copy = dashboardCopy[locale], router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const id = useId(), reduced = useReducedMotion(), animate = motionEnabled && reduced === false;
  const items = [{ tab: "overview", Icon: House }, { tab: "transfer", Icon: Send }, { tab: "history", Icon: History }, { tab: "recipients", Icon: UsersRound }, { tab: "profile", Icon: UserRound }] as const;
  async function signOut() {
    if (busy) return;
    setBusy(true); setError(false);
    try { const { error } = await supabase.auth.signOut({ scope: "local" }); if (error) throw error; router.replace(`/${locale}/login`); router.refresh(); }
    catch { setError(true); setBusy(false); }
  }
  function activeSurface(mobile = false) {
    return <motion.span aria-hidden="true" layoutId={animate ? `${id}-${mobile ? "mobile" : "desktop"}` : undefined} className={cn("absolute inset-0 -z-10 rounded-2xl", mobile ? "bg-[#eeedff]" : "bg-[#eeedff]")} transition={{ type: "spring", stiffness: 420, damping: 38, duration: animate ? .3 : 0 }}/>;
  }
  return <>
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-[220px] flex-col border-e border-[#e9ecf0] bg-white px-4 py-7 min-[900px]:flex xl:w-[248px] xl:px-6">
      <Link href={dashboardHref(locale, "overview")} className="mb-12 flex w-fit items-center rounded-xl px-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#635bff]" aria-label="Zarman">
        <span className="grid size-[76px] place-items-center rounded-full border border-[#d8c9f2] bg-[radial-gradient(circle_at_35%_25%,#ffffff,#ede7fa)] shadow-[0_3px_0_#e4dced,inset_0_0_0_5px_#ffffffa6]"><Image src="/images/logo-no-text-light.svg" width={58} height={58} alt="Zarman" className="size-[58px] shrink-0 object-contain" style={{ transform: "none" }}/></span>
      </Link>
      <nav className="grid gap-1.5" aria-label={locale === "fa" ? "داشبورد" : "Dashboard"}>
        {items.map(({ tab, Icon }) => <Link key={tab} href={dashboardHref(locale, tab)} aria-current={activeTab === tab ? "page" : undefined} className={cn("relative isolate flex min-h-[52px] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium no-underline transition-colors", activeTab === tab ? "text-[#5148c7]" : "text-[#626a76] hover:bg-[#f7f8fa] hover:text-[#182027]")}>
          {activeTab === tab && activeSurface()}<Icon size={19} strokeWidth={activeTab === tab ? 2 : 1.7} aria-hidden="true"/><span>{copy[tab]}</span>
        </Link>)}
      </nav>
      <div className="mt-auto grid gap-1 border-t border-[#eef0f3] pt-5">
        <Link className="flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm text-[#626a76] hover:bg-[#f7f8fa]" href={dashboardHref(locale, "feedback")} aria-current={activeTab === "feedback" ? "page" : undefined}><MessageCircle size={18} aria-hidden="true"/>{copy.feedback}</Link>
        <button className="flex min-h-12 items-center gap-3 rounded-2xl px-4 text-start text-sm text-[#626a76] hover:bg-[#f7f8fa] disabled:opacity-50" onClick={() => void signOut()} disabled={busy}><LogOut size={18} aria-hidden="true"/>{copy.signOut}</button>
        {error && <p role="alert" className="px-4 text-xs text-rose-700">{locale === "fa" ? "خروج ناموفق بود. دوباره تلاش کنید." : "Sign out failed. Please retry."}</p>}
      </div>
    </aside>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 border-t border-[#e9ecf0] bg-white px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] min-[900px]:hidden" aria-label={locale === "fa" ? "ناوبری اصلی" : "Main navigation"}>
      {items.filter(item => item.tab !== "profile").map(({ tab, Icon }) => <Link key={tab} href={dashboardHref(locale, tab)} aria-current={activeTab === tab ? "page" : undefined} className={cn("relative isolate flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium no-underline", activeTab === tab ? "text-[#5148c7]" : "text-[#626a76]")}>{activeTab === tab && activeSurface(true)}<Icon size={20} strokeWidth={1.8} aria-hidden="true"/><span>{copy[tab]}</span></Link>)}
    </nav>
  </>;
}
