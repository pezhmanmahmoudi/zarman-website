"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { DashboardButton, DashboardMagicCard, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { dashboardPalette, dashboardStageTones } from "@/lib/dashboard/palette";
import { journeyPresentation } from "@/lib/dashboard/journey-presentation";
import { requestMilestones } from "@/lib/requests/journey";
import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { requestDate, requestMoney } from "@/components/requests/request-labels";
import { RequestJourneyStepper } from "@/components/requests/RequestJourneyStepper";
import TransferBrandMotif from "./TransferBrandMotif";

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
    <dt className="mb-2 text-xs font-medium text-[#66617a]">{label}</dt>
    <dd className="m-0 min-w-0 font-semibold text-[#25213e]"><motion.bdi key={`${amount}-${currency}`} initial={motionEnabled ? { opacity: 0, filter: "blur(3px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: motionEnabled ? .32 : 0 }} data-private-value className="block break-words text-[clamp(1.65rem,2.8vw,2.3rem)] leading-[1.2] tracking-[-.035em] tabular-nums rtl:tracking-normal">{formatted.slice(0, separator)}{" "}<span className="text-sm font-medium tracking-normal text-[#66617a]">{formatted.slice(separator + 1)}</span></motion.bdi></dd>
  </div>;
}

/** The visual follows the authenticated request. It never advances financial state. */
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
  const cardTone = journey?.mood === "failed" ? "rose" : journey?.mood === "attention" ? "amber" : journey?.mood === "quiet" ? "slate" : dashboardStageTones[journey?.stage ?? 0];
  const palette = dashboardPalette[cardTone];

  return <section aria-label={text("Transfer overview", "نمای کلی انتقال")} dir={fa ? "rtl" : "ltr"} data-transfer-overview data-stage={journey?.stage}>
    <BentoGrid className="gap-4">
      <BentoCard className="overflow-visible border-0 bg-transparent lg:col-span-3">
        <DashboardMagicCard tone={cardTone} motionEnabled={motionEnabled} contentClassName="p-0 sm:p-0" data-transfer-tone={cardTone}>
          {error && <div role="status" className="border-b border-[#e6cca5] bg-[#fff3de] px-6 py-3 text-sm leading-relaxed text-[#815214] sm:px-8">{text(request ? "Showing your last update. Refresh before continuing." : "We couldn’t load your transfers.", request ? "آخرین اطلاعات نمایش داده می‌شود. برای ادامه، تازه‌سازی کنید." : "اطلاعات انتقال‌ها دریافت نشد.")}</div>}
          {request && journey ? <>
            <div className="relative overflow-hidden" style={{ background: `radial-gradient(ellipse at 100% 0%, ${palette.soft}, transparent 75%)` }}>
              <header className="relative flex flex-wrap items-center justify-between gap-3 px-6 pt-6 sm:px-8 sm:pt-7">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><span className="text-xs font-medium text-[#66617a]">{text("Current transfer", "انتقال جاری")}</span><bdi className="rounded-lg border bg-white/65 px-2.5 py-1.5 text-xs font-semibold text-[#25213e]" style={{ borderColor: palette.border }}>{request.reference_code}</bdi>{request.service_tier === "priority" && <StatusBadge tone="brand">{text("Priority", "اولویت‌دار")}</StatusBadge>}</div>
                <div role="status" aria-live="polite" aria-atomic="true"><motion.div key={journey.status} initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: animate ? .25 : 0 }}><StatusBadge tone={tone}>{journey.status}</StatusBadge></motion.div></div>
              </header>
              <div className="relative grid min-w-0 items-center gap-5 px-6 pb-8 pt-6 sm:px-8 sm:pb-9 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,.9fr)] lg:gap-9">
                <div className="min-w-0">
                  <div className="mb-4 flex flex-wrap items-center gap-2" data-next-actor={journey.nextActor}>
                    <span className="inline-flex items-center gap-2 rounded-full border bg-white/75 px-3 py-1.5 text-xs font-semibold" style={{ color: palette.ink, borderColor: palette.border }}><span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: palette.accent }} />{error ? text("Refresh to continue", "برای ادامه تازه‌سازی کنید") : journey.actorLabel}</span>
                    <span className="text-xs text-[#66617a]">{text(`Stage ${journey.stage + 1} of 5`, `مرحله ${journey.stage + 1} از 5`)}</span>
                  </div>
                  <motion.div key={`${request.id}:${journey.status}:${error}`} initial={animate ? { opacity: 0, filter: "blur(3px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: animate ? .28 : 0 }}>
                    <h2 className="m-0! max-w-[23ch] text-[clamp(1.75rem,3.2vw,2.65rem)]! font-semibold leading-[1.18]! tracking-[-.04em] text-[#25213e]! rtl:leading-relaxed! rtl:tracking-normal">{error ? text("Let’s get your latest update.", "آخرین وضعیت را دریافت کنیم.") : journey.heading}</h2>
                    <p className="mb-0 mt-4 max-w-lg text-sm leading-7 text-[#66617a]">{error ? text("Check the latest status before your next step.", "پیش از مرحله بعد، آخرین وضعیت را بررسی کنید.") : journey.description}</p>
                  </motion.div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {error ? <DashboardButton onClick={onRetry} disabled={refreshing}>{refreshing ? text("Refreshing…", "در حال تازه‌سازی…") : text("Try again", "تلاش دوباره")}</DashboardButton>
                      : !loading && <DashboardButton asChild><Link href={actionHref} {...(actionHref.startsWith("/api/") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{journey.action || text("View transfer", "مشاهده انتقال")}</Link></DashboardButton>}
                    {!error && !loading && journey.nextActor !== "customer" && <span className="max-w-[24ch] text-xs leading-5" style={{ color: palette.ink }}>{text("No action needed from you", "نیازی به اقدام شما نیست")}</span>}
                  </div>
                </div>
                <TransferBrandMotif stage={journey.stage} replayKey={request.id} from={request.quote.funding_currency} to={request.quote.recipient_currency} locale={locale} motionEnabled={animate} quiet={error || journey.mood === "failed" || journey.mood === "quiet"} />
              </div>
            </div>
            <div className="border-y bg-white/70 px-6 py-6 sm:px-8" style={{ borderColor: palette.border }}>
              <dl className="m-0 grid min-w-0 gap-6 sm:grid-cols-2">
                <TransferAmount label={text("You send", "شما می‌فرستید")} amount={request.quote.funding_total} currency={request.quote.funding_currency} locale={locale} motionEnabled={animate} />
                <TransferAmount label={text("Recipient gets", "گیرنده دریافت می‌کند")} amount={request.quote.recipient_amount} currency={request.quote.recipient_currency} locale={locale} motionEnabled={animate} />
              </dl>
              <p className="mb-0 mt-4 text-xs text-[#66617a]">{text("To", "به")} <bdi className="font-medium text-[#25213e]" data-private-value>{typeof recipientName === "string" ? recipientName : text("your recipient", "گیرنده شما")}</bdi></p>
            </div>
            <div className="bg-white/85">
              <div className="px-6 pt-5 text-xs font-semibold text-[#66617a] sm:px-8">{text("Transfer progress", "مراحل انتقال")}</div>
              <RequestJourneyStepper milestones={requestMilestones(request)} stage={journey.stage} locale={locale} actorLabel={journey.actorLabel} motionEnabled={animate} />
              {!journey.closed && request.ready_at && request.handling_due_at && journey.stage === 3 && <p className="m-0 border-t border-[#e8e4f1] px-6 py-3 text-xs leading-relaxed text-[#66617a] sm:px-8">{text("Handling target: ", "مهلت رسیدگی: ")}<bdi dir="ltr">{requestDate(request.handling_due_at, locale)}</bdi> {text("(Sydney)", "(سیدنی)")}</p>}
            </div>
          </> : <div className="grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12" aria-busy={loading} style={{ background: `radial-gradient(ellipse at 100% 0%, ${palette.soft}, transparent 80%)` }}>
            <div className="min-w-0">
              <p className="mb-4 mt-0 text-xs font-semibold text-[#6a53b7]">{text("A little closer to home", "یک قدم نزدیک‌تر به خانه")}</p>
              <h2 className="m-0! max-w-[20ch] text-[clamp(1.8rem,3vw,2.5rem)]! font-semibold leading-[1.2]! tracking-[-.035em] text-[#25213e]! rtl:leading-relaxed! rtl:tracking-normal">{loading ? text("Loading your transfers", "در حال دریافت انتقال‌های شما") : error ? text("Let’s reconnect", "دوباره متصل شویم") : text("Your next transfer starts here.", "انتقال بعدی شما از اینجا شروع می‌شود.")}</h2>
              <p className="mb-6 mt-4 max-w-md text-sm leading-7 text-[#66617a]">{loading ? text("Your latest activity will appear here.", "آخرین وضعیت انتقال‌ها اینجا نمایش داده می‌شود.") : error ? text("Refresh to see your latest information.", "برای مشاهده آخرین اطلاعات، تازه‌سازی کنید.") : text("Send between Australia and Iran. Follow every step in one place.", "بین استرالیا و ایران وجه ارسال کنید و هر مرحله را یکجا دنبال کنید.")}</p>
              {error ? <DashboardButton onClick={onRetry} disabled={refreshing}>{text("Try again", "تلاش دوباره")}</DashboardButton> : !loading && <DashboardButton asChild><Link href={`/${locale}/dashboard?tab=transfer`}>{text("New transfer", "انتقال جدید")}</Link></DashboardButton>}
              {loading && <div role="status" className="h-12 w-48 rounded-full bg-[#ece7fa]"><span className="sr-only">{text("Loading transfers", "در حال دریافت انتقال‌ها")}</span></div>}
            </div>
            <TransferBrandMotif locale={locale} motionEnabled={animate && !loading && !error} quiet={error || loading} />
          </div>}
        </DashboardMagicCard>
      </BentoCard>
    </BentoGrid>
  </section>;
}
