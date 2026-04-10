import React, { useState, useMemo } from "react";
import { Calculator, AlertTriangle, Lock, MessageSquare, ChevronDown, ServerCrash, Loader2 } from "lucide-react";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";
import styles from "@/styles/dashboard/DashboardRequestHub.module.css";
import { Profile } from "@/app/fa/dashboard/dashboard.types";

function toFaDigits(input: string) { return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]); }
function faToEnDigits(input: string) { const fa = "۰۱۲۳۴۵۶۷۸۹"; return String(input).replace(/[۰-۹]/g, (d) => String(fa.indexOf(d))); }
function getRawNumber(value: string) {
  let v = faToEnDigits(value);
  v = v.replace(/،/g, "").replace(/,/g, "").replace(/\D/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatNumberUI(num: number | null, isToman: boolean = false) {
  if (num === null || !num) return "";
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  const en = Number(num).toLocaleString("en-US", options);
  return toFaDigits(en);
}

function formatNumberWA(num: number | null, isToman: boolean = false) {
  if (num === null) return "0";
  const options = isToman ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  return Number(num).toLocaleString("en-US", options);
}

type ServerTransactionResult = {
  baseRate: number;
  tailoredRate: number;
  loyaltyBonus: number;
  equivalentToman: number;
  appliedFee: number;
  rawAmount: number;
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
  onSaveTransaction: (rawAmount: number, txType: "buy_aud" | "sell_aud") => Promise<ServerTransactionResult | null>;
};

// 👇 باگ اینجا بود! کلمه default حذف شد تا ایمپورتِ فایل page.tsx درست کار کند
export function DashboardRequestHub({ 
  isApproved, txType, setTxType, amountStr, setAmountStr, 
  loyaltyBonus, tailoredRate, baseRate, displayFullName, profile,
  onSaveTransaction
}: RequestHubProps) { 
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawAmount = getRawNumber(amountStr);
  const appliedFee = (rawAmount > 0 && rawAmount < 1000) ? 15 : 0;
  const isRateOffline = baseRate === null || tailoredRate === null;

  const effectiveAud = useMemo(() => {
    if (rawAmount === 0) return 0;
    if (txType === "buy_aud") return rawAmount + appliedFee; 
    else return Math.max(rawAmount - appliedFee, 0);
  }, [rawAmount, appliedFee, txType]);

  const resultNumber = (rawAmount === 0 || isRateOffline) ? 0 : Math.round(effectiveAud * tailoredRate!);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") { setAmountStr(""); return; }
    if (val === "0" || val === "۰") { setAmountStr("۰"); return; }
    const raw = getRawNumber(val);
    setAmountStr(formatNumberUI(raw, false));
  };

  const submit = async () => {
    if (!profile || !isApproved || rawAmount <= 0 || isRateOffline || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const serverData = await onSaveTransaction(rawAmount, txType);
      
      if (!serverData) return; 

      const actionLabel = txType === "sell_aud" ? "فروش AUD (مشتری دلار می‌دهد)" : "خرید AUD (مشتری تومان می‌دهد)";
      
      const fmtAmount = formatNumberWA(serverData.rawAmount, false);
      const fmtResult = formatNumberWA(serverData.equivalentToman, true);
      const fmtTailored = formatNumberWA(serverData.tailoredRate, true);
      const fmtBase = formatNumberWA(serverData.baseRate, true);
      const fmtLoyalty = formatNumberWA(serverData.loyaltyBonus, true);
      
      let feeText = "بدون کارمزد";
      if (serverData.appliedFee > 0) {
         feeText = txType === "buy_aud" ? `${serverData.appliedFee} AUD (اضافه شده)` : `${serverData.appliedFee} AUD (کسر شده)`;
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
      
      setAmountStr("");

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className={cardStyles.panelCard}>
      {isRateOffline && (
        <div className={styles.lockOverlay} style={{ background: 'rgba(239, 68, 68, 0.9)' }}>
          <ServerCrash size={48} className={styles.lockIcon} style={{ color: '#fff' }} />
          <h3 className={styles.lockTitle}>ارتباط با سرور جهانی نرخ قطع است</h3>
          <p className={styles.lockText}>متاسفانه در حال حاضر دریافت نرخ لحظه‌ای امکان‌پذیر نیست. برای جلوگیری از ضرر مالی، ثبت تراکنش موقتاً غیرفعال شده است. لطفاً دقایقی دیگر تلاش کنید.</p>
        </div>
      )}

      {!isApproved && !isRateOffline && (
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
              <select className={styles.currencySelect} value={txType} onChange={(e) => setTxType(e.target.value as "buy_aud" | "sell_aud")} disabled={isSubmitting}>
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
            <input type="text" value={amountStr} onChange={handleInput} dir="ltr" className={styles.faInput} placeholder="۰" disabled={isRateOffline || isSubmitting} />
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
          <input type="text" value={isRateOffline ? "—" : formatNumberUI(resultNumber, true)} readOnly dir="ltr" className={`${styles.faInput} ${styles.resultInput}`} placeholder="۰" />
          <div className={styles.divider}></div>
          <span className={styles.currencyLabelFixed}>تومان</span>
        </div>
      </div>
      
      <div className={styles.summaryBox}>
        <div className={styles.summaryText}>
          <strong className={styles.summaryRate}>
            نرخ اختصاصی شما: {isRateOffline ? "—" : formatNumberUI(tailoredRate, true)} تومان
          </strong>
          {(loyaltyBonus > 0 && !isRateOffline) && (
            <span className={styles.summaryHint}>
              شامل {formatNumberUI(loyaltyBonus, true)} تومان سود وفاداری.
            </span>
          )}
        </div>
        <button className={cardStyles.primaryButton} onClick={submit} disabled={!isApproved || rawAmount <= 0 || isRateOffline || isSubmitting} type="button">
          {isSubmitting ? (
            <><Loader2 className="lucide-spin" size={20} /> در حال پردازش امن...</>
          ) : (
            <><MessageSquare size={20} /> تایید و ارسال به واتس‌اپ</>
          )}
        </button>
      </div>
    </article>
  );
}