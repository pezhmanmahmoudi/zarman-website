// app/api/admin/compliance/recipient-rapidid/route.ts
// Admin-triggered RapidID AML person-search for AU recipients.
// Only called when recipient.direction === "aud". Returns an in-memory PDF.
// Note: This uses RapidID's AML module (/aml/v1/person), NOT the DVS module.
// Recipients have no identity document, so DVS is not applicable here.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { runRecipientRapidIdCheck } from "@/lib/compliance/manual";
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

  // 3. Fetch recipient — must be AUD (AU) direction.
  const db = makeServiceRoleClient();
  const { data: recipient, error: recipientError } = await db
    .from("recipients")
    .select("id, direction, full_name, account_name, residential_address, irt_address")
    .eq("id", recipientId)
    .maybeSingle();

  if (recipientError || !recipient) {
    return NextResponse.json({ message: "Recipient not found." }, { status: 404 });
  }

  if (recipient.direction !== "aud") {
    return NextResponse.json(
      { message: "RapidID check only applies to Australian (AUD) recipients." },
      { status: 400 }
    );
  }

  // 4. Run RapidID AML person check.
  const rapidIdResult = await runRecipientRapidIdCheck(recipient);

  // 5. Generate in-memory PDF.
  const resolvedName    = (recipient.full_name ?? recipient.account_name ?? "Unknown").trim();
  const resolvedAddress = (recipient.residential_address ?? "").trim();

  const pdfBytes = await generateAmlPdf({
    subject: {
      fullName:    resolvedName,
      dateOfBirth: "N/A — Recipient Record",
      country:     "Australia (AUD)",
      address:     resolvedAddress || "—",
    },
    check: {
      listsScreened:      rapidIdResult.listsScreened,
      performedAt:        new Date().toISOString(),
      referenceId:        rapidIdResult.referenceId,
      matchCount:         rapidIdResult.matchCount,
      possibleMatchCount: rapidIdResult.possibleMatchCount,
    },
    outcome:          rapidIdResult.outcome,
    rawResponse:      rapidIdResult.rawResponse,
    performedByEmail: user.email ?? "admin",
  });

  // 6. Audit log — non-fatal.
  try {
    await db.from("audit_logs").insert([{
      actor_id:    user.id,
      actor_email: user.email ?? "",
      action:      "ADMIN_MANUAL_RECIPIENT_RAPIDID_CHECK",
      target_type: "recipient",
      target_id:   recipientId,
      new_value: {
        outcome:           rapidIdResult.outcome,
        matchCount:        rapidIdResult.matchCount,
        possibleMatchCount: rapidIdResult.possibleMatchCount,
        referenceId:       rapidIdResult.referenceId,
        performedAt:       new Date().toISOString(),
      },
    }]);
  } catch { /* audit failure is non-fatal */ }

  // 7. Stream PDF — zero storage.
  const safeId = recipientId.slice(0, 8);
  const ts     = Date.now();
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type":           "application/pdf",
      "Content-Disposition":    `attachment; filename="recipient-rapidid-${safeId}-${ts}.pdf"`,
      "Content-Length":         String(pdfBytes.byteLength),
      "Cache-Control":          "no-store, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function GET()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function PUT()    { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
export function DELETE() { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
