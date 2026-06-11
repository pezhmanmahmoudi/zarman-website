"use client";

import React, { useMemo, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import formStyles from "@/styles/admin/AdminForms.module.css";
import { createAssistedCustomerOnboarding } from "@/app/actions/admin.actions";

type Props = {
  onCreated?: (userId: string) => void;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className={cardStyles.sectionHeading}>
      {children}
    </div>
  );
}

export function AssistedOnboardingPanel({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    // ── Personal ──────────────────────────────────────────
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    mobile_number: "",
    dob: "",
    // ── Address ───────────────────────────────────────────
    country: "Australia",
    address: "",
    city: "",
    state: "",
    postcode: "",
    // ── Admin metadata ────────────────────────────────────
    customer_code: "",
    kyc_status: "pending",
    // ── Document / Identity ───────────────────────────────
    doc_type: "",
    license_number: "",
    doc_card_number: "",   // driver licence card number
    state_of_issue: "",
    passport_number: "",
    expiry_date: "",
    // ── Recipient ─────────────────────────────────────────
    recipient_direction: "aud",
    recipient_label: "",
    bank_name: "",
    bsb: "",
    account_number: "",
    account_name: "",
    residential_address: "",
    recipient_email: "",
    recipient_phone: "",
    bank_type: "other",
    irt_card_number: "",   // IRT bank card (separate from driver licence card)
    shaba_number: "",
    irt_account_number: "",
    full_name: "",
    irt_address: "",
    irt_phone: "",
    // ── Optional first transaction ────────────────────────
    create_tx: false,
    tx_recipient: "section4",  // only option during onboarding: the recipient from Section 4
    tx_type: "buy_aud",
    tx_amount_aud: "",
    tx_equivalent_toman: "",
    tx_applied_rate: "",
    tx_source_of_funds: "",
    tx_reason_for_transfer: "",
    tx_payment_link: "",
  });

  const isAud = form.recipient_direction === "aud";
  const isDriverLicense = form.doc_type === "driver_license";
  const isPassport = form.doc_type === "passport";

  const recipientAutoLabel = useMemo(() => {
    if (isAud) {
      const accountName = form.account_name.trim();
      const bankName = form.bank_name.trim();
      return accountName || bankName
        ? `${accountName} - ${bankName}`.replace(/^\s*[-]\s*|\s*[-]\s*$/g, "")
        : "Primary recipient";
    }

    const fullName = form.full_name.trim();
    const bankName = form.bank_name.trim();
    const bankLabel = bankName || "Other";
    return fullName ? `${fullName} - ${bankLabel}` : "Primary recipient";
  }, [isAud, form.account_name, form.bank_name, form.full_name]);

  const setField = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    setStatus(null);
    startTransition(async () => {
      const res = await createAssistedCustomerOnboarding({
        first_name: form.first_name,
        middle_name: form.middle_name || undefined,
        last_name: form.last_name,
        email: form.email,
        mobile_number: form.mobile_number,
        dob: form.dob || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        postcode: form.postcode || undefined,
        country: form.country || undefined,
        customer_code: form.customer_code || undefined,
        kyc_status: (form.kyc_status as "pending" | "under_review" | "approved" | "rejected" | "archived") || "pending",
        document_type: (form.doc_type as "driver_license" | "passport" | "none" | "") || undefined,
        license_number: isDriverLicense ? (form.license_number || undefined) : undefined,
        card_number: isDriverLicense ? (form.doc_card_number || undefined) : undefined,
        state_of_issue: isDriverLicense ? (form.state_of_issue || undefined) : undefined,
        passport_number: isPassport ? (form.passport_number || undefined) : undefined,
        expiry_date: (isDriverLicense || isPassport) ? (form.expiry_date || undefined) : undefined,
        recipient: {
          direction: form.recipient_direction as "aud" | "irt",
          label: recipientAutoLabel,
          bank_name: form.bank_name || undefined,
          bsb: form.bsb || undefined,
          account_number: form.account_number || undefined,
          account_name: form.account_name || undefined,
          residential_address: form.residential_address || undefined,
          recipient_email: form.recipient_email || undefined,
          recipient_phone: form.recipient_phone || undefined,
          bank_type: (form.bank_type as "bank_melli" | "other") || "other",
          card_number: form.irt_card_number || undefined,
          shaba_number: form.shaba_number || undefined,
          irt_account_number: form.irt_account_number || undefined,
          full_name: form.full_name || undefined,
          irt_address: form.irt_address || undefined,
          irt_phone: form.irt_phone || undefined,
        },
        transaction: form.create_tx
          ? {
              create: true,
              type: form.tx_type as "buy_aud" | "sell_aud",
              amount_aud: Number(form.tx_amount_aud || 0),
              equivalent_toman: Number(form.tx_equivalent_toman || 0),
              applied_rate: form.tx_applied_rate ? Number(form.tx_applied_rate) : undefined,
              source_of_funds: form.tx_source_of_funds || undefined,
              reason_for_transfer: form.tx_reason_for_transfer || undefined,
              payment_link: form.tx_payment_link || undefined,
            }
          : { create: false, type: "buy_aud" as const, amount_aud: 0, equivalent_toman: 0 },
      });

      if ("error" in res && res.error) {
        setStatus({ type: "error", text: res.error });
        return;
      }

      setStatus({
        type: "success",
        text: res.transactionId
          ? "Customer, recipient, and pending transaction created successfully."
          : "Customer and recipient created successfully.",
      });

      if (res.userId) onCreated?.(res.userId);
    });
  };

  return (
    <div id="assisted-onboarding" className={cardStyles.panelMt}>
      {!open ? (
        <button type="button" className={formStyles.btnPrimary} onClick={() => setOpen(true)}>
          <UserPlus size={16} />
          Open Assisted Onboarding
        </button>
      ) : (
      <div className={cardStyles.panel}>
          <div className={cardStyles.panelHeader}>
            <h2 className={cardStyles.panelTitle}>
              <UserPlus size={18} />
              Assisted Customer Onboarding
            </h2>
            <button type="button" className={formStyles.btnSecondary} onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          <div className={cardStyles.panelBody}>
            <div className={formStyles.formSection}>

              {/* ─── 1. Personal Details ─── */}
              <SectionHeading>1 — Personal Details</SectionHeading>
              <div className={formStyles.fieldRow}>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>First Name *</label>
                  <input className={formStyles.input} value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Middle Name</label>
                  <input className={formStyles.input} value={form.middle_name} onChange={(e) => setField("middle_name", e.target.value)} />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Last Name *</label>
                  <input className={formStyles.input} value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Email *</label>
                  <input type="email" className={formStyles.input} value={form.email} onChange={(e) => setField("email", e.target.value)} />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Mobile *</label>
                  <input className={formStyles.input} value={form.mobile_number} onChange={(e) => setField("mobile_number", e.target.value)} placeholder="+61 4xx xxx xxx" />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Date of Birth</label>
                  <input type="date" className={formStyles.input} value={form.dob} onChange={(e) => setField("dob", e.target.value)} />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Customer Code</label>
                  <input className={formStyles.input} placeholder="Auto-generated if empty" value={form.customer_code} onChange={(e) => setField("customer_code", e.target.value)} />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>KYC Status</label>
                  <select className={formStyles.input} value={form.kyc_status} onChange={(e) => setField("kyc_status", e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className={formStyles.divider} />

              {/* ─── 2. Residential Address ─── */}
              <SectionHeading>2 — Residential Address</SectionHeading>
              <div className={formStyles.fieldRow}>
                <div className={`${formStyles.fieldGroup} ${formStyles.fieldGroupFull}`}>
                  <label className={formStyles.label}>Street Address</label>
                  <input className={formStyles.input} value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="123 Example St" />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>City / Suburb</label>
                  <input className={formStyles.input} value={form.city} onChange={(e) => setField("city", e.target.value)} />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>State</label>
                  <input className={formStyles.input} value={form.state} onChange={(e) => setField("state", e.target.value)} placeholder="NSW" />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Postcode</label>
                  <input className={formStyles.input} value={form.postcode} onChange={(e) => setField("postcode", e.target.value)} />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Country</label>
                  <input className={formStyles.input} value={form.country} onChange={(e) => setField("country", e.target.value)} />
                </div>
              </div>

              <div className={formStyles.divider} />

              {/* ─── 3. Identity Document ─── */}
              <SectionHeading>3 — Identity Document</SectionHeading>
              <div className={formStyles.fieldRow}>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Document Type</label>
                  <select className={formStyles.input} value={form.doc_type} onChange={(e) => setField("doc_type", e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="driver_license">Australian Driver Licence</option>
                    <option value="passport">Passport</option>
                    <option value="none">None / Submit via WhatsApp</option>
                  </select>
                </div>

                {isDriverLicense && (
                  <>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Licence Number</label>
                      <input className={formStyles.input} value={form.license_number} onChange={(e) => setField("license_number", e.target.value)} placeholder="e.g. 12345678" />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Card Number</label>
                      <input className={formStyles.input} value={form.doc_card_number} onChange={(e) => setField("doc_card_number", e.target.value)} placeholder="Printed on front of licence" />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>State of Issue</label>
                      <select className={formStyles.input} value={form.state_of_issue} onChange={(e) => setField("state_of_issue", e.target.value)}>
                        <option value="">— Select state —</option>
                        <option>NSW</option><option>VIC</option><option>QLD</option>
                        <option>WA</option><option>SA</option><option>TAS</option>
                        <option>ACT</option><option>NT</option>
                      </select>
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Expiry Date</label>
                      <input type="date" className={formStyles.input} value={form.expiry_date} onChange={(e) => setField("expiry_date", e.target.value)} />
                    </div>
                  </>
                )}

                {isPassport && (
                  <>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Passport Number</label>
                      <input className={formStyles.input} value={form.passport_number} onChange={(e) => setField("passport_number", e.target.value)} />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Expiry Date</label>
                      <input type="date" className={formStyles.input} value={form.expiry_date} onChange={(e) => setField("expiry_date", e.target.value)} />
                    </div>
                  </>
                )}
              </div>

              <div className={formStyles.divider} />

              {/* ─── 4. Recipient Account ─── */}
              <SectionHeading>4 — Recipient Account</SectionHeading>
              <div className={formStyles.fieldRow}>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Recipient In</label>
                  <select className={formStyles.input} value={form.recipient_direction} onChange={(e) => setField("recipient_direction", e.target.value)}>
                    <option value="aud">Australia</option>
                    <option value="irt">Iran</option>
                  </select>
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Recipient Label</label>
                  <input className={formStyles.input} value={recipientAutoLabel} readOnly />
                </div>
                <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Full Name</label>
                      <input className={formStyles.input} value={form.account_name} onChange={(e) => setField("account_name", e.target.value)} />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Bank Name</label>
                  <input className={formStyles.input} value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} />
                </div>

                {isAud ? (
                  <>
                    
                  
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>BSB</label>
                      <input className={formStyles.input} value={form.bsb} onChange={(e) => setField("bsb", e.target.value)} placeholder="000-000" />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Acc. Number</label>
                      <input className={formStyles.input} value={form.account_number} onChange={(e) => setField("account_number", e.target.value)} />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Recipient Email</label>
                      <input className={formStyles.input} value={form.recipient_email} onChange={(e) => setField("recipient_email", e.target.value)} />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Recipient Phone</label>
                      <input className={formStyles.input} value={form.recipient_phone} onChange={(e) => setField("recipient_phone", e.target.value)} />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Full Address</label>
                      <input className={formStyles.input} value={form.residential_address} onChange={(e) => setField("residential_address", e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Card Number</label>
                      <input className={formStyles.input} value={form.irt_card_number} onChange={(e) => setField("irt_card_number", e.target.value)} placeholder="6037xxxxxxxx" />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Account Number</label>
                      <input className={formStyles.input} value={form.irt_account_number} onChange={(e) => setField("irt_account_number", e.target.value)} />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>SHABA (IBAN)</label>
                      <input className={formStyles.input} value={form.shaba_number} onChange={(e) => setField("shaba_number", e.target.value)} placeholder="26 digits" />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Phone</label>
                      <input className={formStyles.input} value={form.irt_phone} onChange={(e) => setField("irt_phone", e.target.value)} />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Full Address</label>
                      <input className={formStyles.input} value={form.irt_address} onChange={(e) => setField("irt_address", e.target.value)} />
                    </div>
                  </>
                )}
              </div>

              <div className={formStyles.divider} />

              {/* ─── 5. Optional First Transaction ─── */}
              <SectionHeading>5 — First Transaction (optional)</SectionHeading>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.toggleRow}>
                  <span className={formStyles.toggleInfo}>
                    <span className={formStyles.toggleLabel}>Create Pending Transaction Now</span>
                    <span className={formStyles.toggleDesc}>Saved as pending — approve from Transactions queue when payment is received.</span>
                  </span>
                  <span className={formStyles.switch}>
                    <input type="checkbox" className={formStyles.switchInput} checked={form.create_tx} onChange={(e) => setField("create_tx", e.target.checked)} />
                    <span className={formStyles.switchSlider} />
                  </span>
                </label>
              </div>

              {form.create_tx && (
                <div className={formStyles.fieldRow}>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Recipient</label>
                    <select className={formStyles.input} value={form.tx_recipient} onChange={(e) => setField("tx_recipient", e.target.value)}>
                      <option value="section4">{recipientAutoLabel}</option>
                    </select>
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Transaction Type</label>
                    <select className={formStyles.input} value={form.tx_type} onChange={(e) => setField("tx_type", e.target.value)}>
                      <option value="buy_aud">Buy AUD</option>
                      <option value="sell_aud">Sell AUD</option>
                    </select>
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>AUD Amount</label>
                    <input type="number" step="0.01" min="0" className={formStyles.input} value={form.tx_amount_aud} onChange={(e) => setField("tx_amount_aud", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Equivalent Toman</label>
                    <input type="number" step="1" min="0" className={formStyles.input} value={form.tx_equivalent_toman} onChange={(e) => setField("tx_equivalent_toman", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Rate (Toman / AUD)</label>
                    <input type="number" step="1" min="0" className={formStyles.input} value={form.tx_applied_rate} onChange={(e) => setField("tx_applied_rate", e.target.value)} placeholder="e.g. 42000" />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Source of Funds</label>
                    <input className={formStyles.input} value={form.tx_source_of_funds} onChange={(e) => setField("tx_source_of_funds", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Reason for Transfer</label>
                    <input className={formStyles.input} value={form.tx_reason_for_transfer} onChange={(e) => setField("tx_reason_for_transfer", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Payment Link (optional)</label>
                    <input className={formStyles.input} value={form.tx_payment_link} onChange={(e) => setField("tx_payment_link", e.target.value)} placeholder="https://..." />
                  </div>
                </div>
              )}

              <div className={formStyles.formActions}>
                <button type="button" className={formStyles.btnPrimary} onClick={handleSubmit} disabled={isPending}>
                  {isPending ? "Creating…" : "Create Assisted Customer"}
                </button>
                {status && (
                  <span className={`${formStyles.saveStatus} ${status.type === "success" ? formStyles.saveStatusSuccess : formStyles.saveStatusError}`}>
                    {status.text}
                  </span>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
