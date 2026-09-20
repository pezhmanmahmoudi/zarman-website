import type { Recipient } from "@/app/[locale]/dashboard/dashboard.types";
type RecipientInput = Omit<Recipient, "id" | "user_id" | "created_at">;
const fields = ["direction","label","bank_name","bank_city","bsb","account_number","account_name","residential_address","residential_city","residential_state","residential_postcode","residential_country","recipient_email","recipient_phone","bank_type","card_number","shaba_number","irt_account_number","full_name","irt_address","irt_city","irt_state","irt_postcode","irt_country","irt_phone"] as const;

/** Allow only editable fields. Ownership and identifiers always come from the server. */
export function normalizeRecipientInput(input: unknown): {data:RecipientInput;error?:never} | {error:string;data?:never} {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {error:"Invalid recipient details."};
  const source = input as Record<string,unknown>, data:Record<string,string|null> = {};
  if (source.direction !== "aud" && source.direction !== "irt") return {error:"Invalid recipient direction."};
  if (typeof source.label !== "string" || !source.label.trim()) return {error:"A recipient name is required."};
  for (const key of fields) {
    const value = source[key];
    if (value === undefined) continue;
    if (value === null) {data[key] = null;continue;}
    if (typeof value !== "string") return {error:"Invalid recipient details."};
    const limit = key === "bank_city" ? 120 : key.includes("address") ? 500 : 250;
    if (value.trim().length > limit) return {error:key === "bank_city" ? "Bank branch city must be 120 characters or fewer." : "A recipient field is too long."};
    data[key] = value.trim();
  }
  if (source.direction === "aud") delete data.bank_city;
  else if ("bank_city" in data) data.bank_city = data.bank_city || null;
  return {data:data as RecipientInput};
}
