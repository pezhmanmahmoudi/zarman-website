import type { SupabaseClient } from "@supabase/supabase-js";

type ConsentSubject = {
  first_name?: string | null; last_name?: string | null; dob?: string | null;
  document_type?: string | null; license_number?: string | null; card_number?: string | null;
  state_of_issue?: string | null; passport_number?: string | null; expiry_date?: string | null;
};
const value = (input: unknown) => String(input ?? "").trim();

// Bind consent to the latest submitted identity. Editing a profile cannot reuse
// permission recorded for a different name, DOB or primary identity document.
export function matchesCustomerConsent(details: Record<string, unknown>, subject: ConsentSubject): boolean {
  if (details.consent_dvs !== true || details.consent_notice !== true || !value(details.consent_version)) return false;
  for (const key of ["first_name", "last_name", "dob"] as const) {
    if (!value(details[key]) || value(details[key]) !== value(subject[key])) return false;
  }
  if ("document_type" in subject && value(details.profile_document_type) !== value(subject.document_type)) return false;
  for (const key of ["license_number", "card_number", "state_of_issue", "passport_number", "expiry_date"] as const) {
    if (key in subject && value(details[key]) !== value(subject[key])) return false;
  }
  return true;
}

export async function getCustomerVerificationConsent(db: SupabaseClient, userId: string, subject: ConsentSubject) {
  const { data, error } = await db.from("customer_kyc_submissions")
    .select("id,details,created_at").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return { ok: false as const, status: 503, message: "Unable to verify customer consent. No provider request was sent." };
  if (!data || !data.details || !Number.isFinite(Date.parse(data.created_at)) || !matchesCustomerConsent(data.details, subject)) {
    return { ok: false as const, status: 403, message: "The customer must explicitly consent to verification of their current identity details before this check can run." };
  }
  return { ok: true as const, submissionId: String(data.id), version: String(data.details.consent_version), grantedAt: String(data.created_at) };
}
