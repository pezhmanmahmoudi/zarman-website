// app/api/admin/compliance/dfat-upload/route.ts
// Admin uploads the DFAT "Australian Sanctions Consolidated List" workbook. The file is parsed in
// memory (never stored), loaded as the new active list, and every customer/recipient is re-screened.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/actions/admin.actions";
import { parseDfatWorkbook } from "@/lib/compliance/dfat-import";
import { loadDfatList } from "@/lib/compliance/dfat-load";
import { complianceDb, isComplianceUnavailable } from "@/lib/compliance/screening";

export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let admin: { id: string; email?: string | null };
  try {
    admin = await requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized.";
    return NextResponse.json({ message }, { status: /forbidden/i.test(message) ? 403 : 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "Choose the DFAT .xlsx file." }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ message: "The DFAT list must be an .xlsx workbook." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ message: "The file is larger than expected for the DFAT list." }, { status: 413 });

  let parsed;
  try {
    parsed = await parseDfatWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "The workbook could not be read." }, { status: 422 });
  }

  try {
    const result = await loadDfatList(complianceDb(), parsed, { fileName: file.name, actor: admin.id, force: form?.get("force") === "true" });
    if (!result.ok) return NextResponse.json({ message: `${result.message} Tick "Reload even if unchanged" to replace it.`, code: result.code }, { status: 409 });
    return NextResponse.json({ ok: true, rows: result.rows, lowRelevanceRows: result.lowRelevanceRows, latestControlDate: result.latestControlDate, rescreen: result.rescreen, notes: result.notes });
  } catch (error) {
    const message = isComplianceUnavailable(error)
      ? "Compliance screening is not set up yet: apply the 20261031_69 database migration."
      : "The list could not be loaded. The previous list (if any) is still active.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export function GET() { return NextResponse.json({ message: "Method not allowed." }, { status: 405 }); }
