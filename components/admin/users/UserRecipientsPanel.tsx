"use client";

import React, { useMemo, useState, useTransition } from "react";
import { MapPin, Plus, Pencil, Save, X } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import formStyles from "@/styles/admin/AdminForms.module.css";
import { createAssistedRecipientForUser, updateAssistedRecipientForUser } from "@/app/actions/admin.actions";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { RecipientComplianceButtons } from "@/components/admin/RecipientComplianceButtons";

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
  residential_city?: string | null;
  residential_state?: string | null;
  residential_postcode?: string | null;
  residential_country?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  // IRT fields
  full_name?: string | null;
  card_number?: string | null;
  shaba_number?: string | null;
  irt_account_number?: string | null;
  irt_address?: string | null;
  irt_city?: string | null;
  irt_state?: string | null;
  irt_postcode?: string | null;
  irt_country?: string | null;
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

function composeAddress(parts: Array<string | null | undefined>) {
  return parts.map((p) => String(p ?? "").trim()).filter(Boolean).join(", ");
}

function splitLegacyAddress(raw: string): {
  street: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
} {
  const normalized = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return { street: "", city: "", state: "", postcode: "", country: "" };

  const countryMatch = normalized.match(/\b(australia|iran|islamic republic of iran)\b/i);
  const country = countryMatch?.[1] ?? "";
  const postcodeMatch = normalized.match(/\b(\d{4})\b(?!.*\b\d{4}\b)/);
  const postcode = postcodeMatch?.[1] ?? "";
  const stateMatch = normalized.match(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i);
  const state = stateMatch?.[1]?.toUpperCase() ?? "";

  let working = normalized;
  if (country) working = working.replace(new RegExp(`\\b${country}\\b`, "i"), "").trim();
  if (postcode) working = working.replace(new RegExp(`\\b${postcode}\\b`), "").trim();
  if (state) working = working.replace(new RegExp(`\\b${state}\\b`, "i"), "").trim();
  working = working.replace(/\s*,\s*/g, ", ").replace(/^,|,$/g, "").trim();

  let city = "";
  let street = "";
  if (working.includes(",")) {
    const parts = working.split(",").map((p) => p.trim()).filter(Boolean);
    city = parts.length > 0 ? parts[parts.length - 1] : "";
    street = parts.length > 1 ? parts.slice(0, -1).join(", ") : "";
  } else {
    const words = working.split(" ").filter(Boolean);
    if (words.length >= 3) {
      city = words.slice(-2).join(" ");
      street = words.slice(0, -2).join(" ");
    } else {
      street = working;
    }
  }

  return { street: street.trim(), city: city.trim(), state, postcode, country };
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
    residential_city: "",
    residential_state: "",
    residential_postcode: "",
    residential_country: "",
    recipient_email: "",
    recipient_phone: "",
    bank_type: "other",
    card_number: "",
    shaba_number: "",
    irt_account_number: "",
    full_name: "",
    irt_address: "",
    irt_city: "",
    irt_state: "",
    irt_postcode: "",
    irt_country: "",
    irt_phone: "",
  });
  const [editForm, setEditForm] = useState({
    direction: "aud",
    bank_name: "",
    bsb: "",
    account_number: "",
    account_name: "",
    residential_address: "",
    residential_city: "",
    residential_state: "",
    residential_postcode: "",
    residential_country: "",
    recipient_email: "",
    recipient_phone: "",
    bank_type: "other",
    card_number: "",
    shaba_number: "",
    irt_account_number: "",
    full_name: "",
    irt_address: "",
    irt_city: "",
    irt_state: "",
    irt_postcode: "",
    irt_country: "",
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
      residential_city: "",
      residential_state: "",
      residential_postcode: "",
      residential_country: "",
      recipient_email: "",
      recipient_phone: "",
      bank_type: "other",
      card_number: "",
      shaba_number: "",
      irt_account_number: "",
      full_name: "",
      irt_address: "",
      irt_city: "",
      irt_state: "",
      irt_postcode: "",
      irt_country: "",
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
        residential_address: composeAddress([
          form.residential_address,
          form.residential_city,
          form.residential_state,
          form.residential_postcode,
          form.residential_country,
        ]) || undefined,
        residential_city: form.residential_city || undefined,
        residential_state: form.residential_state || undefined,
        residential_postcode: form.residential_postcode || undefined,
        residential_country: form.residential_country || undefined,
        recipient_email: form.recipient_email || undefined,
        recipient_phone: form.recipient_phone || undefined,
        bank_type: form.bank_type as "bank_melli" | "other",
        card_number: form.card_number || undefined,
        shaba_number: form.shaba_number || undefined,
        irt_account_number: form.irt_account_number || undefined,
        full_name: form.full_name || undefined,
        irt_address: composeAddress([
          form.irt_address,
          form.irt_city,
          form.irt_state,
          form.irt_postcode,
          form.irt_country,
        ]) || undefined,
        irt_city: form.irt_city || undefined,
        irt_state: form.irt_state || undefined,
        irt_postcode: form.irt_postcode || undefined,
        irt_country: form.irt_country || undefined,
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
    const parsedResidential = splitLegacyAddress(recipient.residential_address || "");
    const parsedIrt = splitLegacyAddress(recipient.irt_address || "");
    setEditForm({
      direction: recipient.direction === "irt" ? "irt" : "aud",
      bank_name: recipient.bank_name || "",
      bsb: recipient.bsb || "",
      account_number: recipient.account_number || "",
      account_name: recipient.account_name || "",
      residential_address: recipient.residential_address || parsedResidential.street || "",
      residential_city: recipient.residential_city || parsedResidential.city || "",
      residential_state: recipient.residential_state || parsedResidential.state || "",
      residential_postcode: recipient.residential_postcode || parsedResidential.postcode || "",
      residential_country: recipient.residential_country || parsedResidential.country || "",
      recipient_email: recipient.recipient_email || "",
      recipient_phone: recipient.recipient_phone || "",
      bank_type: recipient.bank_type === "bank_melli" ? "bank_melli" : "other",
      card_number: recipient.card_number || "",
      shaba_number: recipient.shaba_number || "",
      irt_account_number: recipient.irt_account_number || "",
      full_name: recipient.full_name || "",
      irt_address: recipient.irt_address || parsedIrt.street || "",
      irt_city: recipient.irt_city || parsedIrt.city || "",
      irt_state: recipient.irt_state || parsedIrt.state || "",
      irt_postcode: recipient.irt_postcode || parsedIrt.postcode || "",
      irt_country: recipient.irt_country || parsedIrt.country || "",
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
        residential_address: composeAddress([
          editForm.residential_address,
          editForm.residential_city,
          editForm.residential_state,
          editForm.residential_postcode,
          editForm.residential_country,
        ]) || undefined,
        residential_city: editForm.residential_city || undefined,
        residential_state: editForm.residential_state || undefined,
        residential_postcode: editForm.residential_postcode || undefined,
        residential_country: editForm.residential_country || undefined,
        recipient_email: editForm.recipient_email || undefined,
        recipient_phone: editForm.recipient_phone || undefined,
        bank_type: editForm.bank_type as "bank_melli" | "other",
        card_number: editForm.card_number || undefined,
        shaba_number: editForm.shaba_number || undefined,
        irt_account_number: editForm.irt_account_number || undefined,
        full_name: editForm.full_name || undefined,
        irt_address: composeAddress([
          editForm.irt_address,
          editForm.irt_city,
          editForm.irt_state,
          editForm.irt_postcode,
          editForm.irt_country,
        ]) || undefined,
        irt_city: editForm.irt_city || undefined,
        irt_state: editForm.irt_state || undefined,
        irt_postcode: editForm.irt_postcode || undefined,
        irt_country: editForm.irt_country || undefined,
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
                <SelectBox
                  className={formStyles.input}
                  labeledOptions={[
                    { value: "aud", label: "Australia" },
                    { value: "irt", label: "Iran" },
                  ]}
                  value={form.direction}
                  onChange={(val) => setField("direction", val)}
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Recipient Label</label>
                <input className={formStyles.input} value={autoLabel} readOnly />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Full Name</label>
                <input
                  className={formStyles.input}
                  value={isAud ? form.account_name : form.full_name}
                  onChange={(e) => setField(isAud ? "account_name" : "full_name", e.target.value)}
                />
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
                    <label className={formStyles.label}>Street Address</label>
                    <input className={formStyles.input} value={form.residential_address} onChange={(e) => setField("residential_address", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>City</label>
                    <input className={formStyles.input} value={form.residential_city} onChange={(e) => setField("residential_city", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>State</label>
                    <input className={formStyles.input} value={form.residential_state} onChange={(e) => setField("residential_state", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Postcode</label>
                    <input className={formStyles.input} value={form.residential_postcode} onChange={(e) => setField("residential_postcode", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Country</label>
                    <input className={formStyles.input} value={form.residential_country} onChange={(e) => setField("residential_country", e.target.value)} />
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
                    <label className={formStyles.label}>Street Address</label>
                    <input className={formStyles.input} value={form.irt_address} onChange={(e) => setField("irt_address", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>City</label>
                    <input className={formStyles.input} value={form.irt_city} onChange={(e) => setField("irt_city", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>State/Province</label>
                    <input className={formStyles.input} value={form.irt_state} onChange={(e) => setField("irt_state", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Postcode</label>
                    <input className={formStyles.input} value={form.irt_postcode} onChange={(e) => setField("irt_postcode", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Country</label>
                    <input className={formStyles.input} value={form.irt_country} onChange={(e) => setField("irt_country", e.target.value)} />
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
                      <SelectBox
                        className={formStyles.input}
                        labeledOptions={[
                          { value: "aud", label: "Australia" },
                          { value: "irt", label: "Iran" },
                        ]}
                        value={editForm.direction}
                        onChange={(val) => setEditField("direction", val)}
                      />
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
                          <label className={formStyles.label}>Street Address</label>
                          <input className={formStyles.input} value={editForm.residential_address} onChange={(e) => setEditField("residential_address", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>City</label>
                          <input className={formStyles.input} value={editForm.residential_city} onChange={(e) => setEditField("residential_city", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>State</label>
                          <input className={formStyles.input} value={editForm.residential_state} onChange={(e) => setEditField("residential_state", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Postcode</label>
                          <input className={formStyles.input} value={editForm.residential_postcode} onChange={(e) => setEditField("residential_postcode", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Country</label>
                          <input className={formStyles.input} value={editForm.residential_country} onChange={(e) => setEditField("residential_country", e.target.value)} />
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
                          <label className={formStyles.label}>Street Address</label>
                          <input className={formStyles.input} value={editForm.irt_address} onChange={(e) => setEditField("irt_address", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>City</label>
                          <input className={formStyles.input} value={editForm.irt_city} onChange={(e) => setEditField("irt_city", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>State/Province</label>
                          <input className={formStyles.input} value={editForm.irt_state} onChange={(e) => setEditField("irt_state", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Postcode</label>
                          <input className={formStyles.input} value={editForm.irt_postcode} onChange={(e) => setEditField("irt_postcode", e.target.value)} />
                        </div>
                        <div className={formStyles.fieldGroup}>
                          <label className={formStyles.label}>Country</label>
                          <input className={formStyles.input} value={editForm.irt_country} onChange={(e) => setEditField("irt_country", e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <dl className={cardStyles.kycDetailList}>
                      {isAud ? (
                        <>
                          <Field label="Account Holder Name" value={r.account_name} />
                          <Field label="Bank Name"           value={r.bank_name} />
                          <Field label="BSB"                 value={r.bsb} mono />
                          <Field label="Account Number"      value={r.account_number} mono />
                          <Field label="Phone"               value={r.recipient_phone} />
                          <Field label="Email"               value={r.recipient_email} />
                          <Field label="Street Address"      value={r.residential_address} />
                          <Field label="City"                value={r.residential_city} />
                          <Field label="State"               value={r.residential_state} />
                          <Field label="Postcode"            value={r.residential_postcode} />
                          <Field label="Country"             value={r.residential_country} />
                        </>
                      ) : (
                        <>
                          <Field label="Full Name"           value={r.full_name} />
                          <Field label="Bank"                value={bankLabel} />
                          <Field label="Card Number"         value={r.card_number} mono />
                          <Field label="Account Number"      value={r.irt_account_number} mono />
                          <Field label="Shaba (IBAN)"        value={r.shaba_number || null} mono />
                          <Field label="Phone"               value={r.irt_phone} />
                          <Field label="Street Address"      value={r.irt_address} />
                          <Field label="City"                value={r.irt_city} />
                          <Field label="State/Province"      value={r.irt_state} />
                          <Field label="Postcode"            value={r.irt_postcode} />
                          <Field label="Country"             value={r.irt_country} />
                        </>
                      )}
                    </dl>
                    {/* Compliance check buttons — manual admin trigger only */}
                    <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px dashed var(--border-soft)" }}>
                      <RecipientComplianceButtons
                        recipientId={r.id}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
