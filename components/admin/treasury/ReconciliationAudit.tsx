"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, Landmark, Trash2, Wand2 } from "lucide-react";
import {
  getComputedBalancesAsOf,
  saveAccountReconciliation,
  postReconciliationAdjustment,
  deleteAccountReconciliation,
} from "@/app/actions/treasury.actions";
import { fmtAUD, fmtIRT } from "@/lib/accounting-engine";
import { FA } from "@/lib/treasury-utils";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import s from "@/styles/admin/Treasury.module.css";

type BankAccount = {
  id: string;
  account_name: string;
  currency: "AUD" | "IRT";
  account_type: "bank" | "virtual" | "transit";
};

type ReconciliationRecord = {
  id: string;
  account_id: string;
  account_name: string;
  period: string;
  as_of_date: string;
  currency: "AUD" | "IRT";
  computed_balance: number;
  actual_balance: number;
  discrepancy: number;
  status: "matched" | "discrepancy" | "adjusted";
  notes: string | null;
  adjustment_ledger_id: string | null;
  reconciled_by_email: string | null;
  created_at: string;
};

type Props = {
  bankAccounts: BankAccount[];
  accounting: { drawerBalances: Record<string, { balance: number }> };
  reconciliations: ReconciliationRecord[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(currency: "AUD" | "IRT", value: number) {
  return currency === "AUD" ? `${fmtAUD(value)} AUD` : `${fmtIRT(value)} IRT`;
}

function statusPill(status: ReconciliationRecord["status"]) {
  if (status === "matched") return <span className={s.badgeSuccess}>{FA.auditStatusMatched}</span>;
  if (status === "adjusted") return <span className={s.auditBadgeAdjusted}>{FA.auditStatusAdjusted}</span>;
  return <span className={s.badgeWarning}>{FA.auditStatusDiscrepancy}</span>;
}

export default function ReconciliationAudit({ bankAccounts, accounting, reconciliations }: Props) {
  const [isPending, startTransition] = useTransition();
  const [asOfDate, setAsOfDate] = useState(today);
  const [historicalBalances, setHistoricalBalances] = useState<Record<string, number> | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, { actual: string; notes: string }>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const bankOnlyAccounts = useMemo(
    () => bankAccounts.filter(a => a.account_type === "bank"),
    [bankAccounts],
  );

  const isToday = asOfDate === today();

  // Balances for "today" are derived straight from the live snapshot; only a
  // past "as of" date needs an async, point-in-time recomputation.
  const todayBalances = useMemo(() => {
    const initial: Record<string, number> = {};
    Object.entries(accounting.drawerBalances ?? {}).forEach(([id, d]) => { initial[id] = d.balance; });
    return initial;
  }, [accounting.drawerBalances]);

  const computedBalances = isToday ? todayBalances : (historicalBalances ?? {});

  useEffect(() => {
    if (isToday) return;
    let cancelled = false;
    async function load() {
      setLoadingBalances(true);
      setBalancesError(null);
      const res = await getComputedBalancesAsOf(asOfDate);
      if (cancelled) return;
      setLoadingBalances(false);
      if ("error" in res) setBalancesError(res.error);
      else setHistoricalBalances(res.balances);
    }
    load();
    return () => { cancelled = true; };
  }, [asOfDate, isToday]);

  const latestByAccount = useMemo(() => {
    const map = new Map<string, ReconciliationRecord>();
    for (const r of reconciliations) if (!map.has(r.account_id)) map.set(r.account_id, r);
    return map;
  }, [reconciliations]);

  const currentPeriod = asOfDate.slice(0, 7);
  const { matchedCount, discrepancyCount, pendingCount } = useMemo(() => {
    const seen = new Map<string, ReconciliationRecord>();
    for (const r of reconciliations) {
      if (r.period !== currentPeriod) continue;
      if (!seen.has(r.account_id)) seen.set(r.account_id, r);
    }
    const values = [...seen.values()];
    return {
      matchedCount: values.filter(r => r.status === "matched" || r.status === "adjusted").length,
      discrepancyCount: values.filter(r => r.status === "discrepancy").length,
      pendingCount: Math.max(0, bankOnlyAccounts.length - seen.size),
    };
  }, [reconciliations, currentPeriod, bankOnlyAccounts.length]);

  function updateField(accountId: string, key: "actual" | "notes", value: string) {
    setFormState(prev => {
      const current = prev[accountId] ?? { actual: "", notes: "" };
      return { ...prev, [accountId]: { ...current, [key]: value } };
    });
    setFieldErrors(prev => ({ ...prev, [accountId]: "" }));
  }

  function handleSave(account: BankAccount) {
    const state = formState[account.id] ?? { actual: "", notes: "" };
    const actualNum = Number(state.actual.replace(/,/g, ""));
    if (!state.actual.trim() || !Number.isFinite(actualNum)) {
      setFieldErrors(prev => ({ ...prev, [account.id]: "موجودی واقعی نامعتبر است." }));
      return;
    }
    const computed = computedBalances[account.id] ?? 0;
    setSavingId(account.id);
    startTransition(async () => {
      const res = await saveAccountReconciliation({
        account_id: account.id,
        as_of_date: asOfDate,
        computed_balance: computed,
        actual_balance: actualNum,
        notes: state.notes,
      });
      setSavingId(null);
      if ("error" in res) setFieldErrors(prev => ({ ...prev, [account.id]: res.error }));
      else setFormState(prev => ({ ...prev, [account.id]: { actual: "", notes: "" } }));
    });
  }

  function handleAdjust(rec: ReconciliationRecord) {
    if (!confirm(FA.auditConfirmAdjust)) return;
    setAdjustingId(rec.id);
    startTransition(async () => {
      const res = await postReconciliationAdjustment(rec.id);
      setAdjustingId(null);
      if ("error" in res) alert(res.error);
    });
  }

  function handleDelete(id: string) {
    if (!confirm(FA.auditConfirmDelete)) return;
    startTransition(async () => {
      const res = await deleteAccountReconciliation(id);
      if ("error" in res) alert(res.error);
    });
  }

  return (
    <section>
      <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
        <div>
          <h2 className={cardStyles.sectionTitle}>{FA.secAudit}</h2>
          <p className={cardStyles.sectionDesc}>{FA.secAuditDesc}</p>
        </div>
      </div>

      <div className={s.auditToolbar}>
        <div className={s.formGroup} style={{ maxWidth: 220 }}>
          <label className={s.formLabel}>{FA.auditAsOfLabel}</label>
          <CustomDatePicker value={asOfDate} onChange={setAsOfDate} disabled={isPending} />
        </div>
        <div className={s.auditSummaryRow}>
          <span className={`${s.auditChip} ${matchedCount > 0 ? s.auditChipSuccess : ""}`}>
            <CheckCircle2 size={13} /> {matchedCount} {FA.auditSummaryMatched}
          </span>
          <span className={`${s.auditChip} ${discrepancyCount > 0 ? s.auditChipWarning : ""}`}>
            <AlertTriangle size={13} /> {discrepancyCount} {FA.auditSummaryDiscrepancy}
          </span>
          <span className={s.auditChip}>{pendingCount} {FA.auditSummaryPending}</span>
        </div>
      </div>

      {balancesError && <p className={s.formError}>{balancesError}</p>}

      {bankOnlyAccounts.length === 0 ? (
        <p className={s.auditEmptyHint}>{FA.auditNoAccounts}</p>
      ) : (
        <div className={s.auditGrid}>
          {bankOnlyAccounts.map(account => {
            const latest = latestByAccount.get(account.id);
            const actualRaw = formState[account.id]?.actual ?? "";
            const actualNum = Number(actualRaw.replace(/,/g, ""));
            const hasPreview = actualRaw.trim() !== "" && Number.isFinite(actualNum);
            const gap = hasPreview ? Math.round((actualNum - (computedBalances[account.id] ?? 0)) * 100) / 100 : 0;

            return (
              <div className={s.auditCard} key={account.id}>
                <div className={s.auditCardHeader}>
                  <div className={s.auditCardTitle}>
                    <Landmark size={16} />
                    {account.account_name}
                  </div>
                  <span className={`${s.reconCurrencyBadge} ${s.reconCurrencyBadgeAccent}`}>{account.currency}</span>
                </div>

                <div className={s.auditStat}>
                  <span className={s.auditStatLabel}>{FA.auditComputedLabel}</span>
                  <span className={s.auditStatValue} dir="ltr">
                    {loadingBalances ? "…" : fmt(account.currency, computedBalances[account.id] ?? 0)}
                  </span>
                </div>

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{FA.auditActualLabel}</label>
                  <input
                    className={`${s.formInput} ${s.formInputNum}`}
                    type="text"
                    inputMode="decimal"
                    value={actualRaw}
                    onChange={e => updateField(account.id, "actual", e.target.value)}
                    placeholder="0.00"
                    disabled={isPending || loadingBalances}
                  />
                </div>

                {hasPreview && (
                  Math.abs(gap) < 0.01 ? (
                    <div className={`${s.auditGapPreview} ${s.auditGapNeutral}`}>
                      <CheckCircle2 size={14} /> {FA.auditGapNone}
                    </div>
                  ) : (
                    <div className={`${s.auditGapPreview} ${gap > 0 ? s.auditGapPositive : s.auditGapNegative}`}>
                      <AlertTriangle size={14} />
                      {gap > 0 ? FA.auditExtra : FA.auditShortfall}: <span dir="ltr">{fmt(account.currency, Math.abs(gap))}</span>
                    </div>
                  )
                )}

                <div className={s.formGroup}>
                  <label className={s.formLabel}>{FA.auditNotesLabel}</label>
                  <input
                    className={s.formInput}
                    type="text"
                    value={formState[account.id]?.notes ?? ""}
                    onChange={e => updateField(account.id, "notes", e.target.value)}
                    placeholder={FA.auditNotesPlaceholder}
                    disabled={isPending}
                  />
                </div>

                {fieldErrors[account.id] && <p className={s.formError}>{fieldErrors[account.id]}</p>}

                <div className={s.formActionsRow}>
                  <button className={s.btnSubmit} onClick={() => handleSave(account)} disabled={isPending || loadingBalances}>
                    {isPending && savingId === account.id ? FA.auditSavingBtn : FA.auditSaveBtn}
                  </button>
                </div>

                <div className={s.auditCardFooter}>
                  {latest ? (
                    <>
                      <span>{FA.auditLastReconciled}: <span dir="ltr">{latest.as_of_date}</span></span>
                      {statusPill(latest.status)}
                      {latest.status === "discrepancy" && (
                        <button className={s.btnPost} onClick={() => handleAdjust(latest)} disabled={isPending}>
                          <Wand2 size={13} /> {isPending && adjustingId === latest.id ? FA.auditPostingBtn : FA.auditPostAdjustmentBtn}
                        </button>
                      )}
                    </>
                  ) : (
                    <span className={s.auditNeverBadge}>{FA.auditNeverReconciled}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <details className={s.detailsBlock}>
        <summary className={s.detailsSummary}>
          <ChevronDown size={14} />
          {FA.auditHistoryTitle}{reconciliations.length > 0 ? ` (${reconciliations.length})` : ""}
        </summary>
        <div className={s.detailsContent}>
          {reconciliations.length === 0 ? (
            <p className={s.auditEmptyHint}>{FA.auditHistoryEmpty}</p>
          ) : (
            <div className={s.listContainer}>
              <table className={s.listTable}>
                <thead>
                  <tr>
                    <th>{FA.auditHistoryAccount}</th>
                    <th>{FA.auditHistoryDate}</th>
                    <th>{FA.auditHistoryComputed}</th>
                    <th>{FA.auditHistoryActual}</th>
                    <th>{FA.auditHistoryGap}</th>
                    <th>{FA.auditHistoryStatus}</th>
                    <th>{FA.auditHistoryBy}</th>
                    <th style={{ textAlign: "left" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map(r => (
                    <tr key={r.id}>
                      <td>{r.account_name}</td>
                      <td dir="ltr" style={{ textAlign: "right" }}>{r.as_of_date}</td>
                      <td dir="ltr" style={{ textAlign: "right" }}>{fmt(r.currency, r.computed_balance)}</td>
                      <td dir="ltr" style={{ textAlign: "right" }}>{fmt(r.currency, r.actual_balance)}</td>
                      <td dir="ltr" style={{ textAlign: "right", color: Math.abs(r.discrepancy) < 0.01 ? undefined : (r.discrepancy > 0 ? "#047857" : "#b91c1c") }}>
                        {fmt(r.currency, r.discrepancy)}
                      </td>
                      <td>{statusPill(r.status)}</td>
                      <td>{r.reconciled_by_email || "—"}</td>
                      <td style={{ textAlign: "left" }}>
                        <button className={s.btnIconDanger} onClick={() => handleDelete(r.id)} disabled={isPending} title="حذف">
                          <Trash2 size={15} />
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
    </section>
  );
}
