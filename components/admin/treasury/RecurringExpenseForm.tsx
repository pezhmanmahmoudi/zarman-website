"use client";

import { useState, useTransition } from "react";
import { Trash2, PlusCircle, Play, Pause, CheckCircle2 } from "lucide-react";
import {
  addRecurringExpense,
  deleteRecurringExpense,
  toggleRecurringExpense,
  postRecurringExpense,
} from "@/app/actions/treasury.actions";
import { fmtIRT, fmtAUD } from "@/lib/accounting-engine";
import { FA } from "@/lib/treasury-utils";
import s from "@/styles/admin/Treasury.module.css";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import Tooltip from "@/components/ui/Tooltip/Tooltip";

type Props = {
  recurringExpenses: any[];
  bankAccounts: { id: string; account_name: string; currency: string }[];
};

const CATEGORIES = [
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

const FREQ_FA: Record<string, string> = {
  weekly:      FA.freqWeekly,
  fortnightly: FA.freqFortnightly,
  monthly:     FA.freqMonthly,
  quarterly:   FA.freqQuarterly,
};

const EMPTY = {
  title:            "",
  category:         "miscellaneous",
  currency:         "IRT" as "AUD" | "IRT",
  amount:           "",
  exchange_rate:    "",
  payer_account_id: "",
  frequency:        "monthly" as "weekly" | "fortnightly" | "monthly" | "quarterly",
  start_date:       "",
  notes:            "",
};

/** Returns today as YYYY-MM-DD */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Classify how imminent the next_due_date is relative to today */
function dueBadge(nextDue: string, isActive: boolean) {
  if (!isActive) return <span className={s.badgePaused}>{FA.recurringPaused}</span>;
  const diff = Math.ceil(
    (new Date(nextDue).getTime() - new Date(today()).getTime()) / 86_400_000,
  );
  if (diff <= 0)  return <span className={s.badgeDue}>سررسید گذشته</span>;
  if (diff <= 7)  return <span className={s.badgeUpcoming}>{diff} روز دیگر</span>;
  return <span className={s.badgeFuture}>{diff} روز دیگر</span>;
}

export default function RecurringExpenseForm({ recurringExpenses, bankAccounts }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  // Track which row has its "post panel" open: map id → { date, exchange_rate }
  const [postPanels, setPostPanels] = useState<
    Record<string, { date: string; exchange_rate: string }>
  >({});
  const [postError, setPostError] = useState<Record<string, string>>({});

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

    if (!form.title.trim()) { setError("عنوان هزینه الزامی است."); return; }
    if (!form.payer_account_id) { setError("انتخاب کشوی پرداخت‌کننده الزامی است."); return; }
    if (!form.start_date) { setError("تاریخ شروع الزامی است."); return; }

    const amt = Number(form.amount.replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) { setError("مبلغ نامعتبر است."); return; }

    let rate: number | null = null;
    if (form.currency === "AUD") {
      rate = Number(form.exchange_rate.replace(/,/g, ""));
      if (!Number.isFinite(rate) || rate <= 0) {
        setError("نرخ تبدیل پیش‌فرض برای ارز AUD الزامی است.");
        return;
      }
    }

    startTransition(async () => {
      const res = await addRecurringExpense({
        title:            form.title,
        category:         form.category,
        currency:         form.currency,
        amount:           amt,
        exchange_rate:    rate,
        payer_account_id: form.payer_account_id,
        frequency:        form.frequency,
        start_date:       form.start_date,
        notes:            form.notes,
      });
      if ("error" in res) setError(res.error);
      else resetForm();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("آیا از حذف این هزینه دوره‌ای مطمئن هستید؟")) return;
    startTransition(async () => {
      const res = await deleteRecurringExpense(id);
      if ("error" in res) alert(res.error);
    });
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      const res = await toggleRecurringExpense(id, !current);
      if ("error" in res) alert(res.error);
    });
  }

  function openPostPanel(id: string, defaultDate: string) {
    setPostPanels(prev => ({
      ...prev,
      [id]: { date: defaultDate <= today() ? today() : defaultDate, exchange_rate: "" },
    }));
    setPostError(prev => ({ ...prev, [id]: "" }));
  }

  function closePostPanel(id: string) {
    setPostPanels(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handlePost(item: any) {
    const panel = postPanels[item.id];
    if (!panel?.date) return;

    if (item.currency === "AUD") {
      const rateOverride = Number(panel.exchange_rate.replace(/,/g, ""));
      const fallback = Number(item.exchange_rate ?? 0);
      const effective = rateOverride > 0 ? rateOverride : fallback;
      if (!effective || effective <= 0) {
        setPostError(prev => ({ ...prev, [item.id]: "نرخ تبدیل AUD برای ثبت دوره الزامی است." }));
        return;
      }
    }

    startTransition(async () => {
      const rateStr = panel.exchange_rate.replace(/,/g, "");
      const rate = rateStr ? Number(rateStr) : null;
      const res = await postRecurringExpense(item.id, panel.date, rate);
      if ("error" in res) {
        setPostError(prev => ({ ...prev, [item.id]: res.error }));
      } else {
        closePostPanel(item.id);
      }
    });
  }

  const filteredAccounts = bankAccounts.filter(acc => acc.currency === form.currency);

  return (
    <div className={s.formWrapper}>
      <div className={s.formHeader}>
        <h2 className={s.formTitle}>{FA.secRecurring}</h2>
        {!showForm && (
          <button
            className={s.btnAddNew}
            onClick={() => setShowForm(true)}
            disabled={isPending}
          >
            <PlusCircle size={16} /> {FA.recurringAddBtn}
          </button>
        )}
      </div>

      <p style={{ fontSize: "0.78rem", color: "var(--text-dim, #6b7280)", marginBottom: "0.75rem", direction: "rtl", fontFamily: "IRANSansX, Peyda, Tahoma, sans-serif" }}>
        {FA.secRecurringDesc}
      </p>

      {/* ── Add form ──────────────────────────────────────────────── */}
      {showForm && (
        <form className={s.formContainer} onSubmit={handleSubmit}>
          {/* Row 1: title + category */}
          <div className={s.formRow}>
            <div className={s.formGroup} style={{ flex: "2 1 200px" }}>
              <label className={s.formLabel}>عنوان هزینه</label>
              <input
                className={s.formInput}
                type="text"
                value={form.title}
                onChange={e => field("title", e.target.value)}
                placeholder="مثلاً: هزینه هاستینگ وب‌سایت"
                disabled={isPending}
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>دسته‌بندی</label>
              <select
                className={s.formSelect}
                value={form.category}
                onChange={e => field("category", e.target.value)}
                disabled={isPending}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: currency + amount + frequency */}
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>ارز پرداختی</label>
              <select
                className={s.formSelect}
                value={form.currency}
                onChange={e => field("currency", e.target.value as "AUD" | "IRT")}
                disabled={isPending}
              >
                <option value="IRT">تومان (IRT)</option>
                <option value="AUD">دلار (AUD)</option>
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>مبلغ هر دوره</label>
              <input
                className={`${s.formInput} ${s.formInputNum}`}
                type="text"
                inputMode="numeric"
                value={form.amount}
                onChange={e => field("amount", e.target.value)}
                placeholder="0"
                disabled={isPending}
              />
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>{FA.recurringFreqLabel}</label>
              <select
                className={s.formSelect}
                value={form.frequency}
                onChange={e => field("frequency", e.target.value as typeof EMPTY["frequency"])}
                disabled={isPending}
              >
                <option value="weekly">{FA.freqWeekly}</option>
                <option value="fortnightly">{FA.freqFortnightly}</option>
                <option value="monthly">{FA.freqMonthly}</option>
                <option value="quarterly">{FA.freqQuarterly}</option>
              </select>
            </div>
          </div>

          {/* Row 3: payer + start_date */}
          <div className={s.formRow}>
            <div className={s.formGroup}>
              <label className={s.formLabel}>
                <Tooltip text={FA.hintRecurringPayer}>کشوی پرداخت‌کننده (مبدأ)</Tooltip>
              </label>
              <select
                className={s.formSelect}
                value={form.payer_account_id}
                onChange={e => field("payer_account_id", e.target.value)}
                disabled={isPending}
              >
                <option value="">-- انتخاب حساب --</option>
                {filteredAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
            <div className={s.formGroup}>
              <label className={s.formLabel}>{FA.recurringStartLabel}</label>
              <CustomDatePicker
                value={form.start_date}
                onChange={d => field("start_date", d)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Row 4: AUD exchange rate (conditional) */}
          {form.currency === "AUD" && (
            <div className={s.formRow}>
              <div className={s.formGroup} style={{ flex: "1 1 200px" }}>
                <label className={s.formLabel}>
                  <Tooltip text={FA.hintRecurringRate}>نرخ تبدیل پیش‌فرض (IRT/AUD) — الزامی</Tooltip>
                </label>
                <input
                  className={`${s.formInput} ${s.formInputNum}`}
                  type="text"
                  inputMode="numeric"
                  value={form.exchange_rate}
                  onChange={e => field("exchange_rate", e.target.value)}
                  placeholder="مثلاً 40000"
                  disabled={isPending}
                />
              </div>
            </div>
          )}

          {/* Row 5: notes */}
          <div className={s.formRow}>
            <div className={s.formGroup} style={{ flex: "1 1 100%" }}>
              <label className={s.formLabel}>توضیحات</label>
              <input
                className={s.formInput}
                type="text"
                value={form.notes}
                onChange={e => field("notes", e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {error && <p className={s.formError}>{error}</p>}
          <div className={s.formActionsRow}>
            <button className={s.btnSubmit} type="submit" disabled={isPending}>
              {isPending ? "در حال ذخیره..." : "ذخیره قالب"}
            </button>
            <button className={s.btnCancel} type="button" onClick={resetForm} disabled={isPending}>
              انصراف
            </button>
          </div>
        </form>
      )}

      {/* ── List ──────────────────────────────────────────────────── */}
      {recurringExpenses.length === 0 && !showForm ? (
        <p style={{ fontSize: "0.82rem", color: "var(--text-dim, #6b7280)", textAlign: "center", padding: "1.5rem 0", direction: "rtl", fontFamily: "IRANSansX, Peyda, Tahoma, sans-serif" }}>
          {FA.recurringNoItems}
        </p>
      ) : recurringExpenses.length > 0 && (
        <div className={s.listContainer}>
          <table className={s.listTable}>
            <thead>
              <tr>
                <th>عنوان</th>
                <th>مبلغ</th>
                <th>دوره‌بندی</th>
                <th>{FA.recurringNextLabel}</th>
                <th>وضعیت</th>
                <th style={{ textAlign: "left" }}></th>
              </tr>
            </thead>
            <tbody>
              {recurringExpenses.map(item => (
                <>
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      {item.notes && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text-dim, #6b7280)", marginTop: "0.1rem" }}>
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td dir="ltr" style={{ textAlign: "right" }}>
                      {item.currency === "IRT"
                        ? fmtIRT(item.amount) + " IRT"
                        : fmtAUD(item.amount) + " AUD"}
                    </td>
                    <td>
                      <span className={s.recurringFreqBadge}>
                        {FREQ_FA[item.frequency] ?? item.frequency}
                      </span>
                    </td>
                    <td dir="ltr" style={{ textAlign: "right" }}>
                      {item.next_due_date}
                    </td>
                    <td>
                      {dueBadge(item.next_due_date, item.is_active)}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                        {item.is_active && !postPanels[item.id] && (
                          <button
                            className={s.btnPost}
                            onClick={() => openPostPanel(item.id, item.next_due_date)}
                            disabled={isPending}
                          >
                            <CheckCircle2 size={13} /> {FA.recurringPostBtn}
                          </button>
                        )}
                        <button
                          className={s.btnToggle}
                          onClick={() => handleToggle(item.id, item.is_active)}
                          disabled={isPending}
                          title={item.is_active ? "توقف موقت" : "فعال‌سازی"}
                        >
                          {item.is_active ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                        <button
                          className={s.btnIconDanger}
                          onClick={() => handleDelete(item.id)}
                          disabled={isPending}
                          title="حذف"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline post panel */}
                  {postPanels[item.id] && (
                    <tr key={`${item.id}-post`}>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <div className={s.postPanel}>
                          <div className={s.postPanelGroup}>
                            <span className={s.postPanelLabel}>
                              <Tooltip text={FA.hintPostDate}>تاریخ پرداخت این دوره</Tooltip>
                            </span>
                            <CustomDatePicker
                              value={postPanels[item.id].date}
                              onChange={d =>
                                setPostPanels(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], date: d },
                                }))
                              }
                              disabled={isPending}
                            />
                          </div>

                          {item.currency === "AUD" && (
                            <div className={s.postPanelGroup}>
                              <span className={s.postPanelLabel}>
                                نرخ تبدیل این دوره (IRT/AUD)
                                {item.exchange_rate
                                  ? ` — پیش‌فرض: ${item.exchange_rate}`
                                  : ""}
                              </span>
                              <input
                                className={`${s.formInput} ${s.formInputNum}`}
                                style={{ minWidth: 130 }}
                                type="text"
                                inputMode="numeric"
                                value={postPanels[item.id].exchange_rate}
                                onChange={e =>
                                  setPostPanels(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], exchange_rate: e.target.value },
                                  }))
                                }
                                placeholder={item.exchange_rate ? String(item.exchange_rate) : "نرخ تبدیل"}
                                disabled={isPending}
                              />
                            </div>
                          )}

                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                            <button
                              className={s.btnSubmit}
                              style={{ padding: "0.55rem 1rem", fontSize: "0.82rem" }}
                              type="button"
                              onClick={() => handlePost(item)}
                              disabled={isPending}
                            >
                              {isPending ? "در حال ثبت..." : "تأیید و ثبت هزینه"}
                            </button>
                            <button
                              className={s.btnCancel}
                              style={{ padding: "0.55rem 0.85rem", fontSize: "0.82rem" }}
                              type="button"
                              onClick={() => closePostPanel(item.id)}
                              disabled={isPending}
                            >
                              انصراف
                            </button>
                          </div>

                          {postError[item.id] && (
                            <p className={s.formError} style={{ margin: 0, alignSelf: "flex-end" }}>
                              {postError[item.id]}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
