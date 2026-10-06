"use server";

import { createHash, randomBytes } from "node:crypto";
import { after } from "next/server";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { customerTelegramConfig, telegramDatabase, dispatchCustomerTelegramSafely } from "@/lib/notifications/customer-telegram";
import type { TelegramConnectionState } from "@/lib/notifications/customer-telegram-types";
import type { ActionResult } from "@/lib/requests/types";
import { isUuid } from "@/lib/requests/validation";
import { requireAdmin } from "./admin.actions";

const unavailable: TelegramConnectionState = { available: false, connection: null, pending: null };
async function userId() {
  const client = await createSupabaseServerActionClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("sign_in_required");
  if (!data.user.email_confirmed_at) throw new Error("verified_account_required");
  return data.user.id;
}
async function actionResult<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { data: await work() }; }
  catch (error) {
    const code = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    return { error: ["sign_in_required","verified_account_required","please_wait","already_connected","link_expired","telegram_already_connected","connection_changed","disconnected","duplicate_confirmation_required","delivery_changed"].includes(code) ? code : "telegram_unavailable" };
  }
}

export async function getCustomerTelegram(): Promise<ActionResult<TelegramConnectionState>> {
  return actionResult(async () => {
    const id = await userId(), config = customerTelegramConfig();
    if (!config) return unavailable;
    const { data, error } = await telegramDatabase().rpc("customer_telegram_settings", { p_user_id: id, p_bot_id: config.botId });
    if (error) throw error;
    return { ...data, available: true } as TelegramConnectionState;
  });
}

export async function beginCustomerTelegram(locale: string): Promise<ActionResult<{ state: TelegramConnectionState; url: string }>> {
  return actionResult(async () => {
    const id = await userId(), config = customerTelegramConfig();
    if (!config || !["en","fa"].includes(locale)) throw new Error("telegram_unavailable");
    const token = randomBytes(32).toString("base64url");
    const { data, error } = await telegramDatabase().rpc("customer_telegram_settings", {
      p_user_id: id, p_bot_id: config.botId, p_action: "begin", p_locale: locale,
      p_token_hash: createHash("sha256").update(token).digest("hex"),
    });
    if (error) throw error;
    return { state: { ...data, available: true }, url: `https://t.me/${config.username}?start=${token}` };
  });
}

export async function updateCustomerTelegram(input: { action: "confirm" | "cancel" | "disconnect" | "preferences"; id: string; locale: string; previewMessages?: boolean }): Promise<ActionResult<TelegramConnectionState>> {
  return actionResult(async () => {
    const id = await userId(), config = customerTelegramConfig();
    if (!config || !input || !["confirm","cancel","disconnect","preferences"].includes(input.action) || !isUuid(input.id)
      || !["en","fa"].includes(input.locale) || (input.previewMessages !== undefined && typeof input.previewMessages !== "boolean")) throw new Error("invalid_input");
    const { data, error } = await telegramDatabase().rpc("customer_telegram_settings", {
      p_user_id: id, p_bot_id: config.botId, p_action: input.action, p_locale: input.locale,
      p_challenge_id: ["confirm","cancel"].includes(input.action) ? input.id : null,
      p_connection_id: ["disconnect","preferences"].includes(input.action) ? input.id : null,
      p_preview: input.previewMessages === true,
    });
    if (error) throw error;
    return { ...data, available: true } as TelegramConnectionState;
  });
}

export async function retryCustomerTelegram(input: { requestId: string; deliveryId: string; allowDuplicate: boolean }): Promise<ActionResult<{ queued: true }>> {
  return actionResult(async () => {
    const actor = await requireAdmin();
    if (!customerTelegramConfig() || !input || !isUuid(input.requestId) || !isUuid(input.deliveryId) || typeof input.allowDuplicate !== "boolean") throw new Error("invalid_input");
    const { error } = await telegramDatabase().rpc("retry_customer_telegram_delivery", { p_actor_id: actor.id, p_id: input.deliveryId, p_request_id: input.requestId, p_allow_duplicate: input.allowDuplicate });
    if (error) throw error;
    after(() => dispatchCustomerTelegramSafely(input.requestId, input.deliveryId));
    return { queued: true };
  });
}
