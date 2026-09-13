// lib/compliance/austrac-id-types.ts
// The official AUSTRAC "ID type" enumeration used on IFTI/IFTI-DRA reports
// (the same fixed list shown in AUSTRAC's own online reporting form). Any
// identity/verification document recorded for a customer must use one of
// these exact values, or AUSTRAC's report validation will reject the row.

export const AUSTRAC_ID_TYPES = [
  "Alien registration number",
  "Bank account",
  "Benefits card/ID",
  "Birth certificate",
  "Business registration/licence",
  "Credit/debit card",
  "Customer account/ID",
  "Driver's licence",
  "Employee ID",
  "Employer number",
  "Identity card/number",
  "Membership ID",
  "Passport",
  "Photo ID",
  "Security ID",
  "Social security ID",
  "Student ID",
  "Tax number/ID (except Australian tax file numbers (TFN))",
  "Telephone/fax number",
  "Other (provide description)",
] as const;

export type AustracIdType = typeof AUSTRAC_ID_TYPES[number];

export const AUSTRAC_ID_TYPE_OTHER: AustracIdType = "Other (provide description)";

export function isAustracIdType(value: unknown): value is AustracIdType {
  return typeof value === "string" && (AUSTRAC_ID_TYPES as readonly string[]).includes(value);
}
