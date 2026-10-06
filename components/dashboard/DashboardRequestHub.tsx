"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Check, ServerCrash, PauseCircle } from "lucide-react";
import { DashboardIdentityCard } from "./DashboardIdentityCard";
import { DashboardLottieScene } from "./DashboardLottieScene";
import { TransferRecipientPicker, EDUCATION_RECIPIENT_ID } from "./TransferRecipientPicker";
import { InstitutionPaymentFields, type InstitutionPaymentErrors } from "./InstitutionPaymentFields";
import { isInstitutionPaymentLink, normalizeInstitutionPaymentLink, paymentInstitution } from "@/lib/payments/institutions";
import Stepper, { Step } from "@/components/Stepper";
import { DashboardCard, DashboardMagicCard, DashboardButton, DashboardPageHeader, DashboardReveal, StatusBadge, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
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
import { dashboardNumber, normaliseAmountDigits, localiseAmountDraft } from "@/lib/dashboard/numbers";
import { dashboardPalette } from "@/lib/dashboard/palette";
import flow from "@/styles/dashboard/DashboardProfileFlow.module.css";
import transfer from "@/styles/dashboard/DashboardTransferFlow.module.css";

const formStepColors = [dashboardPalette.violet, dashboardPalette.sky, dashboardPalette.teal];
const EDU_RECIPIENT_VALUE = EDUCATION_RECIPIENT_ID;

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
  let v = normaliseAmountDigits(value);
  v = v.replace(/٫/g, ".").replace(/،/g, "").replace(/,/g, "").replace(/[^\d.]/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatNumberUI(num: number | null, locale: string, isToman: boolean = false) {
  if (num === null || !num) return "";
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  return dashboardNumber(Number(num), locale, options.maximumFractionDigits);
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
  const SELF_DESTINATION_RECIPIENT_VALUE = "__my_destination_account__";

  const amountInputRef = React.useRef<HTMLInputElement>(null);
  const t = useT();
  const locale = useLocale();
  const fa = locale === "fa";
  const text = (en: string, persian: string) => fa ? persian : en;

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
  const [equivalentStr, setEquivalentStr] = useState("");
  const [quoteSource, setQuoteSource] = useState<"aud" | "irt">("aud");
  const [recipientStatus, setRecipientStatus] = useState<"loading" | "ready" | "error">("loading");
  const [recipientAttempt, setRecipientAttempt] = useState(0);
  const [institutionId, setInstitutionId] = useState("");
  const [paymentUsername, setPaymentUsername] = useState("");
  const [paymentPassword, setPaymentPassword] = useState("");
  const [showEducationErrors, setShowEducationErrors] = useState(false);
  const recipientReadVersion = React.useRef(0);
  const promoGeneration = React.useRef(0);

  useEffect(() => {
    // A quote and recipient belong to one direction only.
    promoGeneration.current += 1;
    setSelectedRecipientId(""); setPaymentLink(""); setInstitutionName("");
    setInstitutionId(""); setPaymentUsername(""); setPaymentPassword("");
    setShowEducationErrors(false);
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
    let active = true;
    const version = ++recipientReadVersion.current;
    getRecipients().then((res) => {
      if (!active || version !== recipientReadVersion.current) return;
      if ("data" in res && res.data) {
        const loaded = res.data;
        setRecipients(previous => [...previous.filter(recipient => !loaded.some(item => item.id === recipient.id)), ...loaded]);
        setRecipientStatus("ready");
      }
      else setRecipientStatus("error");
    }).catch(() => { if (active && version === recipientReadVersion.current) setRecipientStatus("error"); });
    return () => { active = false; };
  }, [isApproved, recipientAttempt]);

  const recipientDirection = txType === "buy_aud" ? "aud" : "irt";
  const preselected = React.useRef<string | null>(null);
  useEffect(() => {
    if (!initialRecipientId || preselected.current === initialRecipientId) return;
    if (recipients.some(recipient=>recipient.id === initialRecipientId && recipient.direction === recipientDirection)) {
      setSelectedRecipientId(initialRecipientId); preselected.current = initialRecipientId;
    }
  },[initialRecipientId,recipients,recipientDirection]);
  const filteredRecipients = recipients.filter((r) => r.direction === recipientDirection);

  const isEduPayment = selectedRecipientId === EDU_RECIPIENT_VALUE;
  const normalizedPaymentLink = normalizeInstitutionPaymentLink(paymentLink);
  const educationErrors: InstitutionPaymentErrors = {};
  if (!paymentInstitution(institutionId) && institutionId !== "other") {
    educationErrors.institution = text("Choose a payment recipient.", "دریافت‌کنندهٔ پرداخت را انتخاب کنید.");
  }
  if (institutionId === "other" && !institutionName.trim()) {
    educationErrors.companyName = text("Enter the company receiving payment.", "نام شرکت دریافت‌کنندهٔ پرداخت را وارد کنید.");
  }
  if (!normalizedPaymentLink) {
    educationErrors.paymentLink = text("Enter the payment link.", "لینک پرداخت را وارد کنید.");
  } else if (!isInstitutionPaymentLink(normalizedPaymentLink)) {
    educationErrors.paymentLink = text("Enter a valid HTTPS payment link without account credentials in the link.", "یک لینک پرداخت معتبر با https:// وارد کنید؛ اطلاعات ورود به حساب نباید داخل لینک باشد.");
  }
  if (paymentPassword && !paymentUsername.trim()) {
    educationErrors.username = text("Enter the username for this payment account.", "نام کاربری این حساب پرداخت را وارد کنید.");
  }
  if (paymentUsername.trim() && !paymentPassword) {
    educationErrors.password = text("Enter the password for this payment account.", "رمز عبور این حساب پرداخت را وارد کنید.");
  }
  const educationValidationMessage = Object.values(educationErrors)[0] || null;
  const educationDetailsComplete = !educationValidationMessage;
  const hasValidRecipient = isEduPayment || filteredRecipients.some(recipient => recipient.id === selectedRecipientId);

  const handleRecipientChange = (val: string) => {
    if (isSubmitting) return;
    const addingRecipient = val === NEW_RECIPIENT_VALUE || val === SELF_DESTINATION_RECIPIENT_VALUE;
    if (!addingRecipient && val !== EDU_RECIPIENT_VALUE && !filteredRecipients.some(recipient => recipient.id === val)) return;
    // Adding an account is a new payee choice, not a secondary action on the
    // previous recipient. Cancelling must not silently restore that recipient.
    if (addingRecipient) setSelectedRecipientId("");
    if (val !== EDU_RECIPIENT_VALUE && isEduPayment) {
      setSelectedRecipientId("");
      setPaymentLink(""); setInstitutionName("");
      setInstitutionId(""); setPaymentUsername(""); setPaymentPassword("");
      if (reasonForTransfer === "International Payment") setReasonForTransfer("");
    }
    setStepError("");
    setShowEducationErrors(false);
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
    if (r.direction !== recipientDirection || (profile?.id && r.user_id !== profile.id)) return;
    setRecipients((prev) => [r, ...prev.filter(recipient => recipient.id !== r.id)]);
    setRecipientStatus("ready");
    setSelectedRecipientId(r.id);
    setPaymentLink("");
    setStepError("");
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
    setStep(next); setStepError(""); setShowEducationErrors(false);
    requestAnimationFrame(()=>{ stepHeading.current?.focus({preventScroll:true}); stepHeading.current?.scrollIntoView({block:"nearest",behavior:"auto"}); });
  }
  function nextStep() {
    if (step === 0 && (!Number.isFinite(rawAmount) || rawAmount <= 0 || isRateOffline)) { setStepError(locale === "fa" ? "مبلغ معتبر وارد کنید." : "Enter a valid amount."); return; }
    if (step === 1 && !hasValidRecipient) { setStepError(t.hub.allFieldsRequired); return; }
    if (step === 1 && isEduPayment) {
      setPaymentLink(normalizedPaymentLink);
      if (!educationDetailsComplete) { setStepError(""); setShowEducationErrors(true); return; }
    }
    goToStep(Math.min(2,step+1));
  }

  const labels = fa ? ["مبلغ", "گیرنده", "بررسی و ثبت"] : ["Amount", "Recipient", "Review"];
  const formLabel = "mb-2 block text-sm font-medium text-[#182027]";
  const selectStyle = "[&>button]:min-h-12 [&>button]:rounded-2xl [&>button]:border-[#e9ecf0] [&>button]:bg-white [&>button]:text-[#182027]";
  const selectedRecipient = recipients.find(recipient => recipient.id === selectedRecipientId);

  function amountField(currency: "aud" | "toman") {
    const aud = currency === "aud";
    const sending = aud ? txType === "sell_aud" : txType === "buy_aud";
    const label = sending ? text("You Send", "مبلغ ارسالی (شما می‌پردازید)") : aud
      ? text("Recipient Gets (in AUD)", "گیرنده دریافت می‌کند (به دلار استرالیا)")
      : text("Recipient Gets (in Tomans)", "گیرنده دریافت می‌کند (به تومان)");
    const id = `request-amount-${currency}`;
    const displayValue = aud ? localiseAmountDraft(amountStr,locale) : isRateOffline ? "" : localiseAmountDraft(equivalentStr,locale);
    return <label key={currency} className={transfer.amountField} htmlFor={id}>
      <span id={`${id}-label`} className={transfer.amountLabel}>{label}</span>
      <span className={transfer.amountControl} dir="ltr">
        <input ref={aud ? amountInputRef : undefined} id={id} type="text" inputMode={aud ? "decimal" : "numeric"}
          pattern={aud ? "[0-9۰-۹٠-٩.,٫،٬]*" : undefined} data-amount-input data-number-locale={locale}
          value={displayValue} style={{ "--amount-characters": Math.max(displayValue.length, 6) } as React.CSSProperties}
          onChange={aud ? handleInput : handleEquivalentInput} onFocus={aud ? keepAmountCaretAtEnd : undefined} onClick={aud ? keepAmountCaretAtEnd : undefined}
          dir="ltr" className={transfer.amountInput} placeholder={fa ? "۰" : "0"} disabled={isRateOffline || isSubmitting}
          aria-labelledby={`${id}-label`} aria-describedby="transfer-amount-hint" aria-invalid={step === 0 && !!stepError}/>
        <bdi className={transfer.currency} lang={aud ? "en" : locale} dir={aud || !fa ? "ltr" : "rtl"}>{aud ? "AUD" : text("Toman", "تومان")}</bdi>
      </span>
    </label>;
  }

  if (!isApproved) return <DashboardIdentityCard profile={profile} motionEnabled={motionEnabled} />;

  if (!marketActive || isRateOffline) return <DashboardCard className="mx-auto max-w-2xl p-6 sm:p-10">
    <div className="mb-5 text-[#626a76]">{!marketActive ? <PauseCircle size={26}/> : <ServerCrash size={26}/>}</div>
    <DashboardPageHeader title={!marketActive ? t.hub.marketPaused : t.hub.rateOfflineTitle} description={!marketActive ? pauseMessage || t.hub.marketPausedDefault : t.hub.rateOfflineText}/>
  </DashboardCard>;

  return (
    <div className="min-w-0 space-y-6" dir={fa ? "rtl" : "ltr"}>
      <DashboardPageHeader title={text("New Transfer", "انتقال جدید")} description={submitted ? text("Follow your transfer from your dashboard.", "مراحل انتقال را از داشبورد دنبال کنید.") : text("To get started, select your transfer route and enter the amount.", "برای شروع، مسیر انتقال و مبلغ مورد نظر خود را وارد کنید.")} />
      <div className={cn("grid min-w-0 gap-6", !submitted && "items-start lg:grid-cols-[minmax(0,1fr)_minmax(250px,.42fr)]")}>
        <DashboardMagicCard tone="violet" motionEnabled={motionEnabled} pointerEffect={false} contentClassName={cn(transfer.form,"p-0 sm:p-0")} data-transfer-form>
          {!submitted && <>
            <header className={transfer.header}>
              <div className={transfer.headerCopy}><div className={transfer.draftStatus}><StatusBadge>{text("Draft", "پیش‌نویس")}</StatusBadge></div>
            <h2 ref={stepHeading} tabIndex={-1} className="m-0! text-lg! font-semibold leading-7! text-[#302346]! outline-none">{(fa ? ["مبلغ انتقال را مشخص کنید", "برای چه کسی می‌فرستید؟", "جزئیات را بررسی کنید."] : ["Specify Transfer Amount", "Who are you sending to?", "Review your transfer."])[step]}</h2><p id="transfer-amount-hint" className="mb-0 mt-2 text-sm leading-7 text-[#6a6279]">{(fa ? ["با تغییر مبلغ در هر یک از کادرها، کادر دیگر به‌صورت خودکار محاسبه می‌شود.", "یک گیرنده انتخاب کنید یا حساب جدید اضافه کنید.", "سرویس را انتخاب کنید و درخواست را برای بررسی بفرستید."] : ["Type in either box and we'll automatically calculate the other.", "Choose a recipient or add a new account.", "Choose your service and submit for review."])[step]}</p>
              </div><span className={transfer.headerScene}><DashboardLottieScene name={step === 1 ? "recipient-selection" : step === 2 ? "activity-history" : "mobile-payment"} size={112} className={transfer.headerAnimation} motionEnabled={motionEnabled}/></span>
            </header>
            <div className="border-y border-[#e4ddef] bg-[#faf8ff]/80 px-4 py-5 sm:px-7 sm:py-6">
            <Stepper currentStep={step + 1} onStepChange={(next: number) => { if (!isSubmitting && next <= step + 1) goToStep(next - 1); }} showNavigation={false} showContent={false} motionEnabled={motionEnabled} dir={fa ? "rtl" : "ltr"} stepListLabel={text("New transfer steps", "مراحل ثبت انتقال")}
              className={cn(flow.stepper,"transfer-form-steps aspect-auto! min-h-0! p-0!")} stepCircleContainerClassName="max-w-none! border-0! bg-transparent! rounded-none! shadow-none!" stepContainerClassName="m-0! border-0! p-0!"
              renderStepIndicator={({ step: index, currentStep, onStepClick }: { step: number; currentStep: number; onStepClick: (step: number) => void }) => <li className={flow.stepItem}><button type="button" disabled={isSubmitting || index > currentStep} onClick={() => onStepClick(index)} aria-current={index === currentStep ? "step" : undefined} className={cn(flow.stepButton,"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7667bd]")}><span className={cn("grid size-9 shrink-0 place-items-center rounded-full border border-[#ded8e9] bg-white text-sm", index === currentStep && "border-2")} style={index <= currentStep ? { backgroundColor: formStepColors[index-1].soft, borderColor: formStepColors[index-1].accent, color: formStepColors[index-1].ink } : undefined}>{index < currentStep ? <Check size={16} aria-hidden="true"/> : dashboardNumber(index,locale)}</span><span className={flow.stepLabel} style={index <= currentStep ? { color: formStepColors[index-1].ink } : undefined}>{labels[index - 1]}</span></button></li>}>
              {labels.map(label => <Step key={label}>{label}</Step>)}
            </Stepper>
            </div>
          </>}
          <div className="px-5 py-6 sm:px-7 sm:py-7">
          {!submitted && <>
            <DashboardReveal key={`panel-${step}`} motionEnabled={motionEnabled} className="space-y-6">
              {step === 0 && <>
                <div role="group" aria-label={t.hub.txType} className={transfer.routeGrid}>{(["sell_aud", "buy_aud"] as const).map(direction => <button key={direction} type="button" disabled={isSubmitting} aria-pressed={txType === direction} onClick={() => setTxType(direction)} className={transfer.routeButton}>{direction === "sell_aud" ? text("Australia to Iran", "استرالیا به ایران") : text("Iran to Australia", "ایران به استرالیا")}</button>)}</div>
                <div className={transfer.amountGrid}>{(txType === "sell_aud" ? ["aud", "toman"] as const : ["toman", "aud"] as const).map(amountField)}</div>
                {appliedFee > 0 && <p className="m-0 text-xs leading-relaxed text-[#626a76]">{txType === "buy_aud" ? t.hub.feeAddedBuy.replace("{{fee}}", formatNumberUI(financeConfig.applied_fee, locale)) : t.hub.feeDeductedSell.replace("{{fee}}", formatNumberUI(financeConfig.applied_fee, locale))}</p>}
              </>}
              {step === 1 && <>
                <TransferRecipientPicker key={recipientDirection} recipients={filteredRecipients} direction={recipientDirection} selectedId={selectedRecipientId} locale={locale} status={recipientStatus} disabled={isSubmitting} onSelect={handleRecipientChange} onAdd={() => handleRecipientChange(NEW_RECIPIENT_VALUE)} onAddSelf={() => handleRecipientChange(SELF_DESTINATION_RECIPIENT_VALUE)} onRetry={() => { setRecipientStatus("loading"); setRecipientAttempt(value => value + 1); }}/>
                {isEduPayment && <InstitutionPaymentFields institutionId={institutionId} companyName={institutionName} username={paymentUsername} password={paymentPassword} onCompanyNameChange={setInstitutionName} onUsernameChange={setPaymentUsername} onPasswordChange={setPaymentPassword} paymentLink={paymentLink} locale={locale} disabled={isSubmitting} errors={showEducationErrors ? educationErrors : undefined} onInstitutionChange={id => { const institution = paymentInstitution(id); if (!institution && id !== "other") return; setInstitutionId(id); setInstitutionName(institution?.companyName || ""); setPaymentUsername(""); setPaymentPassword(""); setPaymentLink(""); setStepError(""); setShowEducationErrors(false); }} onPaymentLinkChange={setPaymentLink}/>}
              </>}
              {step === 2 && <>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#f7f8fa] p-4"><div className="min-w-0"><span className="text-xs text-[#626a76]">{t.hub.recipient}</span><p className="mb-0 mt-1 break-words text-sm font-semibold text-[#182027]" data-private-value>{isEduPayment ? institutionName : selectedRecipient?.label || text("Selected account", "حساب انتخاب‌شده")}</p></div><DashboardButton tone="quiet" disabled={isSubmitting} onClick={() => goToStep(1)}>{text("Edit", "ویرایش")}</DashboardButton></div>
                <div className="space-y-5"><div><label className={formLabel}>{t.hub.sourceOfFunds}</label><SelectBox value={sourceOfFunds} onChange={setSourceOfFunds} placeholder={text("Select source of funds", "انتخاب منبع وجه")} disabled={isSubmitting} dir={fa ? "rtl" : "ltr"} className={selectStyle} labeledOptions={sourceOptions.map(([value,en,fa]) => ({value,label:locale === "fa" ? fa : en}))}/></div><div><label className={formLabel}>{t.hub.reasonForTransfer}</label><SelectBox value={reasonForTransfer} onChange={setReasonForTransfer} placeholder={text("Select transfer purpose", "انتخاب دلیل انتقال")} disabled={isSubmitting} dir={fa ? "rtl" : "ltr"} className={selectStyle} labeledOptions={purposeOptions.map(([value,fa]) => ({value,label:locale === "fa" ? fa : value}))}/></div></div>
                <details className="rounded-2xl border border-[#e9ecf0] p-4"><summary className="cursor-pointer text-sm font-medium text-[#182027]">{text("Have a promo code?", "آیا کد تخفیف دارید؟")}</summary><div className="mt-4 flex gap-2"><input id="request-promo-code" aria-label={t.hub.promoCode} className={dashboardInputClass} value={promoInput} onChange={event => {setPromoInput(event.target.value.toUpperCase()); resetPromo();}} dir="ltr" disabled={isSubmitting}/><DashboardButton tone="secondary" asChild><button className="promoApplyBtn" type="button" onClick={handleApplyPromo} disabled={promoValidating || isSubmitting || !promoInput.trim() || rawAmount <= 0}>{promoValidating ? text("Checking…", "در حال بررسی…") : t.hub.promoApply}</button></DashboardButton></div>{promoMsg && <p role="status" className={cn("mb-0 mt-3 text-xs", promoMsg.type === "success" ? "text-emerald-700" : "text-rose-700")}>{promoMsg.text}</p>}</details>
                <p className="m-0 text-xs leading-relaxed text-[#626a76]">{text("Once your request is approved, please transfer the funds to Zarman's bank account. Account details will be available in your dashboard.", "پس از بررسی و تأیید درخواست شما، لطفاً مبلغ را به حساب بانکی زرمان انتقال دهید. اطلاعات حساب در داشبورد شما قابل مشاهده خواهد بود.")}</p>
              </>}
            </DashboardReveal>
          </>}
          {step === 2 && <div className="mt-6"><OnlineRequestSubmit key="request-submit" paymentAccount={isEduPayment && (paymentUsername.trim() || paymentPassword) ? { username: paymentUsername, password: paymentPassword } : undefined} input={{ rawAmount, txType, sourceOfFunds, reasonForTransfer, recipientId: selectedRecipientId, promoCode: appliedPromoCode, paymentLink: isEduPayment ? normalizedPaymentLink || null : null, institutionId: isEduPayment ? institutionId : undefined, institutionName: isEduPayment ? institutionName : undefined, locale }} disabled={!isApproved || !profile || rawAmount <= 0 || isRateOffline || !marketActive} validationMessage={!sourceOfFunds || !reasonForTransfer || !hasValidRecipient ? t.hub.allFieldsRequired : isEduPayment ? educationValidationMessage : null} onBusyChange={setIsSubmitting} onSubmitted={() => { setPaymentUsername(""); setPaymentPassword(""); setSubmitted(true); }}/></div>}
          {!submitted && stepError && <p role="alert" className="mt-5 text-sm text-rose-700">{stepError}</p>}
          </div>
          {!submitted && <div className="wizardFooter flex flex-col items-stretch justify-between gap-3 border-t border-[#e4ddef] bg-white/40 px-5 py-5 sm:flex-row sm:items-center sm:px-7">{step > 0 ? <DashboardButton tone="secondary" asChild><button type="button" className="wizardBack order-last sm:order-none" disabled={isSubmitting} onClick={() => goToStep(step - 1)}>{text("Back", "بازگشت")}</button></DashboardButton> : <span className="text-xs text-[#626a76]">{text("Step 1 of 3", "مرحله ۱ از ۳")}</span>}{step < 2 && <DashboardButton asChild><button type="button" className="wizardNext" disabled={isSubmitting || (step === 1 && !hasValidRecipient)} onClick={nextStep}>{step === 0 ? text("Next: Recipient Details", "مرحله بعد: اطلاعات گیرنده") : text("Review transfer", "بررسی انتقال")}</button></DashboardButton>}</div>}
        </DashboardMagicCard>
        {!submitted && <DashboardMagicCard tone="sky" motionEnabled={motionEnabled} pointerEffect data-transfer-summary className="h-fit lg:sticky lg:top-28" contentClassName="p-5 sm:p-6"><header className={transfer.summaryHeading}><h2 className="m-0! text-lg! font-semibold leading-7! text-[#302346]!">{text("Transfer Summary", "خلاصه تراکنش")}</h2><DashboardLottieScene name="transfer-setup" size={96} className={transfer.summaryScene} motionEnabled={motionEnabled}/></header><div className="my-6 space-y-5"><div><span className="text-xs text-[#626a76]">{text("You send", "شما ارسال می‌کنید")}</span><p className="mb-0 mt-2 break-words text-[clamp(1.3rem,2.2vw,1.65rem)] font-medium tracking-normal text-[#182027]" data-private-value><bdi dir="ltr" data-number-locale={locale}>{formatNumberUI(txType === "buy_aud" ? resultNumber : rawAmount, locale, txType === "buy_aud") || "—"}</bdi> <bdi className={transfer.currency} lang={txType === "buy_aud" ? locale : "en"} dir={txType === "buy_aud" && fa ? "rtl" : "ltr"}>{txType === "buy_aud" ? text("Toman", "تومان") : "AUD"}</bdi></p></div><div><span className="text-xs text-[#626a76]">{text("Recipient gets", "گیرنده دریافت می‌کند")}</span><p className="mb-0 mt-2 break-words text-[clamp(1.3rem,2.2vw,1.65rem)] font-medium tracking-normal text-[#182027]" data-private-value><bdi dir="ltr" data-number-locale={locale}>{formatNumberUI(txType === "buy_aud" ? rawAmount : resultNumber, locale, txType === "sell_aud") || "—"}</bdi> <bdi className={transfer.currency} lang={txType === "buy_aud" ? "en" : locale} dir={txType === "sell_aud" && fa ? "rtl" : "ltr"}>{txType === "buy_aud" ? "AUD" : text("Toman", "تومان")}</bdi></p></div></div><dl className="m-0 space-y-4 border-t border-[#e9ecf0] pt-5 text-xs"><div className={transfer.rateRow}><dt className="text-[#626a76]">{text("Exchange rate", "نرخ تبدیل")}</dt><dd className={transfer.rateValue}>{text("1 AUD", "هر دلار استرالیا")} = <bdi dir="ltr" data-number-locale={locale}>{formatNumberUI(activeRate,locale,true)}</bdi> {text("Tomans", "تومان")}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#626a76]">{t.hub.fixedFee}</dt><dd className="m-0 font-medium"><bdi dir="ltr" data-number-locale={locale}>{formatNumberUI(appliedFee,locale) || dashboardNumber(0,locale)} <span lang="en" className={transfer.currency}>AUD</span></bdi></dd></div>{appliedFee > 0 && txType === "sell_aud" && <div className="flex justify-between gap-3"><dt className="text-[#626a76]">{text("Net Transfer Amount", "مبلغ قابل تبدیل")}</dt><dd className="m-0"><bdi dir="ltr" data-number-locale={locale}>{formatNumberUI(settlementAud,locale)} <span lang="en" className={transfer.currency}>AUD</span></bdi></dd></div>}</dl>{loyaltyBonus > 0 && <p className="mb-0 mt-5 rounded-xl bg-[#f1efff] p-3 text-xs leading-relaxed text-[#5147cc]">{rawAmount > 0 ? t.hub.loyaltyThisTx.replace("{{amount}}",formatNumberUI(loyaltyBonus * rawAmount,locale,true)) : t.hub.loyaltyPerDollar.replace("{{amount}}",formatNumberUI(loyaltyBonus,locale,true))}</p>}{promoDiscount !== null && promoDiscount > 0 && <p className="mt-4 text-xs text-emerald-700">{t.hub.promoSavings} {formatNumberUI(promoDiscount,locale,true)} {text("Toman", "تومان")}</p>}<p className="mb-0 mt-5 text-[11px] leading-relaxed text-[#626a76]">{text("If priority service is selected, the extra fee will be added at final checkout.", "در صورت انتخاب انتقال فوری (اولویت‌دار)، کارمزد آن در مرحله نهایی به این فاکتور اضافه خواهد شد.")}</p></DashboardMagicCard>}
      </div>
      {showRecipientModal && <RecipientModal direction={recipientDirection} lockDirection motionEnabled={motionEnabled} mode={recipientModalMode} profile={profile} locale={locale} onClose={() => setShowRecipientModal(false)} onCreated={handleRecipientCreated}/>}
    </div>
  );
}
