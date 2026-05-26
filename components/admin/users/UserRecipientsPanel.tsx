"use client";

import React from "react";
import { MapPin } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";

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
  recipients: Recipient[];
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

export function UserRecipientsPanel({ recipients }: UserRecipientsPanelProps) {
  if (!recipients || recipients.length === 0) {
    return (
      <div className={`${cardStyles.panel} ${cardStyles.panelMt}`}>
        <div className={cardStyles.panelHeader}>
          <h2 className={cardStyles.panelTitle}>
            <MapPin size={18} color="var(--text-dim)" />
            Recipient Accounts
          </h2>
        </div>
        <div className={cardStyles.emptyState}>
          <div className={cardStyles.emptyStateIcon}>
            <MapPin size={20} />
          </div>
          <div className={cardStyles.emptyStateText}>No saved recipients for this user.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardStyles.panel} ${cardStyles.panelMt}`}>
      <div className={cardStyles.panelHeader}>
        <h2 className={cardStyles.panelTitle}>
          <MapPin size={18} color="var(--text-dim)" />
          Recipient Accounts
        </h2>
        <span
          className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}
          style={{ fontSize: "0.75rem" }}
        >
          {recipients.length} saved
        </span>
      </div>

      <div className={cardStyles.panelBody} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
