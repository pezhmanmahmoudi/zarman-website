"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PlusCircle } from "lucide-react";
import { addExpense, deleteExpense, type ExpenseRow } from "@/app/actions/treasury.actions";
import { fmtIRT, fmtAUD } from "@/lib/accounting-engine";
import s from "@/styles/admin/Treasury.module.css";

type Props = { expenses: ExpenseRow[] };

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
  payer_account: "kadoos" as "zarman" | "kadoos" | "pezhman",
  status:        "paid" as "paid" | "pending",
  notes:         "",
};

export default function ExpenseForm({ expenses }: Props) {
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
    setError(null);
    setShowForm(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = Number(form.amount.replace(/,/g, ""));
    if (!form.date)                                          { setError("تاریخ الزامی است."); return; }
    if (!form.title.trim())                                  { setError("عنوان الزامی است."); return; }
    if (!Number.isFinite(amount) || amount <= 0)             { setError("مبلغ نامعتبر است."); return; }

    const exchangeRate = form.currency === "AUD" ? Number(form.exchange_rate.replace(/,/g, "")) : undefined;
    if (form.currency === "AUD" && (!Number.isFinite(exchangeRate) || (exchangeRate ?? 0) <= 0)) {
      setError("برای هزینه AUD وارد کردن نرخ تاریخی الزامی است."); return;
    }

    startTransition(async () => {
      const res = await addExpense({
        date:          form.date,
        title:         form.title.trim(),
        category:      form.category,
        currency:      form.currency,
        amount,
        exchange_rate: form.currency === "AUD" ? exchangeRate : undefined,
        payer_account: form.payer_account,
        status:        form.status,
        notes:         form.notes || undefined,
      });
      if ("error" in res) { setError(res.error); }
      else { resetForm(); router.refresh(); }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("آیا از حذف این هزینه مطمئن هستید؟")) return;
    startTransition(async () => {
      const res = await deleteExpense(id);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div>
      {/* ─── Table ──────────────────────────────────────────────────────── */}
      {expenses.length > 0 ? (
        <table className={s.inlineTable}>
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
            {expenses.map(exp => (
              <tr key={exp.id}>
                <td style={{ direction: "ltr", textAlign: "left", fontFamily: "monospace", fontSize: "0.775rem" }}>{exp.date}</td>
                <td style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.title}</td>
                <td style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>{CATEGORY_FA[exp.category] ?? exp.category}</td>
                <td style={{ fontFamily: "var(--font-en-stack, 'Inter', sans-serif)", fontSize: "0.8125rem" }}>
                  {exp.currency === "AUD" ? fmtAUD(exp.amount) : fmtIRT(exp.amount)}
                </td>
                <td>
                  <span className={`${s.typeBadge} ${exp.status === "paid" ? s.typePaid : s.typePending}`}>
                    {exp.status === "paid" ? "پرداخت‌شده" : "معلق"}
                  </span>
                </td>
                <td>
                  <button
                    className={s.btnDelete}
                    onClick={() => handleDelete(exp.id)}
                    disabled={isPending}
                    title="حذف"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={s.emptyRows}>هنوز هزینه‌ای ثبت نشده است.</p>
      )}

      {/* ─── Add button / form ───────────────────────────────────────────── */}
      {!showForm ? (
        <div style={{ marginTop: "0.875rem" }}>
          <button className={s.btnAddRow} onClick={() => setShowForm(true)} disabled={isPending}>
            <PlusCircle size={14} />
            <span>افزودن هزینه</span>
          </button>
        </div>
      ) : (
        <form className={s.compactForm} onSubmit={handleAdd} style={{ marginTop: "0.875rem" }}>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>تاریخ</label>
              <input className={s.formInput} type="date" value={form.date} onChange={e => field("date", e.target.value)} disabled={isPending} />
            </div>
            <div className={s.formGroup} style={{ flex: "2 1 200px" }}>
              <label className={s.formLabel}>عنوان</label>
              <input className={s.formInput} type="text" value={form.title} onChange={e => field("title", e.target.value)} placeholder="شرح هزینه" disabled={isPending} />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>دسته‌بندی</label>
              <select className={s.formSelect} value={form.category} onChange={e => field("category", e.target.value)} disabled={isPending}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>ارز</label>
              <select className={s.formSelect} value={form.currency} onChange={e => field("currency", e.target.value)} disabled={isPending}>
                <option value="IRT">تومان (IRT)</option>
                <option value="AUD">دلار استرالیا (AUD)</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>مبلغ</label>
              <input className={`${s.formInput} ${s.formInputNum}`} type="text" inputMode="numeric" value={form.amount}
                onChange={e => field("amount", e.target.value)} placeholder="0" disabled={isPending} />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>حساب پرداخت‌کننده</label>
              <select className={s.formSelect} value={form.payer_account} onChange={e => field("payer_account", e.target.value)} disabled={isPending}>
                <option value="zarman">زارمن (AUD)</option>
                <option value="kadoos">کادوس (IRT)</option>
                <option value="pezhman">پژمان (IRT)</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>وضعیت</label>
              <select className={s.formSelect} value={form.status} onChange={e => field("status", e.target.value)} disabled={isPending}>
                <option value="paid">پرداخت‌شده</option>
                <option value="pending">معلق</option>
              </select>
            </div>
          </div>
          {form.currency === "AUD" && (
            <div className={s.formRow}>
              <div className={s.formGroup} style={{ flex: "1 1 200px" }}>
                <label className={s.formLabel}>نرخ تاریخی (IRT/AUD) — الزامی برای AUD</label>
                <input
                  className={`${s.formInput} ${s.formInputNum}`}
                  type="text"
                  inputMode="numeric"
                  value={form.exchange_rate}
                  onChange={e => field("exchange_rate", e.target.value)}
                  placeholder="مثلاً 52000"
                  disabled={isPending}
                />
              </div>
            </div>
          )}
          <div className={s.formRow}>
            <div className={s.formGroup} style={{ flex: "1 1 100%" }}>
              <label className={s.formLabel}>توضیحات (اختیاری)</label>
              <input className={s.formInput} type="text" value={form.notes} onChange={e => field("notes", e.target.value)} disabled={isPending} />
            </div>
          </div>
          {error && <p className={s.formError}>{error}</p>}
          <div className={s.formActionsRow}>
            <button className={s.btnSubmit} type="submit" disabled={isPending}>
              {isPending ? "در حال ذخیره..." : "ثبت هزینه"}
            </button>
            <button className={s.btnCancel} type="button" onClick={resetForm} disabled={isPending}>
              انصراف
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
