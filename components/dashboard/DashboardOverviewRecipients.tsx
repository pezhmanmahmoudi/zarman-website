"use client";

import { useEffect, useState } from "react";
import { DashboardTabLink as Link } from "./DashboardTabLink";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRecentRecipients } from "@/app/actions/transaction.actions";
import type { Recipient } from "@/app/[locale]/dashboard/dashboard.types";
import { dashboardHref } from "@/lib/dashboard/navigation";
import { recipientShade, recipientShadeIndexes } from "@/lib/dashboard/recipient-shades";
import { cn } from "@/lib/utils";
import { DashboardButton, DashboardMagicCard, dashboardCardLink } from "./dashboard-ui";
import { DashboardOverviewCardHeading } from "./DashboardOverviewCardHeading";
import { DashboardInitials } from "./DashboardInitials";

type RecipientPreview = Pick<Recipient, "id" | "user_id" | "direction" | "label" | "account_name" | "full_name" | "bank_name" | "bank_city" | "created_at">;

function RecipientRow({ recipient, locale, shadeIndex }: { recipient: RecipientPreview; locale: "fa" | "en"; shadeIndex: number }) {
  const fa = locale === "fa", aud = recipient.direction === "aud", palette = recipientShade(recipient.direction, shadeIndex), Chevron = fa ? ChevronLeft : ChevronRight;
  const name = recipient.account_name || recipient.full_name || recipient.label || (fa ? "گیرنده" : "Recipient");
  const bank = [recipient.bank_name, recipient.bank_city].filter(Boolean).join(" · ") || (aud ? fa ? "حساب بانکی استرالیا" : "Australian bank account" : fa ? "حساب بانکی ایران" : "Iranian bank account");
  return <div data-recipient-id={recipient.id} className="flex min-h-20 min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3.5 @sm:flex-nowrap @sm:gap-x-4 @sm:px-5"
    style={{ background: `linear-gradient(100deg, #ffffff 40%, ${palette.soft} 100%)`, borderColor: palette.border, boxShadow: "0 1px 2px #1a1a2e06" }}>
    <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full text-base font-semibold ring-2 ring-white" style={{ color: palette.initials, background: `linear-gradient(145deg, ${palette.from}, ${palette.to})`, boxShadow: `0 8px 18px -10px ${palette.to}99, inset 0 1px 0 #ffffff40` }}><DashboardInitials name={recipient.account_name || recipient.full_name || recipient.label} /></span>
    <span className="min-w-0 flex-1 basis-40">
      <span className="block truncate text-[15px] font-semibold leading-relaxed text-[#25213e]"><bdi data-private-value>{name}</bdi></span>
      <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-[#7a748c]"><span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4" style={{ color: palette.ink, background: palette.soft }}>{aud ? fa ? "دلار" : "AUD" : fa ? "تومان" : "Toman"}</span><bdi className="truncate">{bank}</bdi></span>
    </span>
    <Link className={cn(dashboardCardLink, "ms-auto shrink-0")} href={`${dashboardHref(locale, "transfer")}&requestDirection=${aud ? "buy_aud" : "sell_aud"}&recipient=${encodeURIComponent(recipient.id)}`}>{fa ? "ارسال وجه" : "Send money"}<span className="sr-only"> — <bdi>{name}</bdi></span><Chevron size={16} aria-hidden="true" /></Link>
  </div>;
}

export function DashboardOverviewRecipients({ locale, ownerId, motionEnabled }: { locale: "fa" | "en"; ownerId?: string; motionEnabled: boolean }) {
  const fa = locale === "fa";
  const [state, setState] = useState<{ ownerId?: string; rows: RecipientPreview[]; status: "loading" | "ready" | "error" }>({ ownerId, rows: [], status: "loading" });
  useEffect(() => {
    let active = true;
    if (!ownerId) return;
    getRecentRecipients().then(result => {
      if (!active) return;
      setState("data" in result && result.data ? { ownerId, rows: result.data.slice(0, 2), status: "ready" } : { ownerId, rows: [], status: "error" });
    }).catch(() => { if (active) setState({ ownerId, rows: [], status: "error" }); });
    return () => { active = false; };
  }, [ownerId]);
  const status = state.ownerId === ownerId ? state.status : "loading";
  const rows = state.ownerId === ownerId ? state.rows : [];
  const shadeIndexes = recipientShadeIndexes(rows);
  return <DashboardMagicCard tone="sky" replayLottieOnHover motionEnabled={motionEnabled} className="h-full" contentClassName="flex h-full flex-col p-0 sm:p-0" data-overview-card="recipients">
    <header className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6"><DashboardOverviewCardHeading eyebrow={fa ? "برای انتقال بعدی" : "Ready for the next transfer"} title={fa ? "گیرندگان شما" : "Your recipients"} scene="recipient-avatar" motionEnabled={motionEnabled}><p className="mb-0 mt-1.5 text-xs leading-5 text-[#4e7187]">{fa ? "افرادی که اخیراً برای آن‌ها وجه ارسال کرده‌اید." : "People you have recently sent money to."}</p></DashboardOverviewCardHeading></header>
    <div className="px-4 pb-5 sm:px-5">
      {status === "ready" && rows.length ? <ul className="m-0 list-none space-y-3 p-0">{rows.map((recipient, index) => <li key={recipient.id} className="@container min-w-0"><RecipientRow recipient={recipient} locale={locale} shadeIndex={shadeIndexes[index]} /></li>)}</ul>
        : status === "error" ? <p role="status" className="m-0 px-1 pt-4 text-sm text-[#4e7187]">{fa ? "فهرست گیرندگان فعلاً در دسترس نیست." : "Recipients are temporarily unavailable."}</p>
          : status === "loading" ? <p role="status" className="mt-3 px-1 text-sm text-[#4e7187]">{fa ? "در حال دریافت گیرندگان…" : "Loading recipients…"}</p>
            : <p className="mb-0 mt-3 px-1 text-sm text-[#4e7187]">{fa ? "هنوز گیرنده‌ای به لیست شما اضافه نشده است. با ثبت اطلاعات گیرندگان، انتقال‌های بعدی را در چند ثانیه انجام دهید." : "No recipients added yet. Save recipient details to make future transfers in seconds."}</p>}
    </div>
    <footer className="mt-auto flex justify-end border-t border-[#cfe2ed] bg-white/55 px-5 py-3 sm:px-6"><DashboardButton tone="secondary" asChild><Link href={dashboardHref(locale, "recipients")}>{fa ? "مدیریت گیرندگان" : "Manage recipients"}</Link></DashboardButton></footer>
  </DashboardMagicCard>;
}
