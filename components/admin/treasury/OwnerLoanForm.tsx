"use client";

import { useState, useTransition } from "react";
import { Trash2, PlusCircle } from "lucide-react";
import { addOwnerLoan, deleteOwnerLoan } from "@/app/actions/treasury.actions";
import { fmtIRT, fmtAUD } from "@/lib/accounting-engine";
import s from "@/styles/admin/Treasury.module.css";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import Tooltip from "@/components/ui/Tooltip/Tooltip";

type OwnerLoanRow = {
  id: string;
  date: string;
  currency: "AUD" | "IRT";
  amount: number;
  loan_type: "injection" | "repayment";
};

type Props = { 
  loans: OwnerLoanRow[];
  bankAccounts: { id: string; account_name: string; currency: string }[];
};

const EMPTY = {
  date: "",
  currency: "IRT" as "AUD" | "IRT",
  amount: "",
  exchange_rate: "",
  account_id: "", 
  loan_type: "injection" as "injection" | "repayment",
  repayment_status: "open" as "open" | "partially_repaid" | "repaid",
  notes: "",
};

export default function OwnerLoanForm({ loans, bankAccounts }: Props) {
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
    if (!form.account_id) { setError("انتخاب کشو/حساب الزامی است."); return; }

    const amt = Number(form.amount.replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) { setError("مبلغ نامعتبر است."); return; }

    let rate: number | null = null;
    if (form.currency === "AUD") {
      rate = Number(form.exchange_rate.replace(/,/g, ""));
      if (!Number.isFinite(rate) || rate <= 0) { setError("نرخ تبدیل برای ارز AUD نامعتبر است."); return; }
    }

    startTransition(async () => {
      const res = await addOwnerLoan({
        date: form.date,
        currency: form.currency,
        amount: amt,
        exchange_rate: rate,
        account_id: form.account_id,
        loan_type: form.loan_type,
        repayment_status: form.repayment_status,
        notes: form.notes,
      });
      if ("error" in res) setError(res.error);
      else resetForm();
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("آیا از حذف این ردیف مطمئن هستید؟")) return;
    startTransition(async () => {
      const res = await deleteOwnerLoan(id);
      if ("error" in res) alert(res.error);
    });
  }

  const filteredAccounts = bankAccounts.filter(acc => acc.currency === form.currency);

  return (
    <div className={s.formWrapper}>
      <div className={s.formHeader}>
        <h2 className={s.formTitle}>سرمایه در گردش (Owner Loans)</h2>
        {!showForm && (
          <button className={s.btnAddNew} onClick={() => setShowForm(true)} disabled={isPending}>
            <PlusCircle size={16} /> ثبت تراکنش مالک
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
            <div className={s.formGroup}>
              <label className={s.formLabel}>ارز</label>
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
                <Tooltip text="صندوقی که موجودی آن تحت تاثیر این تراکنش قرار می‌گیرد">کشوی واریز/برداشت</Tooltip>
              </label>
              <select className={s.formSelect} value={form.account_id} onChange={e => field("account_id", e.target.value)} disabled={isPending}>
                <option value="">-- انتخاب حساب --</option>
                {filteredAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_name} ({acc.currency})</option>
                ))}
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>
                <Tooltip text="تزریق: ورود پول از بیرون به صرافی. برداشت: خروج پول به نفع مالک">نوع عملیات</Tooltip>
              </label>
              <select className={s.formSelect} value={form.loan_type} onChange={e => field("loan_type", e.target.value)} disabled={isPending}>
                <option value="injection">تزریق سرمایه (ورود)</option>
                <option value="repayment">برداشت شخصی (خروج)</option>
              </select>
            </div>
          </div>

          {form.currency === "AUD" && (
            <div className={s.formRow}>
              <div className={s.formGroup} style={{ flex: "1 1 200px" }}>
                <label className={s.formLabel}>
                  <Tooltip text="مبنای ارزش‌گذاری دلاری/ریالی این تراکنش در سیستم حسابداری دوبل">نرخ تبدیل تاریخی (الزامی)</Tooltip>
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
            <button className={s.btnSubmit} type="submit" disabled={isPending}>{isPending ? "در حال ذخیره..." : "ثبت تراکنش"}</button>
            <button className={s.btnCancel} type="button" onClick={resetForm} disabled={isPending}>انصراف</button>
          </div>
        </form>
      )}

      {loans.length > 0 && (
        <div className={s.listContainer}>
          <table className={s.listTable}>
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>عملیات</th>
                <th>مبلغ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loans.map(L => (
                <tr key={L.id}>
                  <td>{L.date}</td>
                  <td>
                    <span className={L.loan_type === "injection" ? s.badgeSuccess : s.badgeWarning}>
                      {L.loan_type === "injection" ? "تزریق" : "برداشت"}
                    </span>
                  </td>
                  <td dir="ltr" style={{ textAlign: "right" }}>
                    {L.currency === "IRT" ? fmtIRT(L.amount) + " IRT" : fmtAUD(L.amount) + " AUD"}
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <button className={s.btnIconDanger} onClick={() => handleDelete(L.id)} disabled={isPending}>
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