// app/api/admin/compliance/view/route.ts
// Read-only compliance results for the admin pages. These are plain GETs rather than server
// actions on purpose: Next.js runs server actions one at a time and queues page navigation behind
// them, so a slow screening read would make the Back link feel stuck.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/actions/admin.actions";
import { ensureCustomerCompliance, ensureRecipientsCompliance, ensureRequestCompliance } from "@/lib/compliance/request-compliance";
import { complianceDb, isComplianceUnavailable } from "@/lib/compliance/screening";

export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  let admin: { id: string };
  try {
    admin = await requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: /forbidden/i.test(message) ? 403 : 401, headers: NO_STORE });
  }

  const params = req.nextUrl.searchParams;
  const kind = params.get("kind");
  const id = params.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400, headers: NO_STORE });

  try {
    const db = complianceDb();
    if (kind === "request") return NextResponse.json({ data: await ensureRequestCompliance(db, id, admin.id) }, { headers: NO_STORE });
    if (kind === "customer") return NextResponse.json({ data: await ensureCustomerCompliance(db, id, admin.id, { run: false }) }, { headers: NO_STORE });
    if (kind === "recipients") return NextResponse.json({ data: await ensureRecipientsCompliance(db, id, admin.id, { run: params.get("run") === "1" }) }, { headers: NO_STORE });
    return NextResponse.json({ error: "Unknown compliance view." }, { status: 400, headers: NO_STORE });
  } catch (error) {
    const message = isComplianceUnavailable(error)
      ? "Compliance screening is not set up yet: apply the 20261031_69 database migration."
      : error instanceof Error ? error.message : "The compliance status could not be loaded.";
    return NextResponse.json({ error: message }, { headers: NO_STORE });
  }
}
