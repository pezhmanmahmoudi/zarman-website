"use client";

import { DashboardTabLink as Link } from "./DashboardTabLink";
import { ArrowLeft, ArrowRight, Ban, Check, ChevronLeft, ChevronRight, Clock3, Download, PenLine, ReceiptText, Star, Undo2, X, type LucideIcon } from "lucide-react";
import { DashboardButton, DashboardMagicCard, StatusBadge, dashboardCardLink } from "@/components/dashboard/dashboard-ui";
import { dashboardHref } from "@/lib/dashboard/navigation";
import { dashboardPalette, dashboardStageTones, type DashboardTone } from "@/lib/dashboard/palette";
import { journeyPresentation } from "@/lib/dashboard/journey-presentation";
import { requestLottieScene } from "@/lib/dashboard/request-lottie-scene";
import { DashboardLottieScene } from "./DashboardLottieScene";
import { requestMoney, requestShortDate } from "@/components/requests/request-labels";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { cn } from "@/lib/utils";
import styles from "@/components/dashboard/TransferOverviewCard.module.css";

function Amount({ label, amount, currency, locale }: { label: string; amount: number; currency: string; locale: RequestLocale }) {
  const formatted = requestMoney(amount, currency, locale), separator = formatted.lastIndexOf(" ");
  return <dl className="m-0 min-w-0 text-center"><div>
    <dt className="text-xs font-medium text-[#6f6982]">{label}</dt>
    <dd className="m-0 mt-1 text-[#25213e]"><bdi data-private-value dir={locale === "fa" ? "rtl" : "ltr"} className={cn(styles.amountNumber, "justify-center! gap-x-1.5! gap-y-0! text-base! leading-snug! @sm:text-lg!")}><bdi dir="ltr" data-number-locale={locale} className="whitespace-nowrap">{formatted.slice(0, separator)}</bdi><span className="text-xs font-medium text-[#6f6982]">{formatted.slice(separator + 1)}</span></bdi></dd>
  </div></dl>;
}

/** Compact record of a request; only its action links are clickable, so scrolling never opens the details by accident. `stageMotion` shows the stage Lottie on open requests. */
export function TransactionSummaryCard({ request, locale, stageMotion }: { request: ExchangeRequest; locale: RequestLocale; stageMotion?: boolean }) {
  const fa = locale === "fa", text = (en: string, persian: string) => fa ? persian : en;
  const journey = journeyPresentation(request, locale), { quote } = request;
  const refunded = ["refund_pending", "refunded"].includes(request.funding_status);
  const completed = request.status === "completed" && !refunded, failed = journey.mood === "failed";
  const open = !completed && !failed && !journey.closed && request.status !== "completed", attention = open && journey.mood === "attention";
  const tone: DashboardTone = completed ? "emerald" : failed ? "rose" : attention ? "amber" : open ? dashboardStageTones[journey.stage] : "slate";
  const palette = dashboardPalette[tone];
  const Mark: LucideIcon = completed ? Check : refunded ? Undo2 : failed ? X : open ? Clock3 : Ban;
  const badge = completed ? "success" : failed ? "danger" : attention ? "attention" : open ? "brand" : "neutral";
  const Chevron = fa ? ChevronLeft : ChevronRight, Flow = fa ? ArrowLeft : ArrowRight;
  const recipient = quote.recipient_snapshot;
  const name = [quote.institution_name, recipient.full_name, recipient.account_name, recipient.label].find(value => typeof value === "string" && value.trim());
  const receipt = completed && journey.href?.startsWith("/api/") ? journey.href : null;
  const href = `/${locale}/dashboard/requests/${request.id}`;
  const recipientName = <bdi data-private-value>{typeof name === "string" ? name : text("your recipient", "گیرنده شما")}</bdi>;

  return <DashboardMagicCard tone={tone} pointerEffect={false} motionEnabled={false} className="h-full" contentClassName="@container flex h-full flex-col p-4 sm:p-5" data-request-id={request.id} data-transaction-summary={tone}
    style={{ background: palette.soft, borderColor: palette.border, boxShadow: `0 1px 2px #1a1a2e08, 0 14px 30px -26px ${palette.accent}66` }}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-white/85 px-2.5 py-1 text-[11px] font-semibold leading-4" style={{ color: palette.ink, borderColor: palette.border }}><span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: palette.accent }} />{quote.funding_currency === "AUD" ? text("Sell AUD", "فروش دلار") : text("Buy AUD", "خرید دلار")}</span>
      <StatusBadge tone={badge}>{journey.status}</StatusBadge>
    </div>
    <header className="flex min-w-0 flex-col items-center gap-3 pb-4 pt-2 text-center">
      {open && stageMotion !== undefined ? <DashboardLottieScene name={requestLottieScene(journey)} size={72} motionEnabled={stageMotion} /> : <span aria-hidden="true" className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-white ring-4 ring-white/60" style={{ color: palette.accent, boxShadow: `0 10px 22px -14px ${palette.accent}99` }}>
        <ReceiptText size={24} strokeWidth={1.6} />
        <span className="absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full border-2 border-white text-white" style={{ background: palette.accent }}><Mark size={11} strokeWidth={3} /></span>
      </span>}
      <div className="w-full min-w-0">
        <h3 className="m-0! truncate text-[15px]! font-semibold leading-relaxed! text-[#25213e]!">{recipientName}</h3>
        <p className="m-0 mt-0.5 flex flex-wrap items-center justify-center gap-x-1.5 text-xs leading-5 text-[#756782]">
          <bdi className="font-semibold text-[#4a4560]">{request.reference_code}</bdi>
          <span aria-hidden="true">·</span>
          <time dir="ltr" dateTime={request.created_at}>{requestShortDate(request.created_at)}</time>
        </p>
      </div>
    </header>
    <div className="grid gap-3 border-t pt-3.5 @sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @sm:items-center" style={{ borderColor: palette.border }}>
      <Amount label={text("You sent", "مبلغ ارسالی شما")} amount={quote.funding_total} currency={quote.funding_currency} locale={locale} />
      <span aria-hidden="true" className="hidden size-7 place-items-center rounded-full bg-white @sm:grid" style={{ color: palette.accent }}><Flow size={14} strokeWidth={2} /></span>
      <Amount label={text("Recipient received", "مبلغ دریافتی گیرنده")} amount={quote.recipient_amount} currency={quote.recipient_currency} locale={locale} />
    </div>
    {completed && <div data-feedback-prompt className="mt-3.5 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-white/70 py-1.5 pe-1.5 ps-4">
      <span className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="flex shrink-0 items-center gap-px">{[0, 1, 2, 3, 4].map(index => <Star key={index} size={13} strokeWidth={0} fill="currentColor" className="text-[#f5a623] drop-shadow-[0_1px_2px_#f5a62340]" />)}</span>
        <span className="truncate text-xs font-medium text-[#4a4560]">{text("How was this transfer?", "از این انتقال راضی بودید؟")}</span>
      </span>
      <Link href={dashboardHref(locale, "feedback")} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#e4e0f3] bg-white px-3.5 text-xs font-semibold text-[#4f46c8] no-underline shadow-[0_1px_2px_#1a1a2e0a] outline-none transition-[background-color,border-color,color] duration-150 hover:border-[#cdc6f0] hover:bg-[#f6f5ff] hover:text-[#3730a3] focus-visible:ring-2 focus-visible:ring-[#635bff]/40 motion-reduce:transition-none"><PenLine size={14} aria-hidden="true" />{text("Submit Feedback", "ثبت بازخورد")}</Link>
    </div>}
    <footer className="mt-auto flex min-h-10 flex-wrap items-center justify-between gap-2 pt-3">
      {receipt && <DashboardButton tone="quiet" className="-ms-3 min-h-10 px-3 text-[#4f46c8] hover:bg-[#f3f2ff] hover:text-[#4338ca]" asChild><a href={receipt} target="_blank" rel="noopener noreferrer"><Download size={16} aria-hidden="true" />{text("Download Receipt", "دریافت رسید")}</a></DashboardButton>}
      {open && <span className="text-xs font-medium" style={{ color: palette.ink }} data-actor={journey.nextActor}>{journey.actorLabel}</span>}
      <Link href={href} className={cn(dashboardCardLink, "ms-auto")}>{text("Transaction Details", "جزئیات تراکنش")}<span className="sr-only"> — {recipientName}</span><Chevron size={16} aria-hidden="true" /></Link>
    </footer>
  </DashboardMagicCard>;
}
