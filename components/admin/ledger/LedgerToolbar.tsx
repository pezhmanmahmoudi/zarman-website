"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Check, Download, Search } from "lucide-react";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { SelectBox } from "../../ui/SelectBox/SelectBox";
import styles from "@/styles/admin/LedgerToolbar.module.css";
import {
  filterBankAccountsByLedgerType,
  sortBankAccountsByPriority,
} from "@/lib/bank-account-ordering";

interface LedgerToolbarProps {
  currentParams: Record<string, string | undefined>;
  bankAccounts: Array<{ id: string; account_name: string; currency: "AUD" | "IRT" }>;
  exportRows: Array<{
    id: string;
    date_gregorian: string;
    date_jalali: string;
    type: string;
    entry_type?: string;
    exchange_rate: number | string;
    amount_aud: number | string;
    amount_toman: number | string;
    sender: string | null;
    recipient: string | null;
    fee_aud: number | string;
    payer_account_id: string | null;
    receiver_account_id: string | null;
    notes: string | null;
  }>;
}

const rangeOptions = [
  { label: "همه زمان‌ها", value: "all" },
  { label: "امروز", value: "today" },
  { label: "این ماه", value: "this-month" },
  { label: "ماه گذشته", value: "last-month" },
  { label: "امسال", value: "this-year" },
  { label: "بازه دلخواه", value: "custom" },
];

const transactionOptions = [
  { label: "همه تراکنش‌ها", value: "all" },
  { label: "خرید دلار", value: "buy_aud" },
  { label: "فروش دلار", value: "sell_aud" },
  { label: "انتقال داخلی", value: "transfer" },
  { label: "هزینه", value: "expense" },
  { label: "وام مالک", value: "owner_loan" },
  { label: "اصلاح حساب", value: "adjustment" },
];

export default function LedgerToolbar({ currentParams, bankAccounts, exportRows }: LedgerToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const accountNameById = useMemo(() => {
    const map: Record<string, string> = {};
    bankAccounts.forEach((acc) => {
      map[acc.id] = `${acc.account_name} (${acc.currency})`;
    });
    return map;
  }, [bankAccounts]);

  const accountOptions = useMemo(
    () => [
      { label: "همه حساب‌ها", value: "all" },
      ...sortBankAccountsByPriority(
        filterBankAccountsByLedgerType(bankAccounts, currentParams.type),
      ).map((acc) => ({ label: `${acc.account_name} (${acc.currency})`, value: acc.id })),
    ],
    [bankAccounts, currentParams.type],
  );

  // Local state for custom dates to prevent auto-fetching before confirmation
  const [customStart, setCustomStart] = useState(currentParams.start || "");
  const [customEnd, setCustomEnd] = useState(currentParams.end || "");

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(currentParams as Record<string, string>);
      Object.entries(updates).forEach(([name, value]) => {
        if (value) params.set(name, value);
        else params.delete(name);
      });
      params.delete("page"); // Reset pagination
      return params.toString();
    },
    [currentParams]
  );

  const isCustom = currentParams.range === "custom";

  const applyCustomDate = () => {
    router.push(pathname + "?" + createQueryString({ start: customStart, end: customEnd, range: "custom" }));
  };

  const exportFilteredRows = () => {
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

  return (
    <section className={styles.toolbar} dir="rtl" aria-label="فیلترهای دفتر کل">
      <div className={styles.control}>
        <span className={styles.controlLabel}>نوع تراکنش</span>
        <SelectBox
          labeledOptions={transactionOptions}
          value={currentParams.type || "all"}
          onChange={(value: string) => router.push(pathname + "?" + createQueryString({ type: value === "all" ? null : value }))}
          className={styles.selectTrigger}
          dir="rtl"
        />
      </div>

      <div className={styles.control}>
        <span className={styles.controlLabel}>بازه زمانی</span>
        <SelectBox
          labeledOptions={rangeOptions}
          value={currentParams.range || "all"}
          onChange={(value: string) => {
            if (value === "custom") {
              router.push(pathname + "?" + createQueryString({ range: value }));
              return;
            }
            router.push(pathname + "?" + createQueryString({ range: value, start: null, end: null }));
          }}
          className={styles.selectTrigger}
          dir="rtl"
        />
      </div>

      <div className={styles.control}>
        <span className={styles.controlLabel}>حساب بانکی</span>
        <SelectBox
          labeledOptions={accountOptions}
          value={currentParams.account || "all"}
          onChange={(value: string) => router.push(pathname + "?" + createQueryString({ account: value === "all" ? null : value }))}
          className={styles.selectTrigger}
          dir="rtl"
        />
      </div>

      <label className={`${styles.control} ${styles.searchControl}`}>
        <span className={styles.controlLabel}>جستجو در دفتر کل</span>
        <span className={styles.searchField}>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            placeholder="نام مشتری یا کد مرجع"
            defaultValue={currentParams.search || ""}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                router.push(pathname + "?" + createQueryString({ search: event.currentTarget.value.trim() || null }));
              }
            }}
          />
        </span>
      </label>

      <div className={`${styles.control} ${styles.actionsControl}`}>
        <span className={styles.controlLabel}>خروجی</span>
        <button type="button" className={styles.exportButton} onClick={exportFilteredRows}>
          <Download size={16} aria-hidden="true" />
          خروجی CSV تراکنش‌ها
        </button>
      </div>

      {isCustom && (
        <div className={styles.customRange}>
          <span className={styles.customRangeLabel}>انتخاب بازه دلخواه</span>
          <div className={styles.dateControl}>
            <span>از تاریخ</span>
            <CustomDatePicker value={customStart} onChange={setCustomStart} placeholder="تاریخ شروع" className={styles.datePicker} />
          </div>
          <div className={styles.dateControl}>
            <span>تا تاریخ</span>
            <CustomDatePicker value={customEnd} onChange={setCustomEnd} placeholder="تاریخ پایان" className={styles.datePicker} />
          </div>
          <button
            type="button"
            className={styles.applyButton}
            onClick={applyCustomDate}
            disabled={!customStart || !customEnd}
          >
            <Check size={17} aria-hidden="true" />
            اعمال بازه
          </button>
        </div>
      )}
    </section>
  );
}