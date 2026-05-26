"use server";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { renderTransactionReceiptPdf } from "@/emails/TransactionReceiptPdf";
import { renderTransactionReceiptHtml } from "@/emails/TransactionReceiptEmail";
import { requireAdmin } from "@/app/actions/admin.actions";

// ─── Clients ──────────────────────────────────────────────────────────────────

function makeServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function makeResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY environment variable is not set.");
  return new Resend(key);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SendReceiptResult =
  | { success: true; emailId: string }
  | { error: string };

type TxProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
} | null;

type TxRecipient = {
  direction: string | null;
  bank_type: string | null;
  bank_name: string | null;
  bsb: string | null;
  account_number: string | null;
  account_name: string | null;
  residential_address: string | null;
  recipient_phone: string | null;
  full_name: string | null;
  irt_address: string | null;
  irt_phone: string | null;
  irt_account_number: string | null;
  card_number: string | null;
  shaba_number: string | null;
} | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildBankDetail(recipient: NonNullable<TxRecipient>): string {
  const dir = recipient.direction;
  if (!dir) return "";

  if (dir === "aud") {
    const parts: string[] = [];
    if (recipient.bank_name) parts.push(String(recipient.bank_name));
    if (recipient.bsb) parts.push(`BSB ${recipient.bsb}`);
    if (recipient.account_number) parts.push(`Acc ${recipient.account_number}`);
    return parts.join(" / ");
  }

  // IRT direction
  const isMelli = recipient.bank_type === "bank_melli";
  if (isMelli) {
    const parts: string[] = ["Bank Melli"];
    if (recipient.irt_account_number) parts.push(`Acc ${recipient.irt_account_number}`);
    if (recipient.card_number) parts.push(`Card ${recipient.card_number}`);
    return parts.join(" / ");
  }

  // Other Iranian bank — use Shaba
  if (recipient.shaba_number) return `Shaba ${recipient.shaba_number}`;
  return recipient.bank_name ? String(recipient.bank_name) : "";
}

function formatAUD(amount: number): string {
  return `${amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} AUD`;
}

function formatToman(amount: number): string {
  return `${amount.toLocaleString("en-AU")} تومان`;
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Sends a "Transaction Successful" receipt email to the customer.
 * Admin-only — throws if the caller is not an authenticated admin.
 *
 * @param transactionId  The ID of the transaction row.
 */
export async function sendTransactionReceipt(
  transactionId: string | number
): Promise<SendReceiptResult> {
  // 1. Verify admin session first — fail fast if unauthorized
  const admin = await requireAdmin();
  const db = makeServiceRoleClient();

  // 2. Fetch full transaction with profile + recipient in one query
  const { data: tx, error: txError } = await db
    .from("transactions")
    .select(`
      id, type, amount_aud, equivalent_toman, final_amount, status, created_at,
      source_of_funds, reason_for_transfer, promo_code, reference_code,
      profiles(
        first_name, last_name, email, mobile_number,
        address, city, state, postcode
      ),
      recipients(
        direction, bank_type, bank_name, bsb, account_number, account_name,
        residential_address, recipient_phone, full_name,
        irt_address, irt_phone, irt_account_number, card_number, shaba_number
      )
    `)
    .eq("id", transactionId)
    .single();

  if (txError || !tx) {
    return { error: `Transaction not found: ${txError?.message ?? "unknown error"}` };
  }

  const profile = (Array.isArray(tx.profiles) ? tx.profiles[0] : tx.profiles) as TxProfile;
  const recipient = (Array.isArray(tx.recipients) ? tx.recipients[0] : tx.recipients) as TxRecipient;

  if (!profile?.email) {
    return { error: "Customer email address is missing from the profile." };
  }

  // 3. Map DB row → template props
  const senderFullName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Valued Customer";

  const senderPhone = profile.mobile_number ?? "";
  const senderAddress = [
    profile.address ?? "",
    profile.city ?? "",
    profile.state ?? "",
    profile.postcode ?? "",
  ].filter(Boolean).join(", ");

  let receiverFullName = "—";
  let receiverPhone = "";
  let receiverAddress = "";
  let receiverBankDetail = "";

  if (recipient) {
    if (recipient.direction === "aud") {
      receiverFullName = recipient.account_name ?? "—";
      receiverPhone = recipient.recipient_phone ?? "";
      receiverAddress = recipient.residential_address ?? "";
    } else {
      receiverFullName = recipient.full_name ?? "—";
      receiverPhone = recipient.irt_phone ?? "";
      receiverAddress = recipient.irt_address ?? "";
    }
    receiverBankDetail = buildBankDetail(recipient);
  }

  // For Buy AUD: customer sends Toman, receives AUD
  // For Sell AUD: customer sends AUD, receives Toman
  const isBuyAud = tx.type === "buy_aud";
  const audAmount = Number(tx.final_amount ?? tx.amount_aud ?? 0);
  const tomanAmount = Number(tx.equivalent_toman ?? 0);

  const amountSent = isBuyAud ? formatToman(tomanAmount) : formatAUD(audAmount);
  const amountReceived = isBuyAud ? formatAUD(audAmount) : formatToman(tomanAmount);

  // 4. Render HTML template + PDF attachment in parallel
  const receiptProps = {
    referenceId: (tx as any).reference_code ?? tx.id,
    transactionDate: tx.created_at,
    senderFullName,
    senderPhone,
    senderAddress,
    receiverFullName,
    receiverPhone,
    receiverAddress,
    receiverBankDetail,
    amountSent,
    amountReceived,
    promoCode: tx.promo_code ?? null,
    sourceOfFunds: tx.source_of_funds ?? null,
  };

  const [emailHtml, pdfBytes] = await Promise.all([
    Promise.resolve(renderTransactionReceiptHtml(receiptProps)),
    renderTransactionReceiptPdf(receiptProps),
  ]);

  // 5. Send via Resend
  const resend = makeResendClient();
  const customerEmail = String(profile.email);

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: "Zarman Exchange <info@zarman.com.au>",
    to: [customerEmail],
    subject: `Transaction Successful — Ref ${(tx as any).reference_code ?? `#${tx.id}`} | Zarman Exchange`,
    html: emailHtml,
    attachments: [
      {
        filename: `zarman-receipt-${tx.id}.pdf`,
        content: Buffer.from(pdfBytes),
      },
    ],
    // Optional: BCC to admin mailbox for record-keeping
    // bcc: ["admin@zarmanex.com"],
  });

  if (sendError) {
    return { error: `Email send failed: ${sendError.message}` };
  }

  // 6. Write audit log — non-blocking; do not fail the action if audit log fails
  try {
    // 6a. Mark transaction as receipt sent so UI remembers
    await db.from("transactions").update({ receipt_sent: true }).eq("id", transactionId);

    const { error: auditError } = await db.from("audit_logs").insert([
      {
        actor_id: admin.id,
        actor_email: admin.email ?? "",
        action: "RECEIPT_EMAIL_SENT",
        target_type: "transaction",
        target_id: String(transactionId),
        old_value: null,
        new_value: {
          sent_to: customerEmail,
          resend_email_id: sendData?.id ?? null,
        },
      },
    ]);
    if (auditError) {
      console.warn("[sendTransactionReceipt] Audit log write failed:", auditError.message);
    }
  } catch (auditErr) {
    console.warn("[sendTransactionReceipt] Audit log exception:", auditErr);
  }

  return { success: true, emailId: sendData?.id ?? "" };
}
