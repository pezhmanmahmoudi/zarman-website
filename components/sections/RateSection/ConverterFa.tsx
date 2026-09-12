"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import styles from "./ConverterFa.module.css";
import Button from "@/components/ui/Button/Button";
import { ArrowLeft, ArrowDownCircle, Info, UserCircle, AlertTriangle } from "lucide-react";
import { useRates } from "@/context/RateContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { buildWhatsAppUrl } from "@/lib/constants/contact";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { calcAppliedFee } from "@/lib/pricing";


type Currency = "AUD" | "IRT";

function toFaDigits(input: string) {
  return input.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function faToEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return input.replace(/[۰-۹٠-٩]/g, (d) => String(fa.includes(d) ? fa.indexOf(d) : ar.indexOf(d)));
}

function normalizeAmount(value: string): string | null {
  const normalized = faToEnDigits(value)
    .replace(/[،,٬\s]/g, "")
    .replace(/٫/g, ".");
  // Reject ambiguous or malformed amounts instead of silently multiplying them.
  return /^\d*(?:\.\d{0,2})?$/.test(normalized) ? normalized : null;
}

function getRawNumber(value: string) {
  const normalized = normalizeAmount(value);
  const n = normalized === null ? 0 : Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatNumberFa(num: number, isToman: boolean = false) {
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  const en = Number(num || 0).toLocaleString("en-US", options);
  return toFaDigits(en).replace(/,/g, "،");
}

function formatNumberByLocale(num: number, isEn: boolean, isToman: boolean = false) {
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  const en = Number(num || 0).toLocaleString("en-US", options);
  return isEn ? en : toFaDigits(en).replace(/,/g, "،");
}

export default function ConverterFa() {
  const { locale } = useParams<{ locale: string }>();
  const isEn = locale === "en";

  const CURRENCY_OPTIONS = [
    { value: "AUD", label: isEn ? "Australian Dollar" : "دلار استرالیا" },
    { value: "IRT", label: isEn ? "Iranian Toman" : "تومان ایران" },
  ];

  const [amountText, setAmountText] = useState<string>(isEn ? "3,000" : "۳،۰۰۰");
  const [from, setFrom] = useState<Currency>("AUD");
  const { currentRates, isLoading } = useRates();
  const financeConfig = useFinanceConfig();

  // 🛡️ اگر نرخ وجود نداشت، مقدار 0 در نظر گرفته می‌شود تا جلوی ارور null گرفته شود
  const rawRate = from === "AUD" ? currentRates.buyAUD : currentRates.sellAUD;
  const safeRate = rawRate || 0; 
  const to: Currency = from === "AUD" ? "IRT" : "AUD";

  const amountNum = getRawNumber(amountText);

  // Use the configured fee in both directions and recalculate when it changes.
  const rawAud = safeRate > 0 ? (from === "AUD" ? amountNum : amountNum / safeRate) : 0;
  const feeInAud = calcAppliedFee(rawAud, financeConfig);
  const isFeeApplied = feeInAud > 0;
  const netAud = Math.max(0, rawAud - feeInAud);
  const finalValue = from === "AUD" ? netAud * safeRate : netAud;
  const resultText = amountNum > 0 && safeRate > 0
    ? formatNumberByLocale(finalValue, isEn, to === "IRT")
    : "";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeAmount(e.target.value);
    if (normalized === null) return;
    if (normalized === "") {
      setAmountText("");
      return;
    }
    const [whole, fraction] = normalized.split(".");
    const wholeNumber = Number(whole || "0");
    if (!Number.isSafeInteger(wholeNumber)) return;
    const groupedWhole = wholeNumber.toLocaleString("en-AU", { maximumFractionDigits: 0 });
    // Preserve a trailing separator and zeros so users can type amounts like 10.50.
    const formatted = groupedWhole + (fraction === undefined ? "" : `.${fraction}`);
    setAmountText(isEn ? formatted : toFaDigits(formatted).replace(/,/g, "،").replace(/\./g, "٫"));
  };

  const handleWhatsApp = () => {
    if (safeRate === 0) return;
    const rateFa = formatNumberFa(safeRate, true);
    let text = "";
    if (isEn) {
      if (from === "AUD") {
        text = `Hi, I'd like to convert ${amountText} AUD at rate ${safeRate.toLocaleString("en-AU")} Toman/AUD. The website shows ${resultText} Toman. Please guide me.`;
      } else {
        text = `Hi, I'd like to convert ${amountText} Toman at rate ${safeRate.toLocaleString("en-AU")} Toman/AUD. The website shows ${resultText} AUD. Please guide me.`;
      }
    } else {
      if (from === "AUD") {
        text = `سلام، من می‌خواهم ${amountText} دلار استرالیا را با نرخ ${rateFa} تبدیل کنم که در وب‌سایت، مبلغ ${resultText} تومان محاسبه شده است. لطفا مرا راهنمایی کنید.`;
      } else {
        text = `سلام، من می‌خواهم ${amountText} تومان را با نرخ ${rateFa} تبدیل کنم که در وب‌سایت، مبلغ ${resultText} دلار استرالیا محاسبه شده است. لطفا مرا راهنمایی کنید.`;
      }
    }

    const finalUrl = buildWhatsAppUrl(text);

    // 👇 بررسی هوشمند برای جلوگیری از باز شدن تب خالی در موبایل
    if (finalUrl.startsWith('http')) {
      window.open(finalUrl, '_blank');
    } else {
      window.location.assign(finalUrl);
    }
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
              value={amountText}
              onChange={handleInputChange}
              dir="ltr"
              className={styles.faInput}
              placeholder={isEn ? "0" : "۰"}
              inputMode="decimal"
            />
            <div className={styles.divider}></div>
            <div className={styles.selectWrapper}>
              <SelectBox
                value={from}
                onChange={(val) => setFrom(val as Currency)}
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
          <ArrowDownCircle className={styles.exchangeIcon} size={24} strokeWidth={1.5} />
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
          <div className={`${styles.fieldGroup} ${styles.locked}`}>
            <input
              id="converter-receive-amount"
              type="text"
              value={safeRate === 0 ? "—" : resultText}
              readOnly
              dir="ltr"
              className={styles.faInput}
              placeholder={isEn ? "0" : "۰"}
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
        <Button variant="primary" fullWidth rightIcon={<ArrowLeft />} onClick={handleWhatsApp} disabled={safeRate === 0}>
          {isEn ? "Send Request via WhatsApp" : "ارسال درخواست در واتس‌اپ"}
        </Button>
      </div>
    </div>
  );
}
