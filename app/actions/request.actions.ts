"use server";

import { createClient, type User } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/app/actions/admin.actions";
import { applyPromoCode, calcAppliedFee, calcEquivalentTomanForRequestType, calcLoyaltyDiscount, FINANCE_CONFIG_DEFAULTS, toCompanyTradeType, type PromoCodeData } from "@/lib/pricing";
import { DEFAULT_REQUEST_SETTINGS, isUuid, mutationInputError, publicRequestSettings, quoteInputError, settingsInputError } from "@/lib/requests/validation";
import type { ActionResult, ExchangeRequest, PublicRequestSettings, QuoteInput, QuoteSnapshot, RequestDetail, RequestMutationInput, RequestQuote, RequestSettings, SettingsRecord } from "@/lib/requests/types";

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Request service is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function customer(): Promise<User> {
  const client = await createSupabaseServerActionClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in to continue.");
  return data.user;
}
function failure(error: unknown): string {
  if (error instanceof Error) return error.message;
  const value = error as { code?: string; message?: string } | null;
  if (value?.code === "42P01" || value?.code === "PGRST202" || value?.code === "PGRST205") return "The online request service has not been configured yet. Please contact support.";
  if (value?.code === "42501") return "You do not have permission to perform this request action.";
  if (value?.code === "40001") return "This request has changed. Refresh the page before continuing.";
  if (value?.code === "23505") return "This reference or operation has already been recorded. Refresh to see the current request.";
  if (["P0001", "22023"].includes(value?.code || "") && value?.message) return value.message;
  return "The request could not be processed. Please refresh and try again.";
}
async function result<T>(operation: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { data: await operation() }; }
  catch (error) { return { error: failure(error) }; }
}
async function settingsRecord(): Promise<SettingsRecord> {
  const { data, error } = await database().from("exchange_request_settings").select("version, settings").eq("id", true).single();
  if (error) throw error;
  if (!data) throw new Error("Request settings are unavailable.");
  const settings = { ...DEFAULT_REQUEST_SETTINGS, ...data.settings } as RequestSettings;
  const validation = settingsInputError(settings);
  if (validation) throw new Error("Request service settings need administrator review.");
  return { version: data.version, settings };
}

export async function getRequestPolicy(): Promise<ActionResult<PublicRequestSettings>> {
  return result(async () => publicRequestSettings((await settingsRecord()).settings));
}

export async function createRequestQuote(input: QuoteInput): Promise<ActionResult<RequestQuote>> {
  return result(async () => {
    const user = await customer();
    if (!user.email || !user.email_confirmed_at) throw new Error("Verify your email address before submitting a request.");
    const policy = await settingsRecord();
    const invalid = quoteInputError(input, policy.settings);
    if (invalid) throw new Error(invalid);
    const db = database();
    const [profileResult, rateResult, volumeResult, recentQuotes] = await Promise.all([
      db.from("profiles").select("id,first_name,last_name,kyc_status").eq("id", user.id).single(),
      db.from("rates_history").select("id,buy_aud,sell_aud,market_active,discount_step_volume,discount_percent_per_step,max_discount_percent,fee_threshold,applied_fee").order("date", { ascending: false }).order("id", { ascending: false }).limit(1).single(),
      db.from("transactions").select("amount_aud").eq("user_id", user.id).eq("status", "approved"),
      db.from("exchange_request_quotes").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(Date.now() - 60_000).toISOString()),
    ]);
    for (const response of [profileResult, rateResult, volumeResult, recentQuotes]) if (response.error) throw response.error;
    if (profileResult.data?.kyc_status !== "approved") throw new Error("Identity verification must be approved before submitting a request.");
    if (!rateResult.data?.market_active) throw new Error("The exchange market is paused. Please try again when service resumes.");
    if ((recentQuotes.count || 0) >= 10) throw new Error("Please wait a minute before requesting another quote.");
    const rate = rateResult.data;
    const buy = Number(rate.buy_aud), sell = Number(rate.sell_aud);
    if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) throw new Error("A valid exchange rate is currently unavailable.");
    const config = {
      discount_step_volume: Number(rate.discount_step_volume ?? FINANCE_CONFIG_DEFAULTS.DISCOUNT_STEP_VOLUME),
      discount_percent_per_step: Number(rate.discount_percent_per_step ?? FINANCE_CONFIG_DEFAULTS.DISCOUNT_PERCENT_PER_STEP),
      max_discount_percent: Number(rate.max_discount_percent ?? FINANCE_CONFIG_DEFAULTS.MAX_DISCOUNT_PERCENT),
      fee_threshold: Number(rate.fee_threshold ?? FINANCE_CONFIG_DEFAULTS.FEE_THRESHOLD),
      applied_fee: Number(rate.applied_fee ?? FINANCE_CONFIG_DEFAULTS.APPLIED_FEE),
    };
    if (Object.values(config).some(value => !Number.isFinite(value) || value < 0) || config.discount_step_volume <= 0 || config.max_discount_percent > 1) throw new Error("Exchange fee configuration needs administrator review.");
    const volume = (volumeResult.data || []).reduce((total, row) => total + Number(row.amount_aud || 0), 0);
    const loyalty = calcLoyaltyDiscount(volume, Math.abs(sell - buy), config);
    const baseRate = input.txType === "buy_aud" ? sell - loyalty : buy + loyalty;
    let appliedRate = baseRate, discount = 0;
    let promo: PromoCodeData | null = null;
    const promoCode = input.promoCode?.trim().toUpperCase() || null;
    if (promoCode) {
      const lookup = await db.from("promo_codes").select("code,discount_type,discount_value,max_uses,used_count,active,expires_at").eq("code", promoCode).single();
      if (lookup.error || !lookup.data) throw new Error("This promotion code is not available.");
      promo = lookup.data as PromoCodeData;
      const benefit = applyPromoCode(input.rawAmount, baseRate, input.txType, promo);
      if (!benefit.valid) throw new Error(benefit.error);
      appliedRate = benefit.effectiveRate;
      discount = benefit.discount_amount;
    }
    let recipient: Record<string, unknown>;
    const education = input.recipientId === "__edu_exam__";
    if (education) {
      recipient = { label: input.institutionName!.trim(), institution_name: input.institutionName!.trim(), invoice_reference: input.invoiceReference!.trim(), direction: input.txType === "buy_aud" ? "aud" : "irt" };
    } else {
      const lookup = await db.from("recipients").select("id,user_id,direction,label,bank_name,bsb,account_number,account_name,residential_address,residential_city,residential_state,residential_postcode,residential_country,recipient_email,recipient_phone,bank_type,card_number,shaba_number,irt_account_number,full_name,irt_address,irt_city,irt_state,irt_postcode,irt_country,irt_phone,updated_at").eq("id", input.recipientId).eq("user_id", user.id).single();
      if (lookup.error || !lookup.data) throw new Error("The selected recipient is not available for your account.");
      recipient = lookup.data;
      if (recipient.direction !== (input.txType === "buy_aud" ? "aud" : "irt")) throw new Error("Choose a recipient for the correct destination currency.");
      if (recipient.direction === "aud" && (!String(recipient.account_name || "").trim() || !/^\d{6}$/.test(String(recipient.bsb || "").replaceAll("-", "")) || !/^\d{5,12}$/.test(String(recipient.account_number || "")))) throw new Error("Complete the recipient's account name, six-digit BSB and account number.");
      if (recipient.direction === "irt" && (!String(recipient.full_name || "").trim() || (recipient.bank_type === "bank_melli" ? !/^\d{5,20}$/.test(String(recipient.irt_account_number || "")) : !/^IR\d{24}$/i.test(String(recipient.shaba_number || "").replaceAll(" ", ""))))) throw new Error("Complete the recipient's name and valid Iranian account or IBAN details.");
    }
    const fee = calcAppliedFee(input.rawAmount, config);
    const equivalent = calcEquivalentTomanForRequestType(input.rawAmount, appliedRate, fee, input.txType);
    const priority = input.serviceTier === "priority" ? policy.settings.priority_fee_aud : 0;
    const currency = input.txType === "buy_aud" ? "IRT" : "AUD";
    const priorityAmount = currency === "IRT" ? Math.round(priority * appliedRate) : priority;
    const fundingTotal = currency === "IRT" ? equivalent + priorityAmount : Math.round((input.rawAmount + priorityAmount) * 100) / 100;
    if (!Number.isFinite(appliedRate) || appliedRate <= 0 || !Number.isSafeInteger(equivalent) || equivalent <= 0 || !Number.isFinite(fundingTotal) || fundingTotal <= 0 || fundingTotal > Number.MAX_SAFE_INTEGER / 100) throw new Error("This amount cannot be quoted. Please review the amount and fees.");
    const snapshot: QuoteSnapshot = {
      locale: input.locale, customer_request_type: input.txType, company_trade_type: toCompanyTradeType(input.txType),
      raw_amount_aud: input.rawAmount, equivalent_toman: equivalent, applied_rate: appliedRate, base_fee_aud: fee,
      priority_fee_aud: priority, priority_fee_amount: priorityAmount, funding_currency: currency, funding_total: fundingTotal,
      recipient_amount: input.txType === "buy_aud" ? input.rawAmount : equivalent,
      recipient_currency: input.txType === "buy_aud" ? "AUD" : "IRT", service_tier: input.serviceTier,
      source_of_funds: input.sourceOfFunds.trim(), reason_for_transfer: input.reasonForTransfer.trim(),
      recipient_id: education ? null : input.recipientId, recipient_snapshot: recipient,
      sender_snapshot: { name: [profileResult.data?.first_name, profileResult.data?.last_name].filter(Boolean).join(" "), email: user.email },
      payment_link: education ? new URL(input.paymentLink!).href : null,
      institution_name: education ? input.institutionName!.trim() : null,
      invoice_reference: education ? input.invoiceReference!.trim() : null,
      promo_code: promoCode, promo_snapshot: promo ? { ...promo } : null, discount_amount: discount,
      loyalty_discount: Math.round(loyalty * input.rawAmount), policy_version: policy.version,
      policy_snapshot: publicRequestSettings(policy.settings), rate_id: String(rate.id),
    };
    const inserted = await db.from("exchange_request_quotes").insert({ user_id: user.id, snapshot, expires_at: new Date(Date.now() + policy.settings.quote_minutes * 60_000).toISOString() }).select("id,user_id,snapshot,expires_at,created_at").single();
    if (inserted.error) throw inserted.error;
    return inserted.data as RequestQuote;
  });
}

export async function submitExchangeRequest(input: { quoteId: string; commandKey: string }): Promise<ActionResult<ExchangeRequest>> {
  return result(async () => {
    const user = await customer();
    if (!input || !isUuid(input.quoteId) || !isUuid(input.commandKey)) throw new Error("Invalid quote. Please request a new quote.");
    const { data, error } = await database().rpc("submit_exchange_request", { p_actor_id: user.id, p_quote_id: input.quoteId, p_idempotency_key: input.commandKey });
    if (error) throw error;
    return data as ExchangeRequest;
  });
}
export async function listMyRequests(): Promise<ActionResult<ExchangeRequest[]>> {
  return result(async () => {
    const user = await customer();
    const { data, error } = await database().from("exchange_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data as ExchangeRequest[];
  });
}
async function readDetail(id: string, userId?: string): Promise<RequestDetail> {
  if (!isUuid(id)) throw new Error("Request not found.");
  const db = database();
  let query = db.from("exchange_requests").select("*").eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const request = await query.single();
  if (request.error || !request.data) throw new Error("Request not found.");
  const events = await db.from("exchange_request_events").select("id,request_id,sequence,event_type,status,public_message,actor_id,created_at").eq("request_id", id).order("sequence", { ascending: true });
  if (events.error) throw events.error;
  const detail: RequestDetail = { request: request.data as ExchangeRequest, events: events.data || [] };
  if (!userId) {
    const deliveries = await db.from("exchange_request_notification_deliveries").select("id,event_id,request_id,audience,recipient_email,locale,status,attempts,last_error,created_at").eq("request_id", id).order("created_at", { ascending: false }).limit(100);
    if (deliveries.error) throw deliveries.error;
    detail.deliveries = deliveries.data as RequestDetail["deliveries"];
  }
  return detail;
}
export async function getMyRequest(id: string): Promise<ActionResult<RequestDetail>> {
  return result(async () => readDetail(id, (await customer()).id));
}
async function mutate(input: RequestMutationInput, admin: boolean): Promise<ExchangeRequest> {
  const actor = admin ? await requireAdmin() : await customer();
  const invalid = mutationInputError(input, admin);
  if (invalid) throw new Error(invalid);
  // Whitelist fields rather than forwarding arbitrary client JSON to privileged SQL.
  const supplied = input.payload || {};
  const payload = Object.fromEntries(Object.entries({
    message: supplied.message?.trim(), payment_reference: supplied.payment_reference?.trim(),
    received_amount: supplied.received_amount, received_currency: supplied.received_currency,
    settlement_reference: supplied.settlement_reference?.trim(), payer_account_id: supplied.payer_account_id,
    receiver_account_id: supplied.receiver_account_id, transfer_method: supplied.transfer_method || "free",
    refund_reference: supplied.refund_reference?.trim(), refund_kind: supplied.refund_kind,
    ...(input.action === "complete" ? { date_jalali: new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date()) } : {}),
  }).filter(([, value]) => value !== undefined));
  const { data, error } = await database().rpc("transition_exchange_request", {
    p_actor_id: actor.id, p_request_id: input.requestId, p_expected_version: input.expectedVersion,
    p_command_key: input.commandKey, p_action: input.action, p_payload: payload,
  });
  if (error) throw error;
  return data as ExchangeRequest;
}
export async function mutateMyRequest(input: RequestMutationInput): Promise<ActionResult<ExchangeRequest>> {
  return result(() => mutate(input, false));
}
export async function listAdminRequests(): Promise<ActionResult<ExchangeRequest[]>> {
  return result(async () => {
    await requireAdmin();
    const db = database();
    const closed = ["completed", "cancelled", "rejected", "expired"];
    const [active, recent] = await Promise.all([
      db.from("exchange_requests").select("*").not("status", "in", `(${closed.join(",")})`).order("handling_due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }).limit(200),
      db.from("exchange_requests").select("*").in("status", closed).order("updated_at", { ascending: false }).limit(50),
    ]);
    if (active.error) throw active.error;
    if (recent.error) throw recent.error;
    return [...(active.data || []), ...(recent.data || [])] as ExchangeRequest[];
  });
}
export async function getAdminRequest(id: string): Promise<ActionResult<RequestDetail>> {
  return result(async () => { await requireAdmin(); return readDetail(id); });
}
export async function mutateAdminRequest(input: RequestMutationInput): Promise<ActionResult<ExchangeRequest>> {
  return result(() => mutate(input, true));
}
export async function getRequestSettings(): Promise<ActionResult<SettingsRecord>> {
  return result(async () => { await requireAdmin(); return settingsRecord(); });
}
export async function saveRequestSettings(input: { expectedVersion: number; settings: RequestSettings }): Promise<ActionResult<SettingsRecord>> {
  return result(async () => {
    const actor = await requireAdmin();
    if (!input || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new Error("Refresh the settings before saving.");
    const invalid = settingsInputError(input.settings);
    if (invalid) throw new Error(invalid);
    if (input.settings.enabled && (!process.env.RESEND_API_KEY || !process.env.REQUEST_NOTIFICATIONS_CRON_SECRET || !process.env.REQUEST_SITE_URL || !process.env.RESEND_WEBHOOK_SECRET)) throw new Error("Configure the notification sender, webhook, site URL and scheduled worker credentials before enabling requests.");
    const { data, error } = await database().rpc("save_exchange_request_settings", {
      p_actor_id: actor.id, p_expected_version: input.expectedVersion,
      p_settings: { ...input.settings, management_emails: [...new Set(input.settings.management_emails.map(email => email.trim().toLowerCase()))] },
    });
    if (error) throw error;
    return data as SettingsRecord;
  });
}
export async function getRequestBankAccounts(): Promise<ActionResult<Array<{ id: string; account_name: string; currency: string }>>> {
  return result(async () => {
    await requireAdmin();
    const { data, error } = await database().from("bank_accounts").select("id,account_name,currency").eq("is_active", true).order("account_name");
    if (error) throw error;
    return data || [];
  });
}
