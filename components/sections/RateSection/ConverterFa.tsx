"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./ConverterFa.module.css";
import Button from "@/components/ui/Button/Button";
import { ArrowLeft, ArrowDownCircle, Info, UserCircle, AlertTriangle } from "lucide-react";
import { useRates } from "@/context/RateContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { buildWhatsAppUrl } from "@/lib/constants/contact";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";


type Currency = "AUD" | "IRT";

function toFaDigits(input: string) {
  return input.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function faToEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return input.replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)));
}

function getRawNumber(value: string) {
  let v = faToEnDigits(value);
  v = v.replace(/،/g, "").replace(/,/g, "").replace(/\D/g, "");
  const n = Number(v);
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

  // بررسی اعمال کارمزد
  let isFeeApplied = false;
  if (amountNum > 0 && safeRate > 0) {
    if (from === "AUD") {
      isFeeApplied = amountNum < financeConfig.fee_threshold;
    } else {
      const rawAud = amountNum / safeRate;
      isFeeApplied = rawAud > 0 && rawAud < financeConfig.fee_threshold;
    }
  }

  const resultText = useMemo(() => {
    if (amountNum === 0 || safeRate === 0) return "";

    let finalValue = 0;

    if (from === "AUD") {
      const feeInAud = isFeeApplied ? financeConfig.applied_fee : 0;
      const netAud = Math.max(0, amountNum - feeInAud);
      finalValue = netAud * safeRate;
    } else {
      const rawAud = amountNum / safeRate;
      const feeInAud = isFeeApplied ? 15 : 0;
      finalValue = Math.max(0, rawAud - feeInAud);
    }

    return formatNumberByLocale(finalValue, isEn, to === "IRT");
  }, [amountNum, from, safeRate, to, isFeeApplied, isEn]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      setAmountText("");
      return;
    }
    const raw = getRawNumber(val);
    if (isEn) {
      const opts = from === "IRT" ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
      setAmountText(raw.toLocaleString("en-AU", opts));
    } else {
      setAmountText(formatNumberFa(raw, from === "IRT"));
    }
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
          <p className={styles.subTitle}>{isEn ? "Online live rate calculator" : "محاسبه آنلاین و لحظه‌ای نرخ حواله"}</p>
        </div>
        
        <div className={styles.rateInfo}>
          <span className={styles.pulse}></span>
          <span>
            {isLoading || safeRate === 0
              ? (isEn ? "Loading rate..." : "در حال دریافت نرخ...")
              : isEn
                ? `Current rate: 1 AUD = ${safeRate.toLocaleString("en-AU")} Toman`
                : `نرخ فعلی: ۱ دلار استرالیا = ${formatNumberFa(safeRate, true)} تومان`}
          </span>
        </div>
      </div>

      <div className={styles.converterBody}>
        <div className={styles.inputBox}>
          <label className={styles.label}>{isEn ? "You send" : "شما ارسال می‌کنید"}</label>
          <div className={styles.fieldGroup}>
            <input
              type="text"
              value={amountText}
              onChange={handleInputChange}
              dir="ltr"
              className={styles.faInput}
              placeholder={isEn ? "0" : "۰"}
              suppressHydrationWarning
            />
            <div className={styles.divider}></div>
            <div className={styles.selectWrapper}>
              <SelectBox
                value={from}
                onChange={(val) => setFrom(val as Currency)}
                labeledOptions={CURRENCY_OPTIONS}
                dir="rtl"
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
            <label className={styles.label}>{isEn ? "Recipient receives" : "گیرنده دریافت می‌کند"}</label>
            {isFeeApplied && (
              <span className={styles.feeWarning}>
                <AlertTriangle size={14} />
                {isEn
                  ? `This transaction has a ${financeConfig.applied_fee} AUD fee`
                  : `این تراکنش دارای کارمزد ${formatNumberByLocale(financeConfig.applied_fee, false)} دلار است`}
              </span>
            )}
          </div>
          <div className={`${styles.fieldGroup} ${styles.locked}`}>
            <input
              type="text"
              value={safeRate === 0 ? "—" : resultText}
              readOnly
              dir="ltr"
              className={styles.faInput}
              placeholder={isEn ? "0" : "۰"}
              suppressHydrationWarning
            />
            <div className={styles.divider}></div>
            <div className={styles.selectWrapper}>
              <SelectBox
                value={to}
                onChange={() => {}}
                labeledOptions={CURRENCY_OPTIONS}
                dir="rtl"
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