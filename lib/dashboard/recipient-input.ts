import type { Recipient } from "@/app/[locale]/dashboard/dashboard.types";

type RecipientInput = Omit<Recipient, "id" | "user_id" | "created_at">;

const commonFields = ["direction", "label", "bank_name"] as const;
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

/** Allow only editable fields. Ownership and identifiers always come from the server. */
export function normalizeRecipientInput(input: unknown): { data: RecipientInput; error?: never } | { error: string; data?: never } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Invalid recipient details." };
  const source = input as Record<string, unknown>;
  const data: Record<string, string | null> = {};
  if (source.direction !== "aud" && source.direction !== "irt") return { error: "Invalid recipient direction." };

  const fields = source.direction === "aud" ? audFields : irtFields;
  for (const key of fields) {
    const value = source[key];
    if (value === undefined) continue;
    if (value === null) {
      data[key] = null;
      continue;
    }
    if (typeof value !== "string") return { error: "Invalid recipient details." };
    const limit = key === "bank_city" ? 120 : key.includes("address") ? 500 : 250;
    if (value.trim().length > limit) {
      return { error: key === "bank_city" ? "Bank branch city must be 120 characters or fewer." : "A recipient field is too long." };
    }
    data[key] = value.trim();
  }

  data.direction = source.direction;
  const required = source.direction === "aud" ? audRequired : irtRequired;
  if (required.some((key) => !isPresent(data[key]))) return { error: "Complete all required recipient details." };

  if (source.direction === "aud") {
    if (!/^\d{6}$/.test(data.bsb!)) return { error: "BSB must contain exactly 6 digits." };
    if (!/^\d{5,12}$/.test(data.account_number!)) return { error: "Account number must contain 5 to 12 digits." };
    if (!/^\d{4}$/.test(data.residential_postcode!)) return { error: "Australian postcode must contain exactly 4 digits." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.recipient_email!)) return { error: "Enter a valid recipient email address." };
    if (!/^\+?[0-9 ()-]{7,25}$/.test(data.recipient_phone!)) return { error: "Enter a valid recipient phone number." };
  } else {
    data.shaba_number = data.shaba_number!.toUpperCase();
    if (!/^IR\d{24}$/.test(data.shaba_number)) return { error: "Shaba number must start with IR followed by 24 digits." };
    if (isPresent(data.card_number) && !/^\d{16}$/.test(data.card_number)) return { error: "Card number must contain exactly 16 digits." };
    if ("card_number" in data && !isPresent(data.card_number)) data.card_number = null;
    if ("bank_city" in data && !isPresent(data.bank_city)) data.bank_city = null;
    if (isPresent(data.bank_type) && data.bank_type !== "bank_melli" && data.bank_type !== "other") return { error: "Invalid bank type." };
    if (!/^\+?[0-9 ()-]{7,25}$/.test(data.irt_phone!)) return { error: "Enter a valid recipient phone number." };
  }

  return { data: data as RecipientInput };
}
