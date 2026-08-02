"use client";

import React, { useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Check, Search } from "lucide-react";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import styles from "@/styles/admin/LedgerToolbar.module.css";

interface LedgerToolbarProps {
  currentParams: Record<string, string | undefined>;
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

export default function LedgerToolbar({ currentParams }: LedgerToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();

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

  return (
    <section className={styles.toolbar} dir="rtl" aria-label="فیلترهای دفتر کل">
      <div className={styles.control}>
        <span className={styles.controlLabel}>نوع تراکنش</span>
        <SelectBox
          labeledOptions={transactionOptions}
          value={currentParams.type || "all"}
          onChange={(value) => router.push(pathname + "?" + createQueryString({ type: value === "all" ? null : value }))}
          className={styles.selectTrigger}
          dir="rtl"
        />
      </div>

      <div className={styles.control}>
        <span className={styles.controlLabel}>بازه زمانی</span>
        <SelectBox
          labeledOptions={rangeOptions}
          value={currentParams.range || "all"}
          onChange={(value) => {
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