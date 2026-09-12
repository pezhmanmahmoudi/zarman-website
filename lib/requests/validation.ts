import type { PublicRequestSettings, QuoteInput, RequestMutationInput, RequestSettings } from "./types";

export const DEFAULT_REQUEST_SETTINGS: RequestSettings = {
  enabled: false, priority_enabled: false, priority_fee_aud: 0, priority_capacity: 0,
  standard_minutes: 240, priority_minutes: 30, quote_minutes: 10, funding_minutes: 60,
  max_amount_aud: 1_000_000, timezone: "Australia/Sydney", business_days: [1, 2, 3, 4, 5],
  opening_hour: 9, closing_hour: 17, holidays: [], management_emails: [],
  payment_instructions_aud: "", payment_instructions_irt: "", priority_terms: "", priority_terms_fa: "",
};
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string { return typeof value === "string" && UUID_PATTERN.test(value); }
export function isMoney(value: unknown, maximum = Number.MAX_SAFE_INTEGER / 100): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= maximum
    && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}
export function publicRequestSettings(settings: RequestSettings): PublicRequestSettings {
  // Enumerate public fields so adding a private setting cannot expose it by accident.
  return {
    enabled: settings.enabled, priority_enabled: settings.priority_enabled,
    priority_fee_aud: settings.priority_fee_aud, priority_capacity: settings.priority_capacity,
    standard_minutes: settings.standard_minutes, priority_minutes: settings.priority_minutes,
    quote_minutes: settings.quote_minutes, funding_minutes: settings.funding_minutes,
    max_amount_aud: settings.max_amount_aud, timezone: settings.timezone,
    business_days: settings.business_days, opening_hour: settings.opening_hour,
    closing_hour: settings.closing_hour, holidays: settings.holidays,
    priority_terms: settings.priority_terms, priority_terms_fa: settings.priority_terms_fa,
  };
}
function boundedText(value: unknown, maximum: number, required = true): boolean {
  return typeof value === "string" && value.trim().length <= maximum && (!required || value.trim().length > 0)
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
export function quoteInputError(input: QuoteInput, settings: RequestSettings): string | null {
  if (!input || typeof input !== "object") return "Invalid request details.";
  if (!settings.enabled) return "Online requests are temporarily unavailable. Please contact support.";
  if (!isMoney(input.rawAmount, settings.max_amount_aud)) return "Enter a valid AUD amount within the service limit, with at most two decimal places.";
  if (!["buy_aud", "sell_aud"].includes(input.txType)) return "Choose a transfer direction.";
  if (!["en", "fa"].includes(input.locale)) return "Choose a supported language.";
  if (!["standard", "priority"].includes(input.serviceTier)) return "Choose a service level.";
  if (input.serviceTier === "priority" && (!settings.priority_enabled || settings.priority_fee_aud <= 0 || settings.priority_capacity < 1)) return "Priority service is currently unavailable. Choose Standard.";
  if (!boundedText(input.sourceOfFunds, 200) || !boundedText(input.reasonForTransfer, 200)) return "Confirm your source of funds and reason for transfer.";
  if (input.promoCode != null && (typeof input.promoCode !== "string" || !/^[a-zA-Z0-9_-]{0,50}$/.test(input.promoCode.trim()))) return "Enter a valid promotion code.";
  if (input.recipientId === "__edu_exam__") {
    if (!boundedText(input.institutionName, 200) || !boundedText(input.invoiceReference, 200)) return "Enter the institution name and invoice or student reference.";
    try {
      const url = new URL(input.paymentLink || "");
      if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2000) return "Enter a valid HTTPS institution payment link.";
    } catch { return "Enter a valid HTTPS institution payment link."; }
  } else if (!isUuid(input.recipientId)) return "Choose a saved recipient or add a recipient.";
  return null;
}
export function settingsInputError(input: RequestSettings): string | null {
  if (!input || typeof input !== "object" || typeof input.enabled !== "boolean" || typeof input.priority_enabled !== "boolean") return "Invalid service settings.";
  for (const [key, minimum, maximum] of [
    ["standard_minutes", 1, 10_080], ["priority_minutes", 1, 1_440], ["quote_minutes", 1, 60],
    ["funding_minutes", 5, 10_080], ["priority_capacity", 0, 1_000], ["opening_hour", 0, 23], ["closing_hour", 1, 24],
  ] as const) {
    if (!Number.isInteger(input[key]) || input[key] < minimum || input[key] > maximum) return `Invalid value for ${key.replaceAll("_", " ")}.`;
  }
  if (input.closing_hour <= input.opening_hour || input.timezone !== "Australia/Sydney") return "Choose valid Sydney business hours.";
  if (!isMoney(input.max_amount_aud, 10_000_000)) return "Choose a positive maximum AUD amount up to 10,000,000.";
  if (typeof input.priority_fee_aud !== "number" || (input.priority_fee_aud !== 0 && !isMoney(input.priority_fee_aud, 10_000))) return "Enter a valid priority fee.";
  if (!Array.isArray(input.business_days) || !input.business_days.length || input.business_days.length > 7
      || new Set(input.business_days).size !== input.business_days.length || input.business_days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) return "Choose at least one business day.";
  if (!Array.isArray(input.holidays) || input.holidays.length > 366 || input.holidays.some(day => {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return true;
    const date = new Date(day + "T00:00:00Z");
    return !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day;
  })) return "Enter valid holiday dates in YYYY-MM-DD format.";
  if (!Array.isArray(input.management_emails) || input.management_emails.length > 10
      || input.management_emails.some(email => typeof email !== "string" || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) return "Enter up to ten valid management email addresses.";
  for (const key of ["payment_instructions_aud", "payment_instructions_irt", "priority_terms", "priority_terms_fa"] as const) {
    if (!boundedText(input[key], 4000, false)) return "Instructions and terms must be plain text, up to 4,000 characters.";
  }
  if (input.enabled && (!input.management_emails.length || !input.payment_instructions_aud.trim() || !input.payment_instructions_irt.trim())) return "Add management recipients and both currencies' payment instructions before enabling requests.";
  if (input.priority_enabled && (!input.enabled || input.priority_fee_aud <= 0 || input.priority_capacity < 1
      || input.priority_minutes >= input.standard_minutes || !input.priority_terms.trim() || !input.priority_terms_fa.trim())) return "Configure capacity, fee, faster handling and terms in both languages before enabling priority.";
  return null;
}
export function mutationInputError(input: RequestMutationInput, admin: boolean): string | null {
  if (!input || !isUuid(input.requestId) || !isUuid(input.commandKey) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) return "Invalid request. Refresh the page and try again.";
  const allowed = admin
    ? ["review", "request_info", "await_funds", "confirm_funds", "start_processing", "record_uncertain_payout", "complete", "cancel", "reject", "confirm_refund"]
    : ["respond", "cancel", "payment_evidence"];
  if (!allowed.includes(input.action)) return "This action is not available.";
  const payload = input.payload || {};
  if (typeof payload !== "object" || Array.isArray(payload)) return "Invalid action details.";
  if (["request_info", "respond", "record_uncertain_payout", "reject"].includes(input.action) && !boundedText(payload.message, 2000)) return "Enter the reason or requested information.";
  if (payload.message !== undefined && !boundedText(payload.message, 2000, false)) return "Your message must be at most 2,000 characters.";
  if (["confirm_funds", "payment_evidence"].includes(input.action) && !boundedText(payload.payment_reference, 200)) return "Enter the payment reference.";
  if (input.action === "confirm_funds" && (!isMoney(payload.received_amount) || !["AUD", "IRT"].includes(payload.received_currency || "")
      || (payload.received_currency === "IRT" && !Number.isInteger(payload.received_amount)))) return "Enter the reconciled amount and currency (whole Toman).";
  if (input.action === "complete" && (!boundedText(payload.settlement_reference, 200) || !isUuid(payload.payer_account_id)
      || !isUuid(payload.receiver_account_id) || payload.payer_account_id === payload.receiver_account_id)) return "Enter the settlement reference and distinct payer and receiver accounts.";
  if (payload.transfer_method && !["free", "pol", "paya", "satna"].includes(payload.transfer_method)) return "Choose a valid bank transfer method.";
  if (input.action === "confirm_refund" && (!boundedText(payload.refund_reference, 200) || !["priority", "principal"].includes(payload.refund_kind || ""))) return "Enter the refund reference and refund kind.";
  return null;
}
