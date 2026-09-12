"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Check, Download, Search, SlidersHorizontal, X, LoaderCircle } from "lucide-react";
import { getLedgerExportRows, type AdminLedgerFilters } from "@/app/actions/admin.actions";
import { AdminToast } from "@/components/admin/ui/AdminToast";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { SelectBox } from "../../ui/SelectBox/SelectBox";
import styles from "@/styles/admin/LedgerToolbar.module.css";
import { sortBankAccountsByPriority } from "@/lib/bank-account-ordering";

interface LedgerToolbarProps {
  currentParams: Record<string, string | undefined>;
  bankAccounts: Array<{ id: string; account_name: string; currency: "AUD" | "IRT" }>;
  exportFilters: AdminLedgerFilters;
}

const rangeOptions = [
  { label: "All time", value: "all" }, { label: "Today", value: "today" },
  { label: "This month", value: "this-month" }, { label: "Last month", value: "last-month" },
  { label: "This year", value: "this-year" }, { label: "Custom dates", value: "custom" },
];
const transactionOptions = [
  { label: "All entry types", value: "all" }, { label: "Buy AUD", value: "buy_aud" },
  { label: "Sell AUD", value: "sell_aud" }, { label: "Internal transfer", value: "transfer" },
  { label: "Expense", value: "expense" }, { label: "Owner loan", value: "owner_loan" },
  { label: "Adjustment", value: "adjustment" },
];

export default function LedgerToolbar({ currentParams, bankAccounts, exportFilters }: LedgerToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hasDateFilter = Boolean(currentParams.range && currentParams.range !== "all" || currentParams.start || currentParams.end);
  const activeFilterCount = [currentParams.type, currentParams.account, currentParams.search, hasDateFilter].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(Boolean(currentParams.type || currentParams.account || hasDateFilter));
  const [isExporting, setIsExporting] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const [searchText, setSearchText] = useState(currentParams.search || "");
  const [customStart, setCustomStart] = useState(currentParams.start || "");
  const [customEnd, setCustomEnd] = useState(currentParams.end || "");
  const { showToast, toastProps } = useAdminFeedback();
  const isCustom = currentParams.range === "custom" || (!currentParams.range && Boolean(currentParams.start || currentParams.end));
  const invalidRange = Boolean(customStart && customEnd && customStart > customEnd);
  const accountNameById = useMemo(() => Object.fromEntries(bankAccounts.map(account => [account.id, `${account.account_name} (${account.currency})`])), [bankAccounts]);
  const accountOptions = useMemo(() => [
    { label: "All bank accounts", value: "all" },
    ...sortBankAccountsByPriority(bankAccounts).map(account => ({ label: `${account.account_name} (${account.currency})`, value: account.id })),
  ], [bankAccounts]);

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(currentParams)) if (value !== undefined) params.set(key, value);
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    startNavigation(() => router.push(`${pathname}?${params}`, { scroll: false }));
  }
  function clearFilters() {
    setSearchText("");
    navigate({ type: null, account: null, range: null, start: null, end: null, search: null });
  }
  const downloadExportRows = (exportRows: Awaited<ReturnType<typeof getLedgerExportRows>>) => {
    const selectedAccountId = currentParams.account || null;

    const toNumber = (value: number | string) => {
      const parsed = Number(String(value).replaceAll(",", ""));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const resolveFlow = (row: { payer_account_id: string | null; receiver_account_id: string | null }) => {
      // Primary mode: signed values from the perspective of the selected account.
      if (selectedAccountId) {
        const isPayer = row.payer_account_id === selectedAccountId;
        const isReceiver = row.receiver_account_id === selectedAccountId;
        if (isPayer && !isReceiver) return { direction: "out", sign: -1 };
        if (isReceiver && !isPayer) return { direction: "in", sign: 1 };
        if (isPayer && isReceiver) return { direction: "internal", sign: 0 };
        return { direction: "unrelated", sign: 0 };
      }

      // Fallback mode (no account selected): only infer sign for one-sided rows.
      const hasPayer = Boolean(row.payer_account_id);
      const hasReceiver = Boolean(row.receiver_account_id);
      if (hasPayer && !hasReceiver) return { direction: "out", sign: -1 };
      if (hasReceiver && !hasPayer) return { direction: "in", sign: 1 };
      if (hasPayer && hasReceiver) return { direction: "internal", sign: 0 };
      return { direction: "unknown", sign: 0 };
    };

    const headers = [
      "id",
      "date_gregorian",
      "date_jalali",
      "entry_type",
      "type",
      "flow_direction",
      "signed_amount_aud",
      "signed_amount_toman",
      "exchange_rate",
      "amount_aud",
      "amount_toman",
      "fee_aud",
      "payer_account",
      "receiver_account",
      "sender",
      "recipient",
      "notes",
    ];

    const csvRows = exportRows.map((row) => {
      const flow = resolveFlow(row);
      const signedAud = flow.sign === 0 ? "" : String((flow.sign * toNumber(row.amount_aud)).toFixed(2));
      const signedToman = flow.sign === 0 ? "" : String(Math.round(flow.sign * toNumber(row.amount_toman)));

      return [
        row.id,
        row.date_gregorian,
        row.date_jalali,
        row.entry_type ?? "trade",
        row.type,
        flow.direction,
        signedAud,
        signedToman,
        row.exchange_rate,
        row.amount_aud,
        row.amount_toman,
        row.fee_aud,
        row.payer_account_id ? (accountNameById[row.payer_account_id] ?? row.payer_account_id) : "",
        row.receiver_account_id ? (accountNameById[row.receiver_account_id] ?? row.receiver_account_id) : "",
        row.sender ?? "",
        row.recipient ?? "",
        row.notes ?? "",
      ];
    });

    const csv = [headers, ...csvRows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\r\n");

    const params = new URLSearchParams(currentParams as Record<string, string>);
    const suffix = params.toString() ? `-${params.toString().replaceAll("&", "-").replaceAll("=", "_")}` : "";
    // Excel on Windows reliably detects UTF-8 CSV when BOM is present.
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-export${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFilteredRows = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const rows = await getLedgerExportRows(exportFilters);
      downloadExportRows(rows);
      showToast({ type: "success", message: `${rows.length.toLocaleString()} ledger records exported.` });
    } catch {
      showToast({ type: "error", message: "The ledger export couldn't be prepared. Please try again." });
    } finally {
      setIsExporting(false);
    }
  };


  return <section className={styles.toolbar} aria-label="Ledger filters and export" aria-busy={navigating}>
    <div className={styles.primaryRow}>
      <form className={styles.searchForm} role="search" aria-label="Search ledger entries" onSubmit={event => { event.preventDefault(); navigate({ search: searchText.trim() || null }); }}>
        <div className={styles.searchField}>
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Search sender or recipient" placeholder="Search sender or recipient…" value={searchText} onChange={event => setSearchText(event.target.value)} dir="auto" />
          <button type="submit" disabled={navigating} className={styles.searchSubmit}>Search</button>
        </div>
      </form>
      <div className={styles.primaryActions}>
        <button type="button" className={`${styles.filterButton} ${filtersOpen ? styles.filterButtonActive : ""}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}>
          <SlidersHorizontal size={15} /> Filters {activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
        </button>
        <button type="button" className={styles.exportButton} onClick={exportFilteredRows} disabled={isExporting || navigating} aria-busy={isExporting}>
          {isExporting ? <LoaderCircle size={15} className={styles.spinner} /> : <Download size={15} />}
          {isExporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
    </div>
    {filtersOpen && <div className={styles.filterFields}>
      <div className={styles.control}><span className={styles.controlLabel}>Entry type</span><SelectBox placeholder="Entry type" labeledOptions={transactionOptions} value={currentParams.type || "all"} onChange={value => navigate({ type: value === "all" ? null : value })} className={styles.selectTrigger} disabled={navigating} dir="ltr" /></div>
      <div className={styles.control}><span className={styles.controlLabel}>Date range</span><SelectBox placeholder="Date range" labeledOptions={rangeOptions} value={currentParams.range || (currentParams.start || currentParams.end ? "custom" : "all")} onChange={value => navigate(value === "custom" ? { range: value } : { range: value, start: null, end: null })} className={styles.selectTrigger} disabled={navigating} dir="ltr" /></div>
      <div className={styles.control}><span className={styles.controlLabel}>Bank account</span><SelectBox placeholder="Bank account" labeledOptions={accountOptions} value={currentParams.account || "all"} onChange={value => navigate({ account: value === "all" ? null : value })} className={styles.selectTrigger} disabled={navigating} dir="ltr" /></div>
      {isCustom && <div className={styles.customRange}>
        <div className={styles.dateControl}><span>From</span><CustomDatePicker value={customStart} onChange={setCustomStart} placeholder="Start date" disabled={navigating} /></div>
        <div className={styles.dateControl}><span>To</span><CustomDatePicker value={customEnd} onChange={setCustomEnd} placeholder="End date" disabled={navigating} /></div>
        <button type="button" className={styles.applyButton} onClick={() => navigate({ start: customStart, end: customEnd, range: "custom" })} disabled={!customStart || !customEnd || invalidRange || navigating}><Check size={16} /> Apply dates</button>
        {invalidRange && <p className={styles.rangeError} role="alert">End date must be on or after the start date.</p>}
      </div>}
    </div>}
    {(activeFilterCount > 0 || navigating) && <div className={styles.activeFilters}>
      {navigating ? <span role="status"><LoaderCircle size={13} className={styles.spinner} /> Updating entries…</span> : <span>{activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}{currentParams.search ? ` · “${currentParams.search}”` : ""}</span>}
      {activeFilterCount > 0 && <button type="button" onClick={clearFilters} disabled={navigating}><X size={13} /> Clear filters</button>}
    </div>}
    <AdminToast {...toastProps} />
  </section>;
}
