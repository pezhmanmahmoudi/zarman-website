import React, { useMemo } from "react";
import { Calculator, AlertTriangle, Lock, MessageSquare, ChevronDown } from "lucide-react";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";
import styles from "@/styles/dashboard/DashboardRequestHub.module.css";

// ==========================================
// توابع مدیریت اعداد (دوگانه: فارسی برای سایت، انگلیسی برای واتس‌اپ)
// ==========================================
function toFaDigits(input: string) { return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]); }
function faToEnDigits(input: string) { const fa = "۰۱۲۳۴۵۶۷۸۹"; return String(input).replace(/[۰-۹]/g, (d) => String(fa.indexOf(d))); }
function getRawNumber(value: string) {
  let v = faToEnDigits(value);
  v = v.replace(/،/g, "").replace(/,/g, "").replace(/\D/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// فرمت برای نمایش در داشبورد (اعداد کاملاً فارسی)
function formatNumberUI(num: number, isToman: boolean = false) {
  if (!num) return "";
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  const en = Number(num).toLocaleString("en-US", options);
  return toFaDigits(en);
}

// فرمت برای ارسال به واتس‌اپ (اعداد انگلیسی برای جلوگیری از به هم ریختگی پیام)
function formatNumberWA(num: number, isToman: boolean = false) {
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  return Number(num || 0).toLocaleString("en-US", options);
}

export function DashboardRequestHub({ 
  isApproved, txType, setTxType, amountStr, setAmountStr, 
  loyaltyBonus, tailoredRate, baseRate, displayFullName, profile,
  onSaveTransaction
}: any) {
  
  const rawAmount = getRawNumber(amountStr);
  const appliedFee = (rawAmount > 0 && rawAmount < 1000) ? 15 : 0;

  const effectiveAud = useMemo(() => {
    if (rawAmount === 0) return 0;
    if (txType === "buy_aud") return rawAmount + appliedFee; 
    else return Math.max(rawAmount - appliedFee, 0);
  }, [rawAmount, appliedFee, txType]);

  const resultNumber = rawAmount === 0 ? 0 : Math.round(effectiveAud * tailoredRate);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") { setAmountStr(""); return; }
    
    // اجازه تایپ کردن خود عدد صفر
    if (val === "0" || val === "۰") { setAmountStr("۰"); return; }
    
    const raw = getRawNumber(val);
    setAmountStr(formatNumberUI(raw, false));
  };

  const submit = async () => {
    if (!profile || !isApproved || rawAmount <= 0) return;

    if (onSaveTransaction) {
      const isSaved = await onSaveTransaction(rawAmount, resultNumber, txType);
      if (!isSaved) return; // اگر دیتابیس ارور داد واتس‌اپ باز نشود
    }

    const actionLabel = txType === "sell_aud" ? "فروش AUD (مشتری دلار می‌دهد)" : "خرید AUD (مشتری تومان می‌دهد)";
    
    // استفاده از فرمت انگلیسی فقط برای پیام واتس‌اپ
    const fmtAmount = formatNumberWA(rawAmount, false);
    const fmtResult = formatNumberWA(resultNumber, true);
    const fmtTailored = formatNumberWA(tailoredRate, true);
    const fmtBase = formatNumberWA(baseRate, true);
    const fmtLoyalty = formatNumberWA(loyaltyBonus, true);
    
    let feeText = "بدون کارمزد";
    if (appliedFee > 0) {
       feeText = txType === "buy_aud" ? `${appliedFee} AUD (اضافه شده)` : `${appliedFee} AUD (کسر شده)`;
    }

    const text = 
      "*** درخواست حواله اختصاصی زرمان ***\n\n" +
      "- مشتری: " + displayFullName + "\n" +
      "- ایمیل: " + (profile?.email || "—") + "\n" +
      "- نوع درخواست: " + actionLabel + "\n" +
      "- مقدار: " + fmtAmount + " AUD\n" +
      "--------------------------\n" +
      "- نرخ پایه بازار: " + fmtBase + " تومان\n" +
      "- تخفیف وفاداری: " + fmtLoyalty + " تومان\n" +
      "- نرخ اختصاصی نهایی: " + fmtTailored + " تومان\n" +
      "- کارمزد: " + feeText + "\n" +
      "--------------------------\n" +
      "* معادل نهایی: " + fmtResult + " تومان *\n\n" +
      "لطفاً درخواست من را بررسی نمایید.";

    window.open(`https://wa.me/61497851631?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

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
        <div className={styles.titleWrapper}>
          <h2 className={styles.panelTitle}>
            <Calculator size={26} className={styles.titleIcon} /> 
            محاسبه‌گر نرخ اختصاصی
          </h2>
        </div>
      </div>
      
      <div className={styles.formRow}>
        <div className={styles.inputBox}>
          <label className={styles.label}>نوع تراکنش ارزی از جانب مشتری</label>
          <div className={styles.fieldGroup}>
            <div className={styles.selectWrapper}>
              <select className={styles.currencySelect} value={txType} onChange={(e) => setTxType(e.target.value)}>
                <option value="buy_aud">خرید AUD (تومان می‌دهم، دلار می‌گیرم)</option>
                <option value="sell_aud">فروش AUD (دلار می‌دهم، تومان می‌گیرم)</option>
              </select>
              <ChevronDown className={styles.selectChevron} size={16} strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <div className={styles.inputBox}>
          <div className={styles.labelRow}>
            <label className={styles.label}>مقدار به دلار (AUD)</label>
            {appliedFee > 0 && (
              <span className={styles.feeWarning}>
                <AlertTriangle size={14} /> 
                {txType === "buy_aud" ? "افزوده شدن ۱۵ دلار کارمزد" : "کسر ۱۵ دلار کارمزد"}
              </span>
            )}
          </div>
          <div className={styles.fieldGroup}>
            <input type="text" value={amountStr} onChange={handleInput} dir="ltr" className={styles.faInput} placeholder="۰" />
            <div className={styles.divider}></div>
            <span className={styles.currencyLabelFixed}>AUD</span>
          </div>
        </div>
      </div>
      
      <div className={styles.inputBox} style={{ marginBottom: "28px" }}>
        <label className={styles.label}>
          {txType === "buy_aud" ? "مبلغ قابل پرداخت به تومان (IRT)" : "مبلغ دریافتی شما به تومان (IRT)"}
        </label>
        <div className={`${styles.fieldGroup} ${styles.locked}`}>
          {/* نمایش نتیجه با فرمت فارسی */}
          <input type="text" value={formatNumberUI(resultNumber, true)} readOnly dir="ltr" className={`${styles.faInput} ${styles.resultInput}`} placeholder="۰" />
          <div className={styles.divider}></div>
          <span className={styles.currencyLabelFixed}>تومان</span>
        </div>
      </div>
      
      <div className={styles.summaryBox}>
        <div className={styles.summaryText}>
          <strong className={styles.summaryRate}>
            نرخ اختصاصی شما: {formatNumberUI(tailoredRate, true)} تومان
          </strong>
          {loyaltyBonus > 0 && (
            <span className={styles.summaryHint}>
              شامل {formatNumberUI(loyaltyBonus, true)} تومان سود وفاداری.
            </span>
          )}
        </div>
        <button className={cardStyles.primaryButton} onClick={submit} disabled={!isApproved || rawAmount <= 0} type="button">
          <MessageSquare size={20} /> تایید و ارسال به واتس‌اپ
        </button>
      </div>
    </article>
  );
}