import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/app/actions/admin.actions";
import { isUuid } from "@/lib/requests/validation";
import { renderRequestReceiptPdf, type RequestCompletionReceiptSnapshot } from "@/lib/requests/receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const { id } = await context.params;
  if (!isUuid(id)) return new Response("Receipt not found", { status: 404, headers });
  const auth = await createSupabaseServerActionClient();
  const { data: session, error: sessionError } = await auth.auth.getUser();
  if (sessionError || !session.user) return new Response("Sign in to download your receipt", { status: 401, headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("Receipt service unavailable", { status: 503, headers });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const request = await db.from("exchange_requests").select("user_id,status").eq("id", id).single();
  if (request.error || !request.data) return new Response("Receipt not found", { status: 404, headers });
  if (request.data.user_id !== session.user.id) {
    try { await requireAdmin(auth); }
    catch { return new Response("Receipt not found", { status: 404, headers }); }
  }
  if (request.data.status !== "completed") return new Response("A final receipt is available after settlement is confirmed", { status: 409, headers });
  const receipt = await db.from("exchange_request_completion_receipts").select("snapshot").eq("request_id", id).single();
  if (receipt.error || !receipt.data) return new Response("Receipt not found", { status: 404, headers });
  try {
    const snapshot = receipt.data.snapshot as RequestCompletionReceiptSnapshot;
    const pdf = await renderRequestReceiptPdf(snapshot);
    const filename = `zarman-receipt-${snapshot.reference_code.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80)}.pdf`;
    return new Response(Buffer.from(pdf), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch { return new Response("The receipt could not be generated. Please retry shortly", { status: 503, headers }); }
}
