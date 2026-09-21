import type { Recipient, RecipientRelationship } from "@/app/[locale]/dashboard/dashboard.types";

type RecipientInput = Omit<Recipient, "id" | "user_id" | "created_at">;

export type RecipientFieldErrors = Record<string, string>;
export type RecipientInputResult =
  | { data: RecipientInput; error?: never; fieldErrors?: never }
  | { error: string; fieldErrors: RecipientFieldErrors; data?: never };

const relationships: readonly RecipientRelationship[] = ["self", "family", "friend", "business", "other"];
const commonFields = ["direction", "label", "bank_name", "relationship"] as const;
const audFields = [
  ...commonFields,
  "bsb",
  "account_number",
  "account_name",
  "residential_address",
  "residential_city",
  "residential_state",
  "residential_postcode",
  "residential_country",
  "recipient_email",
  "recipient_phone",
] as const;
const irtFields = [
  ...commonFields,
  "bank_city",
  "bank_type",
  "card_number",
  "shaba_number",
  "full_name",
  "irt_address",
  "irt_city",
  "irt_state",
  "irt_postcode",
  "irt_country",
  "irt_phone",
] as const;

const audRequired = [
  "label",
  "bank_name",
  "account_name",
  "bsb",
  "account_number",
  "residential_address",
  "residential_city",
  "residential_state",
  "residential_postcode",
  "residential_country",
  "recipient_email",
  "recipient_phone",
] as const;
const irtRequired = [
  "label",
  "bank_name",
  "full_name",
  "shaba_number",
  "irt_address",
  "irt_city",
  "irt_state",
  "irt_country",
  "irt_phone",
] as const;

function isPresent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Keep identifiers as strings so translated numerals never lose leading zeroes. */
export function normalizeRecipientDigits(value: string): string {
  return value.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, digit =>
    String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660)),
  );
}

export function isValidIranianShaba(value: string): boolean {
  const normalized = normalizeRecipientDigits(value).replace(/\s+/g, "").toUpperCase();
  if (!/^IR\d{24}$/.test(normalized)) return false;
  const rearranged = `${normalized.slice(4)}1827${normalized.slice(2, 4)}`;
  let remainder = 0;
  for (const digit of rearranged) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

/** Allow only editable fields. Ownership and identifiers always come from the server. */
export function normalizeRecipientInput(input: unknown): RecipientInputResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Invalid recipient details.", fieldErrors: {} };
  const source = input as Record<string, unknown>;
  const data: Record<string, string | null> = {};
  const fieldErrors: RecipientFieldErrors = {};
  let error = "";
  const fail = (field: string, message: string, summary = message) => {
    if (!fieldErrors[field]) fieldErrors[field] = message;
    if (!error) error = summary;
  };
  if (source.direction !== "aud" && source.direction !== "irt") {
    return { error: "Invalid recipient direction.", fieldErrors: { direction: "Invalid recipient direction." } };
  }

  const fields = source.direction === "aud" ? audFields : irtFields;
  for (const key of fields) {
    const value = source[key];
    if (value === undefined) continue;
    if (value === null) {
      data[key] = null;
      continue;
    }
    if (typeof value !== "string") {
      fail(key, "Invalid recipient details.");
      continue;
    }
    const limit = key === "bank_city" ? 120 : key.includes("address") ? 500 : 250;
    if (value.trim().length > limit) {
      fail(key, key === "bank_city" ? "Bank branch city must be 120 characters or fewer." : "A recipient field is too long.");
      continue;
    }
    data[key] = value.trim();
  }

  data.direction = source.direction;
  const required = source.direction === "aud" ? audRequired : irtRequired;
  for (const key of required) {
    if (!isPresent(data[key])) fail(key, "This field is required.", "Complete all required recipient details.");
  }

  if ("relationship" in data && !isPresent(data.relationship)) data.relationship = null;
  if (isPresent(data.relationship) && !relationships.includes(data.relationship as RecipientRelationship)) {
    fail("relationship", "Choose a valid recipient relationship.");
  }

  // Whitespace in pasted account identifiers is formatting, not part of the identifier.
  // Other punctuation remains invalid; the UI may explicitly format BSB input.
  for (const key of ["bsb", "account_number", "card_number", "shaba_number", "residential_postcode", "irt_postcode"] as const) {
    if (typeof data[key] === "string") data[key] = normalizeRecipientDigits(data[key]).replace(/\s+/g, "");
  }
  for (const key of ["recipient_phone", "irt_phone"] as const) {
    if (typeof data[key] === "string") data[key] = normalizeRecipientDigits(data[key]);
  }
  const validate = (key: string, pattern: RegExp, message: string) => {
    if (isPresent(data[key]) && !pattern.test(data[key])) fail(key, message);
  };

  if (source.direction === "aud") {
    validate("bsb", /^\d{6}$/, "BSB must contain exactly 6 digits.");
    validate("account_number", /^\d{5,12}$/, "Account number must contain 5 to 12 digits.");
    validate("residential_postcode", /^\d{4}$/, "Australian postcode must contain exactly 4 digits.");
    validate("recipient_email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid recipient email address.");
    validate("recipient_phone", /^\+?[0-9 ()-]{7,25}$/, "Enter a valid recipient phone number.");
  } else {
    if (typeof data.shaba_number === "string") data.shaba_number = data.shaba_number.toUpperCase();
    validate("shaba_number", /^IR\d{24}$/, "Shaba number must start with IR followed by 24 digits.");
    if (isPresent(data.shaba_number) && !isValidIranianShaba(data.shaba_number)) fail("shaba_number", "Enter a valid Iranian Shaba number.");
    validate("card_number", /^\d{16}$/, "Card number must contain exactly 16 digits.");
    if ("card_number" in data && !isPresent(data.card_number)) data.card_number = null;
    if ("bank_city" in data && !isPresent(data.bank_city)) data.bank_city = null;
    if (isPresent(data.bank_type) && data.bank_type !== "bank_melli" && data.bank_type !== "other") fail("bank_type", "Invalid bank type.");
    validate("irt_phone", /^\+?[0-9 ()-]{7,25}$/, "Enter a valid recipient phone number.");
  }

  if (error) return { error, fieldErrors };
  return { data: data as RecipientInput };
}
