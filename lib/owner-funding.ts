import type { OwnerLoanRowInput } from "@/lib/accounting-engine";

export type OwnerFundingPayload = {
  date: string;
  currency: "AUD" | "IRT";
  amount: number;
  exchange_rate?: number | null;
  account_id: string;
  loan_type: "injection" | "repayment";
  funding_type?: "loan" | "equity";
  repayment_status: "open" | "partially_repaid" | "repaid";
  cash_effect?: boolean;
  settlement_currency?: "AUD" | "IRT" | null;
  settlement_amount?: number | null;
  linked_ledger_id?: string | null;
  notes?: string;
};

export function ownerFundingInput(row: Record<string, unknown>): OwnerLoanRowInput {
  return {
    id: String(row.id),
    currency: row.currency as "AUD" | "IRT",
    amount: Number(row.amount),
    exchange_rate: row.exchange_rate != null ? Number(row.exchange_rate) : null,
    loan_type: row.loan_type as "injection" | "repayment",
    funding_type: row.funding_type === "equity" ? "equity" : "loan",
    cash_effect: row.cash_effect !== false,
    settlement_currency: row.settlement_currency as "AUD" | "IRT" | null,
    settlement_amount: row.settlement_amount != null ? Number(row.settlement_amount) : null,
    account_id: (row.account_id ?? row.account) as string | null,
    date: String(row.date),
    created_at: row.created_at == null ? undefined : String(row.created_at),
  };
}

export function validateOwnerFunding(payload: OwnerFundingPayload): string | null {
  if (payload.cash_effect != null && typeof payload.cash_effect !== "boolean") return "وضعیت گردش نقدی نامعتبر است.";
  if (payload.linked_ledger_id && payload.cash_effect !== false) return "ثبت متصل به سند قبلی نباید دوباره گردش نقدی ایجاد کند.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return "تاریخ معتبر الزامی است.";
  if (!payload.account_id) return "انتخاب حساب الزامی است.";
  if (!["AUD", "IRT"].includes(payload.currency)) return "ارز نامعتبر است.";
  if (!["injection", "repayment"].includes(payload.loan_type)) return "نوع گردش مالک نامعتبر است.";
  if (payload.funding_type != null && !["loan", "equity"].includes(payload.funding_type)) return "نوع تأمین مالی نامعتبر است.";
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) return "مبلغ باید عددی بزرگتر از صفر باشد.";
  if ((payload.currency === "AUD" || payload.funding_type === "equity") &&
    (!Number.isFinite(payload.exchange_rate) || Number(payload.exchange_rate) <= 0)) {
    return "نرخ تاریخی معتبر برای محاسبه آورده و سود الزامی است.";
  }
  const hasCurrency = payload.settlement_currency != null;
  const hasAmount = payload.settlement_amount != null;
  if (hasCurrency !== hasAmount || (hasCurrency &&
    (!["AUD", "IRT"].includes(payload.settlement_currency!) || !Number.isFinite(payload.settlement_amount) || Number(payload.settlement_amount) < 0))) {
    return "مبلغ و ارز تسویه باید با هم و به‌درستی مشخص شوند.";
  }
  return null;
}

/** Settlements linked to earlier cash evidence must not be silently reposted. */
export function isLinkedOwnerFunding(row: Record<string, unknown>): boolean {
  return row.cash_effect === false || row.linked_ledger_id != null || row.settlement_currency != null;
}

export function changesLinkedOwnerFunding(before: Record<string, unknown>, next: OwnerFundingPayload): boolean {
  if (!isLinkedOwnerFunding(before)) return false;
  return before.date !== next.date || before.currency !== next.currency ||
    Number(before.amount) !== next.amount || Number(before.exchange_rate ?? 0) !== Number(next.exchange_rate ?? 0) ||
    before.account_id !== next.account_id || before.loan_type !== next.loan_type ||
    (before.funding_type ?? "loan") !== (next.funding_type ?? before.funding_type ?? "loan") ||
    (next.cash_effect != null && before.cash_effect !== next.cash_effect) ||
    (next.settlement_currency !== undefined && before.settlement_currency !== next.settlement_currency) ||
    (next.settlement_amount !== undefined && Number(before.settlement_amount) !== Number(next.settlement_amount)) ||
    (next.linked_ledger_id !== undefined && before.linked_ledger_id !== next.linked_ledger_id);
}

/** Ordinary edits preserve the cash evidence and settlement method. */
export function changesOwnerFundingSettlement(before: Record<string, unknown>, next: OwnerFundingPayload): boolean {
  return (next.cash_effect !== undefined && (before.cash_effect !== false) !== next.cash_effect) ||
    (next.settlement_currency !== undefined && (before.settlement_currency ?? null) !== next.settlement_currency) ||
    (next.settlement_amount !== undefined && (before.settlement_amount == null ? null : Number(before.settlement_amount)) !== next.settlement_amount) ||
    (next.linked_ledger_id !== undefined && (before.linked_ledger_id ?? null) !== next.linked_ledger_id);
}
