"use server";

import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { customerPushConfig, customerPushTestPayload, pushDatabase, sendCustomerPush, validPushSubscription } from "@/lib/notifications/customer-push";
import type { ActionResult } from "@/lib/requests/types";

export type CustomerPushState = { available: boolean; publicKey: string | null; thisDevice: boolean };

const MAX_DEVICES = 10;
const ERRORS = ["sign_in_required", "verified_account_required", "invalid_subscription", "please_wait", "subscription_expired", "push_unavailable"];

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
    return { error: ERRORS.includes(code) ? code : "push_unavailable" };
  }
}

/** Status for this browser. `endpoint` is the browser's current push subscription, if any. */
export async function getCustomerPush(endpoint: string | null): Promise<ActionResult<CustomerPushState>> {
  return actionResult(async () => {
    const id = await userId(), config = customerPushConfig();
    if (!config) return { available: false, publicKey: null, thisDevice: false };
    let thisDevice = false;
    if (typeof endpoint === "string" && endpoint.length <= 1024) {
      const { data, error } = await pushDatabase().from("customer_push_subscriptions").select("id").eq("user_id", id).eq("endpoint", endpoint).maybeSingle();
      if (error) throw error;
      thisDevice = !!data;
    }
    return { available: true, publicKey: config.publicKey, thisDevice };
  });
}

/** Saves (or moves to the signed-in customer) this browser's subscription. Also called on each visit to keep it current. */
export async function saveCustomerPush(input: { subscription: unknown; locale: string }): Promise<ActionResult<CustomerPushState>> {
  return actionResult(async () => {
    const id = await userId(), config = customerPushConfig();
    if (!config) throw new Error("push_unavailable");
    const subscription = validPushSubscription(input?.subscription);
    if (!subscription || !["en", "fa"].includes(input.locale)) throw new Error("invalid_subscription");
    const db = pushDatabase();
    const { error } = await db.from("customer_push_subscriptions").upsert({
      ...subscription, user_id: id, locale: input.locale, last_seen_at: new Date().toISOString(), failure_count: 0,
    }, { onConflict: "endpoint" });
    if (error) throw error;
    const { data: stale, error: listError } = await db.from("customer_push_subscriptions").select("id")
      .eq("user_id", id).order("last_seen_at", { ascending: false }).range(MAX_DEVICES, MAX_DEVICES + 50);
    if (listError) throw listError;
    if (stale?.length) await db.from("customer_push_subscriptions").delete().in("id", stale.map(row => row.id));
    return { available: true, publicKey: config.publicKey, thisDevice: true };
  });
}

export async function removeCustomerPush(endpoint: string): Promise<ActionResult<CustomerPushState>> {
  return actionResult(async () => {
    const id = await userId(), config = customerPushConfig();
    if (typeof endpoint !== "string" || endpoint.length > 1024) throw new Error("invalid_subscription");
    const { error } = await pushDatabase().from("customer_push_subscriptions").delete().eq("user_id", id).eq("endpoint", endpoint);
    if (error) throw error;
    return { available: !!config, publicKey: config?.publicKey ?? null, thisDevice: false };
  });
}

export async function sendCustomerPushTest(endpoint: string): Promise<ActionResult<{ sent: true }>> {
  return actionResult(async () => {
    const id = await userId(), config = customerPushConfig();
    if (!config) throw new Error("push_unavailable");
    if (typeof endpoint !== "string" || endpoint.length > 1024) throw new Error("invalid_subscription");
    const db = pushDatabase();
    const { data, error } = await db.from("customer_push_subscriptions").select("id,endpoint,p256dh,auth,locale,last_test_at")
      .eq("user_id", id).eq("endpoint", endpoint).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("subscription_expired");
    if (data.last_test_at && Date.now() - new Date(data.last_test_at).getTime() < 30_000) throw new Error("please_wait");
    await db.from("customer_push_subscriptions").update({ last_test_at: new Date().toISOString() }).eq("id", data.id);
    const payload = customerPushTestPayload(data.locale === "fa" ? "fa" : "en");
    const outcome = await sendCustomerPush(config, data, payload);
    if (outcome === "gone") {
      await db.from("customer_push_subscriptions").delete().eq("id", data.id);
      throw new Error("subscription_expired");
    }
    if (outcome === "failed") throw new Error("push_unavailable");
    return { sent: true };
  });
}
