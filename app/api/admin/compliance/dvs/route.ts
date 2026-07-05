// app/api/admin/compliance/dvs/route.ts
// Route Handler for admin-triggered DVS (Document Verification Service) check.
// Only POST is supported. Returns an in-memory PDF — nothing is written to
// Supabase Storage or any file system.
//
// Vercel limits: 50 MB response payload, 300 s timeout (Pro).
// A compliance PDF is typically < 100 KB, well within both limits.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { runManualDvsCheck } from "@/lib/compliance/manual";
import { generateDvsPdf } from "@/lib/compliance/pdf";

const PRIVILEGED_ROLES = new Set(["admin", "supabase_admin", "service_role"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
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
  let userId: string;
  try {
    const body: unknown = await req.json();
    userId = (body as Record<string, unknown>).userId as string;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  if (!userId || typeof userId !== "string" || !UUID_RE.test(userId)) {
    return NextResponse.json({ message: "Invalid or missing userId." }, { status: 400 });
  }

  // 3. Fetch customer profile (service role to bypass RLS).
  const db = makeServiceRoleClient();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, first_name, last_name, dob, country, address, city, state, postcode, document_type, license_number, card_number, state_of_issue, passport_number, expiry_date")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ message: "Customer profile not found." }, { status: 404 });
  }

  // 4. Run DVS check via RapidID (in-memory, no storage).
  const dvsResult = await runManualDvsCheck(profile);

  // 5. Generate in-memory PDF.
  const fullName     = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Unknown";
  const docNumber    = profile.document_type === "driver_license"
    ? `${profile.license_number ?? ""}${profile.card_number ? ` / Card: ${profile.card_number}` : ""}`.trim()
    : (profile.passport_number ?? "");
  const addressLine  = [profile.address, profile.city, profile.state, profile.postcode].filter(Boolean).join(", ");

  const pdfBytes = await generateDvsPdf({
    subject: {
      fullName,
      dateOfBirth:  profile.dob            ?? "",
      country:      profile.country         ?? "",
      address:      addressLine,
      documentType: profile.document_type   ?? "",
      documentNumber: docNumber,
      stateOfIssue: profile.state_of_issue  ?? undefined,
      expiryDate:   profile.expiry_date     ?? undefined,
    },
    check: {
      checkType:    dvsResult.checkType,
      performedAt:  new Date().toISOString(),
      referenceId:  dvsResult.referenceId,
      resultCode:   dvsResult.resultCode,
    },
    outcome:          dvsResult.outcome,
    rawResponse:      dvsResult.rawResponse,
    performedByEmail: user.email ?? "admin",
  });

  // 6. Audit log — non-fatal if it fails.
  try {
    await db.from("audit_logs").insert([{
      actor_id:    user.id,
      actor_email: user.email ?? "",
      action:      "ADMIN_MANUAL_DVS_CHECK",
      target_type: "profile",
      target_id:   userId,
      new_value: {
        outcome:     dvsResult.outcome,
        resultCode:  dvsResult.resultCode,
        referenceId: dvsResult.referenceId,
        checkType:   dvsResult.checkType,
        performedAt: new Date().toISOString(),
      },
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
      "Content-Disposition": `attachment; filename="dvs-report-${safeId}-${ts}.pdf"`,
      "Content-Length":      String(pdfBytes.byteLength),
      "Cache-Control":       "no-store, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Reject any non-POST method.
export function GET()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function PUT()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function DELETE() { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
