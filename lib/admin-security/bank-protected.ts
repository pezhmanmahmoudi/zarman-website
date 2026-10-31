import type { FundingBankDetails, RequestSettings } from "@/lib/requests/types";

// Pure helpers shared by the server and the settings form (no secrets, no server-only imports).
/** Settings that tell customers where to send money. Changing any of them needs approval. */
export const BANK_PROTECTED_KEYS = [
  "payment_details_aud", "payment_details_irt",
  "payment_instructions_aud", "payment_instructions_irt",
  "payment_instructions_aud_fa", "payment_instructions_irt_fa",
] as const;
export type BankProtectedKey = typeof BANK_PROTECTED_KEYS[number];
export type BankProtectedValues = Partial<Pick<RequestSettings, BankProtectedKey>>;

/** The requesting admin may confirm their own change only after this hold; another admin can approve at once. */
export const BANK_CHANGE_HOLD_HOURS = 24;

export type BankChangeLine = { label: string; before: string[]; after: string[] };
export type PendingBankChangeView = {
  id: string;
  requestedByEmail: string;
  requestedAt: string;
  effectiveAfter: string;
  /** True for another admin, or for the requester once the hold has ended. */
  canApplyNow: boolean;
  isRequester: boolean;
  changes: BankChangeLine[];
};

const LABELS: Record<BankProtectedKey, string> = {
  payment_details_aud: "AUD account",
  payment_details_irt: "Toman account",
  payment_instructions_aud: "AUD notes (English)",
  payment_instructions_irt: "Toman notes (English)",
  payment_instructions_aud_fa: "AUD notes (Persian)",
  payment_instructions_irt_fa: "Toman notes (Persian)",
};

const isDetails = (key: BankProtectedKey) => key.startsWith("payment_details");
const normalize = (key: BankProtectedKey, value: unknown): unknown => {
  if (isDetails(key)) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    // Empty strings and missing fields mean the same thing.
    return Object.fromEntries(Object.entries(source).filter(([, field]) => typeof field === "string" && field.trim() !== "").sort(([a], [b]) => a.localeCompare(b)));
  }
  return typeof value === "string" ? value.trim() : "";
};

export function pickProtected(settings: Partial<RequestSettings>): BankProtectedValues {
  const picked: Record<string, unknown> = {};
  for (const key of BANK_PROTECTED_KEYS) picked[key] = normalize(key, settings[key]);
  return picked as BankProtectedValues;
}

export function changedProtectedKeys(current: Partial<RequestSettings>, next: Partial<RequestSettings>): BankProtectedKey[] {
  return BANK_PROTECTED_KEYS.filter(key => JSON.stringify(normalize(key, current[key])) !== JSON.stringify(normalize(key, next[key])));
}

const mask = (value: string, keep = 4) => value.length <= keep ? value : `${"•".repeat(Math.min(value.length - keep, 8))}${value.slice(-keep)}`;

/** Human-readable, partly masked: enough for an admin to recognise a wrong account, without re-publishing full numbers. */
export function describeValue(key: BankProtectedKey, value: unknown): string[] {
  const normalized = normalize(key, value);
  if (!isDetails(key)) return [String(normalized || "(empty)")];
  const details = normalized as FundingBankDetails;
  const lines = [
    details.account_name && `Name: ${details.account_name}`,
    details.bank_name && `Bank: ${details.bank_name}`,
    details.bsb && `BSB: ${details.bsb}`,
    details.account_number && `Account: ${mask(details.account_number)}`,
    details.iban && `IBAN: ${mask(details.iban)}`,
    details.card_number && `Card: ${mask(details.card_number)}`,
  ].filter(Boolean) as string[];
  return lines.length ? lines : ["(empty)"];
}

export function buildChangeLines(previous: BankProtectedValues, next: BankProtectedValues): BankChangeLine[] {
  return BANK_PROTECTED_KEYS
    .filter(key => JSON.stringify(normalize(key, previous[key])) !== JSON.stringify(normalize(key, next[key])))
    .map(key => ({ label: LABELS[key], before: describeValue(key, previous[key]), after: describeValue(key, next[key]) }));
}
