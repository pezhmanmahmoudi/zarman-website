"use client";

import { useState, useTransition } from "react";
import { Trash2, PlusCircle, Pencil, ChevronDown } from "lucide-react";
import { addOwnerLoan, deleteOwnerLoan, updateOwnerLoan } from "@/app/actions/treasury.actions";
import { fmtIRT, fmtAUD } from "@/lib/accounting-engine";
import s from "@/styles/admin/Treasury.module.css";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import Tooltip from "@/components/ui/Tooltip/Tooltip";

type OwnerLoanRow = {
  id: string;
  date: string;
  currency: "AUD" | "IRT";
  amount: number;
  exchange_rate?: number | null;
  account_id?: string | null;
  loan_type: "injection" | "repayment";
  repayment_status?: "open" | "partially_repaid" | "repaid";
  notes?: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof typeof EMPTY, value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "currency" && next.account_id) {
        const selected = bankAccounts.find((acc) => acc.id === next.account_id);
        if (!selected || selected.currency !== value) {
          next.account_id = "";
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

  function startEdit(row: OwnerLoanRow) {
    setForm({
      date: row.date || "",
      currency: row.currency || "IRT",
      amount: row.amount != null ? String(row.amount) : "",
      exchange_rate: row.exchange_rate != null ? String(row.exchange_rate) : "",
      account_id: row.account_id || "",
      loan_type: row.loan_type || "injection",
      repayment_status: row.repayment_status || "open",
      notes: row.notes || "",
    });
    setEditingId(row.id);
    setShowForm(true);
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
      const payload = {
        date: form.date,
        currency: form.currency,
        amount: amt,
        exchange_rate: rate,
        account_id: form.account_id,
        loan_type: form.loan_type,
        repayment_status: form.repayment_status,
        notes: form.notes,
      };

      const res = editingId
        ? await updateOwnerLoan({ id: editingId, ...payload })
        : await addOwnerLoan(payload);

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
  const isEditMode = Boolean(editingId);

  return (
    <details className={s.formDetails}>
      <summary className={s.formSummary}>
        <ChevronDown size={16} className={s.formSummaryChevron} />
        <span className={s.formSummaryTitle}>بدهی/تسویه با مالک (Owner Loan Liability)</span>
        <span className={s.formSummaryHint}>ثبت تزریق مالک و بازپرداخت‌ها برای نمایش دقیق بدهی قابل‌پرداخت به مالک.</span>
      </summary>

      <div className={s.formWrapper}>
        <div className={s.formHeader}>
          {!showForm && (
            <button className={s.btnAddNew} onClick={() => setShowForm(true)} disabled={isPending}>
              <PlusCircle size={16} /> ثبت بدهی/تسویه مالک
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
              <SelectBox
                dir="rtl"
                value={form.currency}
                onChange={(val) => field("currency", val as "AUD" | "IRT")}
                labeledOptions={[
                  { value: "IRT", label: "تومان (IRT)" },
                  { value: "AUD", label: "دلار (AUD)" },
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
                <Tooltip text="حسابی که مانده آن تحت تاثیر این رویداد بدهی/تسویه قرار می‌گیرد">حساب درگیر</Tooltip>
              </label>
              <SelectBox
                dir="rtl"
                value={form.account_id}
                onChange={(val) => field("account_id", val)}
                placeholder="-- انتخاب حساب --"
                labeledOptions={filteredAccounts.map(acc => ({ value: acc.id, label: `${acc.account_name} (${acc.currency})` }))}
                disabled={isPending}
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>
                <Tooltip text="تزریق مالک: بدهی کسب‌وکار به مالک را بیشتر می‌کند. بازپرداخت: بدهی به مالک را کمتر می‌کند.">نوع عملیات</Tooltip>
              </label>
              <SelectBox
                dir="rtl"
                value={form.loan_type}
                onChange={(val) => field("loan_type", val)}
                labeledOptions={[
                  { value: "injection", label: "تزریق مالک (افزایش بدهی)" },
                  { value: "repayment", label: "بازپرداخت به مالک (کاهش بدهی)" },
                ]}
                disabled={isPending}
              />
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
            <button className={s.btnSubmit} type="submit" disabled={isPending}>
              {isPending ? "در حال ذخیره..." : isEditMode ? "ذخیره تغییرات" : "ثبت تراکنش"}
            </button>
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
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loans.map(L => (
                <tr key={L.id}>
                  <td>{L.date}</td>
                  <td>
                    <span className={L.loan_type === "injection" ? s.badgeSuccess : s.badgeWarning}>
                      {L.loan_type === "injection" ? "تزریق مالک" : "بازپرداخت"}
                    </span>
                  </td>
                  <td dir="ltr" style={{ textAlign: "right" }}>
                    {L.currency === "IRT" ? fmtIRT(L.amount) + " IRT" : fmtAUD(L.amount) + " AUD"}
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <button
                      className={s.btnIconEdit}
                      onClick={() => startEdit(L)}
                      disabled={isPending}
                      type="button"
                      title="ویرایش"
                      aria-label="ویرایش تراکنش مالک"
                    >
                      <Pencil size={15} />
                    </button>
                    <button className={s.btnIconDanger} onClick={() => handleDelete(L.id)} disabled={isPending} type="button">
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