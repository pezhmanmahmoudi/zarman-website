import { createNotificationDatabase, persistRequestEmailEvent, verifyRequestEmailEvent } from "@/lib/requests/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook not configured" }, { status: 503 });
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  let event: ReturnType<typeof verifyRequestEmailEvent>;
  try {
    event = verifyRequestEmailEvent(body, request.headers, secret);
  } catch {
    return Response.json({ error: "Invalid webhook signature or event" }, { status: 400 });
  }
  try {
    await persistRequestEmailEvent(createNotificationDatabase(), event);
    return Response.json({ received: true });
  } catch {
    // Non-2xx requests provider redelivery; acknowledge only durable commits.
    return Response.json({ error: "Unable to persist event" }, { status: 503 });
  }
}
