"use client";

import { formatLocalizedNumber, normaliseAmountDigits, localiseAmountDraft } from "@/lib/numbers";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import styles from "./ConverterFa.module.css";
import Button from "@/components/ui/Button/Button";
import { ArrowLeft, ArrowUpDown, Info, UserCircle, AlertTriangle } from "lucide-react";
import { useRates } from "@/context/RateContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { calculateQuoteMoney } from "@/lib/requests/quote-money";


type Currency = "AUD" | "IRT";
type InputSide = "send" | "receive";

function normalizeAmount(value: string, currency: Currency): string | null {
  const normalized = normaliseAmountDigits(value);
  // Reject ambiguous or malformed amounts instead of silently multiplying them.
  const pattern = currency === "AUD" ? /^\d*(?:\.\d{0,2})?$/ : /^\d*$/;
  return pattern.test(normalized) ? normalized : null;
}

function getRawNumber(value: string) {
  const n = Number(normaliseAmountDigits(value));
  return Number.isFinite(n) ? n : 0;
}

function formatNumberFa(num: number, isToman: boolean = false) {
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  return formatLocalizedNumber(Number(num || 0), "fa", options);
}

function formatNumberByLocale(num: number, isEn: boolean, isToman: boolean = false) {
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  return formatLocalizedNumber(Number(num || 0), isEn ? "en" : "fa", options);
}

export default function ConverterFa() {
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";

  const CURRENCY_OPTIONS = [
    { value: "AUD", label: isEn ? "Australian Dollar" : "دلار استرالیا" },
    { value: "IRT", label: isEn ? "Iranian Toman" : "تومان ایران" },
  ];

  const [amountText, setAmountText] = useState<string>(() => formatNumberByLocale(3000, isEn));
  const [from, setFrom] = useState<Currency>("AUD");
  const [inputSide, setInputSide] = useState<InputSide>("send");
  const { currentRates, isLoading } = useRates();
  const financeConfig = useFinanceConfig();

  const rawRate = from === "AUD" ? currentRates.buyAUD : currentRates.sellAUD;
  const safeRate = rawRate && Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 0;
  const to: Currency = from === "AUD" ? "IRT" : "AUD";
  const amountNum = getRawNumber(amountText);
  let estimate: ReturnType<typeof calculateQuoteMoney> | null = null;
  let calculationError = "";
  if (amountNum > 0 && safeRate > 0) {
    try {
      estimate = calculateQuoteMoney({
        amount: amountNum,
        currency: inputSide === "send" ? from : to,
        rate: safeRate,
        txType: from === "AUD" ? "sell_aud" : "buy_aud",
        config: financeConfig,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      calculationError = message.includes("transfer-fee threshold")
        ? (isEn ? "This amount cannot be converted with the current fee rules. Increase it or enter AUD in the other field." : "این مبلغ با شرایط کارمزد فعلی قابل تبدیل نیست؛ مبلغ بیشتری وارد کنید یا مبلغ دلاری را در فیلد دیگر وارد کنید.")
        : message.includes("cover the service fees") || message.includes("rounding limit")
          ? (isEn ? "Enter a larger amount to cover the fee and currency rounding." : "مبلغ بیشتری وارد کنید تا کارمزد و حداقل مبلغ قابل تبدیل پوشش داده شود.")
          : (isEn ? "This amount cannot be calculated. Review the amount or try again when rates are available." : "محاسبهٔ این مبلغ ممکن نیست؛ مبلغ را بررسی کنید یا پس از دریافت نرخ دوباره تلاش کنید.");
    }
  }
  const feeInAud = estimate?.baseFeeAud ?? 0;
  const isFeeApplied = feeInAud > 0;
  const unavailableText = safeRate === 0 || calculationError ? "—" : "";
  const draftText = localiseAmountDraft(amountText, isEn ? "en" : "fa");
  const sendText = inputSide === "send" ? draftText : estimate ? formatNumberByLocale(estimate.fundingTotal, isEn, from === "IRT") : unavailableText;
  const receiveText = inputSide === "receive" ? draftText : estimate ? formatNumberByLocale(estimate.recipientAmount, isEn, to === "IRT") : unavailableText;
  const amountDescription = `converter-amount-hint${calculationError ? " converter-amount-error" : ""}`;

  const handleInputChange = (value: string, side: InputSide) => {
    const normalized = normalizeAmount(value, side === "send" ? from : to);
    if (normalized === null) return;
    if (Number(normalized || "0") > Number.MAX_SAFE_INTEGER / 100) return;
    // Preserve a trailing separator and zeros so users can type amounts like 10.50.
    setInputSide(side);
    setAmountText(localiseAmountDraft(normalized, isEn ? "en" : "fa"));
  };

  const handleCurrencyChange = (value: string) => {
    const currency = value as Currency;
    const sendAmount = inputSide === "send" ? amountNum : estimate?.fundingTotal ?? 0;
    setFrom(currency);
    setInputSide("send");
    setAmountText(sendAmount > 0 ? formatNumberByLocale(sendAmount, isEn, currency === "IRT") : "");
  };

  const continueOnline = () => {
    if (!estimate) return;
    const query = new URLSearchParams({
      requestAmountAud: estimate.rawAmountAud.toFixed(2),
      requestDirection: from === "AUD" ? "sell_aud" : "buy_aud",
    });
    window.location.assign(`/${isEn ? "en" : "fa"}/dashboard?${query}`);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <h2 className={styles.mainTitle}>{isEn ? "Currency Exchange Calculator" : "ماشین‌حساب تبدیل ارز"}</h2>
          <p className={styles.subTitle}>{isEn ? "Estimate using the latest published rate" : "برآورد مبلغ با آخرین نرخ منتشرشده"}</p>
        </div>
        
        <div className={styles.rateInfo}>
          <span className={styles.pulse}></span>
          <span>
            {isLoading
              ? (isEn ? "Loading rate..." : "در حال دریافت نرخ...")
              : safeRate === 0
                ? (isEn ? "Rate unavailable. Please contact support." : "نرخ در دسترس نیست؛ با پشتیبانی تماس بگیرید.")
              : isEn
                ? `Current rate: 1 AUD = ${safeRate.toLocaleString("en-AU")} Toman`
                : `نرخ فعلی: ۱ دلار استرالیا = ${formatNumberFa(safeRate, true)} تومان`}
          </span>
        </div>
      </div>

      <div className={styles.converterBody}>
        <div className={styles.inputBox}>
          <label htmlFor="converter-send-amount" className={styles.label}>{isEn ? "You send" : "شما ارسال می‌کنید"}</label>
          <div className={styles.fieldGroup}>
            <input
              id="converter-send-amount"
              type="text"
              value={sendText}
              onChange={event => handleInputChange(event.target.value, "send")}
              dir="ltr"
              lang={isEn ? "en" : "fa"}
              data-number-locale={isEn ? "en" : "fa"}
              aria-describedby={amountDescription}
              aria-invalid={inputSide === "send" && !!calculationError || undefined}
              className={styles.faInput}
              placeholder={isEn ? "0" : "۰"}
              inputMode={from === "AUD" ? "decimal" : "numeric"}
            />
            <div className={styles.divider}></div>
            <div className={styles.selectWrapper}>
              <SelectBox
                value={from}
                onChange={handleCurrencyChange}
                labeledOptions={CURRENCY_OPTIONS}
                dir={isEn ? "ltr" : "rtl"}
                variant="ghost"
                className={styles.currencySelectBox}
              />
            </div>
          </div>
        </div>

        <div className={styles.exchangeIconWrapper}>
          <div className={styles.exchangeLine}></div>
          <ArrowUpDown className={styles.exchangeIcon} size={24} strokeWidth={1.5} aria-hidden="true" />
          <div className={styles.exchangeLine}></div>
        </div>

        <div className={styles.inputBox}>
          <div className={styles.labelRow}>
            <label htmlFor="converter-receive-amount" className={styles.label}>{isEn ? "Estimated recipient amount" : "برآورد مبلغ دریافتی"}</label>
            {isFeeApplied && (
              <span className={styles.feeWarning}>
                <AlertTriangle size={14} />
                {isEn
                  ? `Includes a ${feeInAud} AUD fee`
                  : `با احتساب ${formatNumberByLocale(feeInAud, false)} دلار کارمزد`}
              </span>
            )}
          </div>
          <div className={styles.fieldGroup}>
            <input
              id="converter-receive-amount"
              type="text"
              value={receiveText}
              onChange={event => handleInputChange(event.target.value, "receive")}
              dir="ltr"
              lang={isEn ? "en" : "fa"}
              data-number-locale={isEn ? "en" : "fa"}
              aria-describedby={amountDescription}
              aria-invalid={inputSide === "receive" && !!calculationError || undefined}
              className={styles.faInput}
              placeholder={isEn ? "0" : "۰"}
              inputMode={to === "AUD" ? "decimal" : "numeric"}
            />
            <div className={styles.divider}></div>
            <div className={styles.selectWrapper}>
              <SelectBox
                value={to}
                onChange={() => {}}
                labeledOptions={CURRENCY_OPTIONS}
                dir={isEn ? "ltr" : "rtl"}
                variant="ghost"
                disabled
                className={styles.currencySelectBox}
              />
            </div>
          </div>
        </div>
        <p id="converter-amount-hint" className={styles.amountHint}>{isEn ? "Enter either amount; the other is calculated automatically." : "مبلغ ارسالی یا دریافتی را وارد کنید؛ مبلغ دیگر خودکار محاسبه می‌شود."}</p>
        {calculationError && <p id="converter-amount-error" className={styles.calculationError} role="status">{calculationError}</p>}
      </div>

      <div className={styles.notesContainer}>
        <div className={styles.noteItem}>
          <Info size={16} strokeWidth={2} />
          <span>{isEn ? "This is an estimate. Review your final rate, fees and recipient amount before confirming a request." : "این مبلغ برآورد است. نرخ نهایی، کارمزد و مبلغ دریافتی را پیش از تأیید درخواست بررسی کنید."}</span>
        </div>
        <div className={styles.noteItem}>
          <Info size={16} strokeWidth={2} />
          <span>
            {isEn
              ? `Note: Transactions under ${financeConfig.fee_threshold} AUD incur a ${financeConfig.applied_fee} AUD fee, which is included in the calculation above.`
              : `توجه: برای تراکنش‌های کمتر از ${formatNumberByLocale(financeConfig.fee_threshold, false)} دلار، مبلغ ${formatNumberByLocale(financeConfig.applied_fee, false)} دلار به عنوان کارمزد کسر می‌گردد که در کادر بالا محاسبه میشود.`}
          </span>
        </div>
        <div className={styles.noteItem}>
          <UserCircle size={16} strokeWidth={2} />
          <span>{isEn ? "For personalised rates, sign in to your account and use your dedicated panel." : "برای شخصی‌سازی قیمت توصیه می‌شود وارد پروفایل کاربری خود شده و از پنل اختصاصی درخواست دهید."}</span>
        </div>
      </div>

      <div className={styles.cta}>
        <Button variant="primary" fullWidth rightIcon={<ArrowLeft />} onClick={continueOnline} disabled={!estimate}>
          {isEn ? "Send Request via WhatsApp" : "ارسال درخواست در واتس‌اپ"}
        </Button>
      </div>
    </div>
  );
}
