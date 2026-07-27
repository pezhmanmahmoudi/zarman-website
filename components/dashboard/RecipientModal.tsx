"use client";

import React, { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import styles from "@/styles/dashboard/RecipientModal.module.css";
import { createRecipient } from "@/app/actions/transaction.actions";
import type { Recipient, RecipientDirection, BankType } from "@/app/[locale]/dashboard/dashboard.types";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox"; 

// ─── Utility: Convert Persian digits to English before processing ──────────
function faToEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return String(input).replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)));
}

// ─── Bank List ────────────────────────────────────────────────────────────────
const iranianBanks = [
  { value: "Ayandeh Bank", label: "Ayandeh Bank" },
  { value: "BlueBank", label: "Blue Bank" },
  { value: "Dey Bank", label: "Dey Bank" },
  { value: "Eghtesad Novin Bank", label: "Eghtesad Novin Bank" },
  { value: "Gardeshgari Bank", label: "Gardeshgari Bank" },
  { value: "Ghavamin Bank", label: "Ghavamin Bank" },
  { value: "Hekmat Bank", label: "Hekmat Bank" },
  { value: "Karafarin Bank", label: "Karafarin Bank" },
  { value: "Keshavarzi Bank", label: "Keshavarzi Bank" },
  { value: "Maskan Bank", label: "Maskan Bank" },
  { value: "Parsian Bank", label: "Parsian Bank" },
  { value: "Pasargad Bank", label: "Pasargad Bank" },
  { value: "Post Bank of Iran", label: "Post Bank of Iran" },
  { value: "Refah Bank", label: "Refah Bank" },
  { value: "Saman Bank", label: "Saman Bank" },
  { value: "Sanat Va Maadan Bank", label: "Sanat Va Maadan Bank" },
  { value: "Sarmayeh Bank", label: "Sarmayeh Bank" },
  { value: "Shahr Bank", label: "Shahr Bank" },
  { value: "Sina Bank", label: "Sina Bank" },
  { value: "Tejarat Bank", label: "Tejarat Bank" },
  { value: "Tosee Credit Institution", label: "Tosee Credit Institution" },
  { value: "Tosee Saderat Bank", label: "Tosee Saderat Bank" },
  { value: "Tosee Taavon Bank", label: "Tosee Taavon Bank" },
  { value: "Bank Iran", label: "Other" }
];

// ─── Props ────────────────────────────────────────────────────────────────────
type RecipientModalProps = {
  direction: RecipientDirection;
  onClose: () => void;
  onCreated: (recipient: Recipient) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────
export function RecipientModal({ direction, onClose, onCreated }: RecipientModalProps) {
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

  // IBAN strict formatting
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

  // BSB formatting (3 digits - 3 digits)
  const handleBsbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = faToEnDigits(e.target.value).replace(/\D/g, "");
    if (raw.length > 6) raw = raw.slice(0, 6);
    if (raw.length > 3) raw = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    setBsb(raw);
  };

  // Numeric fields
  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => setAccountNumber(faToEnDigits(e.target.value).replace(/\D/g, ""));
  const handleIrtPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setIrtPhone(faToEnDigits(e.target.value).replace(/\D/g, ""));
  
  const handleRecipientPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    // Setting default to "other" to maintain compatibility with the previous database structure
    return {
      ...base,
      full_name: fullName.trim(),
      irt_address: irtAddress.trim(),
      irt_phone: irtPhone.trim(),
      bank_type: "other" as BankType,
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
      const bankLabel = iranianBanks.find(b => b.value === irtBankName)?.label || "Other";
      autoLabel = `${fullName.trim()} — ${bankLabel}`;
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
          <h3 className={styles.title} dir="ltr" style={{ textAlign: "left", width: "100%", paddingLeft: "8px" }}>
            {isAud ? "Add Australian Recipient" : "Add Iranian Recipient"}
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close" type="button">
            <X size={20} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <form className={styles.body} onSubmit={handleSave} dir="ltr">

          {/* ══ AUD ══════════════════════════════════════════════════ */}
          {isAud && (
            <div className={styles.ltr} dir="ltr" style={{ textAlign: "left" }}>
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
            <div className={styles.ltr} dir="ltr" style={{ textAlign: "left" }}>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>Account Information</p>
                
                {/* ── Sanctions Warning Banner ── */}
                <div 
                  dir="ltr"
                  style={{ 
                    backgroundColor: "rgba(255, 170, 0, 0.1)", 
                    color: "#b27b00", 
                    padding: "12px", 
                    borderRadius: "8px", 
                    fontSize: "13px", 
                    marginBottom: "16px", 
                    lineHeight: "1.5", 
                    display: "flex", 
                    alignItems: "flex-start", 
                    gap: "8px",
                    textAlign: "left"
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>
                    <strong>Sanctions Notice:</strong> The following banks are under active sanctions:{" "}
                    <strong style={{ color: "#ef4444" }}>
                      Bank Saderat Iran, Bank Mellat, Bank Sepah, Bank Melli Iran, Central Bank of Iran, Ansar Bank, and Mehr Bank
                    </strong>. If your only accounts are held with these institutions, please select the <strong>Other</strong> option from the list below.
                  </span>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label}>Bank Name <span className={styles.req}>*</span></label>
                    <SelectBox
                      value={irtBankName}
                      onChange={(val) => setIrtBankName(val)}
                      placeholder="Select Bank..."
                      labeledOptions={iranianBanks}
                      disabled={saving}
                      dir="ltr"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>IBAN (Shaba Number) <span className={styles.req}>*</span></label>
                    <div className={styles.inputWrap} style={{ direction: "ltr" }}>
                      <span className={styles.ibanPrefix}>IR</span>
                      <input required type="text" inputMode="numeric" className={styles.input} placeholder="12-1111-1111-1111-1111-1111-11" value={shabaDisplay} onChange={handleShabaChange} maxLength={30} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <p className={styles.sectionTitle}>Account Holder Information</p>
                <div className={styles.field}>
                  <label className={styles.label}>Full Name <span className={styles.req}>*</span></label>
                  <div className={styles.inputWrap}>
                    <input required type="text" className={styles.input} placeholder="e.g. Ali Rezaei" value={fullName} onChange={(e) => setFullName(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Full Residential Address <span className={styles.req}>*</span></label>
                  <div className={styles.inputWrap}>
                    <input required type="text" className={styles.input} placeholder="e.g. Tehran, Artesh St., No. 10" value={irtAddress} onChange={(e) => setIrtAddress(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Phone Number <span className={styles.req}>*</span></label>
                  <div className={styles.inputWrap}>
                    <input required type="tel" inputMode="tel" className={styles.input} placeholder="+989123456789" value={irtPhone} onChange={handleIrtPhoneChange} dir="ltr" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {errorMsg && <p className={styles.error} dir="ltr" style={{ textAlign: "left" }}>{errorMsg}</p>}

          {/* ── Footer ── */}
          <div className={styles.footer} dir="ltr" style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button className={`${styles.saveBtn}${saving ? ` ${styles.loading}` : ""}`} type="submit" disabled={saving || (!isAud && !irtBankName)}>
              {saving ? <><span className={styles.spinner} aria-hidden="true" /> Saving...</> : "Save Recipient"}
            </button>
            <button className={styles.cancelBtn} onClick={onClose} type="button" disabled={saving}>
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}