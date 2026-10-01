"use server";

import { createClient, type User } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { newRequestTelegramMessage, sendTelegramAdminMessage } from "@/lib/notifications/telegram";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/app/actions/admin.actions";
import { applyPromoCode, calcAppliedFee, calcEquivalentTomanForRequestType, calcLoyaltyDiscount, FINANCE_CONFIG_DEFAULTS, toCompanyTradeType, type PromoCodeData } from "@/lib/pricing";
import { DEFAULT_REQUEST_SETTINGS, isUuid, messageInputError, mutationInputError, publicRequestSettings, quoteInputError, settingsInputError } from "@/lib/requests/validation";
import type { ActionResult, ExchangeRequest, PublicRequestSettings, QuoteInput, QuoteSnapshot, RequestDetail, RequestMessageInput, RequestMessageResult, RequestMutationInput, RequestQuote, RequestReceipt, RequestSettings, SettingsRecord } from "@/lib/requests/types";
import { inspectReceiptUpload, MAX_REQUEST_RECEIPT_BYTES, REQUEST_RECEIPTS_BUCKET } from "@/lib/requests/receipt-upload";
import { validatedNotificationSettings } from "@/lib/requests/notification-config";
import { createNotificationDatabase, createRequestEmailSender, notificationRuntimeSettings, notificationWorkerFailureDiagnostic, sendRequestNotifications } from "@/lib/requests/notifications";
import { isInstitutionPaymentLink, paymentInstitution } from "@/lib/payments/institutions";
import { decryptPaymentAccountAccess, encryptPaymentAccountAccess, validatePaymentAccountAccess, type PaymentAccountAccess } from "@/lib/payments/account-access";
import { requestMatchesSearch, requestNeedsAttention, type ActivityFilter, type RequestPage } from "@/lib/dashboard/activity";
import { cleanSearchTerm, DASHBOARD_PAGE_SIZE, ilikeAny, requestedPage } from "@/lib/dashboard/paging";

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
/** Admin-approved emails go out within the same click; nothing waits for a scheduler.
 * The request change is already committed, so a mail problem never fails the action;
 * the admin sees each email's outcome in the request's delivery list. */
async function sendApprovedEmails(requestId: string) {
  try {
    const settings = notificationRuntimeSettings();
    await sendRequestNotifications({ db: createNotificationDatabase(), send: createRequestEmailSender(settings.apiKey), ...settings, requestId });
  } catch (error) {
    // Log only explicit operation/code/status fields, never the error or cause.
    console.error(notificationWorkerFailureDiagnostic(error));
  }
}
async function settingsRecord(validate = true): Promise<SettingsRecord> {
  const { data, error } = await database().from("exchange_request_settings").select("version, settings").eq("id", true).single();
  if (error) throw error;
  if (!data) throw new Error("Request settings are unavailable.");
  const settings = { ...DEFAULT_REQUEST_SETTINGS, ...data.settings } as RequestSettings;
  const validation = settingsInputError(settings);
  if (validate && validation) throw new Error("Request service settings need administrator review.");
  return { version: data.version, settings };
}

function customerRequest(request: ExchangeRequest): ExchangeRequest {
  // Staff approval gates bank details in every customer-facing response.
  if (request.payment_approved_at) return request;
  return { ...request, payment_details: null, payment_instructions: null, payment_instructions_fa: null };
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
    const institution = input.institutionId ? paymentInstitution(input.institutionId) : undefined;
    if (input.recipientId === "__edu_exam__" && input.institutionId && input.institutionId !== "other" && !institution) throw new Error("Choose a supported institution.");
    if (input.recipientId === "__edu_exam__" && !isInstitutionPaymentLink(input.paymentLink || "")) throw new Error("Enter a valid HTTPS institution payment link without a password.");
    const institutionName = institution?.companyName ?? input.institutionName?.trim();
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
      recipient = { label: institutionName!, institution_name: institutionName!, institution_id: institution?.id ?? (input.institutionId === "other" ? "other" : null), invoice_reference: input.invoiceReference?.trim() || null, direction: input.txType === "buy_aud" ? "aud" : "irt" };
    } else {
      const lookup = await db.from("recipients").select("id,user_id,direction,label,bank_name,bank_city,bsb,account_number,account_name,residential_address,residential_city,residential_state,residential_postcode,residential_country,recipient_email,recipient_phone,bank_type,card_number,shaba_number,irt_account_number,full_name,irt_address,irt_city,irt_state,irt_postcode,irt_country,irt_phone,updated_at").eq("id", input.recipientId).eq("user_id", user.id).is("archived_at", null).single();
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
      institution_name: education ? institutionName! : null,
      invoice_reference: education ? input.invoiceReference?.trim() || null : null,
      promo_code: promoCode, promo_snapshot: promo ? { ...promo } : null, discount_amount: discount,
      loyalty_discount: Math.round(loyalty * input.rawAmount), policy_version: policy.version,
      policy_snapshot: publicRequestSettings(policy.settings), rate_id: String(rate.id),
    };
    const inserted = await db.from("exchange_request_quotes").insert({ user_id: user.id, snapshot, expires_at: new Date(Date.now() + policy.settings.quote_minutes * 60_000).toISOString() }).select("id,user_id,snapshot,expires_at,created_at").single();
    if (inserted.error) throw inserted.error;
    return inserted.data as RequestQuote;
  });
}

export async function submitExchangeRequest(input: { quoteId: string; commandKey: string; paymentAccount?: PaymentAccountAccess }): Promise<ActionResult<ExchangeRequest>> {
  return result(async () => {
    const user = await customer();
    if (!input || !isUuid(input.quoteId) || !isUuid(input.commandKey)) throw new Error("Invalid quote. Please request a new quote.");
    const account = validatePaymentAccountAccess(input.paymentAccount);
    const args = { p_actor_id: user.id, p_quote_id: input.quoteId, p_idempotency_key: input.commandKey };
    const db = database();
    // A retried key returns the existing request; only a first submission alerts the team.
    const previous = await db.from("exchange_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("idempotency_key", input.commandKey);
    if (previous.error) throw previous.error;
    const { data, error } = account
      ? await db.rpc("submit_exchange_request_with_payment_access", { ...args, p_encrypted_account: encryptPaymentAccountAccess(account, user.id, input.quoteId) })
      : await db.rpc("submit_exchange_request", args);
    if (error) throw error;
    const request = data as ExchangeRequest;
    if (!previous.count) after(async () => {
      try { await sendTelegramAdminMessage(newRequestTelegramMessage(request), process.env.TELEGRAM_REQUESTS_CHAT_ID || undefined); }
      catch { console.error("[submitExchangeRequest] Telegram notification unavailable"); }
    });
    return customerRequest(request);
  });
}
/** Newest staff message across the signed-in customer's requests, for the dashboard chime. */
export async function getMyLatestAdminMessage(): Promise<ActionResult<{ id: string; requestId: string; createdAt: string } | null>> {
  return result(async () => {
    const user = await customer();
    const { data, error } = await database().from("exchange_request_messages").select("id,request_id,created_at,exchange_requests!inner(user_id)")
      .eq("sender_role", "admin").eq("exchange_requests.user_id", user.id).order("created_at", { ascending: false }).limit(1);
    if (error) throw error;
    const row = data?.[0];
    return row ? { id: String(row.id), requestId: String(row.request_id), createdAt: String(row.created_at) } : null;
  });
}
export async function getAdminPaymentAccount(requestId: string): Promise<ActionResult<PaymentAccountAccess | null>> {
  return result(async () => {
    await requireAdmin();
    if (!isUuid(requestId)) throw new Error("Request not found.");
    const db = database();
    const request = await db.from("exchange_requests").select("funding_status").eq("id", requestId).single();
    if (request.error) throw request.error;
    if (request.data?.funding_status !== "confirmed") throw new Error("Payment account details are available after customer funds are confirmed.");
    const { data, error } = await db.rpc("read_funded_request_payment_access", { p_request_id: requestId });
    if (error) throw error;
    const row = data?.[0];
    return row ? decryptPaymentAccountAccess(row.encrypted_account, row.user_id, row.quote_id) : null;
  });
}
export async function listMyRequests(): Promise<ActionResult<ExchangeRequest[]>> {
  return result(async () => {
    const user = await customer();
    const { data, error } = await database().from("exchange_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return (data as ExchangeRequest[]).map(customerRequest);
  });
}
const FINISHED_REQUEST_STATUSES = ["cancelled", "rejected", "expired", "completed"];
/** Just what the overview shows: open requests, recent activity and the latest records, newest first. */
export async function listMyOverviewRequests(): Promise<ActionResult<ExchangeRequest[]>> {
  return result(async () => {
    const user = await customer();
    const db = database(), mine = () => db.from("exchange_requests").select("*").eq("user_id", user.id);
    const responses = await Promise.all([
      mine().not("status", "in", `(${FINISHED_REQUEST_STATUSES.join(",")})`).order("created_at", { ascending: false }).limit(20),
      mine().order("updated_at", { ascending: false }).limit(3),
      mine().eq("status", "completed").order("created_at", { ascending: false }).limit(1),
      mine().order("created_at", { ascending: false }).limit(1),
    ]);
    const unique = new Map<string, ExchangeRequest>();
    for (const response of responses) {
      if (response.error) throw response.error;
      for (const row of response.data as ExchangeRequest[]) unique.set(row.id, row);
    }
    return [...unique.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(customerRequest);
  });
}
const REQUEST_SEARCH_COLUMNS = ["reference_code", "quote->recipient_snapshot->>full_name", "quote->recipient_snapshot->>account_name", "quote->recipient_snapshot->>label", "quote->>institution_name"];
/** One page of the Transactions list: open requests (few, ranked in memory) first, then finished ones paged in SQL. */
export async function listMyRequestPage(input: { filter?: ActivityFilter; search?: string; page?: number }): Promise<ActionResult<RequestPage>> {
  return result(async () => {
    const user = await customer();
    const filter: ActivityFilter = ["active", "attention", "completed"].includes(input?.filter as string) ? input.filter as ActivityFilter : "all";
    const term = cleanSearchTerm(input?.search), db = database();
    const finished = (head: boolean) => {
      let query = db.from("exchange_requests").select("*", head ? { count: "exact", head: true } : undefined).eq("user_id", user.id);
      query = filter === "completed" ? query.eq("status", "completed") : query.in("status", FINISHED_REQUEST_STATUSES);
      return term ? query.or(ilikeAny(REQUEST_SEARCH_COLUMNS, term)) : query;
    };
    const withFinished = filter === "all" || filter === "completed";
    const [openResult, allResult, completedResult, finishedCount] = await Promise.all([
      db.from("exchange_requests").select("*").eq("user_id", user.id).not("status", "in", `(${FINISHED_REQUEST_STATUSES.join(",")})`).order("created_at", { ascending: false }).limit(100),
      db.from("exchange_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      db.from("exchange_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
      withFinished ? finished(true) : null,
    ]);
    for (const response of [openResult, allResult, completedResult, finishedCount]) if (response?.error) throw response.error;
    const open = (openResult.data as ExchangeRequest[]).map(customerRequest), attention = open.filter(requestNeedsAttention);
    const counts = { all: allResult.count ?? 0, active: open.length, attention: attention.length, completed: completedResult.count ?? 0 };
    const ranked = (filter === "attention" ? attention : filter === "completed" ? [] : [...attention, ...open.filter(request => !requestNeedsAttention(request))])
      .filter(request => requestMatchesSearch(request, term));
    const total = ranked.length + (finishedCount?.count ?? 0);
    const page = Math.min(requestedPage(input?.page), Math.max(1, Math.ceil(total / DASHBOARD_PAGE_SIZE))), start = (page - 1) * DASHBOARD_PAGE_SIZE;
    const items = ranked.slice(start, start + DASHBOARD_PAGE_SIZE);
    if (withFinished && items.length < DASHBOARD_PAGE_SIZE && total > ranked.length) {
      const offset = Math.max(0, start - ranked.length);
      const rows = await finished(false).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + DASHBOARD_PAGE_SIZE - items.length - 1);
      if (rows.error) throw rows.error;
      items.push(...(rows.data as ExchangeRequest[]).map(customerRequest));
    }
    return { items, total, page, counts };
  });
}
async function readDetail(id: string, userId?: string): Promise<RequestDetail> {
  if (!isUuid(id)) throw new Error("Request not found.");
  const db = database();
  let query = db.from("exchange_requests").select("*").eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const request = await query.single();
  if (request.error || !request.data) throw new Error("Request not found.");
  const eventQuery = userId
    ? db.from("exchange_request_events").select("id,request_id,sequence,event_type,status,public_message,actor_id,created_at")
      .eq("request_id", id).eq("customer_visible", true).order("sequence", { ascending: true })
    : db.from("exchange_request_events").select("id,request_id,sequence,event_type,status,public_message,actor_id,created_at,internal_message,send_email")
      .eq("request_id", id).order("sequence", { ascending: true });
  const [events, receipts, messages] = await Promise.all([
    eventQuery,
    db.from("exchange_request_receipts").select("id,request_id,original_name,content_type,size_bytes,sha256,uploaded_by,created_at").eq("request_id", id).order("created_at", { ascending: false }),
    db.from("exchange_request_messages").select("id,request_id,event_id,event_sequence,sender_id,sender_role,body,send_email,created_at").eq("request_id", id).order("event_sequence", { ascending: true }),
  ]);
  if (events.error) throw events.error;
  if (receipts.error) throw receipts.error;
  if (messages.error) throw messages.error;
  const detail: RequestDetail = { request: userId ? customerRequest(request.data as ExchangeRequest) : request.data as ExchangeRequest, events: events.data || [], receipts: receipts.data as RequestReceipt[], messages: messages.data || [] };
  if (!userId) {
    const [deliveries, payments] = await Promise.all([
      db.from("exchange_request_notification_deliveries").select("id,event_id,request_id,audience,recipient_email,locale,status,attempts,last_error,created_at").eq("request_id", id).order("created_at", { ascending: false }).limit(100),
      db.from("exchange_request_payments").select("id,request_id,payment_reference,amount,currency,account_id,created_at").eq("request_id", id).order("created_at", { ascending: false }),
    ]);
    if (deliveries.error) throw deliveries.error;
    if (payments.error) throw payments.error;
    detail.deliveries = deliveries.data as RequestDetail["deliveries"];
    detail.payments = (payments.data || []) as RequestDetail["payments"];
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
  const db = database();
  let accountingDate: string | undefined;
  if (["complete", "reconcile_complete", "confirm_funds", "resume_funded_request", "confirm_refund"].includes(input.action)) {
    // The server-added date is part of the SQL command fingerprint. Keep the
    // original date on a retry across midnight, while the RPC still validates
    // the actor, version, action and every caller-supplied payload field.
    const prior = await db.from("exchange_request_commands").select("accounting_date_jalali")
      .eq("request_id", input.requestId).eq("command_key", input.commandKey).eq("actor_id", actor.id).maybeSingle();
    if (prior.error) throw prior.error;
    const recordedDate = prior.data?.accounting_date_jalali;
    if (recordedDate != null) {
      if (typeof recordedDate !== "string" || !/^\d{4}\/\d{2}\/\d{2}$/.test(recordedDate)) throw new Error("The saved accounting date needs administrator review.");
      accountingDate = recordedDate;
    } else {
      const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).formatToParts(new Date());
      accountingDate = ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("/");
    }
  }
  // Whitelist fields rather than forwarding arbitrary client JSON to privileged SQL.
  const supplied = input.payload || {};
  // Admins no longer type bank references. Derive one from the command key so a
  // retry of the same command sends an identical, idempotent payload.
  const generatedReference = `AUTO-${input.commandKey.slice(0, 13).toUpperCase()}`;
  const payload = Object.fromEntries(Object.entries({
    message: supplied.message?.trim(),
    payment_reference: supplied.payment_reference?.trim() || (admin && input.action === "confirm_funds" ? generatedReference : undefined),
    received_amount: supplied.received_amount, received_currency: supplied.received_currency,
    settlement_reference: supplied.settlement_reference?.trim() || (admin && ["complete", "reconcile_complete"].includes(input.action) ? generatedReference : undefined),
    payer_account_id: supplied.payer_account_id,
    receiver_account_id: supplied.receiver_account_id, transfer_method: supplied.transfer_method || "free",
    refund_reference: supplied.refund_reference?.trim(), refund_kind: supplied.refund_kind,
    honour_quote: supplied.honour_quote,
    ...(admin ? { send_email: input.sendEmail } : {}),
    ...(accountingDate ? { date_jalali: accountingDate } : {}),
  }).filter(([, value]) => value !== undefined));
  const { data, error } = await db.rpc("transition_exchange_request", {
    p_actor_id: actor.id, p_request_id: input.requestId, p_expected_version: input.expectedVersion,
    p_command_key: input.commandKey, p_action: input.action, p_payload: payload,
  });
  if (error) throw error;
  if (admin && input.action === "confirm_funds") await saveAccountingTerms(db, data as ExchangeRequest, supplied);
  if (admin && input.sendEmail === true) await sendApprovedEmails(input.requestId);
  return admin ? data as ExchangeRequest : customerRequest(data as ExchangeRequest);
}
// Admin-adjusted rate/fee only change the accounting record (ledger + linked
// transaction). The accepted quote, customer amounts and payout stay unchanged.
async function saveAccountingTerms(db: ReturnType<typeof database>, request: ExchangeRequest, supplied: NonNullable<RequestMutationInput["payload"]>) {
  if ((supplied.accounting_rate === undefined && supplied.accounting_fee_aud === undefined) || !request?.quote) return;
  const quoteRate = Number(request.quote.applied_rate), quoteFee = Number(request.quote.base_fee_aud);
  const rate = supplied.accounting_rate ?? quoteRate, fee = supplied.accounting_fee_aud ?? quoteFee;
  if (rate === quoteRate && fee === quoteFee) return;
  const overrides = { applied_rate: rate, base_fee_aud: fee };
  const saved = await db.from("exchange_requests").update({ accounting_overrides: overrides }).eq("id", request.id);
  const linked = saved.error ? saved : await db.from("transactions").update({ applied_rate: rate, ledger_fee_aud: fee }).eq("id", request.transaction_id).eq("status", "pending");
  if (saved.error || linked.error) throw new Error("Funds were recorded, but the adjusted rate or fee could not be saved. Refresh and contact an administrator.");
}
export async function mutateMyRequest(input: RequestMutationInput): Promise<ActionResult<ExchangeRequest>> {
  return result(() => mutate(input, false));
}
export async function listAdminRequests(): Promise<ActionResult<ExchangeRequest[]>> {
  return result(async () => {
    await requireAdmin();
    const db = database();
    // Without a scheduler, expiry and overdue checks run when staff open the queue.
    // Best effort: the sweep is idempotent and must never block the list.
    const sweep = await db.rpc("sweep_exchange_request_deadlines").then(response => response.error, () => true);
    if (sweep) console.error("[listAdminRequests] Deadline sweep unavailable");
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
export async function deleteAdminRequest(id: string): Promise<ActionResult<{ transactionId: string; warning?: string }>> {
  return result(async () => {
    const admin = await requireAdmin();
    if (!isUuid(id)) throw new Error("Request not found.");

    const db = database();
    const { data, error } = await db.rpc("admin_hard_delete_exchange_request", {
      p_actor_id: admin.id,
      p_request_id: id,
    });
    if (error) throw error;

    const deleted = (data ?? {}) as { transaction_id?: string; receipt_paths?: unknown };
    const paths = Array.from(new Set(
      Array.isArray(deleted.receipt_paths)
        ? deleted.receipt_paths.filter((path): path is string => typeof path === "string" && path.length > 0)
        : [],
    ));
    let warning: string | undefined;
    if (paths.length > 0) {
      const cleanup = await db.storage.from(REQUEST_RECEIPTS_BUCKET).remove(paths);
      if (cleanup.error) warning = `The request was deleted, but ${paths.length} receipt file(s) could not be removed: ${cleanup.error.message}`;
    }

    return {
      transactionId: deleted.transaction_id ?? "",
      ...(warning ? { warning } : {}),
    };
  });
}
export async function mutateAdminRequest(input: RequestMutationInput): Promise<ActionResult<ExchangeRequest>> {
  return result(() => mutate(input, true));
}
async function sendMessage(input: RequestMessageInput, admin: boolean): Promise<RequestMessageResult> {
  const actor = admin ? await requireAdmin() : await customer();
  const invalid = messageInputError(input, admin);
  if (invalid) throw new Error(invalid);
  const { data, error } = await database().rpc("send_exchange_request_message", {
    p_actor_id: actor.id, p_request_id: input.requestId, p_expected_version: input.expectedVersion,
    p_command_key: input.commandKey, p_message: input.message.trim(), p_send_email: admin ? input.sendEmail : false,
  });
  if (error) throw error;
  if (admin && input.sendEmail === true) await sendApprovedEmails(input.requestId);
  return data as RequestMessageResult;
}
export async function sendMyRequestMessage(input: RequestMessageInput): Promise<ActionResult<RequestMessageResult>> {
  return result(() => sendMessage(input, false));
}
export async function sendAdminRequestMessage(input: RequestMessageInput): Promise<ActionResult<RequestMessageResult>> {
  return result(() => sendMessage(input, true));
}
export async function getRequestSettings(): Promise<ActionResult<SettingsRecord>> {
  // Administrators must be able to repair settings saved before new fields existed.
  return result(async () => { await requireAdmin(); return settingsRecord(false); });
}
export async function saveRequestSettings(input: { expectedVersion: number; settings: RequestSettings }): Promise<ActionResult<SettingsRecord>> {
  return result(async () => {
    const actor = await requireAdmin();
    if (!input || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new Error("Refresh the settings before saving.");
    const invalid = settingsInputError(input.settings);
    if (invalid) throw new Error(invalid);
    if (input.settings.enabled) {
      try {
        validatedNotificationSettings(process.env);
        if (!process.env.RESEND_WEBHOOK_SECRET?.trim()) throw new Error("notification_webhook_not_configured");
      } catch {
        throw new Error("Configure a valid notification sender, HTTPS site URL and webhook secret before enabling requests.");
      }
    }
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

const RECEIPT_PUBLIC_COLUMNS = "id,request_id,original_name,content_type,size_bytes,sha256,uploaded_by,created_at";

export async function uploadRequestReceipt(form: FormData): Promise<ActionResult<RequestReceipt>> {
  return result(async () => {
    const user = await customer();
    if (!(form instanceof FormData)) throw new Error("Choose a bank transfer receipt to upload.");
    const requestId = form.get("requestId"), commandKey = form.get("commandKey"), file = form.get("file");
    if (!isUuid(requestId) || !isUuid(commandKey) || !(file instanceof File)) throw new Error("Choose a receipt for a valid request.");
    if (!file.size || file.size > MAX_REQUEST_RECEIPT_BYTES) throw new Error("Upload a receipt of up to 4 MB.");
    const db = database();
    const request = await db.from("exchange_requests").select("id,user_id,status,funding_status,priority_fee_status,payment_approved_at").eq("id", requestId).eq("user_id", user.id).single();
    if (request.error || !request.data) throw new Error("Request not found.");
    if (!request.data.payment_approved_at) throw new Error("Wait for payment approval before sending a receipt.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspected = inspectReceiptUpload(bytes, file.name, file.type);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const duplicate = await db.from("exchange_request_receipts").select(RECEIPT_PUBLIC_COLUMNS).eq("request_id", requestId).eq("sha256", digest).maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data) return duplicate.data as RequestReceipt;
    if (!["submitted", "under_review", "action_required", "awaiting_funds"].includes(request.data.status)
      || ["confirmed", "refund_pending", "refunded"].includes(request.data.funding_status)
      || ["refund_pending", "refunded"].includes(request.data.priority_fee_status)) throw new Error("Receipts can only be uploaded while your payment is awaiting review.");
    const count = await db.from("exchange_request_receipts").select("id", { count: "exact", head: true }).eq("request_id", requestId);
    if (count.error) throw count.error;
    if ((count.count || 0) >= 10) throw new Error("This request already has ten receipts. Please use the request response to contact the team.");
    const path = `${user.id}/${requestId}/${commandKey}.${inspected.extension}`;
    const bucket = db.storage.from(REQUEST_RECEIPTS_BUCKET);
    const upload = await bucket.upload(path, bytes, { contentType: inspected.contentType, upsert: false, cacheControl: "0" });
    if (upload.error) {
      // A timeout/retry can encounter an already-uploaded object. Verify the
      // existing bytes; never overwrite evidence under an existing command key.
      const existing = await bucket.download(path);
      if (existing.error || !existing.data) throw new Error("The receipt upload could not be confirmed. Retry with the same file.");
      const existingHash = createHash("sha256").update(new Uint8Array(await existing.data.arrayBuffer())).digest("hex");
      if (existingHash !== digest) throw new Error("This upload attempt belongs to a different file. Select the receipt again.");
    }
    const attached = await db.rpc("attach_exchange_request_receipt", {
      p_actor_id: user.id, p_request_id: requestId, p_receipt_id: commandKey, p_path: path,
      p_original_name: inspected.filename, p_content_type: inspected.contentType, p_size_bytes: file.size,
      p_sha256: digest, p_command_key: commandKey,
    });
    if (attached.error) {
      // Only delete a new object after a definite rejected DB command. A network
      // timeout may have committed; preserve its evidence for reconciliation.
      if (!upload.error && attached.error.code && attached.error.code !== "PGRST000") {
        const committed = await db.from("exchange_request_receipts").select("id").eq("id", commandKey).maybeSingle();
        if (!committed.error && !committed.data) await bucket.remove([path]);
      }
      throw attached.error;
    }
    const receipt = attached.data as RequestReceipt;
    if (receipt.id !== commandKey && !upload.error) await bucket.remove([path]);
    // The RPC contains server-only storage metadata. Enumerate the public shape.
    return { id: receipt.id, request_id: receipt.request_id, original_name: receipt.original_name,
      content_type: receipt.content_type, size_bytes: receipt.size_bytes, sha256: receipt.sha256,
      uploaded_by: receipt.uploaded_by, created_at: receipt.created_at, request_version: receipt.request_version };
  });
}

export async function getRequestReceiptUrl(receiptId: string): Promise<ActionResult<{ url: string }>> {
  return result(async () => {
    const user = await customer();
    if (!isUuid(receiptId)) throw new Error("Receipt not found.");
    const db = database();
    const receipt = await db.from("exchange_request_receipts").select("request_id,storage_path,original_name").eq("id", receiptId).single();
    if (receipt.error || !receipt.data) throw new Error("Receipt not found.");
    const request = await db.from("exchange_requests").select("user_id").eq("id", receipt.data.request_id).single();
    if (request.error || !request.data) throw new Error("Receipt not found.");
    if (request.data.user_id !== user.id) await requireAdmin();
    const url = await db.storage.from(REQUEST_RECEIPTS_BUCKET).createSignedUrl(receipt.data.storage_path, 60, { download: receipt.data.original_name });
    if (url.error || !url.data) throw new Error("The receipt download is temporarily unavailable.");
    return { url: url.data.signedUrl };
  });
}
