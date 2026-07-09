"use client";

import { useState, useTransition } from "react";
import { Trash2, PlusCircle, Pencil, ChevronDown } from "lucide-react";
import { addExpense, deleteExpense, updateExpense } from "@/app/actions/treasury.actions";
import { fmtIRT, fmtAUD } from "@/lib/accounting-engine";
import s from "@/styles/admin/Treasury.module.css";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import Tooltip from "@/components/ui/Tooltip/Tooltip";

type ExpenseRow = {
  id: string;
  date: string;
  title: string;
  category: string;
  currency: "AUD" | "IRT";
  amount: number;
  exchange_rate?: number | null;
  payer_account_id?: string | null;
  status: "paid" | "pending";
  notes?: string | null;
};

type Props = { 
  expenses: ExpenseRow[];
  bankAccounts: { id: string; account_name: string; currency: string }[];
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "it_infrastructure", label: "زیرساخت و IT" },
  { value: "office",        label: "اداری" },
  { value: "rent",          label: "اجاره" },
  { value: "software",      label: "نرم‌افزار" },
  { value: "bank_fees",     label: "کارمزد بانکی" },
  { value: "marketing",     label: "بازاریابی" },
  { value: "salary",        label: "حقوق" },
  { value: "tax",           label: "مالیات" },
  { value: "miscellaneous", label: "متفرقه" },
  
];

const CATEGORY_FA: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label]),
);

const EMPTY = {
  date:          "",
  title:         "",
  category: CATEGORIES[0].value,
  currency: "AUD" as "AUD" | "IRT",
  amount:        "",
  exchange_rate: "",
  payer_account_id: "", 
  status:        "paid" as "paid" | "pending",
  notes:         "",
};

export default function ExpenseForm({ expenses, bankAccounts }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof typeof EMPTY, value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "currency" && next.payer_account_id) {
        const selected = bankAccounts.find((acc) => acc.id === next.payer_account_id);
        if (!selected || selected.currency !== value) {
          next.payer_account_id = "";
        }
      }
      return next;
    });
    setError(null);
  }

  function resetForm() {
    setForm({ ...EMPTY });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  function startEdit(expense: ExpenseRow) {
    setForm({
      date: expense.date || "",
      title: expense.title || "",
      category: expense.category || CATEGORIES[0].value,
      currency: expense.currency || "AUD",
      amount: expense.amount != null ? String(expense.amount) : "",
      exchange_rate: expense.exchange_rate != null ? String(expense.exchange_rate) : "",
      payer_account_id: expense.payer_account_id || "",
      status: expense.status || "paid",
      notes: expense.notes || "",
    });
    setEditingId(expense.id);
    setShowForm(true);
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
      const payload = {
        date: form.date,
        title: form.title,
        category: form.category,
        currency: form.currency,
        amount: amt,
        exchange_rate: rate,
        payer_account_id: form.payer_account_id,
        status: form.status,
        notes: form.notes,
      };

      const res = editingId
        ? await updateExpense({ id: editingId, ...payload })
        : await addExpense(payload);

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

  const filteredAccounts = bankAccounts.filter((acc) => acc.currency === form.currency);
  const isEditMode = Boolean(editingId);

  return (
    <details className={s.formDetails} open>
      <summary className={s.formSummary}>
        <ChevronDown size={16} className={s.formSummaryChevron} />
        <span className={s.formSummaryTitle}>هزینه‌های عملیاتی</span>
        <span className={s.formSummaryHint}>ثبت، دسته‌بندی و مدیریت هزینه‌های روزانه کسب‌وکار و تعیین حساب پرداخت‌کننده.</span>
      </summary>

      <div className={s.formWrapper}>
        <div className={s.formHeader}>
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
              <SelectBox
                dir="rtl"
                value={form.category}
                onChange={(val) => field("category", val)}
                labeledOptions={CATEGORIES}
                disabled={isPending}
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>ارز پرداختی</label>
              <SelectBox
                dir="rtl"
                value={form.currency}
                onChange={(val) => field("currency", val as "AUD" | "IRT")}
                labeledOptions={[
                  { value: "AUD", label: "دلار (AUD)" },
                  { value: "IRT", label: "تومان (IRT)" },
                ]}
                disabled={isPending}
              />
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
              <SelectBox
                dir="rtl"
                value={form.payer_account_id}
                onChange={(val) => field("payer_account_id", val)}
                placeholder="-- انتخاب حساب --"
                labeledOptions={filteredAccounts.map(acc => ({ value: acc.id, label: `${acc.account_name} (${acc.currency})` }))}
                disabled={isPending}
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>
                <Tooltip text="پرداخت شده: از کشو کسر می‌شود. در انتظار: به عنوان بدهی دفتری ثبت می‌شود">وضعیت پرداخت</Tooltip>
              </label>
              <SelectBox
                dir="rtl"
                value={form.status}
                onChange={(val) => field("status", val as "paid" | "pending")}
                labeledOptions={[
                  { value: "paid", label: "پرداخت شده" },
                  { value: "pending", label: "در انتظار پرداخت (بدهی)" },
                ]}
                disabled={isPending}
              />
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
            <button className={s.btnSubmit} type="submit" disabled={isPending}>
              {isPending ? "در حال ذخیره..." : isEditMode ? "ذخیره تغییرات" : "ثبت هزینه"}
            </button>
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
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
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
                    <button
                      className={s.btnIconEdit}
                      onClick={() => startEdit(e)}
                      disabled={isPending}
                      type="button"
                      title="ویرایش"
                      aria-label="ویرایش هزینه"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className={s.btnIconDanger}
                      onClick={() => handleDelete(e.id)}
                      disabled={isPending}
                      type="button"
                      title="حذف"
                      aria-label="حذف هزینه"
                    >
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
    </details>
  );
}