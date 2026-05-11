"use client";

import React, { useMemo, useState } from "react";
import styles from "./ConverterFa.module.css";
import Button from "@/components/ui/Button/Button";
import { ArrowLeft, ArrowDownCircle, Info, UserCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { useRates } from "@/context/RateContext";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { buildWhatsAppUrl } from "@/lib/constants/contact";

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

export default function ConverterFa() {
  const [amountText, setAmountText] = useState<string>("۳،۰۰۰");
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

    return formatNumberFa(finalValue, to === "IRT");
  }, [amountNum, from, safeRate, to, isFeeApplied]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      setAmountText("");
      return;
    }
    const raw = getRawNumber(val);
    setAmountText(formatNumberFa(raw, from === "IRT"));
  };

  const handleWhatsApp = () => {
    if (safeRate === 0) return; // اگر نرخ قطع بود دکمه کار نکند
    const rateFa = formatNumberFa(safeRate, true);
    let text = "";
    
    if (from === "AUD") {
        text = `سلام، من می‌خواهم ${amountText} دلار استرالیا را با نرخ ${rateFa} تبدیل کنم که در وب‌سایت، مبلغ ${resultText} تومان محاسبه شده است. لطفا مرا راهنمایی کنید.`;
    } else {
        text = `سلام، من می‌خواهم ${amountText} تومان را با نرخ ${rateFa} تبدیل کنم که در وب‌سایت، مبلغ ${resultText} دلار استرالیا محاسبه شده است. لطفا مرا راهنمایی کنید.`;
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
          <h2 className={styles.mainTitle}>ماشین‌حساب تبدیل ارز</h2>
          <p className={styles.subTitle}>محاسبه آنلاین و لحظه‌ای نرخ حواله</p>
        </div>
        
        <div className={styles.rateInfo}>
          <span className={styles.pulse}></span>
          <span>
            {isLoading || safeRate === 0 
              ? "در حال دریافت نرخ..." 
              : `نرخ فعلی: ۱ دلار استرالیا = ${formatNumberFa(safeRate, true)} تومان`}
          </span>
        </div>
      </div>

      <div className={styles.converterBody}>
        <div className={styles.inputBox}>
          <label className={styles.label}>شما ارسال می‌کنید</label>
          <div className={styles.fieldGroup}>
            <input
              type="text"
              value={amountText}
              onChange={handleInputChange}
              dir="ltr"
              className={styles.faInput}
              placeholder="۰"
            />
            <div className={styles.divider}></div>
            <div className={styles.selectWrapper}>
              <select className={styles.currencySelect} value={from} onChange={(e) => setFrom(e.target.value as Currency)}>
                <option value="AUD">دلار استرالیا</option>
                <option value="IRT">تومان ایران</option>
              </select>
              <ChevronDown className={styles.selectChevron} size={16} strokeWidth={2.5} />
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
            <label className={styles.label}>گیرنده دریافت می‌کند</label>
            {isFeeApplied && (
              <span className={styles.feeWarning}>
                <AlertTriangle size={14} />
                این تراکنش دارای کارمزد {toFaDigits(String(financeConfig.applied_fee))} دلار است
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
              placeholder="۰"
            />
            <div className={styles.divider}></div>
            <div className={styles.selectWrapper}>
              <select className={styles.currencySelect} value={to} disabled>
                <option value="IRT">تومان ایران</option>
                <option value="AUD">دلار استرالیا</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.notesContainer}>
        <div className={styles.noteItem}>
          <Info size={16} strokeWidth={2} />
            <span>
             توجه: برای تراکنش‌های کمتر از {formatNumberFa(financeConfig.fee_threshold)} دلار، مبلغ {toFaDigits(String(financeConfig.applied_fee))} دلار به عنوان کارمزد کسر می‌گردد که در کادر بالا محاسبه میشود.
          </span>
        </div>
        <div className={styles.noteItem}>
          <UserCircle size={16} strokeWidth={2} />
          <span>برای شخصی‌سازی قیمت توصیه می‌شود وارد پروفایل کاربری خود شده و از پنل اختصاصی درخواست دهید.</span>
        </div>
      </div>

      <div className={styles.cta}>
        <Button variant="primary" fullWidth rightIcon={<ArrowLeft />} onClick={handleWhatsApp} disabled={safeRate === 0}>
          ارسال درخواست در واتس‌اپ
        </Button>
      </div>
    </div>
  );
}