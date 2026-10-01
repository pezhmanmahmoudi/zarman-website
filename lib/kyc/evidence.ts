import type { AustracIdType } from "@/lib/compliance/austrac-id-types";

// Reporting codes are not a list of acceptable standalone identity documents.
// These customer choices map to the same codes used by the admin reviewer.
export const KYC_ID_DOCUMENTS: readonly {
  value: string; label: string; reportType: AustracIdType;
  profileType: "driver_license" | "passport" | "none"; back: boolean; address: boolean;
}[] = [
  { value: "driver_license", label: "Australian driver's licence", reportType: "Driver's licence", profileType: "driver_license", back: true, address: false },
  { value: "passport", label: "Australian passport", reportType: "Passport", profileType: "passport", back: false, address: false },
  { value: "foreign_passport", label: "Foreign passport", reportType: "Passport", profileType: "none", back: false, address: false },
  { value: "photo_id", label: "Australian government photo ID card", reportType: "Photo ID", profileType: "none", back: true, address: true },
  { value: "proof_of_age", label: "Australian proof of age card", reportType: "Photo ID", profileType: "none", back: true, address: true },
  { value: "national_id", label: "Government-issued national identity card", reportType: "Identity card/number", profileType: "none", back: true, address: true },
  { value: "birth_certificate", label: "Birth certificate", reportType: "Birth certificate", profileType: "none", back: false, address: true },
  { value: "citizenship_certificate", label: "Citizenship certificate", reportType: "Other (provide description)", profileType: "none", back: false, address: true },
  { value: "concession_card", label: "Government-issued concession / benefits card", reportType: "Benefits card/ID", profileType: "none", back: true, address: true },
];

// Zarman intake policy, not a claim of universal statutory document-age limits.
export const KYC_ADDRESS_DOCUMENTS = [
  { value: "bank_statement", label: "Bank statement", reportType: "Bank account", maxAgeDays: 90 },
  { value: "utility_bill", label: "Utility bill (electricity, gas or water)", reportType: "Other (provide description)", maxAgeDays: 90 },
  { value: "council_rates", label: "Council rates notice", reportType: "Other (provide description)", maxAgeDays: 365 },
  { value: "government_notice", label: "Government-issued address notice", reportType: "Other (provide description)", maxAgeDays: 365 },
] as const;

export const KYC_MAX_FILE_BYTES = 4 * 1024 * 1024; // Under the 5MB server-action envelope.
export const KYC_FILE_ACCEPT = "image/jpeg,image/png,application/pdf";
export type KycUploadRole = "front" | "back" | "address";
export type KycUploadedFile = { id: string; name: string };
export type KycEvidenceDraft = {
  front?: KycUploadedFile; back?: KycUploadedFile; address?: KycUploadedFile;
  addressType: string; addressDate: string; documentNumber: string; documentIssuer: string;
};
export const emptyKycEvidence = (): KycEvidenceDraft => ({ addressType: "", addressDate: "", documentNumber: "", documentIssuer: "" });
export const kycDocument = (type: string) => KYC_ID_DOCUMENTS.find(doc => doc.value === type);
export function requiredKycUploads(type: string): KycUploadRole[] {
  const doc = kycDocument(type);
  return doc ? ["front", ...(doc.back ? ["back" as const] : []), ...(doc.address ? ["address" as const] : [])] : [];
}
export function validIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function kycToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function validateKycEvidence(type: string, evidence: KycEvidenceDraft | undefined, now = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  const doc = kycDocument(type);
  if (!doc) return { docType: "Choose an identity document. Contact support if you cannot provide a listed document." };
  const data = evidence ?? emptyKycEvidence();
  for (const role of requiredKycUploads(type)) {
    if (!data[role]?.id) errors[`evidence-${role}`] = `Upload ${role === "front" ? "the identity document" : role === "back" ? "the back of your identity document" : "your proof of residential address"}.`;
  }
  if (doc.profileType === "none") {
    if (!data.documentNumber?.trim()) errors.documentNumber = "Enter the document number or registration number.";
    if (!data.documentIssuer?.trim()) errors.documentIssuer = "Enter the issuing country and authority.";
  }
  if (doc.address) {
    const address = KYC_ADDRESS_DOCUMENTS.find(item => item.value === data.addressType);
    if (!address) errors.addressType = "Choose a proof of address document.";
    const today = Date.parse(kycToday(now));
    const age = (today - Date.parse(data.addressDate)) / 86400000;
    if (!validIsoDate(data.addressDate) || age < 0 || (address && age > address.maxAgeDays)) {
      errors.addressDate = address ? `Use a document issued within the last ${address.maxAgeDays} days, not a future date.` : "Enter the document issue date.";
    }
  }
  return errors;
}

export function validateKycFile(file: { size: number; type: string }): string | null {
  if (!file.size || file.size > KYC_MAX_FILE_BYTES) return "Choose a non-empty file up to 4 MB.";
  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) return "Use a JPG, PNG or PDF file.";
  return null;
}

// Check content as well as the untrusted extension and browser MIME type.
export function matchesKycFileSignature(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  if (type === "application/pdf") return [37,80,68,70,45].every((v,i) => bytes[i] === v);
  return false;
}
