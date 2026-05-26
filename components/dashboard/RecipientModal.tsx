"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import styles from "@/styles/dashboard/RecipientModal.module.css";
import { createRecipient } from "@/app/actions/transaction.actions";
import type { Recipient, RecipientDirection, BankType } from "@/app/[locale]/dashboard/dashboard.types";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox"; 

// ─── Utility: Convert Persian digits to English before processing ──────────
function faToEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return String(input).replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)));
}

// ─── Props ────────────────────────────────────────────────────────────────────
type RecipientModalProps = {
  direction: RecipientDirection;
  onClose: () => void;
  onCreated: (recipient: Recipient) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────
export function RecipientModal({ direction, onClose, onCreated }: RecipientModalProps) {
  const [bankType, setBankType] = useState<BankType>("other");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // AUD fields
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bsb, setBsb] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  // IRT shared
  const [fullName, setFullName] = useState("");
  const [irtAddress, setIrtAddress] = useState("");
  const [irtPhone, setIrtPhone] = useState("");

  // IRT Bank Melli
  const [irtAccountNumber, setIrtAccountNumber] = useState("");
  const [cardNumber, setCardNumber] = useState("");

  // IRT Other Banks (Shaba + Bank Name)
  const [shabaDisplay, setShabaDisplay] = useState("");
  const [irtBankName, setIrtBankName] = useState("");

  // Scroll lock while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const isAud = direction === "aud";

  // فیلتر و مسدودسازی هوشمند فقط برای اعداد (شبا)
  const handleShabaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = faToEnDigits(e.target.value).replace(/\D/g, "");
    if (raw.length > 24) raw = raw.slice(0, 24);
    const parts: string[] = [];
    if (raw.length > 0)  parts.push(raw.slice(0, 2));
    if (raw.length > 2)  parts.push(raw.slice(2, 6));
    if (raw.length > 6)  parts.push(raw.slice(6, 10));
    if (raw.length > 10) parts.push(raw.slice(10, 14));
    if (raw.length > 14) parts.push(raw.slice(14, 18));
    if (raw.length > 18) parts.push(raw.slice(18, 22));
    if (raw.length > 22) parts.push(raw.slice(22, 24));
    setShabaDisplay(parts.join("-"));
  };

  // فیلتر و مسدودسازی هوشمند برای کارت بانکی (خط تیره دار)
  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = faToEnDigits(e.target.value).replace(/\D/g, "");
    if (raw.length > 16) raw = raw.slice(0, 16); 
    const formatted = raw.match(/.{1,4}/g)?.join(" - ") || ""; // خط تیره بین هر 4 رقم
    setCardNumber(formatted);
  };

  // فیلتر برای BSB (سه رقم - سه رقم)
  const handleBsbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = faToEnDigits(e.target.value).replace(/\D/g, "");
    if (raw.length > 6) raw = raw.slice(0, 6);
    if (raw.length > 3) raw = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    setBsb(raw);
  };

  // سایر فیلترهای فقط عدد
  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => setAccountNumber(faToEnDigits(e.target.value).replace(/\D/g, ""));
  const handleIrtAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => setIrtAccountNumber(faToEnDigits(e.target.value).replace(/\D/g, ""));
  const handleIrtPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setIrtPhone(faToEnDigits(e.target.value).replace(/\D/g, ""));
  
  const handleRecipientPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // برای موبایل استرالیا علامت + هم مجاز است
    let raw = faToEnDigits(e.target.value).replace(/[^\d+]/g, "");
    setRecipientPhone(raw);
  };

  const buildPayload = (autoLabel: string): Omit<Recipient, "id" | "user_id" | "created_at"> => {
    const base = { direction, label: autoLabel };
    if (isAud) {
      return {
        ...base,
        bank_name: bankName.trim(),
        bsb: bsb.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
        residential_address: residentialAddress.trim(),
        recipient_email: recipientEmail.trim(), 
        recipient_phone: recipientPhone.trim(),
      };
    }
    const sharedIrt = {
      full_name: fullName.trim(),
      irt_address: irtAddress.trim(),
      irt_phone: irtPhone.trim(),
      bank_type: bankType,
    };
    if (bankType === "bank_melli") {
      return {
        ...base,
        ...sharedIrt,
        irt_account_number: irtAccountNumber.trim(),
        card_number: cardNumber.replace(/\D/g, ""), // ارسال اعداد خالص به دیتابیس
      };
    }
    return {
      ...base,
      ...sharedIrt,
      bank_name: irtBankName.trim(),
      shaba_number: `IR${shabaDisplay.replace(/[\s-]/g, "")}`,
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setErrorMsg("");

    let autoLabel = "";
    if (isAud) {
      autoLabel = `${accountName.trim()} — ${bankName.trim()}`;
    } else {
      const bankNameFa = bankType === "bank_melli" ? "ملی" : (irtBankName.trim() || "سایر");
      autoLabel = `${fullName.trim()} — ${bankNameFa}`;
    }

    const payload = buildPayload(autoLabel);
    
    setSaving(true);
    try {
      const result = await createRecipient(payload);
      if ("error" in result && result.error) {
        setErrorMsg(result.error);
      } else if ("data" in result && result.data) {
        onCreated(result.data);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.card}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div />{/* grid spacer */}
          <h3 className={styles.title}>
            {isAud ? "افزودن گیرنده استرالیایی" : "افزودن گیرنده ایرانی"}
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="بستن" type="button">
            <X size={20} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <form className={styles.body} onSubmit={handleSave}>

          {/* ══ AUD ══════════════════════════════════════════════════ */}
          {isAud && (
            <div className={styles.ltr}>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Banking Information</p>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>Bank Name <span className={styles.req}>*</span></label>
                    <div className={styles.inputWrap}>
                      <input required type="text" className={styles.input} placeholder="e.g. Commonwealth Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} dir="ltr" />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Account Holder Name <span className={`${styles.req} ${styles.textAlignLtr}`}>*</span></label>
                    <div className={styles.inputWrap}>
                      <input required type="text" className={styles.input} placeholder="John Smith" value={accountName} onChange={(e) => setAccountName(e.target.value)} dir="ltr" />
                    </div>
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}> BSB <span className={`${styles.req} ${styles.textAlignLtr}`}>*</span></label>
                    <div className={styles.inputWrap}>
                      <input required type="text" inputMode="numeric" className={styles.input} placeholder="123-456" value={bsb} onChange={handleBsbChange} dir="ltr" />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Account Number <span className={`${styles.req} ${styles.textAlignLtr}`}>*</span></label>
                    <div className={styles.inputWrap}>
                      <input required type="text" inputMode="numeric" className={styles.input} placeholder="123456789" value={accountNumber} onChange={handleAccountNumberChange} dir="ltr" />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <p className={styles.sectionTitle}>Contact and Address Information</p>
                <div className={styles.field}>
                  <label className={styles.label}>Residential Address <span className={styles.req}>*</span></label>
                  <div className={styles.inputWrap}>
                    <input required type="text" className={styles.input} placeholder="123 Example St, Sydney NSW 2000" value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>Recipient Phone <span className={`${styles.req} ${styles.textAlignLtr}`}>*</span></label>
                    <div className={styles.inputWrap}>
                      <input required type="tel" inputMode="tel" className={styles.input} placeholder="+61412345678" value={recipientPhone} onChange={handleRecipientPhoneChange} dir="ltr" />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Recipient Email <span className={`${styles.req} ${styles.textAlignLtr}`}>*</span></label>
                    <div className={styles.inputWrap}>
                      <input required type="email" className={styles.input} placeholder="user@mail.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} dir="ltr" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ IRT ══════════════════════════════════════════════════ */}
          {!isAud && (
            <>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>نوع بانک</p>
                <SelectBox
                  value={bankType}
                  onChange={(val) => { setBankType(val as BankType); setIrtBankName(""); }}
                  labeledOptions={[
                    { value: "bank_melli", label: "بانک ملی ایران" },
                    { value: "other",      label: "سایر بانک‌ها (شبا / IBAN)" },
                  ]}
                  dir="rtl"
                  disabled={saving}
                />
              </div>

              <div className={styles.section}>
                <p className={styles.sectionTitle}>اطلاعات حساب</p>

                {bankType === "bank_melli" && (
                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>شماره حساب <span className={styles.req}>*</span></label>
                      <div className={styles.inputWrap}>
                        <input required type="text" inputMode="numeric" className={styles.input} placeholder="123456789" value={irtAccountNumber} onChange={handleIrtAccountNumberChange} dir="ltr" />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>شماره کارت <span className={styles.req}>*</span></label>
                      <div className={styles.inputWrap}>
                        <input required type="text" inputMode="numeric" className={styles.input} placeholder="1234 - 5678 - 9012 - 3456" value={cardNumber} onChange={handleCardChange} maxLength={25} dir="ltr" />
                      </div>
                    </div>
                  </div>
                )}

                {bankType === "other" && (
                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label className={styles.label}>نام بانک <span className={styles.req}>*</span></label>
                      <div className={styles.inputWrap}>
                        <input required type="text" className={styles.input} placeholder="e.g. Mellat, Saderat" value={irtBankName} onChange={(e) => setIrtBankName(e.target.value)} dir="ltr" />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>شماره شبا (IBAN) <span className={styles.req}>*</span></label>
                      <div className={styles.inputWrap} style={{ direction: "ltr" }}>
                        <span className={styles.ibanPrefix}>IR</span>
                        <input required type="text" inputMode="numeric" className={styles.input} placeholder="12-1111-1111-1111-1111-1111-11" value={shabaDisplay} onChange={handleShabaChange} maxLength={30} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.section}>
                <p className={styles.sectionTitle}>اطلاعات صاحب حساب</p>
                <div className={styles.field}>
                  <label className={styles.label}>نام و نام خانوادگی <span className={styles.req}>*</span></label>
                  <div className={styles.inputWrap}>
                    <input required type="text" className={styles.input} placeholder="e.g. Ali Rezaei" value={fullName} onChange={(e) => setFullName(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>آدرس کامل سکونت <span className={styles.req}>*</span></label>
                  <div className={styles.inputWrap}>
                    <input required type="text" className={styles.input} placeholder="e.g. Tehran, Artesh St., No. 10" value={irtAddress} onChange={(e) => setIrtAddress(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>شماره تلفن <span className={styles.req}>*</span></label>
                  <div className={styles.inputWrap}>
                    <input required type="tel" inputMode="tel" className={styles.input} placeholder="+989123456789" value={irtPhone} onChange={handleIrtPhoneChange} dir="ltr" />
                  </div>
                </div>
              </div>
            </>
          )}

          {errorMsg && <p className={styles.error}>{errorMsg}</p>}

          {/* ── Footer ── */}
          <div className={styles.footer}>
            <button className={styles.saveBtn} type="submit" disabled={saving}>
              {saving && <Loader2 className="lucide-spin" size={18} />}
              {saving ? "در حال ذخیره..." : "ذخیره گیرنده"}
            </button>
            <button className={styles.cancelBtn} onClick={onClose} type="button" disabled={saving}>
              انصراف
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}