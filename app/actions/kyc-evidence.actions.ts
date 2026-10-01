"use server";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { KYC_ADDRESS_DOCUMENTS, kycDocument, kycToday, matchesKycFileSignature, requiredKycUploads, validIsoDate, validateKycEvidence, validateKycFile, type KycEvidenceDraft, type KycUploadRole } from "@/lib/kyc/evidence";

const BUCKET = "customer-kyc-evidence";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const service = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
async function identity() {
  const db = await createSupabaseServerActionClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || !uuid(data.user.id)) throw new Error("Sign in again to continue.");
  return data.user;
}
async function admin() {
  const user = await identity();
  if (!["admin", "supabase_admin", "service_role"].includes(user.app_metadata?.role)) throw new Error("Administrator access required.");
  return user;
}

type UploadInput = { file: File; documentType: string; role: KycUploadRole; addressType?: string };
class UploadValidationError extends Error {}

export async function uploadCustomerKycEvidence(input: UploadInput) {
  try { return await performCustomerKycUpload(input); }
  catch (cause) {
    // Expected failures must survive Next's production error redaction without
    // exposing unexpected database, credential or provider details.
    return { error: cause instanceof UploadValidationError ? cause.message : "Could not upload the file. Check your connection and sign-in status, then try again." };
  }
}

async function performCustomerKycUpload(input: UploadInput) {
  const user = await identity();
  if (!(input.file instanceof File)) throw new UploadValidationError("Choose a file to upload.");
  if (!requiredKycUploads(input.documentType).includes(input.role)) throw new UploadValidationError("Invalid document upload slot.");
  if (input.role === "address" && !KYC_ADDRESS_DOCUMENTS.some(doc => doc.value === input.addressType)) throw new UploadValidationError("Choose the proof of address type first.");
  const invalid = validateKycFile(input.file);
  if (invalid) throw new UploadValidationError(invalid);
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  if (!matchesKycFileSignature(bytes, input.file.type)) throw new UploadValidationError("The file contents do not match its format. Choose a valid JPG, PNG or PDF.");
  const db = service();
  const { data: profile } = await db.from("profiles").select("kyc_status").eq("id", user.id).single();
  if (!profile || profile.kyc_status === "approved") throw new UploadValidationError("This account cannot upload identity documents.");
  const { count, error: countError } = await db.from("customer_kyc_uploads").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(Date.now() - 86400000).toISOString());
  if (countError) throw new UploadValidationError("Document uploads are not available yet. Please contact support.");
  if ((count ?? 0) >= 30) throw new UploadValidationError("Upload limit reached. Please contact support or try again tomorrow.");
  const id = crypto.randomUUID();
  const extension = input.file.type === "application/pdf" ? "pdf" : input.file.type === "image/png" ? "png" : "jpg";
  const path = `${user.id}/${id}.${extension}`;
  const name = input.file.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 180) || `document.${extension}`;
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: input.file.type, upsert: false });
  if (error) throw new UploadValidationError("Upload failed. Your other files are saved; please try again.");
  const { error: recordError } = await db.from("customer_kyc_uploads").insert({ id, user_id: user.id, document_type: input.documentType, role: input.role, address_type: input.role === "address" ? input.addressType : null, storage_path: path, original_name: name, mime_type: input.file.type, byte_size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  if (recordError) {
    await db.storage.from(BUCKET).remove([path]); // Only this newly created, unlinked object.
    throw new UploadValidationError("Could not register the upload. Please try again.");
  }
  return { id, name };
}

export type CustomerKycSubmission = {
  first_name?: string; last_name?: string; mobile_number?: string;
  dob: string; country: string; address: string; city: string; state: string; postcode: string;
  document_type: string; license_number?: string | null; card_number?: string | null;
  state_of_issue?: string | null; passport_number?: string | null; expiry_date?: string | null;
  consent_notice: boolean; consent_dvs: boolean; evidence?: KycEvidenceDraft;
};

export async function submitCustomerKycEvidence(payload: CustomerKycSubmission) {
  const user = await identity();
  const doc = kycDocument(payload.document_type);
  const errors = validateKycEvidence(payload.document_type, payload.evidence);
  if (!doc || Object.keys(errors).length) return { error: Object.values(errors)[0] || "Choose a document." };
  for (const key of ["first_name", "last_name", "mobile_number", "country", "address", "city", "state", "postcode"] as const) {
    if (typeof payload[key] !== "string" || !payload[key]?.trim() || payload[key]!.length > 500) return { error: "Complete your personal details and residential address." };
  }
  const today = kycToday();
  if (!validIsoDate(payload.dob) || payload.dob >= today) return { error: "Enter a valid date of birth in the past." };
  if (payload.consent_notice !== true || payload.consent_dvs !== true) return { error: "Please accept both verification consents." };
  if (doc.value === "driver_license" && (!payload.license_number?.trim() || !payload.card_number?.trim() || !["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"].includes(payload.state_of_issue || ""))) return { error: "Enter the licence number, card number and issuing state." };
  if (doc.value === "passport" && !payload.passport_number?.trim()) return { error: "Enter the passport number." };
  if (["driver_license", "passport", "foreign_passport"].includes(doc.value) && (!validIsoDate(payload.expiry_date || "") || payload.expiry_date! < today)) return { error: "Provide a current, unexpired document and its expiry date." };
  if (payload.expiry_date && (!validIsoDate(payload.expiry_date) || payload.expiry_date < today)) return { error: "The document expiry date must be valid and not in the past." };
  const evidence = payload.evidence!;
  const roles = requiredKycUploads(doc.value);
  const ids = roles.map(role => evidence[role]!.id);
  if (!ids.every(uuid) || new Set(ids).size !== ids.length) return { error: "Each required side needs its own uploaded file." };
  const db = service();
  const { data: uploads, error: readError } = await db.from("customer_kyc_uploads").select("id,user_id,document_type,role,address_type,sha256").in("id", ids).eq("user_id", user.id);
  if (readError || !uploads || roles.some((role, i) => !uploads.some(row => row.id === ids[i] && row.role === role && row.document_type === doc.value && (role !== "address" || row.address_type === evidence.addressType)))) return { error: "Some required uploads are missing or belong to another document selection. Upload them again." };
  if (new Set(uploads.map(row => row.sha256)).size !== uploads.length) return { error: "Use a different file for each side and for proof of address." };
  const addressDoc = KYC_ADDRESS_DOCUMENTS.find(item => item.value === evidence.addressType);
  const details = {
    first_name: payload.first_name!.trim(), last_name: payload.last_name!.trim(), mobile_number: payload.mobile_number!.trim(),
    dob: payload.dob, country: payload.country.trim(), address: payload.address.trim(), city: payload.city.trim(), state: payload.state.trim(), postcode: payload.postcode.trim(),
    document_type: doc.value, profile_document_type: doc.profileType, report_type: doc.reportType,
    license_number: doc.value === "driver_license" ? payload.license_number : null,
    card_number: doc.value === "driver_license" ? payload.card_number : null,
    state_of_issue: doc.value === "driver_license" ? payload.state_of_issue : null,
    passport_number: doc.value === "passport" ? payload.passport_number : null,
    expiry_date: payload.expiry_date || null,
    document_number: evidence.documentNumber?.trim().slice(0, 200) || null,
    document_issuer: evidence.documentIssuer?.trim().slice(0, 200) || null,
    address_type: doc.address ? evidence.addressType : null,
    address_report_type: doc.address ? addressDoc?.reportType : null,
    address_date: doc.address ? evidence.addressDate : null,
    consent_notice: true, consent_dvs: true, consent_version: "customer-evidence-2026-09-29",
  };
  const { data, error } = await db.rpc("submit_customer_kyc_evidence", { p_user_id: user.id, p_details: details, p_upload_ids: ids });
  if (error) return { error: "We could not submit your documents. Check your account status or try again; your uploaded files are still saved." };
  return { success: true, submissionId: data as string };
}

export async function getCustomerKycEvidenceForAdmin(userId: string) {
  await admin();
  if (!uuid(userId)) throw new Error("Invalid customer.");
  const db = service();
  const { data, error } = await db.from("customer_kyc_submissions").select("id,document_type,details,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("Unable to load submitted evidence.");
  if (!data) return null;
  const { data: uploads, error: uploadError } = await db.from("customer_kyc_uploads").select("id,role,original_name").eq("submission_id", data.id).eq("user_id", userId);
  if (uploadError) throw new Error("Unable to load uploaded files.");
  return { ...data, uploads: uploads ?? [] };
}

export async function getCustomerKycFileForAdmin(uploadId: string) {
  await admin();
  if (!uuid(uploadId)) throw new Error("Invalid document.");
  const db = service();
  const { data, error } = await db.from("customer_kyc_uploads").select("storage_path,submission_id").eq("id", uploadId).single();
  if (error || !data?.submission_id) throw new Error("Submitted file not found.");
  const { data: signed, error: signError } = await db.storage.from(BUCKET).createSignedUrl(data.storage_path, 60);
  if (signError || !signed?.signedUrl) throw new Error("Unable to open this file.");
  return signed.signedUrl;
}
