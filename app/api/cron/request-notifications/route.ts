import {
  authorizedNotificationCron,
  createNotificationDatabase,
  createRequestEmailSender,
  notificationRuntimeSettings,
  notificationWorkerFailureDiagnostic,
  runRequestNotificationWorker,
} from "@/lib/requests/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizedNotificationCron(request.headers.get("authorization"), process.env.REQUEST_NOTIFICATIONS_CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const settings = notificationRuntimeSettings();
    const result = await runRequestNotificationWorker({
      db: createNotificationDatabase(), send: createRequestEmailSender(settings.apiKey), ...settings,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Log only explicit operation/code/status fields, never the error or cause.
    console.error(notificationWorkerFailureDiagnostic(error));
    return Response.json({ error: "Notification worker unavailable; inspect the queue and configuration." }, { status: 503 });
  }
}
