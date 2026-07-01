"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PlusCircle } from "lucide-react";
import { addExpense, deleteExpense } from "@/app/actions/treasury.actions";
import { fmtIRT, fmtAUD } from "@/lib/accounting-engine";
import { FA } from "@/lib/treasury-utils";
import s from "@/styles/admin/Treasury.module.css";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import Tooltip from "@/components/ui/Tooltip/Tooltip";

type Props = { 
  expenses: any[];
  bankAccounts: { id: string; account_name: string; currency: string }[];
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "rent",          label: "اجاره" },
  { value: "marketing",     label: "بازاریابی" },
  { value: "bank_fees",     label: "کارمزد بانکی" },
  { value: "software",      label: "نرم‌افزار" },
  { value: "salary",        label: "حقوق" },
  { value: "tax",           label: "مالیات" },
  { value: "office",        label: "اداری" },
  { value: "miscellaneous", label: "متفرقه" },
];

const CATEGORY_FA: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label]),
);

const EMPTY = {
  date:          "",
  title:         "",
  category:      "miscellaneous",
  currency:      "IRT" as "AUD" | "IRT",
  amount:        "",
  exchange_rate: "",
  payer_account_id: "", 
  status:        "paid" as "paid" | "pending",
  notes:         "",
};

export default function ExpenseForm({ expenses, bankAccounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof typeof EMPTY, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setError(null);
  }

  function resetForm() {
    setForm({ ...EMPTY });
    setShowForm(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.date) { setError("تاریخ الزامی است."); return; }
    if (!form.title.trim()) { setError("عنوان هزینه الزامی است."); return; }
    if (!form.payer_account_id) { setError("انتخاب کشوی پرداخت‌کننده الزامی است."); return; }
    
    const amt = Number(form.amount.replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) { setError("مبلغ نامعتبر است."); return; }
    
    let rate: number | null = null;
    if (form.currency === "AUD") {
      rate = Number(form.exchange_rate.replace(/,/g, ""));
      if (!Number.isFinite(rate) || rate <= 0) { setError("نرخ تبدیل برای ارز AUD نامعتبر است."); return; }
    }

    startTransition(async () => {
      const res = await addExpense({
        date: form.date,
        title: form.title,
        category: form.category,
        currency: form.currency,
        amount: amt,
        exchange_rate: rate,
        payer_account_id: form.payer_account_id,
        status: form.status,
        notes: form.notes,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        resetForm();
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("آیا از حذف این هزینه مطمئن هستید؟")) return;
    startTransition(async () => {
      const res = await deleteExpense(id);
      if ("error" in res) alert(res.error);
    });
  }

  const filteredAccounts = bankAccounts.filter(acc => acc.currency === form.currency);

  return (
    <div className={s.formWrapper}>
      <div className={s.formHeader}>
        <h2 className={s.formTitle}>مدیریت هزینه‌ها</h2>
        {!showForm && (
          <button className={s.btnAddNew} onClick={() => setShowForm(true)} disabled={isPending}>
            <PlusCircle size={16} /> ثبت هزینه جدید
          </button>
        )}
      </div>

      {showForm && (
        <form className={s.formContainer} onSubmit={handleSubmit}>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>تاریخ</label>
              <CustomDatePicker 
                value={form.date} 
                onChange={(newDate) => field("date", newDate)} 
                disabled={isPending} 
              />
            </div>
            <div className={s.formGroup} style={{ flex: "2 1 200px" }}>
              <label className={s.formLabel}>عنوان هزینه</label>
              <input className={s.formInput} type="text" value={form.title} onChange={e => field("title", e.target.value)} placeholder="مثلاً: سرور AWS" disabled={isPending} />
            </div>
          </div>
          
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>دسته‌بندی</label>
              <select className={s.formSelect} value={form.category} onChange={e => field("category", e.target.value)} disabled={isPending}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>ارز پرداختی</label>
              <select className={s.formSelect} value={form.currency} onChange={e => field("currency", e.target.value as "AUD"|"IRT")} disabled={isPending}>
                <option value="IRT">تومان (IRT)</option>
                <option value="AUD">دلار (AUD)</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>مبلغ</label>
              <input className={`${s.formInput} ${s.formInputNum}`} type="text" inputMode="numeric" value={form.amount} onChange={e => field("amount", e.target.value)} placeholder="0" disabled={isPending} />
            </div>
          </div>

          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>
                <Tooltip text="صندوقی که این هزینه دقیقاً از موجودی آن کسر شده است">کشوی پرداخت‌کننده (مبدأ)</Tooltip>
              </label>
              <select className={s.formSelect} value={form.payer_account_id} onChange={e => field("payer_account_id", e.target.value)} disabled={isPending}>
                <option value="">-- انتخاب حساب --</option>
                {filteredAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_name} ({acc.currency})</option>
                ))}
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>
                <Tooltip text="پرداخت شده: از کشو کسر می‌شود. در انتظار: به عنوان بدهی دفتری ثبت می‌شود">وضعیت پرداخت</Tooltip>
              </label>
              <select className={s.formSelect} value={form.status} onChange={e => field("status", e.target.value as "paid"|"pending")} disabled={isPending}>
                <option value="paid">پرداخت شده</option>
                <option value="pending">در انتظار پرداخت (بدهی)</option>
              </select>
            </div>
          </div>

          {form.currency === "AUD" && (
            <div className={s.formRow}>
              <div className={s.formGroup} style={{ flex: "1 1 200px" }}>
                <label className={s.formLabel}>
                  <Tooltip text="نرخ برابری دلار به تومان در روزی که هزینه انجام شده است">نرخ تاریخی (IRT/AUD) — الزامی</Tooltip>
                </label>
                <input className={`${s.formInput} ${s.formInputNum}`} type="text" inputMode="numeric" value={form.exchange_rate} onChange={e => field("exchange_rate", e.target.value)} placeholder="مثلاً 40000" disabled={isPending} />
              </div>
            </div>
          )}

          <div className={s.formRow}>
             <div className={s.formGroup} style={{ flex: "1 1 100%" }}>
                <label className={s.formLabel}>توضیحات</label>
                <input className={s.formInput} type="text" value={form.notes} onChange={e => field("notes", e.target.value)} disabled={isPending} />
             </div>
          </div>

          {error && <p className={s.formError}>{error}</p>}
          <div className={s.formActionsRow}>
            <button className={s.btnSubmit} type="submit" disabled={isPending}>{isPending ? "در حال ذخیره..." : "ثبت هزینه"}</button>
            <button className={s.btnCancel} type="button" onClick={resetForm} disabled={isPending}>انصراف</button>
          </div>
        </form>
      )}

      {expenses.length > 0 && (
        <div className={s.listContainer}>
          <table className={s.listTable}>
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>عنوان</th>
                <th>دسته</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{e.title}</td>
                  <td>{CATEGORY_FA[e.category] || e.category}</td>
                  <td dir="ltr" style={{ textAlign: "right" }}>
                    {e.currency === "IRT" ? fmtIRT(e.amount) + " IRT" : fmtAUD(e.amount) + " AUD"}
                  </td>
                  <td>
                    <span className={e.status === "paid" ? s.badgeSuccess : s.badgeWarning}>
                      {e.status === "paid" ? "پرداخت شده" : "بدهی"}
                    </span>
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <button className={s.btnIconDanger} onClick={() => handleDelete(e.id)} disabled={isPending}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}