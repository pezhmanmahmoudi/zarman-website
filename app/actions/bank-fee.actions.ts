"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/actions/admin.actions";
import {
  bankFeePostInputError,
  currentBankFeeMonth,
  isBankFeeMonth,
  type BankFeeAccountReview,
  type BankFeeMonthReview,
  type BankFeePostInput,
} from "@/lib/bank-fee-posting";

function database() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type DatabaseError = { code?: string; message?: string };

function feeError(error: DatabaseError): { error: string; code?: string } {
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(error.code ?? "")) {
    return {
      error: "برای فعال شدن ثبت و ویرایش کارمزدها، به‌روزرسانی پایگاه داده کارمزد بانکی باید اجرا شود.",
      code: "setup_required",
    };
  }
  if (error.code === "40001" || error.message?.includes("BANK_FEE_REVIEW_CHANGED")) {
    return { error: "اطلاعات این ماه تغییر کرده است. فهرست را تازه‌سازی و مبلغ را دوباره بررسی کنید.", code: "stale_review" };
  }
  if (error.message?.includes("BANK_FEE_LEGACY_POSTING")) {
    return { error: "ثبت‌های قبلی این ماه به بررسی نیاز دارند؛ برای جلوگیری از کسر دوباره، ثبت جدید انجام نشد." };
  }
  if (error.message?.includes("BANK_FEE_MANAGED_EXPENSE")) {
    return { error: "این هزینه به کارمزد ماهانه متصل است؛ آن را از بخش کارمزد انتقال‌های بانکی ویرایش کنید." };
  }
  console.error("Monthly bank fee request failed", { code: error.code, message: error.message });
  return { error: "ثبت یا دریافت کارمزدها انجام نشد. دوباره تلاش کنید؛ در صورت ادامه خطا، تنظیمات پایگاه داده را بررسی کنید." };
}

type ReviewAccountResult = {
  account_id: string;
  account_name: string;
  estimated_total_toman: number | string;
  pending_total_toman: number | string;
  pending_count: number;
  posted_total_toman: number | string | null;
  posting_version: number;
  pending_fingerprint: string;
  expense_id: string | null;
  notes: string | null;
  other_paid_fees_toman: number | string;
};

export async function getMonthlyBankFeeReview(feeMonth: string): Promise<
  { data: BankFeeMonthReview } | { error: string; code?: string }
> {
  await requireAdmin();
  if (!isBankFeeMonth(feeMonth) || feeMonth > currentBankFeeMonth()) {
    return { error: "یک ماه میلادی معتبر تا ماه جاری انتخاب کنید." };
  }
  const { data, error } = await database().rpc("get_monthly_bank_fee_review", { p_fee_month: `${feeMonth}-01` });
  if (error) return feeError(error);
  if (!data || !Array.isArray(data.accounts)) return { error: "پاسخ کارمزدهای بانکی نامعتبر است." };
  const accounts: BankFeeAccountReview[] = (data.accounts as ReviewAccountResult[]).map((row) => ({
    accountId: row.account_id,
    accountName: row.account_name,
    estimatedTotalToman: Number(row.estimated_total_toman ?? 0),
    pendingTotalToman: Number(row.pending_total_toman ?? 0),
    pendingCount: Number(row.pending_count ?? 0),
    postedTotalToman: row.posted_total_toman == null ? null : Number(row.posted_total_toman),
    postingVersion: Number(row.posting_version ?? 0),
    pendingFingerprint: row.pending_fingerprint,
    expenseId: row.expense_id,
    notes: row.notes,
    otherPaidFeesToman: Number(row.other_paid_fees_toman ?? 0),
  }));
  return { data: { feeMonth, accounts } };
}

export async function postMonthlyBankFeeReview(payload: BankFeePostInput): Promise<
  { success: true; posted: number } | { error: string; code?: string }
> {
  const admin = await requireAdmin();
  const validationError = bankFeePostInputError(payload);
  if (validationError) return { error: validationError };
  const { data, error } = await database().rpc("post_monthly_bank_fee_review", {
    p_fee_month: `${payload.feeMonth}-01`,
    p_entries: payload.entries.map((entry) => ({
      account_id: entry.accountId,
      actual_amount_toman: entry.actualAmountToman,
      notes: entry.notes.trim(),
      expected_version: entry.expectedVersion,
      expected_pending_fingerprint: entry.expectedPendingFingerprint,
    })),
    p_actor_id: admin.id,
    p_actor_email: admin.email ?? "",
  });
  if (error) return feeError(error);

  // The RPC commits the expense, consumed accruals and audit together.
  revalidatePath("/admin/treasury");
  revalidatePath("/admin/ledger");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/reports/accounts");
  return { success: true, posted: Number(data?.posted_count ?? 0) };
}
