"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, PlusCircle } from "lucide-react";
import { addOwnerLoan, deleteOwnerLoan, type OwnerLoanRow } from "@/app/actions/treasury.actions";
import { fmtIRT, fmtAUD } from "@/lib/accounting-engine";
import s from "@/styles/admin/Treasury.module.css";

type Props = { loans: OwnerLoanRow[] };

const EMPTY = {
  date: "",
  currency: "IRT" as "AUD" | "IRT",
  amount: "",
  exchange_rate: "",
  account: "kadoos" as "zarman" | "kadoos" | "pezhman",
  loan_type: "injection" as "injection" | "repayment",
  repayment_status: "open" as "open" | "partially_repaid" | "repaid",
  notes: "",
};

export default function OwnerLoanForm({ loans }: Props) {
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
    if (!form.date)               { setError("تاریخ الزامی است."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setError("مبلغ نامعتبر است."); return; }

    const exchangeRate = form.currency === "AUD" ? Number(form.exchange_rate.replace(/,/g, "")) : undefined;
    if (form.currency === "AUD" && (!Number.isFinite(exchangeRate) || (exchangeRate ?? 0) <= 0)) {
      setError("برای وام AUD وارد کردن نرخ تاریخی الزامی است."); return;
    }

    startTransition(async () => {
      const res = await addOwnerLoan({
        date:             form.date,
        currency:         form.currency,
        amount,
        exchange_rate:    form.currency === "AUD" ? exchangeRate : undefined,
        account:          form.account,
        loan_type:        form.loan_type,
        repayment_status: form.repayment_status,
        notes:            form.notes || undefined,
      });
      if ("error" in res) { setError(res.error); }
      else { resetForm(); router.refresh(); }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("آیا از حذف این رکورد مطمئن هستید؟")) return;
    startTransition(async () => {
      const res = await deleteOwnerLoan(id);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  const LOAN_ACCOUNT_FA: Record<string, string> = { zarman: "زارمن (AUD)", kadoos: "کادوس (IRT)", pezhman: "پژمان (IRT)" };
  const STATUS_FA: Record<string, string> = { open: "باز", partially_repaid: "جزئی", repaid: "تسویه" };

  return (
    <div>
      {/* ─── Table ──────────────────────────────────────────────────────── */}
      {loans.length > 0 ? (
        <table className={s.inlineTable}>
          <thead>
            <tr>
              <th>تاریخ</th>
              <th>نوع</th>
              <th>مبلغ</th>
              <th>حساب</th>
              <th>وضعیت</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loans.map(loan => (
              <tr key={loan.id}>
                <td style={{ direction: "ltr", textAlign: "left", fontFamily: "monospace", fontSize: "0.775rem" }}>{loan.date}</td>
                <td>
                  <span className={`${s.typeBadge} ${loan.loan_type === "injection" ? s.typeInjection : s.typeRepayment}`}>
                    {loan.loan_type === "injection" ? "تزریق" : "بازپرداخت"}
                  </span>
                </td>
                <td style={{ fontFamily: "var(--font-en-stack, 'Inter', sans-serif)", fontSize: "0.8125rem" }}>
                  {loan.currency === "AUD" ? fmtAUD(loan.amount) : fmtIRT(loan.amount)}
                </td>
                <td>{LOAN_ACCOUNT_FA[loan.account] ?? loan.account}</td>
                <td style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>{STATUS_FA[loan.repayment_status] ?? loan.repayment_status}</td>
                <td>
                  <button
                    className={s.btnDelete}
                    onClick={() => handleDelete(loan.id)}
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
        <p className={s.emptyRows}>هنوز وامی ثبت نشده است.</p>
      )}

      {/* ─── Add button / form ───────────────────────────────────────────── */}
      {!showForm ? (
        <div style={{ marginTop: "0.875rem" }}>
          <button className={s.btnAddRow} onClick={() => setShowForm(true)} disabled={isPending}>
            <PlusCircle size={14} />
            <span>افزودن وام مالک</span>
          </button>
        </div>
      ) : (
        <form className={s.compactForm} onSubmit={handleAdd} style={{ marginTop: "0.875rem" }}>
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>تاریخ</label>
              <input className={s.formInput} type="date" value={form.date} onChange={e => field("date", e.target.value)} disabled={isPending} />
            </div>
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
            <div className={s.formGroup}>
              <label className={s.formLabel}>حساب</label>
              <select className={s.formSelect} value={form.account} onChange={e => field("account", e.target.value)} disabled={isPending}>
                <option value="kadoos">کادوس (IRT)</option>
                <option value="pezhman">پژمان (IRT)</option>
                <option value="zarman">زارمن (AUD)</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>نوع</label>
              <select className={s.formSelect} value={form.loan_type} onChange={e => field("loan_type", e.target.value)} disabled={isPending}>
                <option value="injection">تزریق سرمایه</option>
                <option value="repayment">بازپرداخت</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>وضعیت بازپرداخت</label>
              <select className={s.formSelect} value={form.repayment_status} onChange={e => field("repayment_status", e.target.value)} disabled={isPending}>
                <option value="open">باز</option>
                <option value="partially_repaid">جزئاً تسویه‌شده</option>
                <option value="repaid">تسویه‌شده</option>
              </select>
            </div>
          </div>
          <div className={s.formRow}>
            <div className={s.formGroup} style={{ flex: "1 1 100%" }}>
              <label className={s.formLabel}>توضیحات (اختیاری)</label>
              <input className={s.formInput} type="text" value={form.notes} onChange={e => field("notes", e.target.value)} disabled={isPending} />
            </div>
          </div>
          {error && <p className={s.formError}>{error}</p>}
          <div className={s.formActionsRow}>
            <button className={s.btnSubmit} type="submit" disabled={isPending}>
              {isPending ? "در حال ذخیره..." : "ثبت وام"}
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
