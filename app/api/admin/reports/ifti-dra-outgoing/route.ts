import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import {
  generateIftiDraOutgoingWorkbook,
  type IftiSourceRecord,
} from "@/lib/reporting/ifti-dra-outgoing";

const PRIVILEGED_ROLES = new Set(["admin", "supabase_admin", "service_role"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_SIZE = 500;

function makeServiceRoleClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseTransactionIds(body: unknown) {
  const rawIds = (body as { transactionIds?: unknown })?.transactionIds;
  if (!Array.isArray(rawIds)) return { error: "transactionIds must be an array." };

  const ids = rawIds
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  if (ids.length === 0) return { error: "Select at least one approved transaction." };
  if (ids.length > MAX_BATCH_SIZE) return { error: `Maximum batch size is ${MAX_BATCH_SIZE}.` };

  for (const id of ids) {
    if (!UUID_RE.test(id)) {
      return { error: `Invalid transaction id: ${id}` };
    }
  }

  return { ids };
}

function buildFileName(records: IftiSourceRecord[]) {
  const dates = records
    .map((r) => new Date(r.created_at))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) {
    return `AML.Report.AustracOutgoing ${new Date().toISOString().slice(0, 10)}.xlsx`;
  }

  const start = dates[0].toISOString().slice(0, 10);
  const end = dates[dates.length - 1].toISOString().slice(0, 10);
  return `AML.Report.AustracOutgoing ${start} to ${end}.xlsx`;
}

export async function POST(req: NextRequest) {
  const userDb = await createSupabaseServerActionClient();
  const {
    data: { user },
    error: authError,
  } = await userDb.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const role = user.app_metadata?.role as string | undefined;
  if (!role || !PRIVILEGED_ROLES.has(role)) {
    return NextResponse.json({ message: "Forbidden: admin role required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseTransactionIds(body);
  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  const db = makeServiceRoleClient();
  const { data, error } = await db
    .from("transactions")
    .select(`
      id, user_id, recipient_id, type, amount_aud, equivalent_toman, status, created_at, approved_at,
      reference_code, reason_for_transfer, source_of_funds,
      profiles(
        first_name, last_name, email, customer_code, mobile_number, dob, country,
        address, city, state, postcode, document_type, license_number, card_number,
        state_of_issue, passport_number, compliance_dvs_method
      ),
      recipients(
        direction, label, full_name, account_name, residential_address, irt_address,
        recipient_phone, recipient_email, irt_phone, account_number, card_number,
        shaba_number, irt_account_number, bank_name
      )
    `)
    .in("id", parsed.ids);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as IftiSourceRecord[];
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const orderedRows = parsed.ids.map((id) => byId.get(id)).filter(Boolean) as IftiSourceRecord[];

  if (orderedRows.length === 0) {
    return NextResponse.json({ message: "No matching transactions were found." }, { status: 404 });
  }

  // IFTI-DRA Outgoing covers buy_aud transactions only (AUD exits Australia → paid overseas).
  // sell_aud = Zarman sells AUD to customer = money enters Australia = AUSTRAC incoming (different report).
  const nonApproved = orderedRows.filter((row) => (row.status ?? "").toLowerCase() !== "approved");
  if (nonApproved.length > 0) {
    return NextResponse.json(
      {
        message: "Only approved transactions can be exported to AUSTRAC IFDA.",
        invalidTransactionIds: nonApproved.map((tx) => tx.id),
      },
      { status: 400 },
    );
  }

  let workbookBuffer: Buffer;
  try {
    workbookBuffer = await generateIftiDraOutgoingWorkbook(orderedRows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate IFDA workbook.";
    return NextResponse.json({ message }, { status: 500 });
  }

  const fileName = buildFileName(orderedRows);

  return new Response(workbookBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(workbookBuffer.byteLength),
      "Cache-Control": "no-store, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function GET() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}

export function PUT() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}

export function DELETE() {
  return NextResponse.json({ message: "Method not allowed." }, { status: 405 });
}
