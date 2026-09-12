"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Receipt, RefreshCw } from "lucide-react";
import {
  getMonthlyBankFeeReview,
  postMonthlyBankFeeReview,
} from "@/app/actions/bank-fee.actions";
import {
  currentBankFeeMonth,
  defaultBankFeeMonth,
  isBankFeeMonth,
  parseBankFeeAmount,
  type BankFeeMonthReview,
} from "@/lib/bank-fee-posting";
import styles from "@/styles/admin/BankTransferFees.module.css";

type AccountDraft = {
  selected: boolean;
  amount: string;
  notes: string;
};

const amountFormatter = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 2,
});

function displayAmount(amount: number): string {
  return amountFormatter.format(amount);
}

function displayError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/migration|PGRST202|schema cache|does not exist/i.test(message)) {
    return "به‌روزرسانی پایگاه داده برای بخش کارمزدها هنوز نصب نشده است. پس از تکمیل به‌روزرسانی، دوباره تلاش کنید.";
  }
  return message || "عملیات انجام نشد. دوباره تلاش کنید.";
}

function initialDrafts(review: BankFeeMonthReview): Record<string, AccountDraft> {
  return Object.fromEntries(review.accounts.map((account) => [account.accountId, {
    selected: false,
    amount: String(account.postedTotalToman ?? account.pendingTotalToman),
    notes: account.notes ?? "",
  }]));
}

export default function BankTransferFees() {
  const router = useRouter();
  const id = useId();
  const [month, setMonth] = useState(() => defaultBankFeeMonth());
  const [review, setReview] = useState<BankFeeMonthReview | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AccountDraft>>({});
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [posting, startPosting] = useTransition();
  const requestSequence = useRef(0);
  const activeMonth = useRef(month);

  const currentMonth = currentBankFeeMonth();
  const validMonth = isBankFeeMonth(month) && month <= currentMonth;
  const currentReview = review?.feeMonth === month ? review : null;
  const busy = loading || posting;

  useEffect(() => {
    const sequence = ++requestSequence.current;
    let cancelled = false;
    setLoadError(null);
    setNeedsReload(false);

    if (!isBankFeeMonth(month) || month > currentBankFeeMonth()) {
      setLoading(false);
      setLoadError("یک ماه معتبر تا ماه جاری انتخاب کنید.");
      return () => { cancelled = true; };
    }

    setLoading(true);
    async function loadMonth() {
      try {
        const result = await getMonthlyBankFeeReview(month);
        if (cancelled || sequence !== requestSequence.current) return;
        if ("error" in result) {
          setLoadError(displayError(result.error));
          return;
        }
        if (result.data.feeMonth !== month) {
          setLoadError("اطلاعات ماه انتخاب‌شده دریافت نشد. ماه را بازخوانی کنید.");
          return;
        }
        setReview(result.data);
        setDrafts(initialDrafts(result.data));
        setSubmitError(null);
      } catch (error) {
        if (!cancelled && sequence === requestSequence.current) {
          setLoadError(displayError(error));
        }
      } finally {
        if (!cancelled && sequence === requestSequence.current) setLoading(false);
      }
    }
    void loadMonth();
    return () => { cancelled = true; };
  }, [month, reload]);

  function updateDraft(accountId: string, patch: Partial<AccountDraft>) {
    setDrafts((previous) => ({
      ...previous,
      [accountId]: { ...previous[accountId], ...patch },
    }));
    setSubmitError(null);
    setSuccess(null);
  }

  const selectedAccounts = currentReview?.accounts.filter(
    (account) => drafts[account.accountId]?.selected,
  ) ?? [];
  const selectedAmounts = selectedAccounts.map(
    (account) => parseBankFeeAmount(drafts[account.accountId].amount),
  );
  const invalidAmount = selectedAmounts.some((amount) => amount === null || amount < 0);
  const selectedTotal = selectedAmounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  const feeChange = selectedTotal - selectedAccounts.reduce(
    (sum, account) => sum + (account.postedTotalToman ?? 0), 0,
  );

  function submitFees(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentReview || !validMonth || busy || loadError || needsReload) return;
    setSubmitError(null);
    setSuccess(null);
    if (selectedAccounts.length === 0) {
      setSubmitError("حداقل یک حساب را انتخاب کنید.");
      return;
    }
    if (invalidAmount) {
      setSubmitError("مبلغ کارمزد هر حساب انتخاب‌شده باید عددی معتبر و صفر یا بیشتر باشد.");
      return;
    }

    const submittedMonth = month;
    const submittedSequence = requestSequence.current;
    const entries = selectedAccounts.map((account) => ({
      accountId: account.accountId,
      actualAmountToman: parseBankFeeAmount(drafts[account.accountId].amount)!,
      notes: drafts[account.accountId].notes.trim(),
      expectedVersion: account.postingVersion,
      expectedPendingFingerprint: account.pendingFingerprint,
    }));

    startPosting(async () => {
      try {
        const result = await postMonthlyBankFeeReview({ feeMonth: submittedMonth, entries });
        if (activeMonth.current !== submittedMonth || submittedSequence !== requestSequence.current) return;
        if ("error" in result) {
          setSubmitError(displayError(result.error));
          if (/stale|conflict/i.test(result.code ?? "")) setNeedsReload(true);
          return;
        }
        setSuccess("کارمزد حساب‌های انتخاب‌شده ثبت شد و موجودی حساب‌ها به‌روزرسانی می‌شود.");
        setDrafts((previous) => Object.fromEntries(
          Object.entries(previous).map(([accountId, draft]) => [accountId, { ...draft, selected: false }]),
        ));
        setReload((value) => value + 1);
        router.refresh();
      } catch (error) {
        if (activeMonth.current === submittedMonth && submittedSequence === requestSequence.current) {
          setSubmitError(displayError(error));
        }
      }
    });
  }

  return (
    <section id="bank-transfer-fees" className={styles.panel} aria-labelledby={`${id}-heading`} dir="rtl">
      <div className={styles.header}>
        <Receipt size={21} aria-hidden="true" className={styles.headerIcon} />
        <div>
          <h3 id={`${id}-heading`} className={styles.heading}>کارمزد انتقال‌های بانکی</h3>
          <p className={styles.description}>
            کارمزد واقعی هر حساب را با صورت‌حساب بانکی بررسی کنید و فقط حساب‌های موردنظر را ثبت کنید.
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.monthField}>
          <label htmlFor={`${id}-month`}>ماه میلادی</label>
          <input
            id={`${id}-month`}
            type="month"
            value={month}
            max={currentMonth}
            disabled={posting}
            className={styles.input}
            dir="ltr"
            aria-describedby={`${id}-month-hint`}
            onChange={(event) => {
              const nextMonth = event.target.value;
              if (nextMonth === month) return;
              activeMonth.current = nextMonth;
              requestSequence.current += 1;
              setLoading(true);
              setMonth(nextMonth);
              setSuccess(null);
              setSubmitError(null);
            }}
          />
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={busy || !validMonth}
          onClick={() => {
            requestSequence.current += 1;
            setLoading(true);
            setReload((value) => value + 1);
          }}
        >
          <RefreshCw size={15} aria-hidden="true" />
          بازخوانی ماه
        </button>
        <p id={`${id}-month-hint`} className={styles.hint}>
          ماه قبل به‌صورت پیش‌فرض انتخاب شده است. ماه جاری نیز قابل ثبت است.
        </p>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {loading && <p className={styles.status}>در حال دریافت کارمزدهای ماه…</p>}
        {success && (
          <p className={styles.success} role="status">
            <CheckCircle2 size={17} aria-hidden="true" />{success}
          </p>
        )}
      </div>
      {loadError && <p className={styles.error} role="alert">{loadError}</p>}

      {currentReview && (
        <form onSubmit={submitFees} aria-busy={busy}>
          <p className={styles.explanation} id={`${id}-total-help`}>
            مبلغ هر حساب، کل کارمزد این فرم برای ماه انتخابی است. ثبت دوباره، مبلغ قبلی را جایگزین می‌کند؛
            به آن اضافه نمی‌شود. برای اصلاح یا تسویه کارمزد می‌توانید مبلغ صفر وارد کنید.
          </p>
          {currentReview.accounts.length === 0 ? (
            <p className={styles.empty}>حسابی برای ثبت کارمزد این ماه یافت نشد.</p>
          ) : (
            <div className={styles.accounts}>
              {currentReview.accounts.map((account) => {
                const draft = drafts[account.accountId];
                if (!draft) return null;
                const fieldId = `${id}-${account.accountId}`;
                const amountInvalid = draft.selected && parseBankFeeAmount(draft.amount) === null;
                return (
                  <fieldset
                    key={account.accountId}
                    className={`${styles.account} ${draft.selected ? styles.accountSelected : ""}`}
                    disabled={busy || Boolean(loadError) || needsReload}
                  >
                    <legend className={styles.srOnly}>{account.accountName}</legend>
                    <div className={styles.accountHeader}>
                      <label className={styles.accountSelector} htmlFor={`${fieldId}-selected`}>
                        <input
                          id={`${fieldId}-selected`}
                          type="checkbox"
                          checked={draft.selected}
                          onChange={(event) => updateDraft(account.accountId, { selected: event.target.checked })}
                          aria-label={`انتخاب حساب ${account.accountName}`}
                        />
                        <bdi>{account.accountName}</bdi>
                      </label>
                      <span className={account.postedTotalToman !== null ? styles.postedBadge : styles.pendingBadge}>
                        {account.postedTotalToman !== null ? "قبلاً ثبت شده" : "ثبت نشده"}
                      </span>
                    </div>

                    <dl className={styles.metrics}>
                      <div><dt>برآورد کل ماه</dt><dd><bdi>{displayAmount(account.estimatedTotalToman)}</bdi> تومان</dd></div>
                      <div><dt>برآورد ثبت‌نشده</dt><dd><bdi>{displayAmount(account.pendingTotalToman)}</bdi> تومان <span className={styles.count}>({account.pendingCount} مورد)</span></dd></div>
                      <div><dt>مبلغ ثبت‌شده این فرم</dt><dd>{account.postedTotalToman === null ? "—" : <><bdi>{displayAmount(account.postedTotalToman)}</bdi> تومان</>}</dd></div>
                    </dl>

                    {account.postedTotalToman !== null && account.pendingCount > 0 && (
                      <p className={styles.notice}>
                        پس از ثبت قبلی، {account.pendingCount} کارمزد جدید اضافه شده است. مبلغ کل ماه را بازبینی کنید.
                      </p>
                    )}
                    {account.pendingCount === 0 && account.postedTotalToman === null && (
                      <p className={styles.hint}>برآوردی ثبت نشده است؛ می‌توانید کارمزد واقعی صورت‌حساب را دستی وارد کنید.</p>
                    )}
                    {account.otherPaidFeesToman > 0 && (
                      <p className={styles.notice}>
                        برای این حساب <bdi>{displayAmount(account.otherPaidFeesToman)}</bdi> تومان کارمزد جداگانه در این ماه ثبت شده است.
                        مبلغی را که جداگانه ثبت کرده‌اید، دوباره در این فرم وارد نکنید.
                      </p>
                    )}

                    <div className={styles.editFields}>
                      <div className={styles.amountField}>
                        <label htmlFor={`${fieldId}-amount`}>مبلغ واقعی کل ماه (تومان)</label>
                        <input
                          id={`${fieldId}-amount`}
                          type="text"
                          inputMode="decimal"
                          className={styles.input}
                          value={draft.amount}
                          disabled={!draft.selected}
                          dir="ltr"
                          aria-invalid={amountInvalid}
                          aria-describedby={`${id}-total-help${amountInvalid ? ` ${fieldId}-amount-error` : ""}`}
                          onChange={(event) => updateDraft(account.accountId, { amount: event.target.value })}
                        />
                        {amountInvalid && <span id={`${fieldId}-amount-error`} className={styles.fieldError}>عدد معتبر و صفر یا بیشتر وارد کنید.</span>}
                      </div>
                      <div className={styles.notesField}>
                        <label htmlFor={`${fieldId}-notes`}>توضیحات یا مرجع صورت‌حساب</label>
                        <input
                          id={`${fieldId}-notes`}
                          type="text"
                          className={styles.input}
                          value={draft.notes}
                          maxLength={2000}
                          disabled={!draft.selected}
                          onChange={(event) => updateDraft(account.accountId, { notes: event.target.value })}
                          placeholder="اختیاری"
                        />
                      </div>
                    </div>
                  </fieldset>
                );
              })}
            </div>
          )}

          {submitError && <p className={styles.error} role="alert">{submitError}</p>}
          {needsReload && <p className={styles.hint}>اطلاعات ماه تغییر کرده است. برای بررسی دوباره، «بازخوانی ماه» را بزنید.</p>}
          <div className={styles.footer}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={busy || !validMonth || Boolean(loadError) || needsReload || selectedAccounts.length === 0 || invalidAmount}
            >
              {posting ? "در حال ثبت کارمزدها…" : "ثبت کارمزد حساب‌های انتخاب‌شده"}
            </button>
            <div aria-live="polite">
              <p className={styles.selectionSummary}>
                {selectedAccounts.length} حساب انتخاب شده
                {selectedAccounts.length > 0 && !invalidAmount && <> · جمع: <bdi>{displayAmount(selectedTotal)}</bdi> تومان</>}
              </p>
              {selectedAccounts.length > 0 && !invalidAmount && (
                <p className={styles.selectionSummary}>
                  اثر این ثبت بر مجموع موجودی حساب‌های انتخاب‌شده: {Math.abs(feeChange) < 0.005 ? "بدون تغییر" : (
                    <>{feeChange > 0 ? "کسر" : "افزایش"} <bdi>{displayAmount(Math.abs(feeChange))}</bdi> تومان</>
                  )}
                </p>
              )}
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
