// app/api/admin/compliance/dvs-manual/route.ts
// Route Handler for admin-recorded DVS completion via alternative documents.
// Used for AU customers who hold neither an Australian driver licence nor an
// Australian passport — the compliance officer verifies identity from a
// photo ID / proof of age card / foreign passport plus a residential proof
// (utility bill, bank statement, etc.) outside the system, then records the
// document name/number here so a compliance report PDF is generated for the file.
//
// Only POST is supported. Returns an in-memory PDF — nothing is written to
// Supabase Storage or any file system.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { generateDvsPdf } from "@/lib/compliance/pdf";
import { AUSTRAC_ID_TYPES, AUSTRAC_ID_TYPE_OTHER, isAustracIdType } from "@/lib/compliance/austrac-id-types";

const PRIVILEGED_ROLES = new Set(["admin", "supabase_admin", "service_role"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_SHORT = 120;
const MAX_ISSUER = 160;
const MAX_OTHER_DESCRIPTION = 160;

function makeServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function trimToNullable(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

export async function POST(req: NextRequest) {
  // 1. Authenticate and authorise — must be an admin.
  const userDb = await createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await userDb.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  const role = user.app_metadata?.role as string | undefined;
  if (!role || !PRIVILEGED_ROLES.has(role)) {
    return NextResponse.json({ message: "Forbidden: admin role required." }, { status: 403 });
  }

  // 2. Parse and validate request body.
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const userId = body.userId as string;
  if (!userId || typeof userId !== "string" || !UUID_RE.test(userId)) {
    return NextResponse.json({ message: "Invalid or missing userId." }, { status: 400 });
  }

  const altIdType = trimToNullable(body.altIdType, 60);
  const altIdTypeOther = trimToNullable(body.altIdTypeOther, MAX_OTHER_DESCRIPTION);
  const altIdNumber = trimToNullable(body.altIdNumber, MAX_SHORT);
  const altIdIssuer = trimToNullable(body.altIdIssuer, MAX_ISSUER);
  const altAddressType = trimToNullable(body.altAddressType, 60);
  const altAddressTypeOther = trimToNullable(body.altAddressTypeOther, MAX_OTHER_DESCRIPTION);
  const altAddressReference = trimToNullable(body.altAddressReference, MAX_SHORT);
  const altAddressIssuer = trimToNullable(body.altAddressIssuer, MAX_ISSUER);
  const altAddressDate = trimToNullable(body.altAddressDate, 10);

  if (!altIdType || !isAustracIdType(altIdType)) {
    return NextResponse.json({ message: `Invalid or missing identity document type. Must be one of: ${AUSTRAC_ID_TYPES.join(", ")}.` }, { status: 400 });
  }
  if (altIdType === AUSTRAC_ID_TYPE_OTHER && !altIdTypeOther) {
    return NextResponse.json({ message: "A description is required when the identity document type is 'Other'." }, { status: 400 });
  }
  if (!altIdNumber) {
    return NextResponse.json({ message: "Identity document number is required." }, { status: 400 });
  }
  if (!altAddressType || !isAustracIdType(altAddressType)) {
    return NextResponse.json({ message: `Invalid or missing proof-of-address document type. Must be one of: ${AUSTRAC_ID_TYPES.join(", ")}.` }, { status: 400 });
  }
  if (altAddressType === AUSTRAC_ID_TYPE_OTHER && !altAddressTypeOther) {
    return NextResponse.json({ message: "A description is required when the proof-of-address document type is 'Other'." }, { status: 400 });
  }
  if (!altAddressReference) {
    return NextResponse.json({ message: "Proof-of-address document reference is required." }, { status: 400 });
  }
  if (altAddressDate && !/^\d{4}-\d{2}-\d{2}$/.test(altAddressDate)) {
    return NextResponse.json({ message: "Invalid address document date." }, { status: 400 });
  }

  // 3. Fetch customer profile (service role to bypass RLS).
  const db = makeServiceRoleClient();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, first_name, last_name, dob, country, address, city, state, postcode, document_type")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ message: "Customer profile not found." }, { status: 404 });
  }

  // 4. Generate in-memory PDF documenting the alternative-document review.
  const fullName    = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Unknown";
  const addressLine = [profile.address, profile.city, profile.state, profile.postcode].filter(Boolean).join(", ");
  const performedAt = new Date().toISOString();

  const pdfBytes = await generateDvsPdf({
    subject: {
      fullName,
      dateOfBirth:  profile.dob     ?? "",
      country:      profile.country  ?? "",
      address:      addressLine,
      documentType: profile.document_type ?? "none",
      documentNumber: "",
    },
    check: {
      checkType:   "Manual Document Review — Alternative Identity Verification",
      performedAt,
      referenceId: null,
      resultCode:  null,
    },
    outcome: "MANUAL_COMPLETED",
    rawResponse: {
      note: "No Australian driver licence or passport on file. Identity and residential address were verified manually by a compliance officer from the alternative supporting documents recorded below.",
      performedBy: user.email ?? "admin",
      performedAt,
    },
    alternativeVerification: {
      identityDocument: {
        type: altIdType,
        otherDescription: altIdTypeOther ?? undefined,
        number: altIdNumber,
        issuer: altIdIssuer ?? undefined,
      },
      addressDocument: {
        type: altAddressType,
        otherDescription: altAddressTypeOther ?? undefined,
        reference: altAddressReference,
        issuer: altAddressIssuer ?? undefined,
        date: altAddressDate ?? undefined,
      },
    },
    performedByEmail: user.email ?? "admin",
  });

  // 5. Persist the check outcome and alternative-document details on the profile.
  const patch = {
    compliance_dvs_status: "completed",
    compliance_dvs_method: "manual_document_review",
    compliance_dvs_checked_at: performedAt,
    compliance_dvs_outcome: "MANUAL_COMPLETED",
    compliance_dvs_alt_id_type: altIdType,
    compliance_dvs_alt_id_type_other: altIdType === AUSTRAC_ID_TYPE_OTHER ? altIdTypeOther : null,
    compliance_dvs_alt_id_number: altIdNumber,
    compliance_dvs_alt_id_issuer: altIdIssuer,
    compliance_dvs_alt_address_type: altAddressType,
    compliance_dvs_alt_address_type_other: altAddressType === AUSTRAC_ID_TYPE_OTHER ? altAddressTypeOther : null,
    compliance_dvs_alt_address_reference: altAddressReference,
    compliance_dvs_alt_address_issuer: altAddressIssuer,
    compliance_dvs_alt_address_date: altAddressDate,
  };

  const { error: updateError } = await db.from("profiles").update(patch).eq("id", userId);
  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  // 6. Audit log — non-fatal if it fails.
  try {
    await db.from("audit_logs").insert([{
      actor_id:    user.id,
      actor_email: user.email ?? "",
      action:      "ADMIN_MANUAL_DVS_ALT_DOCUMENTS_RECORDED",
      target_type: "profile",
      target_id:   userId,
      new_value:   patch,
    }]);
  } catch {
    // Audit failure must not block the response.
  }

  // 7. Stream PDF directly to the client — zero storage.
  const safeId = userId.slice(0, 8);
  const ts     = Date.now();
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="dvs-report-manual-${safeId}-${ts}.pdf"`,
      "Content-Length":      String(pdfBytes.byteLength),
      "Cache-Control":       "no-store, no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-DVS-Outcome": "MANUAL_COMPLETED",
    },
  });
}

// Reject any non-POST method.
export function GET()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function PUT()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function DELETE() { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
