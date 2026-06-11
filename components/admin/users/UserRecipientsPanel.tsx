"use client";

import React, { useMemo, useState, useTransition } from "react";
import { MapPin, Plus, Pencil, Save, X } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import formStyles from "@/styles/admin/AdminForms.module.css";
import { createAssistedRecipientForUser, updateAssistedRecipientForUser } from "@/app/actions/admin.actions";

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
        className={[
          cardStyles.kycDetailRowValue,
          !value ? cardStyles.kycDetailRowValueDim : "",
          mono ? cardStyles.kycDetailRowValueMono : "",
        ].filter(Boolean).join(" ")}
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
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
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
  const [editForm, setEditForm] = useState({
    direction: "aud",
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
  const isEditAud = editForm.direction === "aud";
  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const setEditField = (key: string, value: string) => setEditForm((prev) => ({ ...prev, [key]: value }));
  const nextLabel = useMemo(() => `Recipient ${recipients.length + 1}`, [recipients.length]);
  const autoLabel = useMemo(() => {
    if (isAud) {
      const accountName = form.account_name.trim();
      const bankName = form.bank_name.trim();
      return accountName || bankName ? `${accountName} — ${bankName}`.replace(/^\s*[—-]\s*|\s*[—-]\s*$/g, "") : nextLabel;
    }

    const fullName = form.full_name.trim();
    const bankName = form.bank_name.trim();
    const bankLabel = bankName || "Other";
    return fullName ? `${fullName} — ${bankLabel}` : nextLabel;
  }, [isAud, form.account_name, form.bank_name, form.full_name, nextLabel]);
  const editAutoLabel = useMemo(() => {
    if (isEditAud) {
      const accountName = editForm.account_name.trim();
      const bankName = editForm.bank_name.trim();
      return accountName || bankName ? `${accountName} — ${bankName}`.replace(/^\s*[—-]\s*|\s*[—-]\s*$/g, "") : "Recipient";
    }

    const fullName = editForm.full_name.trim();
    const bankName = editForm.bank_name.trim();
    const bankLabel = bankName || "Other";
    return fullName ? `${fullName} — ${bankLabel}` : "Recipient";
  }, [isEditAud, editForm.account_name, editForm.bank_name, editForm.full_name]);

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
        label: autoLabel,
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

  const startEdit = (recipient: Recipient) => {
    setStatus(null);
    setEditingRecipientId(recipient.id);
    setEditForm({
      direction: recipient.direction === "irt" ? "irt" : "aud",
      bank_name: recipient.bank_name || "",
      bsb: recipient.bsb || "",
      account_number: recipient.account_number || "",
      account_name: recipient.account_name || "",
      residential_address: recipient.residential_address || "",
      recipient_email: recipient.recipient_email || "",
      recipient_phone: recipient.recipient_phone || "",
      bank_type: recipient.bank_type === "bank_melli" ? "bank_melli" : "other",
      card_number: recipient.card_number || "",
      shaba_number: recipient.shaba_number || "",
      irt_account_number: recipient.irt_account_number || "",
      full_name: recipient.full_name || "",
      irt_address: recipient.irt_address || "",
      irt_phone: recipient.irt_phone || "",
    });
  };

  const cancelEdit = () => {
    setEditingRecipientId(null);
  };

  const saveEdit = () => {
    if (!userId || !editingRecipientId) {
      setStatus({ type: "error", text: "User context is missing. Reload profile and try again." });
      return;
    }

    setStatus(null);
    startTransition(async () => {
      const res = await updateAssistedRecipientForUser({
        recipientId: editingRecipientId,
        userId,
        direction: editForm.direction as "aud" | "irt",
        label: editAutoLabel,
        bank_name: editForm.bank_name || undefined,
        bsb: editForm.bsb || undefined,
        account_number: editForm.account_number || undefined,
        account_name: editForm.account_name || undefined,
        residential_address: editForm.residential_address || undefined,
        recipient_email: editForm.recipient_email || undefined,
        recipient_phone: editForm.recipient_phone || undefined,
        bank_type: editForm.bank_type as "bank_melli" | "other",
        card_number: editForm.card_number || undefined,
        shaba_number: editForm.shaba_number || undefined,
        irt_account_number: editForm.irt_account_number || undefined,
        full_name: editForm.full_name || undefined,
        irt_address: editForm.irt_address || undefined,
        irt_phone: editForm.irt_phone || undefined,
      });

      if ("error" in res && res.error) {
        setStatus({ type: "error", text: res.error });
        return;
      }

      setStatus({ type: "success", text: "Recipient details updated." });
      setEditingRecipientId(null);
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
        <div className={cardStyles.panelHeaderControls}>
          <span
            className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}
          >
            {recipients.length} saved
          </span>
          <button
            type="button"
            className={isFormOpen ? formStyles.btnSecondary : formStyles.btnPrimary}
            onClick={() => setIsFormOpen((v) => !v)}
          >
            {isFormOpen ? <X size={14} /> : <Plus size={14} />}
            {isFormOpen ? "Cancel" : "Add Recipient"}
          </button>
        </div>
      </div>

      <div className={`${cardStyles.panelBody} ${cardStyles.panelBodyList}`}>
        {isFormOpen && (
          <div className={cardStyles.formInset}>
            <div className={formStyles.fieldRow}>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Recipient in</label>
                <select className={formStyles.input} value={form.direction} onChange={(e) => setField("direction", e.target.value)}>
                  <option value="aud">Australia</option>
                  <option value="irt">Iran</option>
                </select>
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Recipient Label</label>
                <input className={formStyles.input} value={autoLabel} readOnly />
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
                    <input className={formStyles.input} value={form.bsb} onChange={(e) => setField("bsb", e.target.value)} />
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
                    <input className={formStyles.input} value={form.card_number} onChange={(e) => setField("card_number", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Account Number</label>
                    <input className={formStyles.input} value={form.irt_account_number} onChange={(e) => setField("irt_account_number", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>SHABA (IBAN)</label>
                    <input className={formStyles.input} value={form.shaba_number} onChange={(e) => setField("shaba_number", e.target.value)} />
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
              className={cardStyles.itemCard}
            key={r.id}
            >
              {/* Card header */}
              <div className={cardStyles.itemCardHeader}>
                <div className={cardStyles.itemCardHeaderInfo}>
                  <span
                    className={`${tableStyles.badge} ${isAud ? tableStyles.txBuy : tableStyles.txSell}`}
                  >
                    {isAud ? "AUD" : "IRT"}
                  </span>
                  <span className={cardStyles.itemCardHeaderName}>
                    {r.label || `Recipient ${idx + 1}`}
                  </span>
                </div>
                <span className={cardStyles.itemCardHeaderDate}>
                  Added:{" "}
                  {r.created_at
                    ? new Date(r.created_at).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </span>
                <div className={cardStyles.itemCardHeaderActions}>
                  {editingRecipientId === r.id ? (
                    <>
                      <button type="button" className={formStyles.btnPrimary} onClick={saveEdit} disabled={isPending}>
                        <Save size={14} />
                        Save
                      </button>
                      <button type="button" className={formStyles.btnSecondary} onClick={cancelEdit} disabled={isPending}>
                        <X size={14} />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className={formStyles.btnSecondary} onClick={() => startEdit(r)} disabled={isPending}>
                      <Pencil size={14} />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Card body */}
              <div className={cardStyles.itemCardBody}>
                {editingRecipientId === r.id ? (
                  <div className={formStyles.fieldRow}>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Recipient In</label>
                      <select className={formStyles.input} value={editForm.direction} onChange={(e) => setEditField("direction", e.target.value)}>
                        <option value="aud">Australia</option>
                        <option value="irt">Iran</option>
                      </select>
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Recipient Label</label>
                      <input className={formStyles.input} value={editAutoLabel} readOnly />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Full Name</label>
                      <input className={formStyles.input} value={isEditAud ? editForm.account_name : editForm.full_name} onChange={(e) => setEditField(isEditAud ? "account_name" : "full_name", e.target.value)} />
                    </div>
                    <div className={formStyles.fieldGroup}>
                      <label className={formStyles.label}>Bank Name</label>
                      <input className={formStyles.input} value={editForm.bank_name} onChange={(e) => setEditField("bank_name", e.target.value)} />
                    </div>

                    {isEditAud ? (
                      <>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>BSB</label>
                          <input className={formStyles.input} value={editForm.bsb} onChange={(e) => setEditField("bsb", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Acc. Number</label>
                          <input className={formStyles.input} value={editForm.account_number} onChange={(e) => setEditField("account_number", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Recipient Email</label>
                          <input className={formStyles.input} value={editForm.recipient_email} onChange={(e) => setEditField("recipient_email", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Recipient Phone</label>
                          <input className={formStyles.input} value={editForm.recipient_phone} onChange={(e) => setEditField("recipient_phone", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Full Address</label>
                          <input className={formStyles.input} value={editForm.residential_address} onChange={(e) => setEditField("residential_address", e.target.value)} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Card Number</label>
                          <input className={formStyles.input} value={editForm.card_number} onChange={(e) => setEditField("card_number", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Account Number</label>
                          <input className={formStyles.input} value={editForm.irt_account_number} onChange={(e) => setEditField("irt_account_number", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>SHABA (IBAN)</label>
                          <input className={formStyles.input} value={editForm.shaba_number} onChange={(e) => setEditField("shaba_number", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Phone</label>
                          <input className={formStyles.input} value={editForm.irt_phone} onChange={(e) => setEditField("irt_phone", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Full Address</label>
                          <input className={formStyles.input} value={editForm.irt_address} onChange={(e) => setEditField("irt_address", e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
