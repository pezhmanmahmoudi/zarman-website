"use client";

import React, { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { createPromoCode, deletePromoCode, updatePromoCode } from "@/app/actions/admin.actions";
import type { PromoCode } from "@/app/[locale]/dashboard/dashboard.types";
import formStyles from "@/styles/admin/AdminForms.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";

type PromoCodeManagerProps = {
  initialCodes: PromoCode[];
};

export function PromoCodeManager({ initialCodes }: PromoCodeManagerProps) {
  const [codes, setCodes] = useState<PromoCode[]>(initialCodes);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [description, setDescription] = useState("");

  const resetCreateForm = () => {
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("10");
    setMaxUses("");
    setExpiresAt("");
    setDescription("");
  };

  const onCreate = () => {
    const normalizedCode = code.trim().toUpperCase();
    const parsedDiscount = Number(discountValue);

    if (!normalizedCode) {
      setStatus({ type: "error", text: "Code is required." });
      return;
    }

    if (!Number.isFinite(parsedDiscount) || parsedDiscount <= 0) {
      setStatus({ type: "error", text: "Discount value must be a positive number." });
      return;
    }

    startTransition(async () => {
      const result = await createPromoCode({
        code: normalizedCode,
        discount_type: discountType,
        discount_value: parsedDiscount,
        max_uses: maxUses.trim() ? Number(maxUses) : null,
        expires_at: expiresAt.trim() ? new Date(expiresAt).toISOString() : null,
        description: description.trim() || null,
      });

      if (result.error || !result.data) {
        setStatus({ type: "error", text: result.error ?? "Failed to create promo code." });
        return;
      }

      setCodes((prev) => [result.data as PromoCode, ...prev]);
      setStatus({ type: "success", text: `Promo code ${normalizedCode} created.` });
      resetCreateForm();
    });
  };

  const onToggleActive = (item: PromoCode) => {
    startTransition(async () => {
      const nextActive = !item.active;
      const result = await updatePromoCode(item.id, { active: nextActive });
      if (result.error) {
        setStatus({ type: "error", text: result.error });
        return;
      }

      setCodes((prev) => prev.map((codeItem) => (codeItem.id === item.id ? { ...codeItem, active: nextActive } : codeItem)));
      setStatus({ type: "success", text: `Promo code ${item.code} updated.` });
    });
  };

  const onDelete = (item: PromoCode) => {
    if (!window.confirm(`Delete promo code ${item.code}?`)) {
      return;
    }

    startTransition(async () => {
      const result = await deletePromoCode(item.id);
      if (result.error) {
        setStatus({ type: "error", text: result.error });
        return;
      }

      setCodes((prev) => prev.filter((codeItem) => codeItem.id !== item.id));
      setStatus({ type: "success", text: `Promo code ${item.code} deleted.` });
    });
  };

  return (
    <div className={cardStyles.panel}>
      <div className={cardStyles.panelBody}>
        <div className={formStyles.fieldRow}>
          <div className={formStyles.fieldGroup}>
            <label className={formStyles.label}>Code</label>
            <input
              className={formStyles.input}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
            />
          </div>

          <div className={formStyles.fieldGroup}>
            <label className={formStyles.label}>Type</label>
            <select
              className={formStyles.input}
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed (AUD)</option>
            </select>
          </div>

          <div className={formStyles.fieldGroup}>
            <label className={formStyles.label}>Value</label>
            <input
              type="number"
              className={formStyles.input}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>

          <div className={formStyles.fieldGroup}>
            <label className={formStyles.label}>Max Uses</label>
            <input
              type="number"
              className={formStyles.input}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
        </div>

        <div className={formStyles.fieldRow}>
          <div className={formStyles.fieldGroup}>
            <label className={formStyles.label}>Expires At</label>
            <input
              type="datetime-local"
              className={formStyles.input}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div className={formStyles.fieldGroup}>
            <label className={formStyles.label}>Description</label>
            <input
              className={formStyles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className={formStyles.actionBar} style={{ marginTop: "1rem" }}>
          <div className={formStyles.actionBarMeta}>
            {status?.type === "success" && (
              <span className={`${formStyles.saveStatus} ${formStyles.saveStatusSuccess}`}>
                <CheckCircle2 size={16} /> {status.text}
              </span>
            )}
            {status?.type === "error" && (
              <span className={`${formStyles.saveStatus} ${formStyles.saveStatusError}`}>
                <AlertTriangle size={16} /> {status.text}
              </span>
            )}
          </div>
          <button type="button" className={formStyles.btnPrimary} onClick={onCreate} disabled={isPending}>
            {isPending ? <Loader2 className="lucide-spin" size={16} /> : <Plus size={16} />} Create Promo Code
          </button>
        </div>

        <div style={{ marginTop: "1rem", display: "grid", gap: "0.6rem" }}>
          {codes.length === 0 ? (
            <p className={cardStyles.sectionDesc}>No promo codes yet.</p>
          ) : (
            codes.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid var(--card-border, rgba(255,255,255,0.08))",
                  borderRadius: "12px",
                  padding: "0.75rem 0.9rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{item.code}</div>
                  <div className={cardStyles.sectionDesc}>
                    {item.discount_type === "percentage" ? `${item.discount_value}%` : `$${item.discount_value}`} • Used {item.used_count}
                    {item.max_uses ? ` / ${item.max_uses}` : ""}
                    {item.expires_at ? ` • Expires ${new Date(item.expires_at).toLocaleDateString()}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button
                    type="button"
                    className={item.active ? formStyles.btnSuccess : formStyles.btnSecondary}
                    onClick={() => onToggleActive(item)}
                    disabled={isPending}
                  >
                    {item.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    className={formStyles.btnDanger}
                    onClick={() => onDelete(item)}
                    disabled={isPending}
                    aria-label={`Delete ${item.code}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
