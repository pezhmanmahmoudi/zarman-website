"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Check, Lock, ServerCrash, PauseCircle } from "lucide-react";
import Stepper, { Step } from "@/components/Stepper";
import { DashboardCard, DashboardButton, DashboardPageHeader, DashboardReveal, StatusBadge, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";
import { Profile } from "@/app/[locale]/dashboard/dashboard.types";
import type { Recipient } from "@/app/[locale]/dashboard/dashboard.types";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import {
  calcAppliedFee,
  calcEquivalentTomanForRequestType,
  calcQuotedRawAudFromEquivalent,
  calcSettlementAudForRequestType,
} from "@/lib/pricing";
import { OnlineRequestSubmit } from "@/components/requests/OnlineRequestSubmit";
import { supabase } from "@/lib/supabase";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { RecipientModal } from "@/components/dashboard/RecipientModal";
import { getRecipients, validatePromoCode } from "@/app/actions/transaction.actions";
import { useT } from "@/hooks/useT";
import { useLocale } from "@/context/LocaleContext";
import { requestError } from "@/components/requests/request-labels";
import Link from "next/link";
import { dashboardHref } from "@/lib/dashboard/navigation";

// Keep the recorded values stable while displaying concise labels in the chosen language.
const sourceOptions: Array<[string, string, string]> = [
  ["Employment income e.g. salary, bonus, commission", "Employment income", "حقوق و درآمد شغلی"],
  ["Business income e.g. earnings, profits", "Business income", "درآمد کسب‌وکار"],
  ["Family support or gift (overseas transfer)", "Family support / gift — overseas", "کمک یا هدیه خانواده — خارج از کشور"],
  ["Family support or gift (transfer within Australia)", "Family support / gift — Australia", "کمک یا هدیه خانواده — داخل استرالیا"],
  ["Government benefits or grants", "Government benefits / grants", "کمک‌هزینه دولتی"],
  ["Compensation e.g. insurance, divorce settlement", "Compensation / settlement", "غرامت یا تسویه حقوقی"],
  ["Investment income e.g. interest, dividends, rent", "Investment income", "درآمد سرمایه‌گذاری"],
  ["Liquidation or sale of assets", "Sale of assets", "فروش دارایی"],
  ["Real estate", "Real estate", "املاک"],
  ["Super or pension", "Super / pension", "بازنشستگی"],
  ["Windfall e.g. inheritance, redundancy, winnings", "Inheritance / windfall", "ارث یا درآمد غیرمنتظره"],
  ["Loan", "Loan", "وام"],
  ["Tax refund", "Tax refund", "بازپرداخت مالیات"],
];
const purposeOptions: Array<[string, string]> = [
  ["Support Family", "کمک به خانواده"], ["Loan repayment", "بازپرداخت وام"],
  ["Personal savings / investment", "پس‌انداز یا سرمایه‌گذاری شخصی"], ["Business payment", "پرداخت تجاری"],
  ["Education expenses", "هزینه تحصیل"], ["International Payment", "پرداخت بین‌المللی"],
  ["Medical expenses", "هزینه درمان"], ["Property purchase", "خرید ملک"],
  ["Travel expenses", "هزینه سفر"], ["Other", "سایر"],
];

function toFaDigits(input: string) { return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]); }
function faToEnDigits(input: string) { const fa = "۰۱۲۳۴۵۶۷۸۹", ar = "٠١٢٣٤٥٦٧٨٩"; return String(input).replace(/[۰-۹٠-٩]/g, (d) => String(fa.includes(d) ? fa.indexOf(d) : ar.indexOf(d))); }
function getRawNumber(value: string) {
  let v = faToEnDigits(value);
  v = v.replace(/٫/g, ".").replace(/،/g, "").replace(/,/g, "").replace(/[^\d.]/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatNumberUI(num: number | null, locale: string, isToman: boolean = false) {
  if (num === null || !num) return "";
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  const en = Number(num).toLocaleString("en-US", options);
  if (locale === "fa") {
    return isToman ? toFaDigits(en).replace(/,/g, "،") : toFaDigits(en);
  }
  return en;
}

function formatAudState(num: number, locale: string) {
  return num > 0 ? formatNumberUI(num, locale, false) : "";
}

function formatIrtState(num: number, locale: string) {
  return num > 0 ? formatNumberUI(Math.round(num), locale, true) : "";
}

type RequestHubProps = {
  isApproved: boolean;
  txType: "buy_aud" | "sell_aud";
  setTxType: (type: "buy_aud" | "sell_aud") => void;
  amountStr: string;
  setAmountStr: (val: string) => void;
  loyaltyBonus: number;
  tailoredRate: number | null; 
  baseRate: number | null;     
  profile: Profile | null;
  initialRecipientId?: string | null;
  motionEnabled?: boolean;

};

export function DashboardRequestHub({ 
  isApproved, txType, setTxType, amountStr, setAmountStr, 
  loyaltyBonus, tailoredRate, baseRate, profile, initialRecipientId, motionEnabled = true
}: RequestHubProps) { 
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const stepHeading = React.useRef<HTMLHeadingElement>(null);
  const NEW_RECIPIENT_VALUE = "__new__";
  const EDU_RECIPIENT_VALUE = "__edu_exam__";
  const SELF_DESTINATION_RECIPIENT_VALUE = "__my_destination_account__";

  const amountInputRef = React.useRef<HTMLInputElement>(null);
  const t = useT();
  const locale = useLocale();

  const keepAmountCaretAtEnd = () => {
    requestAnimationFrame(() => {
      const el = amountInputRef.current;
      if (!el) return;
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  };
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [marketActive, setMarketActive] = useState<boolean>(true);
  const [pauseMessage, setPauseMessage] = useState<string>("");
  const [sourceOfFunds, setSourceOfFunds] = useState("");
  const [reasonForTransfer, setReasonForTransfer] = useState("");
  const financeConfig = useFinanceConfig();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [recipientModalMode, setRecipientModalMode] = useState<"standard" | "self_destination">("standard");

  const [promoInput, setPromoInput] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<number | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoEffectiveRate, setPromoEffectiveRate] = useState<number | null>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [equivalentStr, setEquivalentStr] = useState("");
  const [quoteSource, setQuoteSource] = useState<"aud" | "irt">("aud");
  const promoGeneration = React.useRef(0);

  useEffect(() => {
    // A quote and recipient belong to one direction only.
    promoGeneration.current += 1;
    setSelectedRecipientId(""); setPaymentLink(""); setInstitutionName(""); setInvoiceReference("");
    setPromoDiscount(null); setAppliedPromoCode(null); setPromoEffectiveRate(null); setPromoMsg(null);
    setPromoValidating(false);
  }, [txType]);

  useEffect(() => {
    // A promotion must be rechecked if the underlying live rate changes.
    promoGeneration.current += 1;
    setPromoDiscount(null); setAppliedPromoCode(null); setPromoEffectiveRate(null); setPromoMsg(null); setPromoValidating(false);
  }, [tailoredRate, baseRate]);

  useEffect(() => {
    supabase
      .from("rates_history")
      .select("market_active, pause_message")
      .order("date", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setMarketActive(data.market_active ?? true);
          setPauseMessage(data.pause_message ?? "");
        }
      });
  }, []);

  useEffect(() => {
    if (!isApproved) return;
    getRecipients().then((res) => {
      if ("data" in res && res.data) setRecipients(res.data);
    });
  }, [isApproved]);

  const recipientDirection = txType === "buy_aud" ? "aud" : "irt";
  const preselected = React.useRef<string | null>(null);
  useEffect(() => {
    if (!initialRecipientId || preselected.current === initialRecipientId) return;
    if (recipients.some(recipient=>recipient.id === initialRecipientId && recipient.direction === recipientDirection)) {
      setSelectedRecipientId(initialRecipientId); preselected.current = initialRecipientId;
    }
  },[initialRecipientId,recipients,recipientDirection]);
  const filteredRecipients = recipients.filter((r) => r.direction === recipientDirection);

  const recipientOptions = [
    { value: NEW_RECIPIENT_VALUE, label: t.hub.addRecipient },
    { value: SELF_DESTINATION_RECIPIENT_VALUE, label: t.hub.ownDestinationAccount },
    { value: EDU_RECIPIENT_VALUE, label: t.hub.eduPayment },
    ...filteredRecipients.map((r) => ({ value: r.id, label: r.label })),
  ];

  const isEduPayment = selectedRecipientId === EDU_RECIPIENT_VALUE;

  const handleRecipientChange = (val: string) => {
    if (val === NEW_RECIPIENT_VALUE) {
      setRecipientModalMode("standard");
      setShowRecipientModal(true);
      return;
    }
    if (val === SELF_DESTINATION_RECIPIENT_VALUE) {
      setRecipientModalMode("self_destination");
      setShowRecipientModal(true);
      return;
    }
    setSelectedRecipientId(val);
    if (val !== EDU_RECIPIENT_VALUE) setPaymentLink("");
  };

  useEffect(() => {
    if (selectedRecipientId === EDU_RECIPIENT_VALUE) {
      setReasonForTransfer("International Payment");
    }
  }, [selectedRecipientId]);

  const handleRecipientCreated = (r: Recipient) => {
    setRecipients((prev) => [r, ...prev]);
    setSelectedRecipientId(r.id);
  };

  const resetPromo = () => {
    promoGeneration.current += 1;
    setPromoValidating(false);
    setPromoDiscount(null);
    setPromoMsg(null);
    setAppliedPromoCode(null);
    setPromoEffectiveRate(null);
  };

  const handleApplyPromo = async () => {
    if (promoValidating || !promoInput.trim() || rawAmount <= 0 || isRateOffline || tailoredRate === null) return;
    const generation = ++promoGeneration.current;
    setPromoValidating(true);
    setPromoMsg(null);
    try {
      const res = await validatePromoCode(promoInput.trim(), rawAmount, tailoredRate, txType);
      if (generation !== promoGeneration.current) return;
      if ("error" in res && res.error) {
        setPromoMsg({ type: "error", text: requestError(res.error, locale) });
        setPromoDiscount(null);
        setAppliedPromoCode(null);
      } else if ("discount_amount" in res) {
        setPromoDiscount(res.discount_amount ?? null);
        setPromoEffectiveRate(res.effective_rate ?? null);
        setAppliedPromoCode(promoInput.trim().toUpperCase());
        const label = res.discount_type === "percentage"
          ? `${formatNumberUI(Number(res.discount_value), locale)}${locale === "fa" ? "٪ بهبود نرخ" : "% improved rate"}`
          : `${formatNumberUI(Number(res.discount_value), locale, true)} ${locale === "fa" ? "تومان بهبود نرخ" : "Toman improved rate"}`;
        setPromoMsg({ type: "success", text: `${locale === "fa" ? "کد تخفیف اعمال شد — " : "Promo code applied — "}${label}` });
      }
    } catch {
      if (generation === promoGeneration.current) setPromoMsg({ type: "error", text: locale === "fa" ? "بررسی کد ممکن نشد. دوباره تلاش کنید." : "Could not check this code. Please retry." });
    } finally {
      if (generation === promoGeneration.current) setPromoValidating(false);
    }
  };

  const rawAmount = getRawNumber(amountStr);
  const appliedFee = calcAppliedFee(rawAmount, financeConfig);
  const isRateOffline = baseRate === null || tailoredRate === null;
  const activeRate = promoEffectiveRate ?? tailoredRate;
  const settlementAud = useMemo(
    () => calcSettlementAudForRequestType(rawAmount, appliedFee, txType),
    [rawAmount, appliedFee, txType],
  );
  const resultNumber = (rawAmount === 0 || isRateOffline || activeRate === null)
    ? 0
    : calcEquivalentTomanForRequestType(rawAmount, activeRate, appliedFee, txType);

  useEffect(() => {
    if (quoteSource === "irt") return;
    setEquivalentStr(resultNumber > 0 ? formatIrtState(resultNumber, locale) : "");
  }, [quoteSource, resultNumber, locale]);

  useEffect(() => {
    if (quoteSource !== "irt") return;
    if (isRateOffline || activeRate === null) {
      setAmountStr("");
      return;
    }

    const equivalentValue = getRawNumber(equivalentStr);
    if (equivalentValue <= 0) {
      setAmountStr("");
      return;
    }

    const nextRaw = calcQuotedRawAudFromEquivalent(equivalentValue, activeRate, financeConfig, txType);
    const nextAmount = formatAudState(nextRaw, locale);
    if (nextAmount !== amountStr) {
      setAmountStr(nextAmount);
    }
  }, [quoteSource, equivalentStr, isRateOffline, activeRate, financeConfig, txType, amountStr, setAmountStr, locale]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuoteSource("aud");
    let val = e.target.value;
    val = val.replace(/٫/g, ".").replace(/[^\d۰-۹٠-٩.]/g, "");
    const normalized = faToEnDigits(val);
    const dotCount = (normalized.match(/\./g) || []).length;
    if (dotCount > 1) return;

    if (normalized === "") {
      setAmountStr(""); resetPromo(); keepAmountCaretAtEnd(); return;
    }
    if (normalized === ".") {
      setAmountStr(locale === "fa" ? "۰." : "0."); resetPromo(); keepAmountCaretAtEnd(); return;
    }
    if (normalized === "0") {
      setAmountStr(locale === "fa" ? "۰" : "0"); resetPromo(); keepAmountCaretAtEnd(); return;
    }
    if (normalized.includes(".")) {
      const [intRaw, decRaw = ""] = normalized.split(".");
      const intNum = Number(intRaw || "0");
      const intFormatted = locale === "fa" ? toFaDigits(intNum.toLocaleString("en-US")) : intNum.toLocaleString("en-US");
      const decLimited = decRaw.slice(0, 2);
      const decFormatted = locale === "fa" ? toFaDigits(decLimited) : decLimited;
      const trailingDot = normalized.endsWith(".");
      setAmountStr(trailingDot ? `${intFormatted}.` : `${intFormatted}.${decFormatted}`);
      resetPromo(); keepAmountCaretAtEnd();
      return;
    }

    const raw = getRawNumber(normalized);
    setAmountStr(formatAudState(raw, locale));
    resetPromo();
    keepAmountCaretAtEnd();
  };

  const handleEquivalentInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuoteSource("irt");
    let val = e.target.value;
    val = val.replace(/[^\d۰-۹٠-٩]/g, "");
    const normalized = faToEnDigits(val).replace(/[^\d]/g, "");

    if (!normalized) {
      setEquivalentStr("");
      setAmountStr("");
      resetPromo();
      return;
    }

    const equivalentValue = Number(normalized);
    setEquivalentStr(formatIrtState(equivalentValue, locale));
    resetPromo();
  };


  function goToStep(next: number) {
    if (submitted) return;
    setStep(next); setStepError("");
    requestAnimationFrame(()=>{ stepHeading.current?.focus({preventScroll:true}); stepHeading.current?.scrollIntoView({block:"nearest",behavior:"auto"}); });
  }
  function nextStep() {
    if (step === 0 && (!Number.isFinite(rawAmount) || rawAmount <= 0 || isRateOffline)) { setStepError(locale === "fa" ? "مبلغ معتبر وارد کنید." : "Enter a valid amount."); return; }
    if (step === 1 && (!selectedRecipientId || (isEduPayment && (!paymentLink.trim() || !institutionName.trim() || !invoiceReference.trim())))) { setStepError(t.hub.allFieldsRequired); return; }
    goToStep(Math.min(2,step+1));
  }

  const fa = locale === "fa";
  const text = (en: string, persian: string) => fa ? persian : en;
  const labels = fa ? ["مبلغ", "گیرنده", "بررسی و ثبت"] : ["Amount", "Recipient", "Review"];
  const formLabel = "mb-2 block text-sm font-medium text-[#182027]";
  const selectStyle = "[&>button]:min-h-12 [&>button]:rounded-2xl [&>button]:border-[#e9ecf0] [&>button]:bg-white [&>button]:text-[#182027]";
  const selectedRecipient = recipients.find(recipient => recipient.id === selectedRecipientId);

  if (!marketActive || isRateOffline || !isApproved) return <DashboardCard className="mx-auto max-w-2xl p-6 sm:p-10">
    <div className="mb-5 text-[#626a76]">{!marketActive ? <PauseCircle size={26}/> : isRateOffline ? <ServerCrash size={26}/> : <Lock size={26}/>}</div>
    <DashboardPageHeader title={!marketActive ? t.hub.marketPaused : isRateOffline ? t.hub.rateOfflineTitle : t.hub.accessLimited} description={!marketActive ? pauseMessage || t.hub.marketPausedDefault : isRateOffline ? t.hub.rateOfflineText : t.hub.accessLimitedKyc}/>
    {!isApproved && <DashboardButton asChild className="mt-7"><Link href={dashboardHref(locale,"profile")}>{text("Complete your profile", "تکمیل پروفایل")}</Link></DashboardButton>}
  </DashboardCard>;

  return (
    <div className="min-w-0 space-y-6" dir={fa ? "rtl" : "ltr"}>
      <DashboardPageHeader title={text("New transfer", "انتقال جدید")} description={submitted ? text("Follow your transfer from your dashboard.", "مراحل انتقال را از داشبورد دنبال کنید.") : text("A few details. One clear next step.", "چند جزئیات، و یک قدم روشن برای ادامه.")} />
      <div className={cn("grid min-w-0 gap-6", !submitted && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
        <DashboardCard className="min-w-0 p-5 sm:p-8">
          {!submitted && <>
            <div className="mb-7 flex items-center justify-between gap-3"><StatusBadge>{text("Draft", "پیش‌نویس")}</StatusBadge><span className="text-xs text-[#626a76]">{text("Not submitted yet", "هنوز ثبت نشده")}</span></div>
            <Stepper currentStep={step + 1} onStepChange={(next: number) => { if (!isSubmitting && next <= step + 1) goToStep(next - 1); }} showNavigation={false} showContent={false} motionEnabled={motionEnabled} dir={fa ? "rtl" : "ltr"} stepListLabel={text("New transfer steps", "مراحل ثبت انتقال")}
              className="wizardSteps aspect-auto! min-h-0! p-0!" stepCircleContainerClassName="max-w-none! rounded-none! shadow-none!" stepContainerClassName="mb-8! p-0!"
              renderStepIndicator={({ step: index, currentStep, onStepClick }: { step: number; currentStep: number; onStepClick: (step: number) => void }) => <li className="shrink-0"><button type="button" disabled={isSubmitting || index > currentStep} onClick={() => onStepClick(index)} aria-current={index === currentStep ? "step" : undefined} className="flex min-h-12 flex-col items-center gap-2 rounded-xl px-1 text-xs font-medium text-[#626a76] outline-none focus-visible:ring-2 focus-visible:ring-[#635bff] sm:flex-row sm:gap-3 sm:px-2"><span className={cn("grid size-8 place-items-center rounded-full border text-xs", index <= currentStep ? "border-[#20242c] bg-[#20242c] text-white" : "border-[#e9ecf0] bg-[#f7f8fa]")}>{index < currentStep ? <Check size={14}/> : index}</span><span className={index === currentStep ? "text-[#182027]" : ""}>{labels[index - 1]}</span></button></li>}>
              {labels.map(label => <Step key={label}>{label}</Step>)}
            </Stepper>
            <div className="mb-7"><h2 ref={stepHeading} tabIndex={-1} className="m-0! text-2xl font-semibold leading-snug! tracking-[-.03em] text-[#182027]! outline-none rtl:tracking-normal">{(fa ? ["چقدر می‌خواهید ارسال کنید؟", "برای چه کسی می‌فرستید؟", "جزئیات را بررسی کنید."] : ["How much would you like to send?", "Who are you sending to?", "Review your transfer."])[step]}</h2><p className="mb-0 mt-2 text-sm leading-relaxed text-[#626a76]">{(fa ? ["مسیر را انتخاب کنید. هر دو مبلغ قابل ویرایش است.", "یک گیرنده انتخاب کنید یا حساب جدید اضافه کنید.", "سرویس را انتخاب کنید و درخواست را برای بررسی بفرستید."] : ["Choose a direction. You can edit either amount.", "Choose a recipient or add a new account.", "Choose your service and submit for review."])[step]}</p></div>
            <DashboardReveal key={`panel-${step}`} motionEnabled={motionEnabled} className="space-y-6">
              {step === 0 && <>
                <div role="group" aria-label={t.hub.txType} className="grid gap-2 rounded-[20px] bg-[#f7f8fa] p-1.5 sm:grid-cols-2">{(["sell_aud", "buy_aud"] as const).map(direction => <button key={direction} type="button" disabled={isSubmitting} aria-pressed={txType === direction} onClick={() => setTxType(direction)} className={cn("min-h-14 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#635bff]", txType === direction ? "bg-white text-[#182027] shadow-sm" : "text-[#626a76] hover:bg-white/60")}>{direction === "sell_aud" ? text("Australia to Iran", "استرالیا به ایران") : text("Iran to Australia", "ایران به استرالیا")}</button>)}</div>
                <div className="space-y-3">
                  <div className="rounded-[20px] border border-[#e9ecf0] px-5 py-5 focus-within:border-[#635bff] focus-within:ring-2 focus-within:ring-[#635bff]/10"><label className={formLabel} htmlFor="request-amount-aud">{txType === "buy_aud" ? text("Recipient gets", "گیرنده دریافت می‌کند") : text("You send", "شما ارسال می‌کنید")}</label><div className="flex min-w-0 items-center gap-3"><input ref={amountInputRef} id="request-amount-aud" type="text" inputMode="decimal" pattern="[0-9۰-۹٠-٩.,٫،]*" value={amountStr} onChange={handleInput} onFocus={keepAmountCaretAtEnd} onClick={keepAmountCaretAtEnd} dir="ltr" className="w-full min-w-0 border-0 bg-transparent py-2 text-start text-[clamp(1.6rem,4vw,2.5rem)] font-semibold tracking-[-.035em] text-[#182027] outline-none placeholder:text-[#a6acb5]" placeholder={fa ? "۰" : "0"} disabled={isRateOffline || isSubmitting}/><span className="text-sm font-medium text-[#626a76]">AUD</span></div></div>
                  <div className="rounded-[20px] border border-[#e9ecf0] px-5 py-5 focus-within:border-[#635bff] focus-within:ring-2 focus-within:ring-[#635bff]/10"><label className={formLabel} htmlFor="request-amount-toman">{txType === "buy_aud" ? t.hub.amountPayToman : t.hub.amountReceiveToman}</label><div className="flex min-w-0 items-center gap-3"><input id="request-amount-toman" type="text" inputMode="numeric" value={isRateOffline ? "" : equivalentStr} onChange={handleEquivalentInput} dir="ltr" className="w-full min-w-0 border-0 bg-transparent py-2 text-start text-[clamp(1.6rem,4vw,2.5rem)] font-semibold tracking-[-.035em] text-[#182027] outline-none placeholder:text-[#a6acb5]" placeholder={fa ? "۰" : "0"} disabled={isRateOffline || isSubmitting}/><span className="text-sm font-medium text-[#626a76]">{text("Toman", "تومان")}</span></div></div>
                </div>
                {appliedFee > 0 && <p className="m-0 text-xs leading-relaxed text-[#626a76]">{txType === "buy_aud" ? t.hub.feeAddedBuy.replace("{{fee}}", formatNumberUI(financeConfig.applied_fee, locale)) : t.hub.feeDeductedSell.replace("{{fee}}", formatNumberUI(financeConfig.applied_fee, locale))}</p>}
              </>}
              {step === 1 && <>
                <div><label className={formLabel}>{t.hub.recipient}</label><SelectBox value={selectedRecipientId} onChange={handleRecipientChange} placeholder={text("Choose recipient", "انتخاب گیرنده")} labeledOptions={recipientOptions} disabled={isSubmitting} dir={fa ? "rtl" : "ltr"} className={selectStyle}/></div>
                {selectedRecipient && <div className="rounded-2xl bg-[#f7f8fa] p-5"><p className="m-0 text-sm font-semibold text-[#182027]" data-private-value>{selectedRecipient.full_name || selectedRecipient.account_name || selectedRecipient.label}</p><p className="mb-0 mt-2 text-xs text-[#626a76]">{selectedRecipient.bank_name} · {recipientDirection === "aud" ? text("Australia", "استرالیا") : text("Iran", "ایران")}</p></div>}
                {isEduPayment && <div className="space-y-5">{[{id:"request-institution",label:text("Institution name", "نام دانشگاه / مؤسسه"),value:institutionName,change:setInstitutionName,max:160},{id:"request-invoice",label:text("Invoice reference", "شماره صورتحساب"),value:invoiceReference,change:setInvoiceReference,max:120},{id:"request-payment-link",label:t.hub.paymentLink,value:paymentLink,change:setPaymentLink,max:2000}].map(field => <div key={field.id}><label className={formLabel} htmlFor={field.id}>{field.label}</label><input id={field.id} type={field.id === "request-payment-link" ? "url" : "text"} className={dashboardInputClass} value={field.value} onChange={event => field.change(event.target.value)} maxLength={field.max} disabled={isSubmitting}/></div>)}</div>}
              </>}
              {step === 2 && <>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#f7f8fa] p-4"><div className="min-w-0"><span className="text-xs text-[#626a76]">{t.hub.recipient}</span><p className="mb-0 mt-1 break-words text-sm font-semibold text-[#182027]" data-private-value>{isEduPayment ? institutionName : selectedRecipient?.label || text("Selected account", "حساب انتخاب‌شده")}</p></div><DashboardButton tone="quiet" disabled={isSubmitting} onClick={() => goToStep(1)}>{text("Edit", "ویرایش")}</DashboardButton></div>
                <div className="space-y-5"><div><label className={formLabel}>{t.hub.sourceOfFunds}</label><SelectBox value={sourceOfFunds} onChange={setSourceOfFunds} placeholder={text("Select source of funds", "انتخاب منبع وجه")} disabled={isSubmitting} dir={fa ? "rtl" : "ltr"} className={selectStyle} labeledOptions={sourceOptions.map(([value,en,fa]) => ({value,label:locale === "fa" ? fa : en}))}/></div><div><label className={formLabel}>{t.hub.reasonForTransfer}</label><SelectBox value={reasonForTransfer} onChange={setReasonForTransfer} placeholder={text("Select transfer purpose", "انتخاب دلیل انتقال")} disabled={isSubmitting} dir={fa ? "rtl" : "ltr"} className={selectStyle} labeledOptions={purposeOptions.map(([value,fa]) => ({value,label:locale === "fa" ? fa : value}))}/></div></div>
                <details className="rounded-2xl border border-[#e9ecf0] p-4"><summary className="cursor-pointer text-sm font-medium text-[#182027]">{text("Have a promo code?", "کد تخفیف دارید؟")}</summary><div className="mt-4 flex gap-2"><input id="request-promo-code" aria-label={t.hub.promoCode} className={dashboardInputClass} value={promoInput} onChange={event => {setPromoInput(event.target.value.toUpperCase()); resetPromo();}} dir="ltr" disabled={isSubmitting}/><DashboardButton tone="secondary" asChild><button className="promoApplyBtn" type="button" onClick={handleApplyPromo} disabled={promoValidating || isSubmitting || !promoInput.trim() || rawAmount <= 0}>{promoValidating ? text("Checking…", "در حال بررسی…") : t.hub.promoApply}</button></DashboardButton></div>{promoMsg && <p role="status" className={cn("mb-0 mt-3 text-xs", promoMsg.type === "success" ? "text-emerald-700" : "text-rose-700")}>{promoMsg.text}</p>}</details>
                <p className="m-0 text-xs leading-relaxed text-[#626a76]">{text("Pay by bank transfer after Zarman approves your request. Bank details will appear in your dashboard.", "پس از تأیید درخواست توسط زرمان، مبلغ را بانکی واریز کنید. مشخصات حساب در داشبورد نمایش داده می‌شود.")}</p>
              </>}
            </DashboardReveal>
          </>}
          {step === 2 && <div className="mt-6"><OnlineRequestSubmit key="request-submit" input={{ rawAmount, txType, sourceOfFunds, reasonForTransfer, recipientId: selectedRecipientId, promoCode: appliedPromoCode, paymentLink: isEduPayment ? paymentLink.trim() || null : null, institutionName: isEduPayment ? institutionName : undefined, invoiceReference: isEduPayment ? invoiceReference : undefined, locale }} disabled={!isApproved || !profile || rawAmount <= 0 || isRateOffline || !marketActive} validationMessage={!sourceOfFunds || !reasonForTransfer || !selectedRecipientId ? t.hub.allFieldsRequired : isEduPayment && (!paymentLink.trim() || !institutionName.trim() || !invoiceReference.trim()) ? text("Enter the institution name, invoice reference and payment link.", "نام مؤسسه، شماره صورتحساب و لینک پرداخت را وارد کنید.") : null} onBusyChange={setIsSubmitting} onSubmitted={() => setSubmitted(true)}/></div>}
          {!submitted && stepError && <p role="alert" className="mt-5 text-sm text-rose-700">{stepError}</p>}
          {!submitted && <div className="wizardFooter mt-8 flex items-center justify-between gap-3 border-t border-[#e9ecf0] pt-6">{step > 0 ? <DashboardButton tone="secondary" asChild><button type="button" className="wizardBack" disabled={isSubmitting} onClick={() => goToStep(step - 1)}>{text("Back", "بازگشت")}</button></DashboardButton> : <span className="text-xs text-[#626a76]">{text("Step 1 of 3", "مرحله ۱ از ۳")}</span>}{step < 2 && <DashboardButton asChild><button type="button" className="wizardNext" onClick={nextStep}>{step === 0 ? text("Choose recipient", "انتخاب گیرنده") : text("Review transfer", "بررسی انتقال")}</button></DashboardButton>}</div>}
        </DashboardCard>
        {!submitted && <DashboardCard className="h-fit p-6 xl:sticky xl:top-24"><p className="m-0 text-xs font-medium text-[#626a76]">{text("Your transfer estimate", "برآورد انتقال شما")}</p><div className="my-6 space-y-5"><div><span className="text-xs text-[#626a76]">{text("You send", "شما ارسال می‌کنید")}</span><p className="mb-0 mt-2 break-words text-2xl font-semibold tracking-[-.03em] text-[#182027]" data-private-value><bdi>{formatNumberUI(txType === "buy_aud" ? resultNumber : rawAmount, locale, txType === "buy_aud") || "—"}</bdi> <span className="text-sm font-normal text-[#626a76]">{txType === "buy_aud" ? text("Toman", "تومان") : "AUD"}</span></p></div><div><span className="text-xs text-[#626a76]">{text("Recipient gets", "گیرنده دریافت می‌کند")}</span><p className="mb-0 mt-2 break-words text-2xl font-semibold tracking-[-.03em] text-[#182027]" data-private-value><bdi>{formatNumberUI(txType === "buy_aud" ? rawAmount : resultNumber, locale, txType === "sell_aud") || "—"}</bdi> <span className="text-sm font-normal text-[#626a76]">{txType === "buy_aud" ? "AUD" : text("Toman", "تومان")}</span></p></div></div><dl className="m-0 space-y-4 border-t border-[#e9ecf0] pt-5 text-xs"><div className="flex justify-between gap-3"><dt className="text-[#626a76]">{text("Exchange rate", "نرخ تبدیل")}</dt><dd className="m-0 text-end font-medium"><bdi>1 AUD = {formatNumberUI(activeRate,locale,true)}</bdi> {text("Toman", "تومان")}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#626a76]">{t.hub.fixedFee}</dt><dd className="m-0 font-medium"><bdi>{formatNumberUI(appliedFee,locale) || "0"} AUD</bdi></dd></div>{appliedFee > 0 && txType === "sell_aud" && <div className="flex justify-between gap-3"><dt className="text-[#626a76]">{t.hub.netSale}</dt><dd className="m-0"><bdi>{formatNumberUI(settlementAud,locale)} AUD</bdi></dd></div>}</dl>{loyaltyBonus > 0 && <p className="mb-0 mt-5 rounded-xl bg-[#f1efff] p-3 text-xs leading-relaxed text-[#5147cc]">{rawAmount > 0 ? t.hub.loyaltyThisTx.replace("{{amount}}",formatNumberUI(loyaltyBonus * rawAmount,locale,true)) : t.hub.loyaltyPerDollar.replace("{{amount}}",formatNumberUI(loyaltyBonus,locale,true))}</p>}{promoDiscount !== null && promoDiscount > 0 && <p className="mt-4 text-xs text-emerald-700">{t.hub.promoSavings} {formatNumberUI(promoDiscount,locale,true)} {text("Toman", "تومان")}</p>}<p className="mb-0 mt-5 text-[11px] leading-relaxed text-[#626a76]">{text("Priority service, if selected, is added to your final quote.", "در صورت انتخاب سرویس اولویت‌دار، هزینه آن به پیشنهاد نهایی اضافه می‌شود.")}</p></DashboardCard>}
      </div>
      {showRecipientModal && <RecipientModal direction={recipientDirection} lockDirection motionEnabled={motionEnabled} mode={recipientModalMode} profile={profile} locale={locale} onClose={() => setShowRecipientModal(false)} onCreated={handleRecipientCreated}/>}
    </div>
  );
}
