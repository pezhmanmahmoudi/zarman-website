"use client";

import React, { useMemo, useState, useTransition } from "react";
import { MapPin, Plus } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import formStyles from "@/styles/admin/AdminForms.module.css";
import { createAssistedRecipientForUser } from "@/app/actions/admin.actions";

interface Recipient {
  id: string;
  direction: string;
  label?: string | null;
  bank_type?: string | null;
  // AUD fields
  bank_name?: string | null;
  bsb?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  residential_address?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  // IRT fields
  full_name?: string | null;
  card_number?: string | null;
  shaba_number?: string | null;
  irt_account_number?: string | null;
  irt_address?: string | null;
  irt_phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface UserRecipientsPanelProps {
  userId?: string;
  recipients: Recipient[];
  onRecipientCreated?: () => void;
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className={cardStyles.kycDetailRow}>
      <dt className={cardStyles.kycDetailRowLabel}>{label}</dt>
      <dd
        className={
          value
            ? cardStyles.kycDetailRowValue
            : `${cardStyles.kycDetailRowValue} ${cardStyles.kycDetailRowValueDim}`
        }
        style={mono ? { fontFamily: "monospace", fontSize: "0.88rem", letterSpacing: "0.03em" } : undefined}
        dir={mono ? "ltr" : undefined}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

export function UserRecipientsPanel({ userId, recipients, onRecipientCreated }: UserRecipientsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    direction: "aud",
    label: "",
    bank_name: "",
    bsb: "",
    account_number: "",
    account_name: "",
    residential_address: "",
    recipient_email: "",
    recipient_phone: "",
    bank_type: "other",
    card_number: "",
    shaba_number: "",
    irt_account_number: "",
    full_name: "",
    irt_address: "",
    irt_phone: "",
  });

  const hasRecipients = !!recipients?.length;
  const isAud = form.direction === "aud";
  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const nextLabel = useMemo(() => `Recipient ${recipients.length + 1}`, [recipients.length]);

  const resetForm = () => {
    setForm({
      direction: "aud",
      label: "",
      bank_name: "",
      bsb: "",
      account_number: "",
      account_name: "",
      residential_address: "",
      recipient_email: "",
      recipient_phone: "",
      bank_type: "other",
      card_number: "",
      shaba_number: "",
      irt_account_number: "",
      full_name: "",
      irt_address: "",
      irt_phone: "",
    });
  };

  const handleCreateRecipient = () => {
    if (!userId) {
      setStatus({ type: "error", text: "User context is missing. Reload profile and try again." });
      return;
    }

    setStatus(null);
    startTransition(async () => {
      const res = await createAssistedRecipientForUser({
        userId,
        direction: form.direction as "aud" | "irt",
        label: form.label || nextLabel,
        bank_name: form.bank_name || undefined,
        bsb: form.bsb || undefined,
        account_number: form.account_number || undefined,
        account_name: form.account_name || undefined,
        residential_address: form.residential_address || undefined,
        recipient_email: form.recipient_email || undefined,
        recipient_phone: form.recipient_phone || undefined,
        bank_type: form.bank_type as "bank_melli" | "other",
        card_number: form.card_number || undefined,
        shaba_number: form.shaba_number || undefined,
        irt_account_number: form.irt_account_number || undefined,
        full_name: form.full_name || undefined,
        irt_address: form.irt_address || undefined,
        irt_phone: form.irt_phone || undefined,
      });

      if ("error" in res && res.error) {
        setStatus({ type: "error", text: res.error });
        return;
      }

      setStatus({ type: "success", text: "Recipient added successfully." });
      resetForm();
      setIsFormOpen(false);
      onRecipientCreated?.();
    });
  };

  return (
    <div className={`${cardStyles.panel} ${cardStyles.panelMt}`}>
      <div className={cardStyles.panelHeader}>
        <h2 className={cardStyles.panelTitle}>
          <MapPin size={18} color="var(--text-dim)" />
          Recipient Accounts
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span
            className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}
            style={{ fontSize: "0.75rem" }}
          >
            {recipients.length} saved
          </span>
          <button type="button" className={formStyles.btnSecondary} onClick={() => setIsFormOpen((v) => !v)}>
            <Plus size={14} />
            {isFormOpen ? "Cancel" : "Add Recipient"}
          </button>
        </div>
      </div>

      <div className={cardStyles.panelBody} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {isFormOpen && (
          <div
            style={{
              border: "1px solid var(--border-soft)",
              borderRadius: "0.75rem",
              padding: "1rem",
              background: "var(--bg-soft)",
            }}
          >
            <div className={formStyles.fieldRow}>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Direction</label>
                <select className={formStyles.input} value={form.direction} onChange={(e) => setField("direction", e.target.value)}>
                  <option value="aud">AUD Transfer</option>
                  <option value="irt">IRT Transfer</option>
                </select>
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Recipient Label</label>
                <input className={formStyles.input} placeholder={nextLabel} value={form.label} onChange={(e) => setField("label", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Bank Name</label>
                <input className={formStyles.input} value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} />
              </div>

              {isAud ? (
                <>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Account Name</label>
                    <input className={formStyles.input} value={form.account_name} onChange={(e) => setField("account_name", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>BSB</label>
                    <input className={formStyles.input} value={form.bsb} onChange={(e) => setField("bsb", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Account Number</label>
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
                </>
              ) : (
                <>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Full Name</label>
                    <input className={formStyles.input} value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Card Number</label>
                    <input className={formStyles.input} value={form.card_number} onChange={(e) => setField("card_number", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Shaba</label>
                    <input className={formStyles.input} value={form.shaba_number} onChange={(e) => setField("shaba_number", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Phone</label>
                    <input className={formStyles.input} value={form.irt_phone} onChange={(e) => setField("irt_phone", e.target.value)} />
                  </div>
                </>
              )}
            </div>

            <div className={formStyles.formActions}>
              <button type="button" className={formStyles.btnPrimary} onClick={handleCreateRecipient} disabled={isPending}>
                {isPending ? "Saving..." : "Save Recipient"}
              </button>
              {status && (
                <span className={`${formStyles.saveStatus} ${status.type === "success" ? formStyles.saveStatusSuccess : formStyles.saveStatusError}`}>
                  {status.text}
                </span>
              )}
            </div>
          </div>
        )}

        {!hasRecipients && (
          <div className={cardStyles.emptyState}>
            <div className={cardStyles.emptyStateIcon}>
              <MapPin size={20} />
            </div>
            <div className={cardStyles.emptyStateText}>No saved recipients for this user.</div>
          </div>
        )}

        {recipients.map((r, idx) => {
          const isAud = r.direction === "aud";
          const bankLabel = isAud
            ? (r.bank_name || "—")
            : r.bank_type === "bank_melli" ? "Bank Melli (ملی)" : (r.bank_name || "Other Bank");

          return (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--border-soft)",
                borderRadius: "0.75rem",
                overflow: "hidden",
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1.25rem",
                  background: "var(--bg-soft)",
                  borderBottom: "1px solid var(--border-soft)",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <span
                    className={`${tableStyles.badge} ${isAud ? tableStyles.txBuy : tableStyles.txSell}`}
                    style={{ fontWeight: 700, fontSize: "0.75rem" }}
                  >
                    {isAud ? "AUD" : "IRT"}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>
                    {r.label || `Recipient ${idx + 1}`}
                  </span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", fontFamily: "monospace" }}>
                  Added:{" "}
                  {r.created_at
                    ? new Date(r.created_at).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </span>
              </div>

              {/* Card body */}
              <div style={{ padding: "1.25rem" }}>
                <dl className={cardStyles.kycDetailList}>
                  {isAud ? (
                    <>
                      <Field label="Account Holder Name" value={r.account_name} />
                      <Field label="Bank Name"           value={r.bank_name} />
                      <Field label="BSB"                 value={r.bsb} mono />
                      <Field label="Account Number"      value={r.account_number} mono />
                      <Field label="Phone"               value={r.recipient_phone} />
                      <Field label="Email"               value={r.recipient_email} />
                      <Field label="Residential Address" value={r.residential_address} />
                    </>
                  ) : (
                    <>
                      <Field label="Full Name"           value={r.full_name} />
                      <Field label="Bank"                value={bankLabel} />
                      <Field label="Card Number"         value={r.card_number} mono />
                      <Field label="Account Number"      value={r.irt_account_number} mono />
                      <Field label="Shaba (IBAN)"        value={r.shaba_number ? `IR${r.shaba_number}` : null} mono />
                      <Field label="Phone"               value={r.irt_phone} />
                      <Field label="Address"             value={r.irt_address} />
                    </>
                  )}
                </dl>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
