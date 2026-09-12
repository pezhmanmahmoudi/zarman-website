export type BankFeeAccountReview = {
  accountId: string;
  accountName: string;
  estimatedTotalToman: number;
  pendingTotalToman: number;
  pendingCount: number;
  postedTotalToman: number | null;
  postingVersion: number;
  pendingFingerprint: string;
  expenseId: string | null;
  notes: string | null;
  otherPaidFeesToman: number;
};

export type BankFeeMonthReview = {
  feeMonth: string;
  accounts: BankFeeAccountReview[];
};

export type BankFeePostEntry = {
  accountId: string;
  actualAmountToman: number;
  notes: string;
  expectedVersion: number;
  expectedPendingFingerprint: string;
};

export type BankFeePostInput = {
  feeMonth: string;
  entries: BankFeePostEntry[];
};

// Keep JSON amounts exact to two decimal places within JavaScript's safe range.
export const MAX_BANK_FEE_TOMAN = Math.floor(Number.MAX_SAFE_INTEGER / 100);

export function currentBankFeeMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function defaultBankFeeMonth(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString().slice(0, 7);
}

export function isBankFeeMonth(value: unknown): value is string {
  return typeof value === "string" && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isBankFeeAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    && value <= MAX_BANK_FEE_TOMAN && Math.round(value * 100) / 100 === value;
}

/** Accept copied Persian/Arabic digits and either decimal separator. */
export function parseBankFeeAmount(value: string): number | null {
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u200e\u200f,٬\s]/g, "")
    .replace(/٫/g, ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return isBankFeeAmount(amount) ? amount : null;
}

export function bankFeePostInputError(input: unknown, now = new Date()): string | null {
  if (!input || typeof input !== "object") return "اطلاعات ثبت کارمزد نامعتبر است.";
  const payload = input as Partial<BankFeePostInput>;
  if (!isBankFeeMonth(payload.feeMonth)) return "ماه میلادی معتبر انتخاب کنید.";
  if (payload.feeMonth > currentBankFeeMonth(now)) return "ثبت کارمزد برای ماه آینده مجاز نیست.";
  if (!Array.isArray(payload.entries) || payload.entries.length === 0 || payload.entries.length > 100) {
    return "حداقل یک حساب و حداکثر ۱۰۰ حساب انتخاب کنید.";
  }
  const seen = new Set<string>();
  for (const entry of payload.entries) {
    if (!entry || typeof entry !== "object"
      || typeof entry.accountId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.accountId)) {
      return "شناسه حساب نامعتبر است.";
    }
    const key = entry.accountId.toLowerCase();
    if (seen.has(key)) return "هر حساب را فقط یک بار انتخاب کنید.";
    seen.add(key);
    if (!isBankFeeAmount(entry.actualAmountToman)) {
      return "مبلغ کارمزد باید صفر یا بیشتر و حداکثر دارای دو رقم اعشار باشد.";
    }
    if (typeof entry.notes !== "string" || entry.notes.length > 2000) {
      return "توضیحات نباید بیشتر از ۲۰۰۰ نویسه باشد.";
    }
    if (!Number.isSafeInteger(entry.expectedVersion) || entry.expectedVersion < 0
      || typeof entry.expectedPendingFingerprint !== "string"
      || !/^[0-9a-f]{32}$/i.test(entry.expectedPendingFingerprint)) {
      return "اطلاعات حساب قدیمی یا نامعتبر است؛ فهرست کارمزدها را تازه‌سازی کنید.";
    }
  }
  return null;
}
