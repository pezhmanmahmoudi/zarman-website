import type { AustracIdType } from "@/lib/compliance/austrac-id-types";

// Reporting codes are not a list of acceptable standalone identity documents.
// These customer choices map to the same codes used by the admin reviewer.
export const KYC_ID_DOCUMENTS: readonly {
  value: string; label: string; reportType: AustracIdType;
  profileType: "driver_license" | "passport" | "none"; textOnly: boolean; back: boolean; address: boolean;
}[] = [
  { value: "driver_license", label: "Australian driver's licence", reportType: "Driver's licence", profileType: "driver_license", textOnly: true, back: false, address: false },
  { value: "passport", label: "Australian passport", reportType: "Passport", profileType: "passport", textOnly: true, back: false, address: false },
  { value: "medicare", label: "Medicare card", reportType: "Benefits card/ID", profileType: "none", textOnly: true, back: false, address: false },
  { value: "foreign_passport", label: "Foreign passport", reportType: "Passport", profileType: "none", textOnly: false, back: false, address: false },
  { value: "photo_id", label: "Australian state or territory photo ID card", reportType: "Photo ID", profileType: "none", textOnly: false, back: true, address: true },
  { value: "proof_of_age", label: "Australian proof of age card", reportType: "Photo ID", profileType: "none", textOnly: false, back: true, address: true },
  { value: "national_id", label: "Government-issued national identity card", reportType: "Identity card/number", profileType: "none", textOnly: false, back: true, address: true },
  { value: "birth_certificate", label: "Birth certificate", reportType: "Birth certificate", profileType: "none", textOnly: false, back: false, address: true },
  { value: "citizenship_certificate", label: "Citizenship certificate", reportType: "Other (provide description)", profileType: "none", textOnly: false, back: false, address: true },
  { value: "concession_card", label: "Government-issued concession / benefits card", reportType: "Benefits card/ID", profileType: "none", textOnly: false, back: true, address: true },
  { value: "certified_copy", label: "Certified copies — alternative identity verification", reportType: "Other (provide description)", profileType: "none", textOnly: false, back: false, address: true },
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
export type KycUploadRole = "front" | "back" | "address" | "source_of_funds";
export type KycUploadedFile = { id: string; name: string };
export type KycEvidenceDraft = {
  front?: KycUploadedFile; back?: KycUploadedFile; address?: KycUploadedFile; source_of_funds?: KycUploadedFile;
  addressType: string; addressDate: string; documentNumber: string; documentIssuer: string;
  medicareIRN?: string; medicareColour?: string; medicareExpiry?: string;
};
export const emptyKycEvidence = (): KycEvidenceDraft => ({ addressType: "", addressDate: "", documentNumber: "", documentIssuer: "" });
// Zarman requires an Iranian passport for customers whose residence is Iran.
export const isIranCountry = (country: unknown): boolean => typeof country === "string" && ["iran", "ir", "irn", "ایران", "iran (islamic republic of)"].includes(country.trim().toLowerCase());
export const kycDocument = (type: string) => KYC_ID_DOCUMENTS.find(doc => doc.value === type);
export function requiredKycUploads(type: string): KycUploadRole[] {
  const doc = kycDocument(type);
  return doc ? [...(doc.textOnly ? [] : ["front" as const]), ...(doc.back ? ["back" as const] : []), ...(doc.address ? ["address" as const] : [])] : [];
}
export function allowedKycUploads(type: string): KycUploadRole[] {
  return kycDocument(type) ? [...requiredKycUploads(type), "source_of_funds"] : [];
}
export function validIsoDate(value: string): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
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
  if (doc.textOnly && (data.front || data.back)) errors.identityUpload = "Enter your identity document details instead of uploading an image.";
  if (doc.profileType === "none") {
    if (!boundedKycText(data.documentNumber)) errors.documentNumber = "Enter the document number or registration number.";
    if (!doc.textOnly && !boundedKycText(data.documentIssuer)) errors.documentIssuer = "Enter the issuing country and authority.";
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

export const KYC_AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const;
export const boundedKycText = (value: unknown): value is string => typeof value === "string" && !!value.trim() && value.length <= 200;
export type KycIdentityDetails = {
  country?: string;
  license_number?: string | null; card_number?: string | null; passport_number?: string | null;
  state_of_issue?: string | null; expiry_date?: string | null; evidence?: KycEvidenceDraft;
};
// Shared by the form and server; a text-only document never depends on an upload.
export function validateKycIdentityDetails(type: string, details: KycIdentityDetails, now = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  const today = kycToday(now);
  if (isIranCountry(details.country)) {
    const data = details.evidence ?? emptyKycEvidence();
    if (type !== "foreign_passport") errors.docType = "Residents of Iran must provide an Iranian passport.";
    if (!isIranCountry(data.documentIssuer)) errors.documentIssuer = "Provide a passport issued by Iran.";
    if (!boundedKycText(data.documentNumber)) errors.documentNumber = "Enter your Iranian passport number.";
    if (!data.front?.id) errors["evidence-front"] = "Upload the photo and personal details page of your Iranian passport.";
  }
  if (type === "driver_license") {
    if (!boundedKycText(details.license_number)) errors.licenseNumber = "Enter the licence number.";
    if (!boundedKycText(details.card_number)) errors.cardNumber = "Enter the card number.";
  }
  if (type === "passport" && !boundedKycText(details.passport_number)) errors.passportNumber = "Enter the passport number.";
  if (type === "driver_license" && !KYC_AU_STATES.some(state => state === details.state_of_issue)) errors.stateOfIssue = "Choose the issuing state or territory.";
  if (["driver_license", "passport", "foreign_passport"].includes(type) || details.expiry_date) {
    if (!validIsoDate(details.expiry_date || "") || details.expiry_date! < today) errors.expiryDate = "Provide a current, unexpired document and its expiry date.";
  }
  if (type === "medicare") {
    const data = details.evidence ?? emptyKycEvidence();
    if (typeof data.documentNumber !== "string" || !/^\d{10}$/.test(data.documentNumber.trim())) errors.documentNumber = "Enter the 10-digit Medicare card number.";
    if (typeof data.medicareIRN !== "string" || !/^[1-9]$/.test(data.medicareIRN)) errors.medicareIRN = "Enter the individual reference number beside your name (1–9).";
    if (!["green", "blue", "yellow"].includes(data.medicareColour || "")) errors.medicareColour = "Choose the Medicare card colour.";
    const expiry = data.medicareExpiry || "";
    const valid = data.medicareColour === "green"
      ? /^\d{4}-\d{2}$/.test(expiry) && validIsoDate(`${expiry}-01`) && expiry >= today.slice(0, 7)
      : validIsoDate(expiry) && expiry >= today;
    if (!valid) errors.medicareExpiry = "Enter the valid-to date shown on your Medicare card.";
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
