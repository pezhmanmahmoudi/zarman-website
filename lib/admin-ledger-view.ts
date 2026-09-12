import type { AdminLedgerFilters } from "@/app/actions/admin.actions";

export type LedgerSearchParams = Record<string, string | undefined>;

export function ledgerViewHref(params: LedgerSearchParams, view: "entries" | "insights") {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  if (view === "entries") query.delete("view");
  else query.set("view", view);
  return `/admin/ledger${query.size ? `?${query}` : ""}`;
}

/** Resolve one effective date range for the table, insights and CSV export. */
export function ledgerFiltersForView(params: LedgerSearchParams, now = new Date()): AdminLedgerFilters {
  const dateParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => dateParts.find(item => item.type === type)!.value;
  const year = Number(part("year"));
  const month = Number(part("month"));
  let start = params.start;
  let end = params.end;
  if (params.range === "today") {
    start = `${year}-${part("month")}-${part("day")}`;
    end = start;
  } else if (params.range === "this-month" || params.range === "last-month") {
    const first = new Date(Date.UTC(year, month - (params.range === "last-month" ? 2 : 1), 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    start = first.toISOString().slice(0, 10);
    end = last.toISOString().slice(0, 10);
  } else if (params.range === "this-year") {
    start = `${year}-01-01`;
    end = `${year}-12-31`;
  } else if (params.range === "all") {
    start = undefined;
    end = undefined;
  }
  return { start, end, type: params.type, search: params.search, account: params.account };
}
