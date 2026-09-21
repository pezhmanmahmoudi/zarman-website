"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { DashboardButton, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { journeyPresentation } from "@/lib/dashboard/journey-presentation";
import { requestMotionIcon } from "@/lib/dashboard/request-motion-icon";
import { requestMilestones } from "@/lib/requests/journey";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { requestDate, requestMoney } from "@/components/requests/request-labels";
import { RequestJourneyStepper } from "@/components/requests/RequestJourneyStepper";
import TransferBrandMotif from "./TransferBrandMotif";
import { DashboardMotionIcon } from "./DashboardMotionIcon";

type TransferOverviewCardProps = {
  request?: ExchangeRequest | null;
  locale: RequestLocale;
  loading?: boolean;
  error?: boolean;
  refreshing?: boolean;
  onRetry?: () => void;
  motionEnabled?: boolean;
};

function TransferAmount({ label, amount, currency, locale, motionEnabled }: { label: string; amount: number; currency: string; locale: RequestLocale; motionEnabled: boolean }) {
  const formatted = requestMoney(amount, currency, locale), separator = formatted.lastIndexOf(" ");
  return <div className="min-w-0">
    <dt className="mb-2 text-sm text-[#626a76]">{label}</dt>
    <dd className="m-0 min-w-0 font-semibold text-[#182027]"><motion.bdi key={`${amount}-${currency}`} initial={motionEnabled ? { opacity: 0, filter: "blur(4px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: motionEnabled ? .32 : 0 }} data-private-value className="block break-words text-[clamp(2rem,3.4vw,3rem)] leading-[1.15] tracking-[-.035em] tabular-nums rtl:tracking-normal">{formatted.slice(0, separator)}{" "}<span className="text-base font-medium tracking-normal text-[#626a76]">{formatted.slice(separator + 1)}</span></motion.bdi></dd>
  </div>;
}

/** Uses the authenticated request feed; the card never changes financial state. */
export function TransferOverviewCard({ request = null, locale, loading = false, error = false, refreshing = false, onRetry, motionEnabled = true }: TransferOverviewCardProps) {
  const fa = locale === "fa", reduceMotion = useReducedMotion();
  const animate = motionEnabled && reduceMotion === false;
  const text = (en: string, persian: string) => fa ? persian : en;
  const journey = request ? journeyPresentation(request, locale) : null;
  const detailHref = request ? `/${locale}/dashboard/requests/${request.id}` : "";
  const actionHref = journey?.href ? journey.href.startsWith("#") ? `${detailHref}${journey.href}` : journey.href : detailHref;
  const recipient = request?.quote.recipient_snapshot;
  const recipientName = [request?.quote.institution_name, recipient?.full_name, recipient?.account_name, recipient?.label].find(value => typeof value === "string" && value.trim());
  const tone = journey?.mood === "attention" ? "attention" : journey?.mood === "complete" ? "success" : journey?.mood === "failed" ? "danger" : "neutral";

  return <section aria-label={text("Transfer overview", "نمای کلی انتقال")} dir={fa ? "rtl" : "ltr"} data-transfer-overview data-stage={journey?.stage}>
    <BentoGrid className="gap-4">
      <BentoCard className="lg:col-span-3">
        {error && <div role="status" className="border-b border-[#eee1c8] bg-[#fffbf1] px-6 py-3 text-sm leading-relaxed text-[#805b20] sm:px-8">{text(request ? "Showing your last update. Refresh before continuing." : "We couldn’t load your transfers.", request ? "آخرین اطلاعات نمایش داده می‌شود. برای ادامه، تازه‌سازی کنید." : "اطلاعات انتقال‌ها دریافت نشد.")}</div>}
        {request && journey ? <>
          <header className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6 sm:px-8 sm:pt-8">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><span className="text-sm font-medium text-[#626a76]">{text("Current transfer", "انتقال جاری")}</span><bdi className="text-sm font-medium text-[#182027]">{request.reference_code}</bdi>{request.service_tier === "priority" && <StatusBadge tone="brand">{text("Priority", "اولویت‌دار")}</StatusBadge>}</div>
            <div role="status" aria-live="polite" aria-atomic="true"><motion.div key={journey.status} initial={animate ? { opacity: 0, filter: "blur(3px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: animate ? .25 : 0 }}><StatusBadge tone={tone}>{journey.status}</StatusBadge></motion.div></div>
          </header>
          <div className="grid min-w-0 gap-8 px-6 pb-7 pt-7 sm:px-8 sm:pb-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,1fr)] lg:gap-10">
            <div className="min-w-0">
              <h2 className="m-0! text-2xl font-semibold leading-snug! text-[#182027]!">{text("Transfer to", "انتقال به")} <bdi data-private-value>{typeof recipientName === "string" ? recipientName : text("your recipient", "گیرنده شما")}</bdi></h2>
              <dl className="mb-0 mt-7 grid gap-7">
                <TransferAmount label={text("You send", "شما می‌فرستید")} amount={request.quote.funding_total} currency={request.quote.funding_currency} locale={locale} motionEnabled={animate} />
                <TransferAmount label={text("Recipient gets", "گیرنده دریافت می‌کند")} amount={request.quote.recipient_amount} currency={request.quote.recipient_currency} locale={locale} motionEnabled={animate} />
              </dl>
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <TransferBrandMotif stage={journey.stage} from={request.quote.funding_currency} to={request.quote.recipient_currency} locale={locale} motionEnabled={animate} quiet={error || journey.closed || journey.mood === "quiet"} />
              <motion.div key={`${request.id}:${journey.status}:${error}`} initial={animate ? { opacity: 0, filter: "blur(3px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: animate ? .28 : 0 }} data-next-actor={journey.nextActor}>
                <div className="flex items-center gap-3">
                  <DashboardMotionIcon name={error ? "attention" : requestMotionIcon(journey)} size={56} motionEnabled={motionEnabled && !loading && !error} />
                  <div><p className="mb-1 mt-0 text-xs font-medium text-[#626a76]">{text("Next step", "مرحله بعد")}</p>
                    <h3 className="m-0! text-lg font-semibold leading-snug! text-[#182027]!">{error ? text("Refresh to continue", "برای ادامه تازه‌سازی کنید") : journey.actorLabel}</h3></div>
                </div>
                <p className="mb-0 mt-2 text-sm leading-relaxed text-[#626a76]">{error ? text("Check the latest status before your next step.", "پیش از مرحله بعد، آخرین وضعیت را بررسی کنید.") : journey.description}</p>
                {!error && !loading && journey.nextActor !== "customer" && <p className="mb-0 mt-3 text-xs font-medium text-[#34735c]">{text("No action needed from you", "نیازی به اقدام شما نیست")}</p>}
              </motion.div>
              {error ? <DashboardButton onClick={onRetry} disabled={refreshing} className="w-full">{refreshing ? text("Refreshing…", "در حال تازه‌سازی…") : text("Try again", "تلاش دوباره")}</DashboardButton>
                : !loading && <DashboardButton asChild className="w-full"><Link href={actionHref} {...(actionHref.startsWith("/api/") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{journey.action || text("View transfer", "مشاهده انتقال")}</Link></DashboardButton>}
            </div>
          </div>
          <div className="border-t border-[#e9ecf0]">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5 text-xs text-[#626a76] sm:px-8"><span className="font-medium">{text("Transfer progress", "مراحل انتقال")}</span><span>{text(`Stage ${journey.stage + 1} of 5`, `مرحله ${journey.stage + 1} از 5`)}</span></div>
            <RequestJourneyStepper milestones={requestMilestones(request)} stage={journey.stage} locale={locale} actorLabel={journey.actorLabel} motionEnabled={animate} />
            {!journey.closed && request.ready_at && request.handling_due_at && journey.stage === 3 && <p className="m-0 border-t border-[#e9ecf0] px-6 py-3 text-xs leading-relaxed text-[#626a76] sm:px-8">{text("Handling target: ", "مهلت رسیدگی: ")}<bdi dir="ltr">{requestDate(request.handling_due_at, locale)}</bdi> {text("(Sydney)", "(سیدنی)")}</p>}
          </div>
        </> : <div className="grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12" aria-busy={loading}>
          <div className="min-w-0">
            <h2 className="m-0! max-w-[20ch] text-[clamp(1.8rem,3vw,2.5rem)] font-semibold leading-[1.2]! tracking-[-.035em] text-[#182027]! rtl:leading-relaxed! rtl:tracking-normal">{loading ? text("Loading your transfers", "در حال دریافت انتقال‌های شما") : error ? text("Let’s reconnect", "دوباره متصل شویم") : text("Your next transfer starts here.", "انتقال بعدی شما از اینجا شروع می‌شود.")}</h2>
            <p className="mb-6 mt-4 max-w-md text-sm leading-relaxed text-[#626a76]">{loading ? text("Your latest activity will appear here.", "آخرین وضعیت انتقال‌ها اینجا نمایش داده می‌شود.") : error ? text("Refresh to see your latest information.", "برای مشاهده آخرین اطلاعات، تازه‌سازی کنید.") : text("Send between Australia and Iran. Follow every step in one place.", "بین استرالیا و ایران وجه ارسال کنید و هر مرحله را یکجا دنبال کنید.")}</p>
            {error ? <DashboardButton onClick={onRetry} disabled={refreshing}>{text("Try again", "تلاش دوباره")}</DashboardButton> : !loading && <DashboardButton asChild><Link href={`/${locale}/dashboard?tab=transfer`}>{text("New transfer", "انتقال جدید")}</Link></DashboardButton>}
            {loading && <div role="status" className="h-12 w-48 rounded-full bg-[#f0f2f5]"><span className="sr-only">{text("Loading transfers", "در حال دریافت انتقال‌ها")}</span></div>}
          </div>
          <TransferBrandMotif locale={locale} motionEnabled={animate && !loading && !error} quiet={error || loading} />
        </div>}
      </BentoCard>
    </BentoGrid>
  </section>;
}
