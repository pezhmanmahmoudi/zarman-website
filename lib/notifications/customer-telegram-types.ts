export type TelegramConnectionState = {
  available: boolean;
  connection: { id: string; displayName: string; username: string | null; previewMessages: boolean; locale: "en" | "fa" } | null;
  pending: { id: string; displayName: string | null; username: string | null; claimed: boolean; expiresAt: string } | null;
};

export type CustomerTelegramDelivery = {
  id: string; event_id: string; event_type: string; status: "pending" | "sending" | "sent" | "failed" | "uncertain" | "cancelled";
  attempts: number; last_error: string | null; created_at: string; sent_at: string | null; lease_expires_at: string | null;
};
