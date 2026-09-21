"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Plus, RefreshCw, Search, X } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { DashboardCard, DashboardMagicCard, DashboardButton, DashboardPageHeader } from "./dashboard-ui";
import { DashboardMotionIcon } from "@/components/dashboard/DashboardMotionIcon";

import { useDashboard } from "./DashboardShell";
import { getRecipients } from "@/app/actions/transaction.actions";
import { RecipientModal } from "./RecipientModal";
import type { Recipient, RecipientDirection } from "@/app/[locale]/dashboard/dashboard.types";
import { dashboardHref } from "@/lib/dashboard/navigation";
import { cn } from "@/lib/utils";

type CountryFilter = "all" | RecipientDirection;
type DirectoryState = { ownerId: string | undefined; recipients: Recipient[]; status: "loading" | "ready" | "error" };
const normalizeSearch = (value: string) => value.normalize("NFKC").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\u200d]/g, " ").trim().toLocaleLowerCase();

export function DashboardRecipients() {
  const locale = useLocale(), fa = locale === "fa", { profile, motionEnabled = true } = useDashboard();
  const reducedMotion = useReducedMotion(), animate = motionEnabled && reducedMotion === false;
  const ownerId = profile?.id;
  const [directory, setDirectory] = useState<DirectoryState>({ ownerId, recipients: [], status: "loading" });
  const [direction, setDirection] = useState<CountryFilter>("all");
  const [query, setQuery] = useState(""), [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ ownerId: string | undefined; mode: "standard" | "self_destination" } | null>(null);
  const readVersion = useRef(0), activeOwner = useRef<string | undefined | null>(ownerId);
  const text = (en: string, persian: string) => fa ? persian : en;

  useEffect(() => {
    let active = true;
    activeOwner.current = ownerId;
    const version = ++readVersion.current;
    getRecipients().then(result => {
      if (!active || version !== readVersion.current) return;
      setDirectory("data" in result && result.data
        ? { ownerId, recipients: result.data, status: "ready" }
        : { ownerId, recipients: [], status: "error" });
    }).catch(() => { if (active && version === readVersion.current) setDirectory({ ownerId, recipients: [], status: "error" }); });
    return () => { active = false; activeOwner.current = null; };
  }, [attempt, ownerId]);

  const sameOwner = directory.ownerId === ownerId;
  const recipients = sameOwner ? directory.recipients : [];
  const loading = !sameOwner || directory.status === "loading", error = sameOwner && directory.status === "error";
  const term = normalizeSearch(query);
  const filtered = recipients.filter(recipient => (direction === "all" || recipient.direction === direction)
    && normalizeSearch([recipient.label, recipient.account_name, recipient.full_name, recipient.bank_name, recipient.bank_city].filter(Boolean).join(" ")).includes(term));
  const countries: { value: CountryFilter; label: string }[] = [
    { value: "all", label: text("All recipients", "همه گیرندگان") },
    { value: "aud", label: text("Australia", "استرالیا") },
    { value: "irt", label: text("Iran", "ایران") },
  ];
  function retry() { setDirectory({ ownerId, recipients: [], status: "loading" }); setAttempt(value => value + 1); }
  function resetFilters() { setDirection("all"); setQuery(""); }
  function openModal(mode: "standard" | "self_destination") { setModal({ ownerId, mode }); }

  return <div className="min-w-0 space-y-7" dir={fa ? "rtl" : "ltr"}>
    <DashboardPageHeader title={text("Recipients", "گیرندگان")} description={text("Saved accounts, ready for your next transfer.", "حساب‌های ذخیره‌شده، آماده برای انتقال بعدی شما.")} action={<DashboardButton className="w-full sm:w-auto" onClick={() => openModal("standard")}><Plus size={18} aria-hidden="true"/>{text("Add recipient", "افزودن گیرنده")}</DashboardButton>}/>
    <section className="space-y-5" aria-label={text("Saved recipients", "گیرندگان ذخیره‌شده")}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-[#eceef3] p-1" role="group" aria-label={text("Recipient country", "کشور گیرنده")}>
          {countries.map(country => <button key={country.value} type="button" data-recipient-country={country.value} aria-pressed={direction === country.value} onClick={() => setDirection(country.value)} className={cn("relative isolate flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-medium transition-colors", direction === country.value ? "text-[#182027]" : "text-[#626a76] hover:text-[#182027]")}>
            {direction === country.value && <motion.span layoutId={animate ? "recipient-country-filter" : undefined} className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm" transition={{ duration: animate ? .2 : 0 }}/>}<span>{country.label}</span>
          </button>)}
        </div>
        <div className="relative min-w-0 sm:w-72"><Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-[#7d8490]" aria-hidden="true"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={text("Find a recipient", "جستجوی گیرنده")} placeholder={text("Search name or bank", "جستجوی نام یا بانک")} className="h-12 w-full rounded-2xl border border-[#e2e6ec] bg-white pe-11 ps-11 text-sm text-[#182027] outline-none placeholder:text-[#7d8490] focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10 [&::-webkit-search-cancel-button]:appearance-none"/>{query && <button type="button" aria-label={text("Clear search", "پاک کردن جستجو")} onClick={() => setQuery("")} className="absolute end-0 top-0 grid size-12 place-items-center rounded-full text-[#626a76]"><X size={16}/></button>}</div>
      </div>
      {!loading && !error && selectedId && recipients.some(recipient => recipient.id === selectedId) && <p role="status" className="m-0 flex items-center gap-2 text-sm text-[#177549]"><Check size={16} aria-hidden="true"/>{text("Recipient saved. Ready for your next transfer.", "گیرنده ذخیره شد و برای انتقال بعدی آماده است.")}</p>}
      {loading ? <DashboardCard><p role="status" className="m-0 py-3 text-sm text-[#626a76]">{text("Loading your recipients…", "در حال دریافت گیرندگان…")}</p></DashboardCard>
        : error ? <DashboardCard className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div role="alert"><h2 className="m-0! text-base! font-semibold text-[#182027]!">{text("We couldn’t load your recipients.", "دریافت گیرندگان ممکن نشد.")}</h2><p className="mb-0 mt-2 text-sm text-[#626a76]">{text("Please try again.", "لطفاً دوباره تلاش کنید.")}</p></div><DashboardButton tone="secondary" onClick={retry}><RefreshCw size={16}/>{text("Try again", "تلاش دوباره")}</DashboardButton></DashboardCard>
          : recipients.length === 0 ? <DashboardCard className="flex flex-col items-center py-10 text-center sm:py-12">
            <DashboardMotionIcon name="recipients" size={96} motionEnabled={motionEnabled} className="mb-6"/>
            <h2 className="m-0! text-xl! font-semibold text-[#182027]!">{text("Your recipients will live here", "گیرندگان شما اینجا نمایش داده می‌شوند")}</h2><p className="mb-6 mt-3 max-w-sm text-sm leading-6 text-[#626a76]">{text("Save someone’s bank details once. Send to them whenever you need.", "اطلاعات بانکی گیرنده را یک‌بار ذخیره کنید و هر زمان نیاز داشتید، انتقال دهید.")}</p><DashboardButton onClick={() => openModal("standard")}>{text("Add your first recipient", "افزودن اولین گیرنده")}</DashboardButton>
          </DashboardCard>
            : filtered.length === 0 ? <DashboardCard className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="m-0! text-lg! font-semibold text-[#182027]!">{text("No matching recipients", "گیرنده‌ای پیدا نشد")}</h2><p className="mb-0 mt-2 text-sm text-[#626a76]">{text("Try another name or clear your filters.", "نام دیگری جستجو کنید یا فیلترها را پاک کنید.")}</p></div><DashboardButton tone="secondary" onClick={resetFilters}>{text("Reset filters", "پاک کردن فیلترها")}</DashboardButton></DashboardCard>
              : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((recipient, index) => {
                const number = recipient.account_number || recipient.shaba_number || recipient.irt_account_number || "";
                const name = recipient.account_name || recipient.full_name || recipient.label || text("Recipient", "گیرنده");
                const aud = recipient.direction === "aud", selected = selectedId === recipient.id;
                return <article key={recipient.id} data-recipient-id={recipient.id} data-selected={selected} className="min-w-0"><motion.div className="h-full" initial={animate ? { opacity: 0, filter: "blur(3px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: animate ? .3 : 0, delay: animate ? Math.min(index, 5) * .035 : 0 }}>
                  <DashboardMagicCard tone={aud ? "sky" : "teal"} motionEnabled={motionEnabled} className={cn("h-full", selected && "ring-2 ring-[#a48bd2]")} contentClassName="flex h-full flex-col p-5 sm:p-6">
                    <div className="mb-5 flex items-center justify-between gap-3"><span className={cn("grid size-12 place-items-center rounded-2xl border text-lg font-semibold shadow-[0_2px_0_#ffffff]", aud ? "border-[#a9cfe5] bg-[#d6edff] text-[#185a82]" : "border-[#aad8cf] bg-[#cdf0e7] text-[#17635e]")} aria-hidden="true">{Array.from(name.trim())[0]?.toUpperCase()}</span><span className="text-xs text-[#626a76]">{aud ? text("Australia", "استرالیا") : text("Iran", "ایران")}</span></div>
                    <h2 className="m-0! break-words text-lg! font-semibold leading-relaxed! text-[#182027]!"><bdi data-private-value>{name}</bdi></h2>
                    <p className="mb-0 mt-1.5 text-sm leading-6 text-[#626a76]">{recipient.bank_name || text("Bank account", "حساب بانکی")}{recipient.bank_city ? ` · ${recipient.bank_city}` : ""}</p>
                    <p className="mb-5 mt-2 text-sm tabular-nums text-[#7d8490]"><bdi data-private-value>{number ? `•••• ${number.slice(-4)}` : "—"}</bdi></p>
                    <DashboardButton tone="secondary" asChild className="mt-auto w-full"><Link href={`${dashboardHref(locale, "transfer")}&requestDirection=${aud ? "buy_aud" : "sell_aud"}&recipient=${encodeURIComponent(recipient.id)}`}>{text("Send money", "ارسال وجه")}</Link></DashboardButton>
                  </DashboardMagicCard>
                </motion.div></article>;
              })}</div>}
    </section>
    <div className="flex flex-col items-start justify-between gap-3 border-t border-[#e2e6ec] pt-5 sm:flex-row sm:items-center"><p className="m-0 text-sm text-[#626a76]">{text("Sending to an account in your own name?", "به حسابی به نام خودتان انتقال می‌دهید؟")}</p><DashboardButton tone="quiet" onClick={() => openModal("self_destination")}>{text("Add my account", "افزودن حساب شخصی")}</DashboardButton></div>
    {modal && modal.ownerId === ownerId && <RecipientModal key={`${ownerId}-${modal.mode}`} direction={direction === "irt" ? "irt" : "aud"} mode={modal.mode} profile={profile} locale={locale} motionEnabled={motionEnabled} onClose={() => setModal(null)} onCreated={recipient => {
      if (activeOwner.current !== ownerId) return;
      if (recipient.user_id && ownerId && recipient.user_id !== ownerId) return;
      ++readVersion.current;
      setDirectory(previous => ({ ownerId, recipients: [recipient, ...(previous.ownerId === ownerId ? previous.recipients : []).filter(item => item.id !== recipient.id)], status: "ready" }));
      setSelectedId(recipient.id); resetFilters();
    }}/>}
  </div>;
}
