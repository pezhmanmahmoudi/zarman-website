// app/api/admin/compliance/recipient-aml/route.ts
// Admin-triggered AML/PEP & sanctions screening for a single recipient.
// Applies to ALL recipient directions (AUD and IRT). Returns an in-memory PDF.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { runRecipientAmlCheck } from "@/lib/compliance/manual";
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
  // 1. Auth — admin only.
  const userDb = await createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await userDb.auth.getUser();
  if (authError || !user) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const role = user.app_metadata?.role as string | undefined;
  if (!role || !PRIVILEGED_ROLES.has(role)) {
    return NextResponse.json({ message: "Forbidden: admin role required." }, { status: 403 });
  }

  // 2. Parse body.
  let recipientId: string;
  try {
    const body: unknown = await req.json();
    recipientId = (body as Record<string, unknown>).recipientId as string;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  if (!recipientId || typeof recipientId !== "string" || !UUID_RE.test(recipientId)) {
    return NextResponse.json({ message: "Invalid or missing recipientId." }, { status: 400 });
  }

  // 3. Fetch recipient (service role bypasses RLS).
  const db = makeServiceRoleClient();
  const { data: recipient, error: recipientError } = await db
    .from("recipients")
    .select("id, direction, full_name, account_name, residential_address, irt_address")
    .eq("id", recipientId)
    .maybeSingle();

  if (recipientError || !recipient) {
    return NextResponse.json({ message: "Recipient not found." }, { status: 404 });
  }

  // 4. Run AML check via NameScan.
  const amlResult = await runRecipientAmlCheck(recipient);

  // 5. Generate in-memory PDF.
  const resolvedName    = (recipient.full_name ?? recipient.account_name ?? "Unknown").trim();
  const resolvedAddress = (recipient.residential_address ?? recipient.irt_address ?? "").trim();

  const pdfBytes = await generateAmlPdf({
    subject: {
      fullName:    resolvedName,
      dateOfBirth: "N/A — Recipient Record",
      country:     "Iran (IRT)",
      address:     resolvedAddress || "—",
    },
    check: {
      listsScreened:      amlResult.listsScreened,
      performedAt:        new Date().toISOString(),
      referenceId:        amlResult.referenceId,
      matchCount:         amlResult.matchCount,
      possibleMatchCount: amlResult.possibleMatchCount,
    },
    outcome:          amlResult.outcome,
    rawResponse:      amlResult.rawResponse,
    performedByEmail: user.email ?? "admin",
  });

  // 6. Audit log — non-fatal.
  try {
    await db.from("audit_logs").insert([{
      actor_id:    user.id,
      actor_email: user.email ?? "",
      action:      "ADMIN_MANUAL_RECIPIENT_AML_CHECK",
      target_type: "recipient",
      target_id:   recipientId,
      new_value: {
        outcome:           amlResult.outcome,
        matchCount:        amlResult.matchCount,
        possibleMatchCount: amlResult.possibleMatchCount,
        referenceId:       amlResult.referenceId,
        listsScreened:     amlResult.listsScreened,
        performedAt:       new Date().toISOString(),
      },
    }]);
  } catch { /* audit failure is non-fatal */ }

  // 7. Stream PDF — zero storage.
  const safeId = recipientId.slice(0, 8);
  const ts     = Date.now();
  const amlFlag = amlResult.outcome === "FAILED"
    ? "failed"
    : (amlResult.outcome === "REVIEW REQUIRED" || amlResult.matchCount > 0 || amlResult.possibleMatchCount > 0)
      ? "review_required"
      : "clear";

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type":           "application/pdf",
      "Content-Disposition":    `attachment; filename="recipient-aml-${safeId}-${ts}.pdf"`,
      "Content-Length":         String(pdfBytes.byteLength),
      "Cache-Control":          "no-store, no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Compliance-Done": "true",
      "X-AML-Outcome": amlResult.outcome,
      "X-AML-Match-Count": String(amlResult.matchCount),
      "X-AML-Possible-Match-Count": String(amlResult.possibleMatchCount),
      "X-AML-Flag": amlFlag,
    },
  });
}

export function GET()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function PUT()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function DELETE() { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
