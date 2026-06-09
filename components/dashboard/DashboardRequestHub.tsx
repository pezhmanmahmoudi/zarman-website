import React, { useState, useMemo, useEffect } from "react";
import { Calculator, AlertTriangle, Lock, MessageSquare, ServerCrash, Loader2, PauseCircle, Tag } from "lucide-react";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";
import styles from "@/styles/dashboard/DashboardRequestHub.module.css";
import { Profile } from "@/app/[locale]/dashboard/dashboard.types";
import type { Recipient } from "@/app/[locale]/dashboard/dashboard.types";
import { useFinanceConfig } from "@/context/FinanceConfigContext";
import { calcAppliedFee } from "@/lib/pricing";
import { buildWhatsAppUrl } from "@/lib/constants/contact";
import { supabase } from "@/lib/supabase";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { RecipientModal } from "@/components/dashboard/RecipientModal";
import { getRecipients, validatePromoCode } from "@/app/actions/transaction.actions";

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
  ) => Promise<ServerTransactionResult | null>;
};

export function DashboardRequestHub({ 
  isApproved, txType, setTxType, amountStr, setAmountStr, 
  loyaltyBonus, tailoredRate, baseRate, displayFullName, profile,
  onSaveTransaction
}: RequestHubProps) { 
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [marketActive, setMarketActive] = useState<boolean>(true);
  const [pauseMessage, setPauseMessage] = useState<string>("");
  const [sourceOfFunds, setSourceOfFunds] = useState("");
  const [reasonForTransfer, setReasonForTransfer] = useState("");
  const financeConfig = useFinanceConfig();

  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [showRecipientModal, setShowRecipientModal] = useState(false);

  // Promo code
  const [promoInput, setPromoInput] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<number | null>(null);
  const [promoFinal, setPromoFinal] = useState<number | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoEffectiveRate, setPromoEffectiveRate] = useState<number | null>(null);
  const [paymentLink, setPaymentLink] = useState("");

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

  // Load recipients when approved
  useEffect(() => {
    if (!isApproved) return;
    getRecipients().then((res) => {
      if ("data" in res && res.data) setRecipients(res.data);
    });
  }, [isApproved]);

  const recipientDirection = txType === "buy_aud" ? "aud" : "irt";
  const filteredRecipients = recipients.filter((r) => r.direction === recipientDirection);

  const recipientOptions = [
    { value: "__new__", label: "+ افزودن گیرنده جدید" },
    { value: "__edu_exam__", label: "پرداخت برای آزمون، دانشگاه و ..." },
    ...filteredRecipients.map((r) => ({ value: r.id, label: r.label })),
  ];

  const isEduPayment = selectedRecipientId === "__edu_exam__";

  const handleRecipientChange = (val: string) => {
    if (val === "__new__") {
      setShowRecipientModal(true);
      return;
    }
    setSelectedRecipientId(val);
    if (val !== "__edu_exam__") setPaymentLink("");
  };

  useEffect(() => {
    if (selectedRecipientId === "__edu_exam__") {
      setReasonForTransfer("International Payment");
    }
  }, [selectedRecipientId]);

  const handleRecipientCreated = (r: Recipient) => {
    setRecipients((prev) => [r, ...prev]);
    setSelectedRecipientId(r.id);
  };

  // Reset promo state when amount changes
  const resetPromo = () => {
    setPromoDiscount(null);
    setPromoFinal(null);
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
        setPromoFinal(null);
        setAppliedPromoCode(null);
      } else if ("discount_amount" in res) {
        setPromoDiscount(res.discount_amount ?? null);
        setPromoFinal(res.final_amount ?? null);
        setPromoEffectiveRate(res.effective_rate ?? null);
        setAppliedPromoCode(promoInput.trim().toUpperCase());
        const label = res.discount_type === "percentage"
          ? `${res.discount_value}٪ بهبود نرخ`
          : `${Number(res.discount_value).toLocaleString("fa-IR")} تومان بهبود نرخ`;
        setPromoMsg({ type: "success", text: `کد تخفیف اعمال شد — ${label}` });
      }
    } finally {
      setPromoValidating(false);
    }
  };

  const rawAmount = getRawNumber(amountStr);
  const appliedFee = calcAppliedFee(rawAmount, financeConfig);
  const isRateOffline = baseRate === null || tailoredRate === null;

  const effectiveAud = useMemo(() => {
    if (rawAmount === 0) return 0;
    if (txType === "buy_aud") return rawAmount + appliedFee; 
    else return Math.max(rawAmount - appliedFee, 0);
  }, [rawAmount, appliedFee, txType]);

  const activeRate = promoEffectiveRate ?? tailoredRate;
  const resultNumber = (rawAmount === 0 || isRateOffline) ? 0 : Math.round(effectiveAud * activeRate!);

  // مسدودسازی تایپ حروف الفبا برای فیلد دلار به صورت هوشمند
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    // فقط اجازه ورود اعداد انگلیسی، اعداد فارسی و ویرگول را می‌دهد
    val = val.replace(/[^\d۰-۹,،]/g, ""); 
    
    if (val === "") { setAmountStr(""); resetPromo(); return; }
    if (val === "0" || val === "۰") { setAmountStr("۰"); resetPromo(); return; }
    
    const raw = getRawNumber(val);
    setAmountStr(formatNumberUI(raw, false));
    resetPromo();
  };

  const submit = async () => {
    if (!profile || !isApproved || rawAmount <= 0 || isRateOffline || isSubmitting || !marketActive) return;
    if (!sourceOfFunds || !reasonForTransfer || !selectedRecipientId) {
      alert("لطفاً تمامی فیلدهای اجباری (ستاره‌دار) را تکمیل نمایید.");
      return;
    }
    if (isEduPayment && !paymentLink.trim()) {
      alert("لطفاً لینک صفحه پرداخت را وارد کنید.");
      return;
    }

    setIsSubmitting(true);

    // ─── Pre-open WhatsApp window NOW (synchronous, direct user gesture) ───────
    // Browsers block window.open called after an await. Opening with '' first,
    // then navigating it after the async work, bypasses the popup blocker.
    const whatsappWindow = window.open("", "_blank");

    try {
      const serverData = await onSaveTransaction(
        rawAmount,
        txType,
        sourceOfFunds,
        reasonForTransfer,
        selectedRecipientId || null,
        appliedPromoCode,
        isEduPayment ? (paymentLink.trim() || null) : null,
      );
      
      if (!serverData) {
        whatsappWindow?.close();
        return;
      }

      const actionLabel = txType === "sell_aud" ? "فروش AUD (مشتری دلار می‌دهد)" : "خرید AUD (مشتری تومان می‌دهد)";
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

      // Build recipient section
      let recipientSection = "";
      if (isEduPayment) {
        recipientSection =
          "--------------------------\n" +
          "گیرنده: آزمون / دانشگاه / موسسه\n" +
          (paymentLink ? `- لینک پرداخت: ${paymentLink}\n` : "");
      } else {
        const rec = recipients.find((r) => r.id === selectedRecipientId);
        if (rec) {
          recipientSection = "--------------------------\n📋 اطلاعات گیرنده:\n";
          if (rec.direction === "aud") {
            recipientSection += `- نام صاحب حساب: ${rec.account_name || "—"}\n`;
            recipientSection += `- بانک: ${rec.bank_name || "—"}\n`;
            recipientSection += `- BSB: ${rec.bsb || "—"}\n`;
            recipientSection += `- شماره حساب: ${rec.account_number || "—"}\n`;
            recipientSection += `- آدرس: ${rec.residential_address || "—"}\n`;
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
            if (rec.irt_address) recipientSection += `- آدرس: ${rec.irt_address}\n`;
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
        "- منبع وجه: " + sourceOfFunds + "\n" +
        "- دلیل انتقال: " + reasonForTransfer + "\n" +
        (recipientSection ? "\n" + recipientSection : "") +
        "\nلطفاً درخواست من را بررسی نمایید.";

      const finalUrl = buildWhatsAppUrl(text);

      // Navigate the pre-opened window to the WhatsApp URL
      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.href = finalUrl;
      } else {
        // Fallback: pre-open was blocked — try direct navigation
        window.location.assign(finalUrl);
      }
      setAmountStr("");
      resetPromo();
      setPromoInput("");
      setSelectedRecipientId("");
      setPaymentLink("");
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
          <h3 className={styles.lockTitle}>بازار موقتاً متوقف شده است</h3>
          <p className={styles.lockText}>{pauseMessage || "در حال حاضر امکان ثبت درخواست وجود ندارد. لطفاً بعداً مراجعه کنید."}</p>
        </div>
      )}

      {marketActive && isRateOffline && (
        <div className={`${styles.lockOverlay} ${styles.offlineOverlay}`}>
          <ServerCrash size={48} className={`${styles.lockIcon} ${styles.offlineIcon}`} />
          <h3 className={styles.lockTitle}>ارتباط با سرور جهانی نرخ قطع است</h3>
          <p className={styles.lockText}>متاسفانه در حال حاضر دریافت نرخ لحظه‌ای امکان‌پذیر نیست. ثبت تراکنش موقتاً غیرفعال شده است. لطفاً دقایقی دیگر تلاش کنید.</p>
        </div>
      )}

      {marketActive && !isApproved && !isRateOffline && (
        <div className={styles.lockOverlay}>
          <Lock size={48} className={styles.lockIcon} />
          <h3 className={styles.lockTitle}>دسترسی محدود است</h3>
          <p className={styles.lockText}> برای ثبت درخواست جدید ابتدا باید مدارک هویتی شما تکمیل و توسط مدیریت تایید شود. به قسمت "احراز هویت" بروید و اطلاعات خود را تکمیل کنید. </p>
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
            <SelectBox
              value={txType}
              onChange={(val) => setTxType(val as "buy_aud" | "sell_aud")}
              dir="rtl"
              labeledOptions={[
                { value: "buy_aud",  label: "خرید AUD (تومان می‌دهم، دلار می‌گیرم)" },
                { value: "sell_aud", label: "فروش AUD (دلار می‌دهم، تومان می‌گیرم)" },
              ]}
              disabled={isSubmitting}
            />
        </div>

        <div className={styles.inputBox}>
          <div className={styles.labelRow}>
            <label className={styles.label}>مقدار به دلار (AUD) <span className={styles.requiredMark}>*</span></label>
            {appliedFee > 0 && (
              <span className={styles.feeWarning}>
                <AlertTriangle size={14} /> 
                {txType === "buy_aud"
                  ? `افزوده شدن ${toFaDigits(String(financeConfig.applied_fee))} دلار کارمزد`
                  : `کسر ${toFaDigits(String(financeConfig.applied_fee))} دلار کارمزد`}
              </span>
            )}
          </div>
          {/* استفاده از استایل هاب بازگردانی شده با دیوایدر قدیم */}
          <div className={styles.hubFieldGroup}>
            <input type="text" inputMode="numeric" value={amountStr} onChange={handleInput} dir="ltr" className={styles.hubFaInput} placeholder="۰" disabled={isRateOffline || isSubmitting} />
            <div className={styles.hubDivider}></div>
            <span className={styles.currencyLabelFixed}>AUD</span>
          </div>
        </div>
      </div>
      
      <div className={styles.formRow}>
        <div className={styles.inputBox}>
          <label className={styles.label}>انتخاب گیرنده <span className={styles.requiredMark}>*</span></label>
          <SelectBox
            value={selectedRecipientId}
            onChange={handleRecipientChange}
            placeholder="— انتخاب کنید —"
            labeledOptions={recipientOptions}
            disabled={isSubmitting}
            dir="rtl"
          />
        </div>
        {isEduPayment ? (
          <div className={styles.inputBox}>
            <label className={styles.label}>لینک صفحه پرداخت <span className={styles.requiredMark}>*</span></label>
            <div className={styles.hubFieldGroup}>
              <input
                type="url"
                className={styles.hubEnInput}
                placeholder="https://..."
                value={paymentLink}
                onChange={(e) => setPaymentLink(e.target.value)}
                dir="ltr"
                style={{ textAlign: "left" }}
                disabled={isSubmitting}
               />
            </div>
            <span className={styles.fieldHint}>لینک صفحه پرداخت آزمون، دانشگاه یا موسسه مربوطه</span>
          </div>
        ) : (
          <div className={styles.inputBox} />
        )}
      </div>

      <div className={styles.formRow}>
        <div className={styles.inputBox}>
          <label className={styles.label}>منبع وجه (Source of Funds) <span className={styles.requiredMark}>*</span></label>
          <SelectBox
            value={sourceOfFunds}
            onChange={setSourceOfFunds}
            placeholder="Select Source of Funds"
            disabled={isSubmitting}
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
          <label className={styles.label}>دلیل انتقال (Reason for Transfer) <span className={styles.requiredMark}>*</span></label>
          <SelectBox
            value={reasonForTransfer}
            onChange={setReasonForTransfer}
            placeholder="Select reason"
            disabled={isSubmitting}
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
          <label className={styles.label}>
            {txType === "buy_aud" ? "مبلغ قابل پرداخت به تومان (IRT)" : "مبلغ دریافتی شما به تومان (IRT)"}
          </label>
          <div className={`${styles.hubFieldGroup} ${styles.hubLocked}`}>
            <input type="text" value={isRateOffline ? "—" : formatNumberUI(resultNumber, true)} readOnly dir="ltr" className={`${styles.hubFaInput} ${styles.hubResultInput}`} placeholder="۰" />
            <div className={styles.hubDivider}></div>
            <span className={styles.currencyLabelFixed}>تومان</span>
          </div>
          {promoDiscount !== null && promoDiscount > 0 && (
            <p className={styles.promoSuccess}>
              سود کد تخفیف: {formatNumberUI(promoDiscount, true)} تومان
            </p>
          )}
        </div>

        <div className={styles.inputBox}>
          <label className={styles.label}>
            <Tag size={14} style={{ display: "inline", verticalAlign: "middle", marginLeft: "4px" }} />
            کد تخفیف (اختیاری)
          </label>
          <div className={styles.promoRow}>
            <div className={styles.hubFieldGroup}>
              <input
                type="text"
                className={styles.hubEnInput}
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
              {promoValidating ? <Loader2 className="lucide-spin" size={20} /> : "اعمال"}
            </button>
          </div>
          {promoMsg && <p className={promoMsg.type === "success" ? styles.promoSuccess : styles.promoError}>{promoMsg.text}</p>}
        </div>
      </div>
      
      <div className={styles.summaryBox}>
        <div className={styles.summaryText}>
          <strong className={styles.summaryRate}>
            نرخ اختصاصی شما: {isRateOffline ? "—" : formatNumberUI(activeRate, true)} تومان
          </strong>
          {promoEffectiveRate && tailoredRate && !isRateOffline && (
            <span className={styles.summaryHint}>
              بهبودیافته با کد تخفیف — نرخ پایه: {formatNumberUI(tailoredRate, true)} تومان
            </span>
          )}
          {(loyaltyBonus > 0 && !isRateOffline) && (
            <span className={styles.summaryHint}>
              {rawAmount > 0 
                ? `شامل ${formatNumberUI(loyaltyBonus * rawAmount, true)} تومان سود وفاداری در این تراکنش.`
                : `شما ${formatNumberUI(loyaltyBonus, true)} تومان سود وفاداری روی هر دلار دارید.`}
            </span>
          )}
        </div>
        <button className={cardStyles.primaryButton} onClick={submit} disabled={!isApproved || rawAmount <= 0 || isRateOffline || isSubmitting || !marketActive} type="button">
          {isSubmitting ? (
            <><Loader2 className="lucide-spin" size={20} /> در حال پردازش امن...</>
          ) : (
            <><MessageSquare size={20} /> تایید و ارسال به واتس‌اپ</>
          )}
        </button>
      </div>

      {showRecipientModal && (
        <RecipientModal
          direction={recipientDirection}
          onClose={() => setShowRecipientModal(false)}
          onCreated={handleRecipientCreated}
        />
      )}
    </article>
  );
}