"use client";

import Link from "next/link";
import { Clock3, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { DashboardButton, DashboardMagicCard, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { dashboardPalette, dashboardStageTones } from "@/lib/dashboard/palette";
import { journeyPresentation } from "@/lib/dashboard/journey-presentation";
import { requestMilestones } from "@/lib/requests/journey";
import type { ExchangeRequest, RequestEvent, RequestLocale } from "@/lib/requests/types";
import { requestDate, requestMoney } from "@/components/requests/request-labels";
import { RequestJourneyStepper } from "@/components/requests/RequestJourneyStepper";
import TransferBrandMotif from "./TransferBrandMotif";
import { DashboardMotionIcon } from "./DashboardMotionIcon";
import { DashboardLottieScene } from "./DashboardLottieScene";
import { requestLottieScene } from "@/lib/dashboard/request-lottie-scene";
import styles from "@/components/dashboard/TransferOverviewCard.module.css";

type TransferOverviewCardProps = {
  request?: ExchangeRequest | null;
  locale: RequestLocale;
  loading?: boolean;
  error?: boolean;
  refreshing?: boolean;
  onRetry?: () => void;
  motionEnabled?: boolean;
  events?: RequestEvent[];
  detailView?: boolean;
};

function TransferAmount({ label, amount, currency, locale, motionEnabled }: { label: string; amount: number; currency: string; locale: RequestLocale; motionEnabled: boolean }) {
  const formatted = requestMoney(amount, currency, locale), separator = formatted.lastIndexOf(" ");
  return <div className="min-w-0">
    <dt className={styles.amountLabel}>{label}</dt>
    <dd className={styles.amountValue}><motion.bdi key={`${amount}-${currency}`} initial={motionEnabled ? { opacity: 0, filter: "blur(3px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: motionEnabled ? .32 : 0 }} data-private-value dir={locale === "fa" ? "rtl" : "ltr"} className={styles.amountNumber}><bdi dir="ltr" data-number-locale={locale}>{formatted.slice(0, separator)}</bdi>{" "}<span className={styles.amountUnit}>{formatted.slice(separator + 1)}</span></motion.bdi></dd>
  </div>;
}

/** The visual follows the authenticated request. It never advances financial state. */
export function TransferOverviewCard({ request = null, locale, loading = false, error = false, refreshing = false, onRetry, motionEnabled = true, events = [], detailView = false }: TransferOverviewCardProps) {
  const fa = locale === "fa", reduceMotion = useReducedMotion();
  const animate = motionEnabled && reduceMotion === false;
  const text = (en: string, persian: string) => fa ? persian : en;
  const journey = request ? journeyPresentation(request, locale) : null;
  const detailHref = request ? `/${locale}/dashboard/requests/${request.id}` : "";
  const actionHref = detailView ? journey?.href || "#request-transfer-details" : journey?.href ? journey.href.startsWith("#") ? `${detailHref}${journey.href}` : journey.href : detailHref;
  const recipient = request?.quote.recipient_snapshot;
  const recipientName = [request?.quote.institution_name, recipient?.full_name, recipient?.account_name, recipient?.label].find(value => typeof value === "string" && value.trim());
  const tone = journey?.mood === "attention" ? "attention" : journey?.mood === "complete" ? "success" : journey?.mood === "failed" ? "danger" : "neutral";
  const cardTone = journey?.mood === "failed" ? "rose" : journey?.mood === "attention" ? "amber" : journey?.mood === "quiet" ? "slate" : dashboardStageTones[journey?.stage ?? 0];
  const palette = dashboardPalette[cardTone];

  return <section aria-label={text("Transfer overview", "نمای کلی انتقال")} dir={fa ? "rtl" : "ltr"} data-transfer-overview data-stage={journey?.stage}>
    <BentoGrid className="gap-4">
      <BentoCard className="overflow-visible border-0 bg-transparent lg:col-span-3">
        <DashboardMagicCard tone={cardTone} motionEnabled={motionEnabled} className={!request ? styles.emptyCard : styles.activeCard} contentClassName="p-0 sm:p-0" data-transfer-tone={cardTone}>
          {error && <div role="status" className="border-b border-[#e6cca5] bg-[#fff3de] px-6 py-3 text-sm leading-relaxed text-[#815214] sm:px-8">{text(request ? "Showing your last update. Refresh before continuing." : "We couldn’t load your transfers.", request ? "آخرین اطلاعات نمایش داده می‌شود. برای ادامه، تازه‌سازی کنید." : "اطلاعات انتقال‌ها دریافت نشد.")}</div>}
          {request && journey ? <>
            <div className="relative overflow-hidden" style={{ background: `radial-gradient(ellipse at 100% 0%, ${palette.soft}, transparent 75%)` }}>
              <header className={styles.header}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><span className="text-xs font-medium text-[#66617a]">{text("Current transfer", "انتقال جاری")}</span><bdi className="rounded-lg border bg-white/65 px-2.5 py-1.5 text-xs font-semibold text-[#25213e]" style={{ borderColor: palette.border }}>{request.reference_code}</bdi>{request.service_tier === "priority" && <StatusBadge tone="brand">{text("Priority", "اولویت‌دار")}</StatusBadge>}</div>
                <div role="status" aria-live="polite" aria-atomic="true"><motion.div key={journey.status} initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: animate ? .25 : 0 }}><StatusBadge tone={tone}>{journey.status}</StatusBadge></motion.div></div>
              </header>
              <div className={styles.hero}>
                <div className="min-w-0">
                  <div className={styles.actorRow} data-next-actor={journey.nextActor}>
                    <span className="inline-flex items-center gap-2 rounded-full border bg-white/75 px-3 py-1.5 text-xs font-semibold" style={{ color: palette.ink, borderColor: palette.border }}><span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: palette.accent }} />{error ? text("Refresh to continue", "برای ادامه تازه‌سازی کنید") : journey.actorLabel}</span>
                  </div>
                  <motion.div key={`${request.id}:${journey.status}:${error}`} initial={animate ? { opacity: 0, filter: "blur(3px)" } : false} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: animate ? .28 : 0 }}>
                    <h2 className={styles.heading}>{error ? text("Let’s get your latest update.", "آخرین وضعیت را دریافت کنیم.") : journey.heading}</h2>
                    <p className={styles.description}>{error ? text("Check the latest status before your next step.", "پیش از مرحله بعد، آخرین وضعیت را بررسی کنید.") : journey.description}</p>
                  </motion.div>
                  <div className={styles.actions}>
                    {error ? <DashboardButton onClick={onRetry} disabled={refreshing}>{refreshing ? text("Refreshing…", "در حال تازه‌سازی…") : text("Try again", "تلاش دوباره")}</DashboardButton>
                      : !loading && <DashboardButton asChild><Link href={actionHref} {...(actionHref.startsWith("/api/") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{journey.action || text("Transaction Details", "جزئیات تراکنش")}</Link></DashboardButton>}
                    {!error && !journey.closed && request.status !== "completed" && onRetry && <DashboardButton tone="secondary" onClick={onRetry} disabled={loading || refreshing} aria-label={text("Refresh Status", "به‌روزرسانی وضعیت")}><RefreshCw size={16} aria-hidden="true" className={refreshing ? styles.refreshing : undefined}/>{refreshing ? text("Refreshing…", "در حال تازه‌سازی…") : text("Refresh Status", "به‌روزرسانی وضعیت")}</DashboardButton>}
                  </div>
                  {!error && journey.canPay && !journey.receiptSubmitted && request.funding_due_at && <p className={styles.paymentDeadline}><Clock3 size={16} aria-hidden="true"/><span>{text("Payment due by", "مهلت واریز تا")} <time dateTime={request.funding_due_at} dir="ltr">{requestDate(request.funding_due_at, locale)}</time> {text("(Sydney)", "(سیدنی)")}</span></p>}
                  {!error && !loading && !journey.closed && journey.nextActor !== "customer" && <p className={styles.actionHint}>{text("No action required at this stage.", "در این مرحله نیازی به اقدام از سوی شما نیست.")}</p>}
                </div>
                <div className={styles.heroArt} aria-hidden="true">
                  <DashboardLottieScene name={requestLottieScene(journey)} size={176} motionEnabled={motionEnabled && !error} className="mx-auto" />
                </div>
              </div>
            </div>
            <div className={styles.summary}>
              <dl className={styles.amounts}>
                <TransferAmount label={text("You send", "شما می‌فرستید")} amount={request.quote.funding_total} currency={request.quote.funding_currency} locale={locale} motionEnabled={animate} />
                <TransferAmount label={text("Recipient gets", "گیرنده دریافت می‌کند")} amount={request.quote.recipient_amount} currency={request.quote.recipient_currency} locale={locale} motionEnabled={animate} />
              </dl>
              <p className={styles.recipient}>{text("To", "به")} <bdi className="font-medium text-[#25213e]" data-private-value>{typeof recipientName === "string" ? recipientName : text("your recipient", "گیرنده شما")}</bdi></p>
            </div>
            <div className="bg-white/85">
              <div className={styles.progressHeader}><h3>{text("Transfer progress", "مراحل انتقال")}</h3></div>
              <RequestJourneyStepper milestones={requestMilestones(request, events)} stage={journey.stage} locale={locale} actorLabel={journey.actorLabel} motionEnabled={animate} />
              {!journey.closed && request.ready_at && request.handling_due_at && journey.stage === 3 && <p className="m-0 border-t border-[#e8e4f1] px-6 py-3 text-xs leading-relaxed text-[#66617a] sm:px-8">{text("Handling target: ", "مهلت رسیدگی: ")}<bdi dir="ltr">{requestDate(request.handling_due_at, locale)}</bdi> {text("(Sydney)", "(سیدنی)")}</p>}
            </div>
          </> : <div className={styles.emptyHero} aria-busy={loading} style={{ background: `radial-gradient(ellipse at 100% 0%, ${palette.soft}, transparent 80%)` }}>
            <div className="min-w-0">
              <p className="mb-3 mt-0 text-xs font-semibold tracking-wide text-[#6a53b7]">{text("Beyond Borders", "فراتر از مرزها")}</p>
              <h2 className="m-0! max-w-[26ch] text-[clamp(1.55rem,3.1cqw,2.45rem)]! font-semibold leading-[1.2]! tracking-[-.035em] text-[#25213e]! rtl:leading-relaxed! rtl:tracking-normal">{loading ? text("Loading your transfers", "در حال دریافت انتقال‌های شما") : error ? text("Let’s reconnect", "دوباره متصل شویم") : text("A New Experience in International Payments", "تجربه جدیدی از پرداخت‌های بین‌المللی")}</h2>
              <p className="mb-5 mt-4 max-w-[56ch] text-sm leading-7 text-[#56516c]">{loading ? text("Your latest activity will appear here.", "آخرین وضعیت انتقال‌ها اینجا نمایش داده می‌شود.") : error ? text("Refresh to see your latest information.", "برای مشاهده آخرین اطلاعات، تازه‌سازی کنید.") : text("Send your personal and business transfers with top security and track every transaction in real-time.", "حواله‌های شخصی و تجاری خود را با بالاترین امنیت ارسال کنید و وضعیت هر تراکنش را لحظه‌به‌لحظه پیگیری نمایید.")}</p>
              {error ? <DashboardButton onClick={onRetry} disabled={refreshing}>{text("Try again", "تلاش دوباره")}</DashboardButton> : !loading && <DashboardButton asChild><Link href={`/${locale}/dashboard?tab=transfer`}>{text("New transfer", "انتقال جدید")}</Link></DashboardButton>}
              {loading && <div role="status" className="flex min-h-12 items-center gap-3 text-sm text-[#66617a]"><DashboardMotionIcon name="loading" size={44} motionEnabled={motionEnabled} /><span>{text("Loading transfers", "در حال دریافت انتقال‌ها")}</span></div>}
            </div>
            <div className={styles.emptyArt}><TransferBrandMotif locale={locale} motionEnabled={animate && !error} loading={loading} quiet={error} className="h-40 sm:h-44" /></div>
          </div>}
        </DashboardMagicCard>
      </BentoCard>
    </BentoGrid>
  </section>;
}
