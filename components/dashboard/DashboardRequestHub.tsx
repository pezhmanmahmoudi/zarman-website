import React, { useMemo } from "react";
import { Calculator, AlertTriangle, Lock, MessageSquare } from "lucide-react";
import { formatNumberFa, formatToman, getRawNumber } from "@/app/fa/dashboard/dashboard.utils";
import styles from "@/styles/dashboard/DashboardRequestHub.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";

export function DashboardRequestHub({ 
  isApproved, txType, setTxType, amountStr, setAmountStr, 
  loyaltyBonus, tailoredRate, handleWhatsAppSubmit, baseRate, displayFullName, profile 
}: any) {
  
  const rawAmount = useMemo(() => getRawNumber(amountStr), [amountStr]);
  const appliedFee = useMemo(() => (rawAmount > 0 && rawAmount < 1000 ? 15 : 0), [rawAmount]);
  const effectiveAud = useMemo(() => Math.max(rawAmount - appliedFee, 0), [rawAmount, appliedFee]);
  const resultNumber = useMemo(() => rawAmount === 0 ? 0 : Math.round(effectiveAud * tailoredRate), [rawAmount, effectiveAud, tailoredRate]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") { setAmountStr(""); return; }
    setAmountStr(formatNumberFa(getRawNumber(val), false));
  };

  const submit = () => handleWhatsAppSubmit(rawAmount, appliedFee, tailoredRate, resultNumber, txType);

  return (
    <article className={cardStyles.panelCard}>
      {!isApproved && (
        <div className={styles.lockOverlay}>
          <Lock size={48} className={styles.lockIcon} />
          <h3 className={styles.lockTitle}>دسترسی محدود است</h3>
          <p className={styles.lockText}>مطابق با الزامات مالی و احراز هویت، برای ثبت درخواست جدید ابتدا باید مدارک هویتی شما تکمیل و توسط مدیریت تایید شود.</p>
        </div>
      )}
      <div className={cardStyles.panelHeader}>
        <h2 className={cardStyles.panelTitle}><Calculator size={24} /> محاسبه‌گر نرخ اختصاصی و ثبت درخواست</h2>
      </div>
      <div className={styles.calculatorGrid}>
        <div className={styles.calcBox}>
          <label className={styles.boxLabel}>نوع تراکنش ارزی</label>
          <select className={styles.inputControl} value={txType} onChange={(e) => setTxType(e.target.value)}>
            <option value="sell_aud">فروش AUD (من دلار می‌دهم، تومان می‌گیرم)</option>
            <option value="buy_aud">خرید AUD (من تومان می‌دهم، دلار می‌گیرم)</option>
          </select>
        </div>
        <div className={styles.calcBox}>
          <label className={styles.boxLabel}>مقدار به دلار (AUD)</label>
          <input type="text" className={styles.inputControl} dir="ltr" value={amountStr} onChange={handleInput} placeholder="۰" />
          {appliedFee > 0 && <span className={styles.warningInline}><AlertTriangle size={14} /> کسر ۱۵ دلار کارمزد برای مبالغ زیر ۱۰۰۰ دلار</span>}
        </div>
      </div>
      <div className={styles.inputGroup}>
        <label>معادل نهایی حواله به تومان (IRR)</label>
        <div className={`${styles.inputControl} ${styles.resultBox}`}>{formatNumberFa(resultNumber, true)}</div>
      </div>
      <div className={styles.summaryBox}>
        <div className={styles.summaryText}>
          <strong className={styles.summaryRate}>نرخ اختصاصی شما: {formatToman(tailoredRate)}</strong>
          {loyaltyBonus > 0 && <span className={styles.summaryHint}>شامل {formatToman(loyaltyBonus)} تخفیف وفاداری به پاس تراکنش‌های قبلی شما.</span>}
        </div>
        <button className={cardStyles.primaryButton} onClick={submit} disabled={!isApproved || rawAmount <= 0} type="button">
          <MessageSquare size={20} /> تایید و ارسال به واتس‌اپ
        </button>
      </div>
    </article>
  );
}