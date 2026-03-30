"use client";

import React, { useMemo, useRef, useState } from "react";
import styles from "./ConverterFa.module.css";
import Button from "@/components/ui/Button/Button";
import { ArrowLeft } from "lucide-react";

type Currency = "AUD" | "IRT";

const CONFIG = {
  audToIRTRate: 103000,
  threshold: 3000,
  feePercent: 0.05,
} as const;

// تبدیل عدد انگلیسی به فارسی
function toFaDigits(input: string) {
  return input.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

// تبدیل عدد فارسی به انگلیسی
function faToEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return input.replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)));
}

// گرفتن عدد خام از ورودی (فقط رقم)
function getRawNumber(value: string) {
  let v = faToEnDigits(value);
  v = v.replace(/,/g, "");
  v = v.replace(/\D/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// فرمت عدد + جداکننده + فارسی
function formatNumberFa(num: number, frac = 0) {
  const en = Number(num || 0).toLocaleString("en-US", {
    maximumFractionDigits: frac,
    minimumFractionDigits: 0,
  });
  return toFaDigits(en);
}

export default function ConverterFa() {
  const [amountText, setAmountText] = useState<string>("3000");
  const [from, setFrom] = useState<Currency>("AUD");
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const to: Currency = from === "AUD" ? "IRT" : "AUD";

  const rateText = useMemo(() => {
    return toFaDigits(
      `1 دلار استرالیا = ${CONFIG.audToIRTRate.toLocaleString("en-US")} تومان ایران`
    );
  }, []);

  const computed = useMemo(() => {
    const rawInput = getRawNumber(amountText);
    const valueInAud = from === "AUD" ? rawInput : rawInput / CONFIG.audToIRTRate;

    let feeAud = 0;
    let feeLabel = "کارمزد";
    let feeNote = "کارمزدی برای این مبلغ دریافت نمی‌شود.";
    let feeNoteTone: "good" | "warn" = "good";

    if (valueInAud < CONFIG.threshold && valueInAud > 0) {
      feeAud = valueInAud * CONFIG.feePercent;
      feeLabel = "کارمزد (۵٪)";
      feeNote = `برای مبالغ کمتر از ${formatNumberFa(CONFIG.threshold, 0)} دلار استرالیا، کارمزد دریافت می‌شود.`;
      feeNoteTone = "warn";
    }

    const netAud = Math.max(valueInAud - feeAud, 0);
    const finalResult = to === "AUD" ? netAud : netAud * CONFIG.audToIRTRate;

    return { feeAud, netAud, finalResult, feeLabel, feeNote, feeNoteTone };
  }, [amountText, from, to]);

  const onAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;

    const cursorPosBefore = el.selectionStart ?? el.value.length;
    const oldLength = el.value.length;

    let plain = faToEnDigits(el.value);
    plain = plain.replace(/,/g, "").replace(/\D/g, "");

    if (plain === "") {
      setAmountText("");
      return;
    }

    const num = parseInt(plain, 10);
    const formattedEn = num.toLocaleString("en-US", { maximumFractionDigits: 0 });
    const formattedFa = toFaDigits(formattedEn);

    setAmountText(formattedFa);

    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;

      const newLength = formattedFa.length;
      const diff = newLength - oldLength;
      const newPos = Math.max(cursorPosBefore + diff, 0);
      input.setSelectionRange(newPos, newPos);
    });
  };

  const resultText =
    amountText.trim() === "" ? "۰" : formatNumberFa(computed.finalResult);

  async function handleSubmit() {
    if (loading) return;
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card} aria-label="مبدل نرخ ارز زرمان">
      <div className={styles.header}>
        <div className={styles.rateBox}>نرخ تضمین‌شده (۲۴ ساعت)</div>
        <div className={styles.liveRate}>{rateText}</div>
      </div>

      <div className={styles.inputRow}>
        <label className={styles.label} htmlFor="z-amount">
          شما می‌فرستید
        </label>
        <div className={`${styles.fieldGroup} ${styles.primary}`}>
          <input
            id="z-amount"
            ref={inputRef}
            type="text"
            value={amountText}
            onChange={onAmountChange}
            placeholder="۰"
            inputMode="numeric"
            autoComplete="off"
            aria-label="مبلغ ارسالی"
          />
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value as Currency)}
            aria-label="واحد پول مبدا"
          >
            <option value="AUD">دلار استرالیا</option>
            <option value="IRT">تومان ایران</option>
          </select>
        </div>
      </div>

      <div className={styles.breakdown} aria-label="جزئیات کارمزد و مبلغ خالص">
        <div className={styles.infoRow}>
          <span>{computed.feeLabel}</span>
          <span>{`${formatNumberFa(computed.feeAud)} دلار استرالیا`}</span>
        </div>

        <div className={styles.infoRow}>
          <span>مبلغ خالص قابل تبدیل</span>
          <span>
            {from === "AUD"
              ? `${formatNumberFa(computed.netAud)} دلار استرالیا`
              : `${formatNumberFa(computed.netAud)} دلار استرالیا (معادل)`}
          </span>
        </div>

        <div
          className={`${styles.noteRow} ${
            computed.feeNoteTone === "warn" ? styles.noteWarn : styles.noteGood
          }`}
        >
          {computed.feeNote}
        </div>
      </div>

      <div className={styles.inputRow}>
        <label className={styles.label} htmlFor="z-result">
          گیرنده دریافت می‌کند
        </label>
        <div className={`${styles.fieldGroup} ${styles.locked}`}>
          <input
            id="z-result"
            type="text"
            value={resultText}
            readOnly
            aria-label="مبلغ دریافتی"
          />
          <select value={to} disabled aria-label="واحد پول مقصد">
            <option value="IRT">تومان ایران</option>
            <option value="AUD">دلار استرالیا</option>
          </select>
        </div>
      </div>

      <div className={styles.cta}>
        <Button
          variant="primary"
          fullWidth
          loading={loading}
          rightIcon={<ArrowLeft />}
          onClick={handleSubmit}
          aria-label="ارسال درخواست انتقال"
        >
          ارسال درخواست
        </Button>
      </div>
    </div>
  );
}