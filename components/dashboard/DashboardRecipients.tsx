"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Pencil, Plus, RefreshCw, SearchX, Trash2, UserPlus, Users } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DashboardButton, DashboardMagicCard, DashboardPageHeader, dashboardCardLink } from "./dashboard-ui";
import { DashboardEmptyState, DashboardFilterPills, DashboardListFooter, DashboardListHeader, DashboardListToolbar, DashboardPagination, DashboardSearchInput } from "./dashboard-list";
import { DASHBOARD_PAGE_SIZE } from "@/lib/dashboard/paging";
import { DashboardInitials } from "./DashboardInitials";
import { useDashboard } from "./DashboardShell";
import { deleteRecipient, getRecipientPage } from "@/app/actions/transaction.actions";
import { RecipientModal } from "./RecipientModal";
import { accountTail } from "./TransferRecipientPicker";
import type { Recipient, RecipientDirection } from "@/app/[locale]/dashboard/dashboard.types";
import type { RequestLocale } from "@/lib/requests/types";
import { dashboardHref } from "@/lib/dashboard/navigation";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import { recipientShade, recipientShadeIndexes } from "@/lib/dashboard/recipient-shades";
import { cn } from "@/lib/utils";

type CountryFilter = "all" | RecipientDirection;
type DirectoryState = { ownerId: string | undefined; key: string; recipients: Recipient[]; total: number; page: number; counts: Record<CountryFilter, number>; status: "loading" | "ready" | "error" };
const noCounts: Record<CountryFilter, number> = { all: 0, aud: 0, irt: 0 };

function RecipientCard({ recipient, locale, shadeIndex, selected, onEdit, onDelete }: { recipient: Recipient; locale: RequestLocale; shadeIndex: number; selected: boolean; onEdit: () => void; onDelete: () => void }) {
  const fa = locale === "fa", text = (en: string, persian: string) => fa ? persian : en;
  const aud = recipient.direction === "aud", palette = recipientShade(recipient.direction, shadeIndex), Chevron = fa ? ChevronLeft : ChevronRight;
  const name = recipient.account_name || recipient.full_name || recipient.label || text("Recipient", "گیرنده");
  const where = [recipient.bank_city, aud ? text("Australia", "استرالیا") : text("Iran", "ایران")].filter(Boolean).join(" · ");
  const tail = accountTail(recipient);
  const nameId = `recipient-name-${recipient.id}`;
  const iconButton = "size-9 min-h-9 shrink-0 rounded-full p-0 text-[#8a8499]";
  return <DashboardMagicCard tone={aud ? "amber" : "sky"} pointerEffect={false} motionEnabled={false} className={cn("h-full", selected && "ring-2 ring-[#635bff]/25")} contentClassName="flex h-full flex-col p-4 sm:p-5"
    style={{ background: palette.soft, borderColor: palette.border, boxShadow: `0 1px 2px #1a1a2e08, 0 14px 30px -26px ${palette.accent}66` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-white/85 px-2.5 py-1 text-[11px] font-semibold leading-4" style={{ color: palette.ink, borderColor: palette.border }}><span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: palette.accent }} />{aud ? text("AUD", "دلار") : text("Toman", "تومان")}</span>
        <div className="-me-2 flex items-center">
          <DashboardButton tone="quiet" className={`${iconButton} hover:bg-white hover:text-[#4f46c8]`} onClick={onEdit} aria-label={text("Edit recipient", "ویرایش گیرنده")} aria-describedby={nameId}><Pencil size={15} aria-hidden="true" /></DashboardButton>
          <DashboardButton tone="quiet" className={`${iconButton} hover:bg-white hover:text-[#be123c]`} onClick={onDelete} aria-label={text("Delete recipient", "حذف گیرنده")} aria-describedby={nameId}><Trash2 size={15} aria-hidden="true" /></DashboardButton>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 pb-4 pt-2 text-center">
        <span aria-hidden="true" className="grid size-[42px] shrink-0 place-items-center rounded-[14px] text-sm font-semibold" style={{ color: palette.ink, background: `${palette.accent}22` }}><DashboardInitials name={recipient.account_name || recipient.full_name || recipient.label} /></span>
        <div className="w-full min-w-0">
          <h3 id={nameId} className="m-0! truncate text-[15px]! font-semibold leading-relaxed! text-[#25213e]!"><bdi data-private-value>{name}</bdi></h3>
          <p className="m-0 mt-0.5 truncate text-xs text-[#756782]"><bdi>{where}</bdi></p>
        </div>
      </div>
      <p className="m-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-3 text-xs leading-6 text-[#625570]" style={{ borderColor: palette.border }}>
        <bdi className="min-w-0 truncate">{recipient.bank_name || (aud ? text("Australian bank account", "حساب بانکی استرالیا") : text("Iranian bank account", "حساب بانکی ایران"))}</bdi>
        {tail && <bdi dir="ltr" data-private-value className="whitespace-nowrap tabular-nums" style={{ fontFamily: "var(--font-en-stack)" }}>•••• {tail}</bdi>}
      </p>
      <Link className={cn(dashboardCardLink, "mx-auto mt-1")} href={`${dashboardHref(locale, "transfer")}&requestDirection=${aud ? "buy_aud" : "sell_aud"}&recipient=${encodeURIComponent(recipient.id)}`}>{text("Send money", "ارسال وجه")}<span className="sr-only"> — <bdi>{name}</bdi></span><Chevron size={16} aria-hidden="true" /></Link>
    </DashboardMagicCard>;
}

export function DashboardRecipients() {
  const locale = useLocale(), fa = locale === "fa", { profile, motionEnabled = true } = useDashboard();
  const ownerId = profile?.id;
  const [directory, setDirectory] = useState<DirectoryState>({ ownerId, key: "", recipients: [], total: 0, page: 1, counts: noCounts, status: "loading" });
  const [direction, setDirection] = useState<CountryFilter>("all");
  const [query, setQuery] = useState(""), [search, setSearch] = useState(""), [attempt, setAttempt] = useState(0), [page, setPage] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ ownerId: string | undefined; mode: "standard" | "self_destination"; recipient?: Recipient } | null>(null);
  const [removing, setRemoving] = useState<Recipient | null>(null), [removeBusy, setRemoveBusy] = useState(false), [removeError, setRemoveError] = useState(false);
  const activeOwner = useRef<string | undefined | null>(ownerId), removeBusyRef = useRef(false);
  const text = (en: string, persian: string) => fa ? persian : en;
  const key = JSON.stringify([ownerId ?? null, direction, search, page, attempt]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let active = true;
    activeOwner.current = ownerId;
    const failed = (previous: DirectoryState): DirectoryState => ({ ownerId, key, recipients: [], total: 0, page, counts: previous.ownerId === ownerId ? previous.counts : noCounts, status: "error" });
    getRecipientPage({ direction, search, page }).then(result => {
      if (!active) return;
      if (!("data" in result) || !result.data) { setDirectory(failed); return; }
      setDirectory({ ownerId, key, recipients: result.data, total: result.total, page: result.page, counts: result.counts, status: "ready" });
      if (result.page !== page) setPage(result.page);
    }).catch(() => { if (active) setDirectory(failed); });
    return () => { active = false; activeOwner.current = null; };
  }, [key, ownerId, direction, search, page]);

  const sameOwner = directory.ownerId === ownerId;
  const recipients = sameOwner ? directory.recipients : [], counts = sameOwner ? directory.counts : noCounts;
  const shadeIndexes = recipientShadeIndexes(recipients);
  const loading = !sameOwner || directory.status === "loading", error = sameOwner && directory.status === "error", refreshing = directory.key !== key;
  const total = sameOwner ? directory.total : 0, current = sameOwner ? directory.page : 1, pageCount = Math.max(1, Math.ceil(total / DASHBOARD_PAGE_SIZE));
  const term = search.trim();
  const countries = ([["all", text("All recipients", "همه گیرندگان")], ["aud", text("Australia", "استرالیا")], ["irt", text("Iran", "ایران")]] as const)
    .map(([value, label]) => ({ value, label, count: counts[value] }));
  const countryName = direction === "aud" ? text("Australia", "استرالیا") : text("Iran", "ایران");
  function retry() { setDirectory(previous => ({ ...previous, status: "loading" })); setAttempt(value => value + 1); }
  function resetFilters() { setDirection("all"); setQuery(""); setSearch(""); setPage(1); }
  function goTo(next: number) { setPage(next); listRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }
  function openModal(mode: "standard" | "self_destination", recipient?: Recipient) { setModal({ ownerId, mode, recipient }); }
  function closeRemove() { if (!removeBusyRef.current) setRemoving(null); }
  async function confirmRemove() {
    if (!removing || removeBusyRef.current) return;
    const target = removing, owner = ownerId;
    removeBusyRef.current = true; setRemoveBusy(true); setRemoveError(false);
    try {
      const result = await deleteRecipient(target.id);
      if (result && "error" in result) { setRemoveError(true); return; }
      if (activeOwner.current !== owner) return;
      setDirectory(previous => previous.ownerId === owner ? { ...previous, recipients: previous.recipients.filter(item => item.id !== target.id) } : previous);
      setAttempt(value => value + 1);
      setSelectedId(current => current === target.id ? null : current);
      setRemoving(null);
    } catch { setRemoveError(true); }
    finally { removeBusyRef.current = false; setRemoveBusy(false); }
  }

  return <div className="min-w-0 space-y-6 sm:space-y-7" dir={fa ? "rtl" : "ltr"}>
    <DashboardPageHeader title={text("Recipients", "گیرندگان")} description={text("Manage saved account details for faster and easier money transfers.", "مدیریت اطلاعات حساب افراد برای انتقال سریع‌تر و راحت‌ترِ وجه.")} action={<DashboardButton className="min-w-0 flex-1 sm:flex-none" onClick={() => openModal("standard")}><Plus size={18} aria-hidden="true" />{text("Add recipient", "افزودن گیرنده")}</DashboardButton>} />
    <DashboardMagicCard tone="violet" motionEnabled={motionEnabled} contentClassName="p-0 sm:p-0" aria-label={text("Saved recipients", "گیرندگان ذخیره‌شده")} data-recipient-directory>
      <DashboardListHeader title={text("Saved Accounts", "حساب‌های ذخیره‌شده")} description={text("Select a recipient to start transferring money.", "برای شروع انتقال وجه، گیرنده موردنظر را انتخاب کنید.")} scene="recipient-selection" motionEnabled={motionEnabled} />
      <DashboardListToolbar>
        <DashboardFilterPills label={text("Recipient country", "کشور گیرنده")} options={countries} value={direction} onChange={value => { setDirection(value); setPage(1); }} dataKey="data-recipient-country" locale={locale} />
        <DashboardSearchInput value={query} onChange={value => { setQuery(value); setPage(1); }} label={text("Find a recipient", "جستجوی گیرنده")} placeholder={text("Search name, account, or bank", "جستجوی نام، شماره حساب یا بانک")} clearLabel={text("Clear search", "پاک کردن جستجو")} />
      </DashboardListToolbar>
      {!loading && !error && selectedId && recipients.some(recipient => recipient.id === selectedId) && <p role="status" className="mx-4 mb-0 mt-4 flex items-center gap-2 rounded-2xl border border-[#bfe5cf] bg-[#ecf9f2] px-4 py-3 text-sm text-[#177549] sm:mx-7"><CircleCheck size={16} aria-hidden="true" />{text("Recipient saved. Ready for your next transfer.", "گیرنده ذخیره شد و برای انتقال بعدی آماده است.")}</p>}
      <div ref={listRef} aria-busy={loading || refreshing} className="scroll-mt-24">
        {loading ? <DashboardEmptyState role="status" title={text("Loading your recipients…", "در حال دریافت گیرندگان…")} />
          : error ? <DashboardEmptyState role="alert" icon={CircleAlert} title={text("We couldn’t load your recipients.", "دریافت گیرندگان ممکن نشد.")} description={text("Please check your connection and try again.", "لطفاً اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.")} action={<DashboardButton tone="secondary" onClick={retry}><RefreshCw size={16} aria-hidden="true" />{text("Try again", "تلاش دوباره")}</DashboardButton>} />
            : counts.all === 0 ? <DashboardEmptyState icon={Users} title={text("Your recipients will live here", "گیرندگان شما اینجا نمایش داده می‌شوند")} description={text("Save someone’s bank details once. Send to them whenever you need.", "اطلاعات بانکی گیرنده را یک‌بار ذخیره کنید و هر زمان نیاز داشتید، انتقال دهید.")} action={<DashboardButton onClick={() => openModal("standard")}>{text("Add your first recipient", "افزودن اولین گیرنده")}</DashboardButton>} />
              : recipients.length === 0 ? term ? <DashboardEmptyState icon={SearchX} title={text("No Recipients Found", "گیرنده‌ای یافت نشد")} />
                : <DashboardEmptyState icon={UserPlus} title={text(`No recipients in ${countryName} yet`, `لیست گیرندگان شما در ${countryName} خالی است`)} description={text("Save recipient bank details once to make future transfers in seconds.", "اطلاعات حساب بانکی گیرنده را یک‌بار ثبت کنید تا انتقال‌های بعدی در چند ثانیه انجام شود.")} action={<DashboardButton onClick={() => openModal("standard")}><Plus size={16} aria-hidden="true" />{text("Add New Recipient", "افزودن گیرنده جدید")}</DashboardButton>} />
                : <ul aria-label={text("Saved recipients", "گیرندگان ذخیره‌شده")} className="m-0 grid list-none grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-6 md:grid-cols-3 xl:grid-cols-4">{recipients.map((recipient, index) => <li key={recipient.id} className="min-w-0"><article data-recipient-id={recipient.id} data-selected={selectedId === recipient.id} className="h-full min-w-0"><RecipientCard recipient={recipient} locale={locale} shadeIndex={shadeIndexes[index]} selected={selectedId === recipient.id} onEdit={() => openModal("standard", recipient)} onDelete={() => { setRemoveError(false); setRemoving(recipient); }} /></article></li>)}</ul>}
        {!loading && !error && <DashboardPagination page={current} pageCount={pageCount} onChange={goTo} label={text("Recipient pages", "صفحه‌های گیرندگان")} locale={locale} className="justify-center px-4 pb-5 sm:pb-6" />}
      </div>
      <DashboardListFooter className="flex-col text-center sm:flex-row sm:text-start">
        <span className="text-sm text-[#66617a]">{text("Transferring to your own account?", "قصد انتقال وجه به حساب خودتان را دارید؟")}{!loading && !error && total > 0 && <span className="sr-only" aria-live="polite"> {fa ? `${dashboardNumber(total, locale)} گیرنده` : `${dashboardNumber(total, locale)} recipients`}</span>}</span>
        <DashboardButton onClick={() => openModal("self_destination")}><Plus size={16} aria-hidden="true" />{text("Add Personal Account", "افزودن حساب شخصی")}</DashboardButton>
      </DashboardListFooter>
    </DashboardMagicCard>
    {modal && modal.ownerId === ownerId && <RecipientModal key={`${ownerId}-${modal.mode}-${modal.recipient?.id ?? "new"}`} direction={direction === "irt" ? "irt" : "aud"} mode={modal.mode} recipient={modal.recipient} profile={profile} locale={locale} motionEnabled={motionEnabled} onClose={() => setModal(null)} onCreated={recipient => {
      if (activeOwner.current !== ownerId) return;
      if (recipient.user_id && ownerId && recipient.user_id !== ownerId) return;
      if (modal.recipient) {
        // Edits are saved as a new record, so swap out the previous one by its old id.
        const previousId = modal.recipient.id;
        setDirectory(previous => ({ ...previous, recipients: previous.recipients.map(item => item.id === previousId ? recipient : item) }));
        setSelectedId(recipient.id);
        return;
      }
      setSelectedId(recipient.id); resetFilters(); setAttempt(value => value + 1);
    }} />}
    {removing && <Dialog open onOpenChange={open => { if (!open) closeRemove(); }}>
      <DialogContent showCloseButton={false} dir={fa ? "rtl" : "ltr"} overlayClassName={!motionEnabled ? "animate-none! transition-none!" : undefined} className={cn("max-w-[440px] rounded-3xl border border-[#e9ecf0] bg-white p-6 sm:max-w-[440px]", !motionEnabled && "animate-none! transition-none!")}
        onEscapeKeyDown={event => { if (removeBusyRef.current) event.preventDefault(); }} onPointerDownOutside={event => { if (removeBusyRef.current) event.preventDefault(); }}>
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-[#fff1f2] text-[#be123c]"><Trash2 size={24} strokeWidth={1.7} /></span>
        <DialogTitle className="m-0! text-xl! font-semibold text-[#302346]!">{text("Delete this recipient?", "این گیرنده حذف شود؟")}</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-[#665876]"><bdi data-private-value className="font-semibold text-[#302346]">{removing.account_name || removing.full_name || removing.label}</bdi>{text(" will be removed from your saved accounts. Your past transactions won’t change.", " از حساب‌های ذخیره‌شده شما حذف می‌شود. تراکنش‌های قبلی شما تغییری نمی‌کنند.")}</DialogDescription>
        {removeError && <p role="alert" className="m-0 rounded-2xl bg-[#fff3f3] p-3 text-sm text-[#aa3545]">{text("We couldn’t delete this recipient. Please try again.", "حذف گیرنده ممکن نشد. لطفاً دوباره تلاش کنید.")}</p>}
        <div className="mt-2 flex flex-wrap-reverse justify-end gap-3"><DashboardButton tone="secondary" onClick={closeRemove} disabled={removeBusy} autoFocus>{text("Keep recipient", "انصراف")}</DashboardButton><DashboardButton onClick={() => void confirmRemove()} disabled={removeBusy} aria-busy={removeBusy} className="bg-[#be123c] hover:bg-[#9f1239]">{removeBusy ? text("Deleting…", "در حال حذف…") : text("Delete recipient", "حذف گیرنده")}</DashboardButton></div>
      </DialogContent>
    </Dialog>}
  </div>;
}
