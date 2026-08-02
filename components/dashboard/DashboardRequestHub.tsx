"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Calculator, AlertTriangle, Lock, MessageSquare, ServerCrash, PauseCircle, Tag, Banknote, ChevronDown } from "lucide-react";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";
import styles from "@/styles/dashboard/DashboardRequestHub.module.css";
import { Profile } from "@/app/[locale]/dashboard/dashboard.types";
import type { Recipient } from "@/app/[locale]/dashboard/dashboard.types";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import {
  calcAppliedFee,
  calcEquivalentTomanForRequestType,
  calcQuotedRawAudFromEquivalent,
  calcSettlementAudForRequestType,
} from "@/lib/pricing";
import { buildWhatsAppUrl } from "@/lib/constants/contact";
import { supabase } from "@/lib/supabase";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { RecipientModal } from "@/components/dashboard/RecipientModal";
import { getRecipients, validatePromoCode } from "@/app/actions/transaction.actions";
import { useT } from "@/hooks/useT";
import { useLocale } from "@/context/LocaleContext";

function toFaDigits(input: string) { return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]); }
function faToEnDigits(input: string) { const fa = "۰۱۲۳۴۵۶۷۸۹"; return String(input).replace(/[۰-۹]/g, (d) => String(fa.indexOf(d))); }
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

function formatNumberWA(num: number | null, isToman: boolean = false) {
  if (num === null) return "0";
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  return Number(num).toLocaleString("en-US", options);
}

function formatAudState(num: number, locale: string) {
  return num > 0 ? formatNumberUI(num, locale, false) : "";
}

function formatIrtState(num: number, locale: string) {
  return num > 0 ? formatNumberUI(Math.round(num), locale, true) : "";
}

type ServerTransactionResult = {
  baseRate: number;
  tailoredRate: number;
  loyaltyBonus: number;
  equivalentToman: number;
  appliedFee: number;
  rawAmount: number;
  discount_amount?: number;
  final_amount?: number;
  promo_code?: string | null;
};

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
  displayFullName: string;
  onSaveTransaction: (
    rawAmount: number,
    txType: "buy_aud" | "sell_aud",
    sourceOfFunds: string,
    reasonForTransfer: string,
    recipientId?: string | null,
    promoCode?: string | null,
    paymentLink?: string | null,
    agreedEquivalentToman?: number | null,
  ) => Promise<ServerTransactionResult | null>;
};

export function DashboardRequestHub({ 
  isApproved, txType, setTxType, amountStr, setAmountStr, 
  loyaltyBonus, tailoredRate, baseRate, displayFullName, profile,
  onSaveTransaction
}: RequestHubProps) { 
  const NEW_RECIPIENT_VALUE = "__new__";
  const EDU_RECIPIENT_VALUE = "__edu_exam__";
  const SELF_DESTINATION_RECIPIENT_VALUE = "__my_destination_account__";

  const amountInputRef = React.useRef<HTMLInputElement>(null);
  const t = useT();
  const locale = useLocale();

  // === منطق نشانگر اسکرول ===
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      // اگر کاربر بیشتر از 50 پیکسل اسکرول کرد، نشانگر محو شود
      setIsAtTop(window.scrollY < 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // بررسی وضعیت اولیه

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToForm = () => {
    // اسکرول نرم به سمت فیلد مبلغ
    amountInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  // =========================

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
  const [equivalentStr, setEquivalentStr] = useState("");
  const [quoteSource, setQuoteSource] = useState<"aud" | "irt">("aud");

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
    setPromoDiscount(null);
    setPromoMsg(null);
    setAppliedPromoCode(null);
    setPromoEffectiveRate(null);
  };

  const handleApplyPromo = async () => {
    if (!promoInput.trim() || rawAmount <= 0 || isRateOffline || tailoredRate === null) return;
    setPromoValidating(true);
    setPromoMsg(null);
    try {
      const res = await validatePromoCode(promoInput.trim(), rawAmount, tailoredRate, txType);
      if ("error" in res && res.error) {
        setPromoMsg({ type: "error", text: res.error });
        setPromoDiscount(null);
        setAppliedPromoCode(null);
      } else if ("discount_amount" in res) {
        setPromoDiscount(res.discount_amount ?? null);
        setPromoEffectiveRate(res.effective_rate ?? null);
        setAppliedPromoCode(promoInput.trim().toUpperCase());
        const label = res.discount_type === "percentage"
          ? `${formatNumberUI(Number(res.discount_value), locale)}% improved rate`
          : `${formatNumberUI(Number(res.discount_value), locale, true)} ${locale === "fa" ? "تومان" : "Toman"} improved rate`;
        setPromoMsg({ type: "success", text: `${locale === "fa" ? "کد تخفیف اعمال شد — " : "Promo code applied — "}${label}` });
      }
    } finally {
      setPromoValidating(false);
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
  const agreedEquivalentToman = quoteSource === "irt" ? getRawNumber(equivalentStr) : resultNumber;
  const transactionValidityNotice = t.hub.validityNotice;

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
    val = val.replace(/٫/g, ".").replace(/[^\d۰-۹.]/g, "");
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
    val = val.replace(/[^\d۰-۹]/g, "");
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

  const submit = async () => {
    if (!profile || !isApproved || rawAmount <= 0 || isRateOffline || isSubmitting || !marketActive) return;
    if (!sourceOfFunds || !reasonForTransfer || !selectedRecipientId) {
      alert(t.hub.allFieldsRequired);
      return;
    }
    if (isEduPayment && !paymentLink.trim()) {
      alert(t.hub.paymentLinkRequired);
      return;
    }

    setIsSubmitting(true);
    const whatsappWindow = window.open("", "_blank");

    try {
      const serverData = await onSaveTransaction(
        rawAmount, txType, sourceOfFunds, reasonForTransfer, selectedRecipientId || null,
        appliedPromoCode, isEduPayment ? (paymentLink.trim() || null) : null,
        agreedEquivalentToman > 0 ? agreedEquivalentToman : null,
      );
      
      if (!serverData) {
        whatsappWindow?.close();
        return;
      }

      const actionLabel = txType === "sell_aud"
        ? (locale === "fa" ? "فروش AUD (مشتری دلار می‌دهد)" : "Sell AUD (Customer sends AUD)")
        : (locale === "fa" ? "خرید AUD (مشتری تومان می‌دهد)" : "Buy AUD (Customer sends Toman)");
      const totalLoyalty = serverData.loyaltyBonus * serverData.rawAmount;

      const fmtAmount = formatNumberWA(serverData.rawAmount, false);
      const fmtResult = formatNumberWA(serverData.equivalentToman, true);
      const fmtTailored = formatNumberWA(serverData.tailoredRate, true);
      const fmtBase = formatNumberWA(serverData.baseRate, true);
      const fmtLoyaltyTotal = formatNumberWA(totalLoyalty, true);
      
      let feeText = "بدون کارمزد";
      if (serverData.appliedFee > 0) {
         feeText = txType === "buy_aud" ? `${serverData.appliedFee} AUD (اضافه شده)` : `${serverData.appliedFee} AUD (کسر شده)`;
      }

      let recipientSection = "";
      if (isEduPayment) {
        recipientSection = "--------------------------\nگیرنده: آزمون / دانشگاه / موسسه\n" + (paymentLink ? `- لینک پرداخت: ${paymentLink}\n` : "");
      } else {
        const rec = recipients.find((r) => r.id === selectedRecipientId);
        if (rec) {
          const audAddress = [rec.residential_address, rec.residential_city, rec.residential_state, rec.residential_postcode, rec.residential_country]
            .map((v) => String(v ?? "").trim())
            .filter(Boolean)
            .join(", ");
          const irtAddress = [rec.irt_address, rec.irt_city, rec.irt_state, rec.irt_postcode, rec.irt_country]
            .map((v) => String(v ?? "").trim())
            .filter(Boolean)
            .join(", ");

          recipientSection = "--------------------------\n📋 اطلاعات گیرنده:\n";
          if (rec.direction === "aud") {
            recipientSection += `- نام صاحب حساب: ${rec.account_name || "—"}\n`;
            recipientSection += `- بانک: ${rec.bank_name || "—"}\n`;
            recipientSection += `- BSB: ${rec.bsb || "—"}\n`;
            recipientSection += `- شماره حساب: ${rec.account_number || "—"}\n`;
            recipientSection += `- آدرس: ${audAddress || "—"}\n`;
            if (rec.recipient_phone) recipientSection += `- تلفن گیرنده: ${rec.recipient_phone}\n`;
            if (rec.recipient_email) recipientSection += `- ایمیل گیرنده: ${rec.recipient_email}\n`;
          } else {
            recipientSection += `- نام صاحب حساب: ${rec.full_name || "—"}\n`;
            if (rec.bank_type === "bank_melli") {
              recipientSection += `- بانک: ملی ایران\n`;
              recipientSection += `- شماره حساب: ${rec.irt_account_number || "—"}\n`;
              recipientSection += `- شماره کارت: ${rec.card_number || "—"}\n`;
            } else {
              if (rec.bank_name) recipientSection += `- بانک: ${rec.bank_name}\n`;
              recipientSection += `- شبا: ${rec.shaba_number || "—"}\n`;
            }
            if (rec.irt_phone) recipientSection += `- تلفن گیرنده: ${rec.irt_phone}\n`;
            if (irtAddress) recipientSection += `- آدرس: ${irtAddress}\n`;
          }
        }
      }

      const text = 
        "*** درخواست حواله اختصاصی زرمان ***\n\n" +
        "- مشتری: " + displayFullName + "\n" +
        "- ایمیل: " + (profile?.email || "—") + "\n" +
        "- نوع درخواست: " + actionLabel + "\n" +
        "- مقدار: " + fmtAmount + " AUD\n" +
        "--------------------------\n" +
        "- نرخ پایه بازار: " + fmtBase + " تومان\n" +
        "- مجموع تخفیف وفاداری: " + fmtLoyaltyTotal + " تومان\n" +
        "- نرخ اختصاصی نهایی: " + fmtTailored + " تومان\n" +
        "- کارمزد: " + feeText + "\n" +
        (serverData.promo_code ? `- کد تخفیف: ${serverData.promo_code} (صرفه‌جویی ${formatNumberWA(serverData.discount_amount ?? 0, true)} تومان)\n` : "") +
        "--------------------------\n" +
        "* معادل نهایی: " + fmtResult + " تومان *\n" +
        "--------------------------\n" +
        transactionValidityNotice + "\n" +
        "--------------------------\n" +
        "- منبع وجه: " + sourceOfFunds + "\n" +
        "- دلیل انتقال: " + reasonForTransfer + "\n" +
        (recipientSection ? "\n" + recipientSection : "") +
        "\nلطفاً درخواست من را بررسی نمایید.";

      const finalUrl = buildWhatsAppUrl(text);
      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.href = finalUrl;
      } else {
        window.location.assign(finalUrl);
      }
      setAmountStr(""); resetPromo(); setPromoInput(""); setSelectedRecipientId(""); setPaymentLink("");
    } catch (error) {
      whatsappWindow?.close();
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className={cardStyles.panelCard}>
      {!marketActive && (
        <div className={`${styles.lockOverlay} ${styles.offlineOverlay}`}>
          <PauseCircle size={48} className={`${styles.lockIcon} ${styles.offlineIcon}`} />
          <h3 className={styles.lockTitle}>{t.hub.marketPaused}</h3>
          <p className={styles.lockText}>{pauseMessage || t.hub.marketPausedDefault}</p>
        </div>
      )}

      {marketActive && isRateOffline && (
        <div className={`${styles.lockOverlay} ${styles.offlineOverlay}`}>
          <ServerCrash size={48} className={`${styles.lockIcon} ${styles.offlineIcon}`} />
          <h3 className={styles.lockTitle}>{t.hub.rateOfflineTitle}</h3>
          <p className={styles.lockText}>{t.hub.rateOfflineText}</p>
        </div>
      )}

      {marketActive && !isApproved && !isRateOffline && (
              <div className={styles.lockOverlay}>
                <Lock size={48} className={styles.lockIcon} />
                <h3 className={styles.lockTitle}>{t.hub.accessLimited}</h3>
                <p className={styles.lockText}>
                  {t.hub.accessLimitedText}
                  <span style={{ display: "block", marginTop: "1.75rem", fontSize: "0.95em", lineHeight: "1.8" }}>
                    {t.hub.accessLimitedKyc}
                  </span>
                </p>
              </div>
            )}
      
      <div className={cardStyles.panelHeader}>
        <div className={styles.titleWrapper}>
          <h2 className={styles.panelTitle}>
            <Calculator size={26} className={styles.titleIcon} /> 
            {t.hub.title}
          </h2>
        </div>
      </div>
      
      <div className={`${styles.formRow} ${styles.formRowCompact}`}>
        <div className={styles.inputBox}>
          <div className={styles.labelRow}>
            <label className={styles.label}>{t.hub.txType} <span className={styles.requiredMark}>*</span></label>
          </div>
            <SelectBox
              value={txType}
              onChange={(val) => setTxType(val as "buy_aud" | "sell_aud")}
              dir={locale === "fa" ? "rtl" : "ltr"}
              labeledOptions={[
                { value: "buy_aud",  label: t.hub.buyAud },
                { value: "sell_aud", label: t.hub.sellAud },
              ]}
              disabled={isSubmitting}
            />
        </div>

        <div className={`${styles.inputBox} ${styles.quoteColumn}`}>
          <div className={styles.quoteInputStack}>
            <div className={styles.inputBox}>
              <div className={styles.labelRow}>
                <label className={styles.label}>{t.hub.amountAud} <span className={styles.requiredMark}>*</span></label>
                {appliedFee > 0 && (
                  <span className={styles.feeWarning}>
                    <AlertTriangle size={14} />
                    {txType === "buy_aud"
                      ? t.hub.feeAddedBuy.replace("{{fee}}", formatNumberUI(financeConfig.applied_fee, locale))
                      : t.hub.feeDeductedSell.replace("{{fee}}", formatNumberUI(financeConfig.applied_fee, locale))}
                  </span>
                )}
              </div>
              <div className={`${styles.hubFieldGroup} ${styles.quoteFieldGroup}`}>
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9۰-۹.,٫]*"
                  value={amountStr}
                  onChange={handleInput}
                  onFocus={keepAmountCaretAtEnd}
                  onClick={keepAmountCaretAtEnd}
                  dir="ltr"
                  className={`${styles.hubFaInput} ${styles.quoteFieldInput} ${styles.quoteAudInput}`}
                  placeholder={locale === "fa" ? "۰" : "0"}
                  disabled={isRateOffline || isSubmitting}
                />
                <div className={styles.hubDivider}></div>
                <span className={`${styles.currencyLabelFixed} ${styles.quoteCurrencyLabel}`}>AUD</span>
              </div>
            </div>

            <div className={styles.inputBox}>
              <label className={`${styles.label} ${styles.labelWithIcon}`}>
                <Banknote size={14} className={styles.inlineLabelIcon} />
                {txType === "buy_aud" ? t.hub.amountPayToman : t.hub.amountReceiveToman}
              </label>
              <div className={`${styles.hubFieldGroup} ${styles.quoteFieldGroup} ${quoteSource === "irt" ? styles.hubFieldActive : ""}`}>
                <input
                  type="text"
                  value={isRateOffline ? "" : equivalentStr}
                  onChange={handleEquivalentInput}
                  dir="ltr"
                  className={`${styles.hubFaInput} ${styles.hubResultInput} ${styles.quoteFieldInput}`}
                  placeholder={locale === "fa" ? "۰" : "0"}
                  disabled={isRateOffline || isSubmitting}
                />
                <div className={styles.hubDivider}></div>
                <span className={`${styles.currencyLabelFixed} ${styles.quoteCurrencyLabel}`}>{locale === "fa" ? "تومان" : "Toman"}</span>
              </div>
              <span className={styles.fieldHint}>{t.hub.tomanHint}</span>
              {promoDiscount !== null && promoDiscount > 0 && (
                <p className={styles.promoSuccess}>
                  {t.hub.promoSavings} {formatNumberUI(promoDiscount, locale, true)} {locale === "fa" ? "تومان" : "Toman"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className={styles.formRow}>
        <div className={styles.inputBox}>
          <label className={styles.label}>{t.hub.recipient} <span className={styles.requiredMark}>*</span></label>
          <SelectBox
            value={selectedRecipientId}
            onChange={handleRecipientChange}
            placeholder={locale === "fa" ? "— انتخاب کنید —" : "— Select recipient —"}
            labeledOptions={recipientOptions}
            disabled={isSubmitting}
            dir={locale === "fa" ? "rtl" : "ltr"}
          />
        </div>
        {isEduPayment ? (
          <div className={styles.inputBox}>
            <label className={styles.label}>{t.hub.paymentLink} <span className={styles.requiredMark}>*</span></label>
            <div className={styles.hubFieldGroup}>
              <input
                type="url"
                className={`${styles.hubEnInput} ${styles.hubEnInputLtr}`}
                placeholder="https://..."
                value={paymentLink}
                onChange={(e) => setPaymentLink(e.target.value)}
                dir="ltr"
                disabled={isSubmitting}
               />
            </div>
            <span className={styles.fieldHint}>{t.hub.paymentLinkHint}</span>
          </div>
        ) : (
          <></>
        )}
      </div>

      <div className={styles.formRow}>
        <div className={styles.inputBox}>
          <label className={styles.label}>{t.hub.sourceOfFunds} <span className={styles.requiredMark}>*</span></label>
          <SelectBox
            value={sourceOfFunds}
            onChange={setSourceOfFunds}
            placeholder="Select Source of Funds"
            disabled={isSubmitting}
            dir={locale === "fa" ? "rtl" : "ltr"}
            options={[
              "Employment income e.g. salary, bonus, commission",
              "Business income e.g. earnings, profits",
              "Family support or gift (overseas transfer)",
              "Family support or gift (transfer within Australia)",
              "Government benefits or grants",
              "Compensation e.g. insurance, divorce settlement",
              "Investment income e.g. interest, dividends, rent",
              "Liquidation or sale of assets",
              "Real estate",
              "Super or pension",
              "Windfall e.g. inheritance, redundancy, winnings",
              "Loan",
              "Tax refund",
            ]}
          />
        </div>

        <div className={styles.inputBox}>
          <label className={styles.label}>{t.hub.reasonForTransfer} <span className={styles.requiredMark}>*</span></label>
          <SelectBox
            value={reasonForTransfer}
            onChange={setReasonForTransfer}
            placeholder="Select reason"
            disabled={isSubmitting}
            dir={locale === "fa" ? "rtl" : "ltr"}
            options={[
              "Support Family",
              "Loan repayment",
              "Personal savings / investment",
              "Business payment",
              "Education expenses",
              "International Payment",
              "Medical expenses",
              "Property purchase",
              "Travel expenses",
              "Other",
            ]}
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.inputBox}>
          <label className={`${styles.label} ${styles.labelWithIcon}`}>
            <Tag size={14} className={styles.inlineLabelIcon} />
            {t.hub.promoCode}
          </label>
          <div className={styles.promoRow}>
            <div className={styles.hubFieldGroup}>
              <input
                type="text"
                className={`${styles.hubEnInput} ${styles.hubEnInputLtr}`}
                placeholder="PROMO2026"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                dir="ltr"
                disabled={isSubmitting}
              />
            </div>
            <button
              className={styles.promoApplyBtn}
              type="button"
              onClick={handleApplyPromo}
              disabled={promoValidating || isSubmitting || !promoInput.trim() || rawAmount <= 0}
            >
              {promoValidating ? <><span className={cardStyles.spinner} aria-hidden="true" /></> : t.hub.promoApply}
            </button>
          </div>
          {promoMsg && <p className={promoMsg.type === "success" ? styles.promoSuccess : styles.promoError}>{promoMsg.text}</p>}
        </div>

      </div>
      
      <div className={styles.summaryBox}>
        <div className={styles.summaryText}>
          <strong className={styles.summaryRate}>
            {t.hub.yourRate} {isRateOffline ? t.hub.rateOffline : formatNumberUI(activeRate, locale, true)} {locale === "fa" ? "تومان" : "Toman"}
          </strong>
          {promoEffectiveRate && tailoredRate && !isRateOffline && (
            <span className={styles.summaryHint}>
              {t.hub.improvedRate} {formatNumberUI(tailoredRate, locale, true)} {locale === "fa" ? "تومان" : "Toman"}
            </span>
          )}
          {(loyaltyBonus > 0 && !isRateOffline) && (
            <span className={styles.summaryHint}>
              {rawAmount > 0 
                ? t.hub.loyaltyThisTx.replace("{{amount}}", formatNumberUI(loyaltyBonus * rawAmount, locale, true))
                : t.hub.loyaltyPerDollar.replace("{{amount}}", formatNumberUI(loyaltyBonus, locale, true))}
            </span>
          )}
        </div>
        <div className={styles.summaryFacts}>
          <div className={styles.summaryFact}>
            <span>{t.hub.requestedAmount}</span>
            <strong className={styles.summaryFactValue}>{rawAmount > 0 ? `${formatNumberUI(rawAmount, locale)} AUD` : "—"}</strong>
          </div>
          {appliedFee > 0 ? (
            <>
              <div className={styles.summaryFact}>
                <span>{t.hub.fixedFee}</span>
                <strong className={styles.summaryFactValue}>{`${formatNumberUI(appliedFee, locale)} AUD`}</strong>
              </div>
              {txType === "sell_aud" && (
                <div className={styles.summaryFact}>
                  <span>{t.hub.netSale}</span>
                  <strong className={styles.summaryFactValue}>{settlementAud > 0 ? `${formatNumberUI(settlementAud, locale)} AUD` : "—"}</strong>
                </div>
              )}
            </>
          ) : (
            <div className={`${styles.summaryFact} ${styles.summaryFactCalm}`}>
              <span>{t.hub.feeStatus}</span>
              <strong className={styles.summaryFactText}>{t.hub.noFeeStatus}</strong>
            </div>
          )}
        </div>
        <button className={`${cardStyles.primaryButton}${isSubmitting ? ` ${cardStyles.loading}` : ""}`} onClick={submit} disabled={!isApproved || rawAmount <= 0 || isRateOffline || isSubmitting || !marketActive} type="button">
          {isSubmitting ? (
            <><span className={cardStyles.spinner} aria-hidden="true" /> {t.hub.processing}</>
          ) : (
            <><MessageSquare size={20} /> {t.hub.submitBtn}</>
          )}
        </button>
      </div>
      
      <div className={styles.noticeBannerContainer}>
        <div className={styles.noticeBanner}>
          <div className={styles.noticeIcon}>
            <AlertTriangle size={18} />
          </div>
          <div className={styles.noticeContent}>
            <p className={styles.noticeText} style={{ whiteSpace: "pre-line", lineHeight: "1.8" }}>
              {transactionValidityNotice}
            </p>
          </div>
        </div>
      </div>

      {showRecipientModal && (
        <RecipientModal
          direction={recipientDirection}
          mode={recipientModalMode}
          profile={profile}
          locale={locale}
          onClose={() => setShowRecipientModal(false)}
          onCreated={handleRecipientCreated}
        />
      )}

      {/* === نشانگر اسکرول حرفه‌ای (Stripe/Apple Style) === */}
      <div 
        className={`${styles.scrollIndicatorContainer} ${!isAtTop ? styles.scrollHidden : ''}`} 
        onClick={scrollToForm} 
        aria-hidden="true"
      >
        <div className={styles.scrollPill}>
          <span>{t.hub.scrollIndicator}</span>
          <ChevronDown size={16} className={styles.scrollIcon} />
        </div>
      </div>
      {/* ================================================== */}
    </article>
  );
}