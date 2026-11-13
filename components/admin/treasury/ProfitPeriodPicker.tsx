"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { profitPeriodHref } from "@/lib/treasury-navigation";
import s from "@/styles/admin/ProfitStatement.module.css";

type Month = { value: string; label: string };

/**
 * Whole-history / monthly switch with previous-next stepping and a month list.
 * `months` is newest first, as the statement provides it.
 */
export default function ProfitPeriodPicker({ period, months, from, to }: {
  period: string; months: Month[]; from: string | null; to: string;
}) {
  const router = useRouter();
  const isAll = period === "all";
  const latest = months[0]?.value;
  const index = months.findIndex(month => month.value === period);
  const older = index >= 0 ? months[index + 1] : undefined;
  const newer = index > 0 ? months[index - 1] : undefined;

  const step = (target: Month | undefined, label: string, icon: React.ReactNode) => target
    ? <Link href={profitPeriodHref(target.value)} prefetch={false} className={s.stepButton} aria-label={`${label}: ${target.label}`} title={target.label}>{icon}</Link>
    : <span className={s.stepButton} aria-disabled="true" aria-label={label}>{icon}</span>;

  return (
    <nav className={s.periodBar} aria-label="دوره صورت سود">
      <div className={s.segmented} role="group" aria-label="نوع دوره">
        <Link href={profitPeriodHref("all")} prefetch={false} aria-current={isAll ? "page" : undefined}
          className={`${s.segment} ${isAll ? s.segmentActive : ""}`}>کل دوره</Link>
        {latest && (
          <Link href={profitPeriodHref(isAll ? latest : period)} prefetch={false} aria-current={!isAll ? "page" : undefined}
            className={`${s.segment} ${!isAll ? s.segmentActive : ""}`}>ماهانه</Link>
        )}
      </div>

      {!isAll && (
        <div className={s.monthStepper}>
          {/* RTL: the older month sits on the right, the newer on the left. */}
          {step(older, "ماه قبل", <ChevronRight size={16} aria-hidden="true" />)}
          <SelectBox
            className={s.monthSelect}
            ariaLabel="انتخاب ماه"
            value={period}
            labeledOptions={months}
            onChange={value => router.push(profitPeriodHref(value))}
          />
          {step(newer, "ماه بعد", <ChevronLeft size={16} aria-hidden="true" />)}
        </div>
      )}

      <span className={s.periodRange} dir="ltr">
        {isAll ? (months.length ? `${months.at(-1)!.value} → ${months[0].value}` : "") : `${from} → ${to}`}
      </span>
    </nav>
  );
}
