"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Building2, UserCircle, RefreshCw, Pencil, ChevronDown } from "lucide-react";
import { addBankAccount, updateBankAccount } from "@/app/actions/treasury.actions";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import s from "@/styles/admin/Treasury.module.css";

type BankAccount = {
  id: string;
  account_name: string;
  currency: "AUD" | "IRT";
  account_type: "bank" | "virtual" | "transit";
  country: "Iran" | "Australia";
  is_active: boolean;
};

type Props = {
  bankAccounts: BankAccount[];
};

const EMPTY = {
  account_name: "",
  currency: "IRT" as "AUD" | "IRT",
  account_type: "bank" as "bank" | "virtual" | "transit",
  country: "Iran" as "Iran" | "Australia",
};

export default function BankAccountManager({ bankAccounts }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof typeof EMPTY, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setError(null);
  }

  function handleCurrencyChange(cur: "AUD" | "IRT") {
    setForm(f => ({
      ...f,
      currency: cur,
      country: cur === "AUD" ? "Australia" : "Iran",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = editingId
        ? await updateBankAccount({ id: editingId, ...form })
        : await addBankAccount(form);

      if ("error" in res) {
        setError(res.error);
      } else {
        setForm({ ...EMPTY });
        setEditingId(null);
        setShowForm(false);
      }
    });
  }

  function resetForm() {
    setForm({ ...EMPTY });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(acc: BankAccount) {
    setForm({
      account_name: acc.account_name || "",
      currency: acc.currency || "IRT",
      account_type: acc.account_type || "bank",
      country: acc.country || (acc.currency === "AUD" ? "Australia" : "Iran"),
    });
    setEditingId(acc.id);
    setShowForm(true);
    setError(null);
  }

  const isEditMode = Boolean(editingId);

  return (
    <details className={s.formDetails} open>
      <summary className={s.formSummary}>
        <ChevronDown size={16} className={s.formSummaryChevron} />
        <span className={s.formSummaryTitle}>مدیریت حساب‌های بانکی</span>
        <span className={s.formSummaryHint}>ایجاد، ویرایش و مدیریت حساب‌های بانکی و کیف‌پول‌های مورد استفاده در خزانه‌داری.</span>
      </summary>

      <div className={s.formWrapper}>
        <div className={s.formHeader}>
          {!showForm && (
            <button className={s.btnAddNew} onClick={() => setShowForm(true)} disabled={isPending}>
              <PlusCircle size={16} /> ایجاد حساب جدید
            </button>
          )}
        </div>

      {showForm && (
        <form className={s.formContainer} onSubmit={handleSubmit}>
          <div className={s.formRow}>
            <div className={s.formGroup} style={{ flex: "2 1 200px" }}>
              <label className={s.formLabel}>نام حساب</label>
              <input
                className={s.formInput}
                type="text"
                value={form.account_name}
                onChange={e => field("account_name", e.target.value)}
                placeholder="مثلاً: بانک ملت کادوس / حساب مجازی محمدی"
                disabled={isPending}
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>ارز اصلی</label>
              <SelectBox
                dir="rtl"
                value={form.currency}
                onChange={(val) => handleCurrencyChange(val as "AUD" | "IRT")}
                labeledOptions={[
                  { value: "IRT", label: "تومان (IRT)" },
                  { value: "AUD", label: "دلار (AUD)" },
                ]}
                disabled={isPending}
              />
            </div>
          </div>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>
                <Tooltip text="بانک: حساب فیزیکی | مجازی: حساب دفتری مشتری | در راه: وجوه تسویه‌نشده">نوع حساب (Account Type)</Tooltip>
              </label>
              <SelectBox
                dir="rtl"
                value={form.account_type}
                onChange={(val) => field("account_type", val)}
                labeledOptions={[
                  { value: "bank", label: "حساب بانکی واقعی (نقدینگی فیزیکی)" },
                  { value: "virtual", label: "حساب مجازی/تعهدی (پایاپای مشتریان)" },
                  { value: "transit", label: "وجوه در راه (ساتنا / انتقال بین‌بانکی جاری)" },
                ]}
                disabled={isPending}
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>کشور مستقر</label>
              <SelectBox
                dir="rtl"
                value={form.country}
                onChange={(val) => field("country", val)}
                labeledOptions={[
                  { value: "Iran", label: "ایران" },
                  { value: "Australia", label: "استرالیا" },
                ]}
                disabled={isPending}
              />
            </div>
          </div>

          {error && <p className={s.formError}>{error}</p>}
          <div className={s.formActionsRow}>
            <button className={s.btnSubmit} type="submit" disabled={isPending}>
              {isPending ? "در حال ذخیره..." : isEditMode ? "ذخیره تغییرات" : "ایجاد کشو"}
            </button>
            <button className={s.btnCancel} type="button" onClick={resetForm} disabled={isPending}>
              انصراف
            </button>
          </div>
        </form>
      )}

      {bankAccounts.length > 0 && (
        <div className={s.listContainer}>
          <table className={s.listTable}>
            <thead>
              <tr>
                <th>نام حساب</th>
                <th>نوع</th>
                <th>ارز</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {bankAccounts.map(acc => (
                <tr key={acc.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {acc.account_type === "bank" ? <Building2 size={16} color="var(--accent)" /> : 
                       acc.account_type === "virtual" ? <UserCircle size={16} color="var(--text-dim)" /> : 
                       <RefreshCw size={16} color="#eab308" />}
                      {acc.account_name}
                    </div>
                  </td>
                  <td>
                    {acc.account_type === "bank" ? "بانکی" : acc.account_type === "virtual" ? "مجازی (تعهدی)" : "وجوه در راه"}
                  </td>
                  <td>
                    <span className={acc.currency === "AUD" ? s.badgeSuccess : s.badgeWarning}>
                      {acc.currency}
                    </span>
                  </td>
                  <td>{acc.is_active ? "فعال" : "غیرفعال"}</td>
                  <td style={{ textAlign: "left" }}>
                    <button
                      className={s.btnIconEdit}
                      onClick={() => startEdit(acc)}
                      disabled={isPending}
                      type="button"
                      title="ویرایش"
                      aria-label="ویرایش حساب"
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </details>
  );
}