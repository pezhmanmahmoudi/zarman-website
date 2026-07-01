"use client";

import React, { useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ToggleLeft, ToggleRight, Tag } from "lucide-react";
import formStyles from "@/styles/admin/AdminForms.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import {
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from "@/app/actions/admin.actions";
import type { PromoCode } from "@/app/[locale]/dashboard/dashboard.types";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";

// ΓöÇΓöÇΓöÇ Empty creation form state ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const EMPTY_FORM = {
  code: "",
  discount_type: "percentage" as "percentage" | "fixed",
  discount_value: "",
  max_uses: "",
  expires_at: "",
  description: "",
};

// ΓöÇΓöÇΓöÇ PromoCodeManager component ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export function PromoCodeManager({
  initialCodes,
}: {
  initialCodes: PromoCode[];
}) {
  const router = useRouter();
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();

  const [codes, setCodesOptimistic] = useOptimistic(initialCodes);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ΓöÇΓöÇ Create ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const handleCreate = () => {
    const code = form.code.trim().toUpperCase();
    if (!code) { setFormError("Code is required."); return; }
    const value = parseFloat(form.discount_value);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Discount value must be a positive number.");
      return;
    }
    if (form.discount_type === "percentage" && value > 100) {
      setFormError("Percentage discount cannot exceed 100.");
      return;
    }
    setFormError("");

    startTransition(async () => {
      const result = await createPromoCode({
        code,
        discount_type: form.discount_type,
        discount_value: value,
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
        expires_at: form.expires_at || null,
        description: form.description || null,
        active: true,
      });
      if (result.error) {
        showToast({ type: "error", message: result.error });
      } else {
        showToast({ type: "success", message: `Promo code "${code}" created.` });
        setForm(EMPTY_FORM);
        setShowForm(false);
        router.refresh();
      }
    });
  };

  // ΓöÇΓöÇ Toggle active ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const handleToggle = (c: PromoCode) => {
    const next = !c.active;
    startTransition(async () => {
      setCodesOptimistic((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, active: next } : x))
      );
      const result = await updatePromoCode(c.id, { active: next });
      if (result.error) showToast({ type: "error", message: result.error });
      else router.refresh();
    });
  };

  // ΓöÇΓöÇ Delete ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const handleDelete = (c: PromoCode) => {
    confirm({
      title: "Delete Promo Code",
      message: `Delete "${c.code}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        const result = await deletePromoCode(c.id);
        if (result.error) showToast({ type: "error", message: result.error });
        else {
          showToast({ type: "success", message: `"${c.code}" deleted.` });
          router.refresh();
        }
      },
    });
  };

  // ΓöÇΓöÇ Render ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  return (
    <>
      <AdminConfirmDialog {...dialogProps} />
      <AdminToast {...toastProps} />

      <div className={cardStyles.panelBody}>
        {/* Action bar */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
          <button
            type="button"
            className={formStyles.btnPrimary}
            onClick={() => { setShowForm((v) => !v); setFormError(""); }}
          >
            <Plus size={16} />
            {showForm ? "Cancel" : "New Promo Code"}
          </button>
        </div>

        {/* Creation form */}
        {showForm && (
          <div className={cardStyles.panel} style={{ marginBottom: "1.5rem", background: "var(--bg-soft)" }}>
            <div className={`${cardStyles.panelHeader} ${cardStyles.panelHeaderTight}`}>
              <h4 className={`${cardStyles.panelTitle} ${cardStyles.panelTitleAccent}`}>
                <Tag size={16} /> New Promo Code
              </h4>
            </div>
            <div className={cardStyles.panelBody}>
              <div className={formStyles.fieldRow} style={{ marginBottom: "1rem" }}>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Code *</label>
                  <input
                    type="text"
                    className={formStyles.input}
                    placeholder="e.g. SUMMER20"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Type *</label>
                  <SelectBox
                    value={form.discount_type}
                    onChange={(val) =>
                      setForm({ ...form, discount_type: val as "percentage" | "fixed" })
                    }
                    labeledOptions={[
                      { value: "percentage", label: "Percentage (%)" },
                      { value: "fixed", label: "Fixed (AUD)" },
                    ]}
                  />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>
                    Value * {form.discount_type === "percentage" ? "(%)" : "(AUD)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={formStyles.input}
                    placeholder="e.g. 10"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Max Uses</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={formStyles.input}
                    placeholder="Unlimited"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Expires At</label>
                  <CustomDatePicker
                    value={form.expires_at}
                    onChange={(val) => setForm({ ...form, expires_at: val })}
                  />
                </div>
                <div className={formStyles.fieldGroup}>
                  <label className={formStyles.label}>Description</label>
                  <input
                    type="text"
                    className={formStyles.input}
                    placeholder="Optional note"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              {formError && <p className={formStyles.errorText} style={{ marginBottom: "0.75rem" }}>{formError}</p>}

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  className={formStyles.btnPrimary}
                  onClick={handleCreate}
                  disabled={isPending}
                >
                  {isPending ? "CreatingΓÇª" : "Create Code"}
                </button>
                <button
                  type="button"
                  className={formStyles.btnSecondary}
                  onClick={() => { setShowForm(false); setFormError(""); setForm(EMPTY_FORM); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Codes table */}
        {codes.length === 0 ? (
          <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateLoose}`}>
            <div className={cardStyles.emptyStateIcon}><Tag size={28} /></div>
            <p className={cardStyles.emptyStateText}>No promo codes yet.</p>
          </div>
        ) : (
          <div className={tableStyles.tableWrap}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Uses</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span style={{ fontWeight: 700, fontFamily: "var(--font-en-stack, monospace)", letterSpacing: "0.05em" }}>
                        {c.code}
                      </span>
                      {c.description && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-soft)", marginTop: "2px" }}>
                          {c.description}
                        </div>
                      )}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{c.discount_type}</td>
                    <td>
                      {c.discount_type === "percentage"
                        ? `${c.discount_value}%`
                        : `$${c.discount_value}`}
                    </td>
                    <td>
                      {c.used_count}
                      {c.max_uses ? ` / ${c.max_uses}` : " / Γê₧"}
                    </td>
                    <td>
                      {c.expires_at
                        ? new Date(c.expires_at).toLocaleDateString("en-AU")
                        : "ΓÇö"}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: c.active ? "var(--success)" : "var(--text-soft)",
                        }}
                      >
                        {c.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className={tableStyles.cellActions}>
                        <button
                          type="button"
                          onClick={() => handleToggle(c)}
                          className={`${tableStyles.btnAction} ${c.active ? tableStyles.btnReject : tableStyles.btnApprove}`}
                          title={c.active ? "Deactivate" : "Activate"}
                        >
                          {c.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                          {c.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className={`${tableStyles.btnAction} ${tableStyles.btnReject}`}
                          title="Delete promo code"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
