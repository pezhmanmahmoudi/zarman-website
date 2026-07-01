"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Building2, UserCircle, RefreshCw } from "lucide-react";
import { addBankAccount } from "@/app/actions/treasury.actions";
import { FA } from "@/lib/treasury-utils";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import s from "@/styles/admin/Treasury.module.css";

type Props = {
  bankAccounts: any[];
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
      const res = await addBankAccount(form);
      if ("error" in res) {
        setError(res.error);
      } else {
        setForm({ ...EMPTY });
        setShowForm(false);
      }
    });
  }

  function resetForm() {
    setForm({ ...EMPTY });
    setShowForm(false);
    setError(null);
  }

  return (
    <div className={s.formWrapper}>
      <div className={s.formHeader}>
        <h2 className={s.formTitle}>مدیریت شبکه‌ حساب‌ها و کشوها</h2>
        {!showForm && (
          <button className={s.btnAddNew} onClick={() => setShowForm(true)} disabled={isPending}>
            <PlusCircle size={16} /> ایجاد کشوی جدید
          </button>
        )}
      </div>

      {showForm && (
        <form className={s.formContainer} onSubmit={handleSubmit}>
          <div className={s.formRow}>
            <div className={s.formGroup} style={{ flex: "2 1 200px" }}>
              <label className={s.formLabel}>نام حساب یا کشو</label>
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
              <select
                className={s.formSelect}
                value={form.currency}
                onChange={e => handleCurrencyChange(e.target.value as "AUD" | "IRT")}
                disabled={isPending}
              >
                <option value="IRT">تومان (IRT)</option>
                <option value="AUD">دلار (AUD)</option>
              </select>
            </div>
          </div>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>
                <Tooltip text="بانک: حساب فیزیکی | مجازی: حساب دفتری مشتری | در راه: وجوه تسویه‌نشده">نوع کشو (Account Type)</Tooltip>
              </label>
              <select
                className={s.formSelect}
                value={form.account_type}
                onChange={e => field("account_type", e.target.value)}
                disabled={isPending}
              >
                <option value="bank">حساب بانکی واقعی (نقدینگی فیزیکی)</option>
                <option value="virtual">حساب مجازی/تعهدی (پایاپای مشتریان)</option>
                <option value="transit">وجوه در راه (ساتنا / انتقال بین‌بانکی جاری)</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>کشور مستقر</label>
              <select
                className={s.formSelect}
                value={form.country}
                onChange={e => field("country", e.target.value)}
                disabled={isPending}
              >
                <option value="Iran">ایران</option>
                <option value="Australia">استرالیا</option>
              </select>
            </div>
          </div>

          {error && <p className={s.formError}>{error}</p>}
          <div className={s.formActionsRow}>
            <button className={s.btnSubmit} type="submit" disabled={isPending}>
              {isPending ? "در حال ایجاد..." : "ایجاد کشو"}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}