// app/api/admin/compliance/aml/route.ts
// Route Handler for admin-triggered AML/CTF PEP & sanctions screening (NameScan).
// Only POST is supported. Returns an in-memory PDF — nothing is written to
// Supabase Storage or any file system.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { runManualAmlCheck } from "@/lib/compliance/manual";
import { generateAmlPdf } from "@/lib/compliance/pdf";

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
    .select("id, first_name, last_name, dob, country, address, city, state, postcode")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ message: "Customer profile not found." }, { status: 404 });
  }

  // 4. Run AML/CTF check via NameScan (in-memory, no storage).
  const amlResult = await runManualAmlCheck(profile);

  // 5. Generate in-memory PDF.
  const fullName    = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Unknown";
  const addressLine = [profile.address, profile.city, profile.state, profile.postcode].filter(Boolean).join(", ");

  const pdfBytes = await generateAmlPdf({
    subject: {
      fullName,
      dateOfBirth: profile.dob     ?? "",
      country:     profile.country  ?? "",
      address:     addressLine,
    },
    check: {
      listsScreened:     amlResult.listsScreened,
      performedAt:       new Date().toISOString(),
      referenceId:       amlResult.referenceId,
      matchCount:        amlResult.matchCount,
      possibleMatchCount: amlResult.possibleMatchCount,
    },
    outcome:          amlResult.outcome,
    rawResponse:      amlResult.rawResponse,
    performedByEmail: user.email ?? "admin",
  });

  // 6. Audit log — non-fatal if it fails.
  try {
    await db.from("audit_logs").insert([{
      actor_id:    user.id,
      actor_email: user.email ?? "",
      action:      "ADMIN_MANUAL_AML_CHECK",
      target_type: "profile",
      target_id:   userId,
      new_value: {
        outcome:           amlResult.outcome,
        matchCount:        amlResult.matchCount,
        possibleMatchCount: amlResult.possibleMatchCount,
        referenceId:       amlResult.referenceId,
        listsScreened:     amlResult.listsScreened,
        performedAt:       new Date().toISOString(),
      },
    }]);
  } catch {
    // Audit failure must not block the response.
  }

  // 7. Stream PDF directly to the client — zero storage.
  const safeId = userId.slice(0, 8);
  const ts     = Date.now();
  const amlFlag = amlResult.outcome === "FAILED"
    ? "failed"
    : (amlResult.outcome === "REVIEW REQUIRED" || amlResult.matchCount > 0 || amlResult.possibleMatchCount > 0)
      ? "review_required"
      : "clear";

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="aml-report-${safeId}-${ts}.pdf"`,
      "Content-Length":      String(pdfBytes.byteLength),
      "Cache-Control":       "no-store, no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Compliance-Done": "true",
      "X-AML-Outcome": amlResult.outcome,
      "X-AML-Match-Count": String(amlResult.matchCount),
      "X-AML-Possible-Match-Count": String(amlResult.possibleMatchCount),
      "X-AML-Flag": amlFlag,
    },
  });
}

// Reject any non-POST method.
export function GET()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function PUT()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function DELETE() { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
