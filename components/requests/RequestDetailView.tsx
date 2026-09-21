"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Download, Mail, RefreshCw } from "lucide-react";
import { getAdminRequest, getMyRequest, getRequestBankAccounts, mutateAdminRequest, mutateMyRequest } from "@/app/actions/request.actions";
import type { ExchangeRequest, RequestCommand, RequestDetail, RequestMutationInput } from "@/lib/requests/types";
import { requestDate, requestLabel, requestMoney, requestError, isRequestTerminal, type RequestLocale } from "./request-labels";
import { getRequestJourney, requestActivityLabel, requestEmailStatus, requestMilestones, requestStageLabel } from "@/lib/requests/journey";
import { isMoney } from "@/lib/requests/validation";
import { RequestQuoteFacts } from "./RequestQuoteFacts";
import { RequestProgress } from "./RequestProgress";
import { RequestPaymentInstructions } from "./RequestPaymentInstructions";
import { RequestReceiptUpload } from "./RequestReceiptUpload";
import { RequestAdminMessageBanner, RequestConversation } from "./RequestConversation";
import { supabase } from "@/lib/supabase";
import styles from "@/styles/requests/Requests.module.css";
import workspace from "@/styles/requests/RequestWorkspace.module.css";

const commandLabels: Record<RequestCommand, [string, string]> = {
  review: ["Start review", "شروع بررسی"], request_info: ["Request information", "درخواست اطلاعات"], respond: ["Send response", "ارسال پاسخ"],
  await_funds: ["Approve request", "تأیید درخواست"], confirm_funds: ["Confirm funds received", "تأیید دریافت وجه"],
  resume_funded_request: ["Approve funded request", "تأیید درخواست تأمین‌شده"],
  start_processing: ["Approve & start processing", "تأیید و شروع پردازش"], record_uncertain_payout: ["Reconcile payout", "بررسی نتیجه پرداخت"],
  complete: ["Reconcile & complete", "تطبیق و تکمیل حواله"], reconcile_complete: ["Reconcile & complete", "تطبیق و تکمیل حواله"], cancel: ["Cancel request", "لغو درخواست"], reject: ["Reject request", "رد درخواست"],
  confirm_refund: ["Approve returned refund", "تأیید بازپرداخت"], payment_evidence: ["Add payment reference", "ثبت شماره پیگیری واریز"],
};

function allowedCommands(request: ExchangeRequest, admin: boolean): RequestCommand[] {
  const commands: RequestCommand[] = [];
  const hasPrincipalRefund = ["refund_pending", "refunded"].includes(request.funding_status);
  const hasRefund = hasPrincipalRefund || ["refund_pending", "refunded"].includes(request.priority_fee_status);
  if (admin) {
    if (["submitted", "under_review", "awaiting_funds", "action_required", "ready"].includes(request.status)) commands.push("request_info");
    if (!hasRefund && request.funding_status !== "confirmed" && ["submitted", "under_review", "action_required"].includes(request.status)) commands.push("await_funds");
    if (request.payment_approved_at && !hasRefund && request.funding_status !== "confirmed" && ["submitted", "under_review", "awaiting_funds", "action_required", "expired"].includes(request.status)) commands.push("confirm_funds");
    if (!hasPrincipalRefund && request.funding_status === "confirmed" && ["under_review", "action_required"].includes(request.status)) commands.push("resume_funded_request");
    if (getRequestJourney(request).readyForSettlement) commands.push("reconcile_complete");
    if (request.status === "processing") commands.push("record_uncertain_payout");
    if (["processing", "reconciliation"].includes(request.status)) commands.push("complete");
    if (!isRequestTerminal(request.status) && !["processing", "reconciliation"].includes(request.status)) commands.push("reject");
    if (request.priority_fee_status === "refund_pending" || request.funding_status === "refund_pending") commands.push("confirm_refund");
  } else {
    if (!getRequestJourney(request).fundsReceived && ["submitted", "under_review", "action_required", "awaiting_funds", "ready"].includes(request.status)) commands.push("cancel");
  }
  return commands;
}

function recommendedCommand(request: ExchangeRequest, commands: RequestCommand[]): RequestCommand | undefined {
  if (commands.includes("confirm_refund")) return "confirm_refund";
  if (getRequestJourney(request).customerActionRequired) return undefined;
  const order: RequestCommand[] = ["resume_funded_request", "reconcile_complete", "complete", ...(request.payment_approved_at && request.evidence_submitted_at ? ["confirm_funds" as const] : []), "await_funds"];
  return order.find(command => commands.includes(command));
}

export function RequestDetailView({ id, admin = false, locale = "en" }: { id: string; admin?: boolean; locale?: RequestLocale }) {
  const fa = locale === "fa";
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<RequestCommand | "">("");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [paymentReference, setPaymentReference] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedCurrency, setReceivedCurrency] = useState<"AUD" | "IRT" | "">("");
  const [settlementReference, setSettlementReference] = useState("");
  const [payerAccount, setPayerAccount] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");
  const [fundingAccount, setFundingAccount] = useState("");
  const [refundAccount, setRefundAccount] = useState("");
  const [honourQuote, setHonourQuote] = useState(false);
  const [transferMethod, setTransferMethod] = useState<"free" | "pol" | "paya" | "satna">("free");
  const [refundKind, setRefundKind] = useState<"priority" | "principal">("priority");
  const [refundReference, setRefundReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; account_name: string; currency: string }>>([]);
  const [validation, setValidation] = useState<{ field: string; message: string } | null>(null);
  const [differentCurrency, setDifferentCurrency] = useState(false);
  const [separateDeposit, setSeparateDeposit] = useState(false);
  const [savedDeposit, setSavedDeposit] = useState<{ requestId: string; reference: string; amount: number; currency: "AUD" | "IRT"; version: number } | null>(null);
  const pending = useRef(false);
  const attempt = useRef<{ signature: string; key: string; expectedVersion: number } | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await (admin ? getAdminRequest(id) : getMyRequest(id));
      if (result.error) setError(result.error);
      else if (result.data) {
        const latest = result.data;
        setDetail(current => current?.request.id === latest.request.id && current.request.version > latest.request.version ? current : latest);
        setSavedDeposit(saved => saved && saved.requestId === latest.request.id && latest.request.version >= saved.version && latest.payments?.some(payment => payment.payment_reference === saved.reference && payment.currency === saved.currency && Number(payment.amount) === saved.amount) ? null : saved);
        setError("");
      }
    } catch { setError(fa ? "دریافت وضعیت ممکن نشد. دوباره تلاش کنید." : "Could not load the latest status. Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id, admin, fa]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && !pending.current) void refresh(); }, 20000);
    const onFocus = () => { if (!pending.current) void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible" && !pending.current) void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  useEffect(() => {
    if (typeof supabase.channel !== "function") return;
    const channel = supabase
      .channel(`request-status:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exchange_request_realtime_signals", filter: `request_id=eq.${id}` }, () => {
        if (!pending.current) void refresh();
      })
      .subscribe();
    return () => { if (typeof supabase.removeChannel === "function") void supabase.removeChannel(channel); };
  }, [id, refresh]);

  useEffect(() => {
    if (!admin) return;
    getRequestBankAccounts().then(result => {
      if (result.data) setAccounts(result.data.map(account => ({ ...account, id: String(account.id) })));
      else if (result.error) setError(result.error);
    }).catch(() => setError("Could not load bank accounts."));
  }, [admin]);

  useEffect(() => { setConfirmed(false); }, [detail?.request.version]);
  useEffect(() => { if (validation?.field === "submission") document.getElementById("request-form-feedback")?.focus(); }, [validation]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !currentAction || pending.current) return;
    const invalid = (field: string, explanation: string) => {
      setValidation({ field, message: explanation });
      event.currentTarget?.querySelector<HTMLElement>(`#request-${field}`)?.focus();
    };
    if (currentAction === "confirm_funds") {
      if (!paymentReference.trim() || paymentReference.trim().length > 200) return invalid("payment-reference", fa ? "شماره پیگیری درج‌شده در گردش حساب را وارد کنید." : "Enter the payment reference from the bank statement.");
      if (!isMoney(Number(receivedAmount)) || (fundingCurrency === "IRT" && !Number.isInteger(Number(receivedAmount)))) return invalid("received-amount", fundingCurrency === "IRT" ? (fa ? "مبلغ دریافتی را به تومان و بدون اعشار وارد کنید." : "Enter the cleared amount in whole Toman (IRT).") : (fa ? "مبلغ دریافت‌شده به دلار استرالیا را با حداکثر دو رقم اعشار وارد کنید." : "Enter the cleared amount in AUD, with up to two decimal places."));
      if (!fundingAccount) return invalid("funding-account", fa ? "حسابی که وجه در آن تسویه شده را انتخاب کنید." : `Select the ${currencyLabel(fundingCurrency)} account that received the cleared deposit.`);
    }
    if (currentAction === "resume_funded_request" && !honourQuote) return invalid("honour-quote", fa ? "پس از بررسی، نرخ پذیرفته‌شده را تأیید کنید." : "Confirm the accepted quote after completing the checks.");
    if (["complete", "reconcile_complete"].includes(currentAction)) {
      if (!settlementReference.trim() || settlementReference.trim().length > 200) return invalid("settlement-reference", "Enter the settlement reference from the bank.");
      if (!payerAccount) return invalid("payer-account", "Select the account used for the recipient payment.");
      if (!receiverAccount) return invalid("receiver-account", "Select the account that collected the customer funds.");
      if (payerAccount === receiverAccount) return invalid("receiver-account", "Choose the separate collection account.");
    }
    if (currentAction === "confirm_refund") {
      if (!refundReference.trim() || refundReference.trim().length > 200) return invalid("refund-reference", "Enter the bank reference for the returned funds.");
      if (!refundAccount) return invalid("refund-account", "Select the account debited for the refund.");
    }
    if (messageRequired && (message.trim().length < 3 || message.trim().length > 2000)) return invalid("action-message", fa ? "دلیل یا پیام را با حداقل سه نویسه وارد کنید." : "Enter a message or reason of at least 3 characters.");
    if (!confirmed) return invalid("confirmation", currentAction === "confirm_funds" ? (fa ? "وجه تسویه‌شده را در حساب بانکی بررسی کرده و گزینه تأیید را انتخاب کنید." : "Check the bank account, then tick the cleared-funds verification.") : (fa ? "پس از بررسی، گزینه تأیید را انتخاب کنید." : "Review the details, then tick the approval confirmation."));
    setValidation(null);
    const submittedAction = currentAction;
    const payload: NonNullable<RequestMutationInput["payload"]> = {};
    if (message.trim()) payload.message = message.trim();
    if (submittedAction === "confirm_funds") payload.payment_reference = paymentReference.trim();
    if (submittedAction === "confirm_funds") { payload.received_amount = Number(receivedAmount); payload.received_currency = fundingCurrency; payload.receiver_account_id = fundingAccount; }
    if (submittedAction === "resume_funded_request") payload.honour_quote = honourQuote;
    if (["complete", "reconcile_complete"].includes(submittedAction)) { payload.settlement_reference = settlementReference.trim(); payload.payer_account_id = payerAccount; payload.receiver_account_id = receiverAccount; payload.transfer_method = transferMethod; }
    if (submittedAction === "confirm_refund") { payload.refund_kind = activeRefundKind; payload.refund_reference = refundReference.trim(); payload.payer_account_id = refundAccount; }
    const input = { requestId: id, action: submittedAction, payload, ...(admin ? { sendEmail } : {}) };
    const signature = JSON.stringify(input);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID(), expectedVersion: detail.request.version };
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await (admin ? mutateAdminRequest : mutateMyRequest)({ ...input, commandKey: attempt.current.key, expectedVersion: attempt.current.expectedVersion });
      if (result.error) {
        if (result.error === "This request has changed. Refresh the page before continuing." || result.error === "REQUEST_CONFLICT") {
          attempt.current = null;
          setConfirmed(false);
          await refresh();
        }
        setError(result.error);
        setValidation({ field: "submission", message: requestError(result.error, locale) });
      }
      else if (result.data) {
        const updated = result.data;
        setDetail(current => current && current.request.id === updated.id && current.request.version <= updated.version ? { ...current, request: updated } : current);
        attempt.current = null; setAction(""); setMessage(""); setPaymentReference(""); setConfirmed(false); setHonourQuote(false);
        setReceivedAmount(""); setSettlementReference(""); setPayerAccount(""); setReceiverAccount(""); setFundingAccount(""); setRefundAccount(""); setRefundReference("");
        setDifferentCurrency(false); setSeparateDeposit(false); setReceivedCurrency("");
        if (submittedAction === "confirm_funds") {
          setSavedDeposit({ requestId: updated.id, reference: paymentReference.trim(), amount: Number(receivedAmount), currency: fundingCurrency, version: updated.version });
          const outstanding = Math.max(0, Number(updated.quote.funding_total) - Number(updated.funding_received));
          setNotice(fundingCurrency !== updated.quote.funding_currency
            ? `Deposit recorded in ${currencyLabel(fundingCurrency)}. This request expects ${currencyLabel(updated.quote.funding_currency)}; finance review is required.`
            : getRequestJourney(updated).readyForSettlement ? "Funds received. Ready for destination reconciliation."
            : updated.funding_status === "partial" ? `Partial payment recorded. ${requestMoney(outstanding, updated.quote.funding_currency, locale)} still to collect.`
            : "Deposit recorded. The request remains on hold for review.");
        } else setNotice(fa ? "تغییرات ثبت شد." : "Update saved.");
        await refresh();
      } else {
        const unconfirmed = fa ? "ثبت تأیید نشد. دوباره تلاش کنید." : "The update was not confirmed. Please retry.";
        setError(unconfirmed); setValidation({ field: "submission", message: unconfirmed });
      }
    } catch {
      const unconfirmed = fa ? "ثبت تأیید نشد. دوباره تلاش کنید." : "The update was not confirmed. Please retry.";
      setError(unconfirmed); setValidation({ field: "submission", message: unconfirmed });
    }
    finally { pending.current = false; setBusy(false); }
  }

  const request = detail?.request;
  const visibleSavedDeposit = savedDeposit?.requestId === request?.id ? savedDeposit : null;
  const payments = admin ? detail?.payments || [] : [];
  const hasMismatchedDeposit = payments.some(payment => payment.currency !== request?.quote.funding_currency) || !!(visibleSavedDeposit && visibleSavedDeposit.currency !== request?.quote.funding_currency);
  const commands = request ? allowedCommands(request, admin).filter(command => !(hasMismatchedDeposit && ["await_funds", "resume_funded_request"].includes(command))) : [];
  const recommended = admin && request ? recommendedCommand(request, commands) : undefined;
  const selectedAction = commands.includes(action as RequestCommand) ? action : recommended || "";
  const currentAction = selectedAction === "confirm_funds" && hasMismatchedDeposit && !separateDeposit ? "" : selectedAction;
  const otherCommands = commands.filter(command => command !== recommended && !(command === "confirm_funds" && hasMismatchedDeposit));
  const referenceRequired = currentAction === "confirm_funds";
  const expectedCurrency = request?.quote.funding_currency || "AUD";
  const fundingCurrency = differentCurrency ? receivedCurrency || (expectedCurrency === "AUD" ? "IRT" : "AUD") : expectedCurrency;
  const currencyLabel = (currency: "AUD" | "IRT") => currency === "AUD" ? "AUD" : "Toman (IRT)";
  const activeRefundKind = refundKind === "priority" && request?.priority_fee_status !== "refund_pending" ? "principal" : refundKind;
  const journey = request ? getRequestJourney(request) : null;
  const milestones = request ? requestMilestones(request, detail?.events || []) : [];
  const messageRequired = ["request_info", "respond", "cancel", "reject", "record_uncertain_payout"].includes(currentAction);
  const accountsFor = (currency: "AUD" | "IRT") => accounts.filter(account => account.currency.toUpperCase() === currency || (currency === "IRT" && account.currency.toLowerCase() === "toman"));
  const messages = detail?.messages || [];
  const actionLabel = (command: RequestCommand) => command === "await_funds" && request?.payment_approved_at ? (fa ? "ادامه پرداخت" : "Resume payment") : commandLabels[command][fa ? 1 : 0];
  const fieldValidation = (field: string) => ({ "aria-invalid": validation?.field === field || undefined, "aria-describedby": validation?.field === field ? "request-form-feedback" : undefined });
  const chooseAction = (command: RequestCommand) => {
    if (!request) return;
    setAction(command); setConfirmed(false); setHonourQuote(false); setNotice(""); setMessage(""); setSendEmail(true);
    setValidation(null); setDifferentCurrency(false); setSeparateDeposit(command === "confirm_funds" && hasMismatchedDeposit);
    if (command === "confirm_funds" && hasMismatchedDeposit) { setPaymentReference(""); setReceivedAmount(""); setFundingAccount(""); }
    setRefundKind(request.priority_fee_status === "refund_pending" ? "priority" : "principal"); setReceivedCurrency("");
  };

  const milestoneHistory = <section className={styles.card}><h2>{fa ? "مراحل انجام حواله" : "Transfer milestones"}</h2><ol className={workspace.milestoneList}>{milestones.filter(milestone => milestone.done).map(milestone => <li key={milestone.key}><Check size={15} /><div><strong>{milestone.label[fa ? 1 : 0]}</strong>{milestone.at && <time dir="ltr" dateTime={milestone.at}>{requestDate(milestone.at, locale)}</time>}</div></li>)}</ol><span className={workspace.timezone}>{fa ? "زمان‌ها به وقت سیدنی" : "Sydney time"}</span></section>;
  const actionTitle = currentAction === "await_funds" ? (request?.payment_approved_at ? "Resume customer payment" : "Request approval") : currentAction === "confirm_funds" ? "Verify incoming payment" : ["complete", "reconcile_complete"].includes(currentAction) ? "Reconcile destination payment" : currentAction === "confirm_refund" ? "Refund confirmation" : currentAction ? actionLabel(currentAction) : "";
  const actionPanel = request && commands.length > 0 && <div>
    {currentAction && <form onSubmit={submit} className={workspace.actionForm} noValidate>
      <fieldset disabled={busy} className={workspace.fieldset}>
        <div className={workspace.actionHeading}>{admin && <span className={workspace.kicker}>Next step</span>}<h2>{actionTitle}</h2></div>
        {currentAction === "await_funds" && <div className={workspace.approvalSummary}><span>{request.quote.sender_snapshot.name}</span><strong>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}<ArrowRight size={16} />{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</strong></div>}
        {referenceRequired && <div className={workspace.paymentDirection}><div><span>Incoming from customer</span><strong><bdi>{requestMoney(request.quote.funding_total, expectedCurrency, locale)}</bdi></strong></div><div><span>Outgoing to recipient</span><bdi>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</bdi></div></div>}
        {admin && currentAction === "confirm_funds" && (detail?.receipts.length || 0) > 0 && <div className={workspace.evidenceReview}><RequestReceiptUpload request={request} receipts={detail?.receipts || []} admin locale={locale} onUploaded={refresh} /></div>}
        {referenceRequired && <label className={styles.field}>{fa ? "شماره پیگیری بانکی واریز *" : "Bank payment reference *"}<input id="request-payment-reference" value={paymentReference} onChange={event => setPaymentReference(event.target.value)} required maxLength={200} autoComplete="off" dir="ltr" {...fieldValidation("payment-reference")} aria-describedby={`request-bank-reference-hint${validation?.field === "payment-reference" ? " request-form-feedback" : ""}`} /><span className={workspace.fieldHint} id="request-bank-reference-hint">Use the reference shown on your bank statement.</span></label>}
        {currentAction === "confirm_funds" && <>
          <div className={styles.fields}><label className={styles.field}>Newly received amount ({currencyLabel(fundingCurrency)}) *<input id="request-received-amount" type="number" inputMode="decimal" required min={fundingCurrency === "AUD" ? "0.01" : "1"} step={fundingCurrency === "AUD" ? ".01" : "1"} value={receivedAmount} onChange={event => setReceivedAmount(event.target.value)} dir="ltr" {...fieldValidation("received-amount")} /></label><div className={workspace.lockedCurrency}><span>Incoming currency</span><strong>{currencyLabel(fundingCurrency)}</strong></div></div>
          <label className={styles.field}>Account credited ({currencyLabel(fundingCurrency)}) *<select id="request-funding-account" required value={fundingAccount} onChange={event => setFundingAccount(event.target.value)} {...fieldValidation("funding-account")}><option value="">Select account</option>{accountsFor(fundingCurrency).map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label>
          {Number(request.funding_received) > 0 && <p className={workspace.actionNote}>Already confirmed: {requestMoney(request.funding_received, request.quote.funding_currency, locale)}. Enter only the new payment.</p>}
          <details className={workspace.depositException}><summary>Deposit arrived in another currency</summary><label className={styles.checkbox}><input type="checkbox" checked={differentCurrency} onChange={event => { setDifferentCurrency(event.target.checked); setReceivedCurrency(expectedCurrency === "AUD" ? "IRT" : "AUD"); setReceivedAmount(""); setFundingAccount(""); setConfirmed(false); setValidation(null); }} /><span>Record an actual {currencyLabel(expectedCurrency === "AUD" ? "IRT" : "AUD")} deposit for finance review</span></label>{differentCurrency && <p className={workspace.actionNote}>This records the deposit in its actual currency. It does not confirm the expected {currencyLabel(expectedCurrency)} payment.</p>}</details>
        </>}
        {currentAction === "resume_funded_request" && <label className={styles.checkbox}><input id="request-honour-quote" type="checkbox" required checked={honourQuote} onChange={event => setHonourQuote(event.target.checked)} {...fieldValidation("honour-quote")} /><span>Checks complete. Honour the accepted quote and release the confirmed funds for processing. *</span></label>}
        {["complete", "reconcile_complete"].includes(currentAction) && <>
          <label className={styles.field}>Settlement reference *<input id="request-settlement-reference" required value={settlementReference} onChange={event => setSettlementReference(event.target.value)} maxLength={200} {...fieldValidation("settlement-reference")} /></label>
          <div className={styles.fields}><label className={styles.field}>Payout account *<select id="request-payer-account" required value={payerAccount} onChange={event => setPayerAccount(event.target.value)} {...fieldValidation("payer-account")}><option value="">Select account</option>{accountsFor(request.quote.recipient_currency).map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label><label className={styles.field}>Collection account *<select id="request-receiver-account" required value={receiverAccount} onChange={event => setReceiverAccount(event.target.value)} {...fieldValidation("receiver-account")}><option value="">Select account</option>{accountsFor(request.quote.funding_currency).map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label></div>
          <label className={styles.field}>Transfer method *<select required value={transferMethod} onChange={event => setTransferMethod(event.target.value as typeof transferMethod)}><option value="free">Free transfer</option><option value="pol">Pol</option><option value="paya">Paya</option><option value="satna">Satna</option></select></label>
        </>}
        {currentAction === "confirm_refund" && <>
          <label className={styles.field}>Refund<select value={activeRefundKind} onChange={event => setRefundKind(event.target.value as "priority" | "principal")}><option value="priority" disabled={request.priority_fee_status !== "refund_pending"}>Priority fee</option><option value="principal" disabled={request.funding_status !== "refund_pending"}>Principal</option></select></label>
          <label className={styles.field}>Return reference *<input id="request-refund-reference" required value={refundReference} onChange={event => setRefundReference(event.target.value)} maxLength={200} {...fieldValidation("refund-reference")} /></label>
          <label className={styles.field}>Account debited *<select id="request-refund-account" required value={refundAccount} onChange={event => setRefundAccount(event.target.value)} {...fieldValidation("refund-account")}><option value="">Select account</option>{accountsFor(request.quote.funding_currency).map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label>
        </>}
        {messageRequired && <label className={styles.field}>{currentAction === "record_uncertain_payout" ? "Internal reconciliation note" : admin ? "Message to customer" : (fa ? "دلیل" : "Reason")} *<textarea id="request-action-message" value={message} onChange={event => setMessage(event.target.value)} required minLength={3} maxLength={2000} rows={2} dir="auto" {...fieldValidation("action-message")} /></label>}
        {admin && <label className={`${styles.checkbox} ${workspace.emailChoice}`}><input type="checkbox" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} /><Mail size={16} aria-hidden="true" /><span>Send email to customer and management</span></label>}
        <label className={`${styles.checkbox} ${workspace.confirmChoice}`}><input id="request-confirmation" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required {...fieldValidation("confirmation")} /><span>{currentAction === "cancel" ? (fa ? "لغو را تأیید می‌کنم؛ بازپرداخت جداگانه پیگیری می‌شود." : "Confirm cancellation; any refund is tracked separately.") : currentAction === "confirm_funds" ? `I verified cleared funds in the bank account: the entered amount and ${currencyLabel(fundingCurrency)} currency.` : ["complete", "reconcile_complete"].includes(currentAction) ? "I verified the destination account, amount and successful settlement." : currentAction === "confirm_refund" ? "I verified the returned funds in the original currency." : (fa ? "اطلاعات را بررسی و تأیید می‌کنم." : "I checked and approve the request details.")} *</span></label>
        {validation && <p id="request-form-feedback" className={workspace.formFeedback} role="alert" tabIndex={-1}>{validation.message}</p>}
        <div className={styles.actions}><button className={["cancel", "reject"].includes(currentAction) ? styles.danger : styles.button} type="submit" disabled={busy}>{busy ? (fa ? "در حال ثبت…" : "Saving…") : referenceRequired && fundingCurrency !== expectedCurrency ? "Record deposit for review" : actionLabel(currentAction)}</button>{(currentAction !== recommended || separateDeposit) && <button type="button" className={workspace.textButton} onClick={() => { setAction(""); setSeparateDeposit(false); setConfirmed(false); setValidation(null); }}>{fa ? "انصراف" : "Back"}</button>}</div>
      </fieldset>
    </form>}
    {otherCommands.length > 0 && <details className={workspace.exceptionActions}><summary>{fa ? "سایر اقدامات" : "Other actions"}<ChevronDown size={14} /></summary><div className={workspace.actionChoices}>{otherCommands.map(command => <button key={command} type="button" className={workspace.actionChoice} aria-pressed={currentAction === command} disabled={busy} onClick={() => chooseAction(command)}>{actionLabel(command)}</button>)}</div></details>}
  </div>;

  const Page = admin ? "div" : "section";
  return <Page className={`${styles.workspace} ${workspace.workspace} ${admin ? workspace.adminWorkspace : ""}`} dir={fa ? "rtl" : "ltr"}>
    <header className={`${styles.header} ${workspace.header}`}>
      <div><Link className={workspace.backLink} href={admin ? "/admin/requests" : `/${locale}/dashboard/requests`}><ArrowLeft size={15} />{fa ? "درخواست‌ها" : "Requests"}</Link><div className={workspace.titleRow}><h1><bdi>{request?.reference_code || (fa ? "پیگیری درخواست" : "Request")}</bdi></h1>{request && <><span className={styles.badge}>{requestStageLabel(request, locale)}</span>{request.service_tier === "priority" && <span className={`${styles.badge} ${styles.priority}`}>{fa ? "اولویت‌دار" : "Priority"}</span>}</>}</div>{admin && request && <p className={workspace.customerIdentity}>{request.quote.sender_snapshot.name}<span>{request.quote.sender_snapshot.email}</span></p>}</div>
      <button className={styles.secondary} type="button" onClick={() => void refresh()} disabled={refreshing || busy}><RefreshCw size={16} />{fa ? "به‌روزرسانی" : "Refresh"}</button>
    </header>
    {error && (!currentAction || validation?.field !== "submission") && <p className={styles.error} role="alert">{requestError(error, locale)}</p>}{notice && <p className={workspace.saved} role="status">{notice}</p>}
    {loading && <p className={styles.loading} role="status">{fa ? "در حال بارگذاری…" : "Loading…"}</p>}
    {request && detail && <>
      {!admin && <RequestAdminMessageBanner messages={messages} fallbackMessage={journey?.customerActionMessage} replyRequired={journey?.customerActionRequired} locale={locale} />}
      {request.status === "reconciliation" && <p className={styles.warning}>{admin ? "Verify the bank result before retrying a payout." : (fa ? "نتیجه پرداخت بانکی در حال بررسی است." : "We’re checking the bank settlement.")}</p>}
      {(request.priority_fee_status === "refund_pending" || request.funding_status === "refund_pending") && <p className={styles.warning}>{admin ? "Refund approval required." : (fa ? "بازپرداخت در حال پیگیری است." : "Your refund is being arranged.")}</p>}
      {admin ? <div className={workspace.adminLayout}>
        <div className={workspace.column}>
          {(payments.length > 0 || visibleSavedDeposit) && <section className={`${styles.card} ${workspace.recordedDeposits}`}><h2>Recorded deposits</h2>
            {hasMismatchedDeposit && <p className={workspace.depositWarning}>Finance review required. Expected incoming currency: <strong>{currencyLabel(expectedCurrency)}</strong>.</p>}
            <ol className={workspace.depositList}>{payments.map(payment => <li key={payment.id}>
              <div className={workspace.depositHeading}><strong><bdi>{requestMoney(payment.amount, payment.currency, locale)}</bdi></strong>{payment.currency !== expectedCurrency && <span className={workspace.depositMismatch}>Currency mismatch</span>}</div>
              <span className={workspace.depositReference}>Bank reference: <bdi>{payment.payment_reference}</bdi></span>
              <time dir="ltr" dateTime={payment.created_at}>{requestDate(payment.created_at, locale)}</time>
            </li>)}{visibleSavedDeposit && !payments.some(payment => payment.payment_reference === visibleSavedDeposit.reference && payment.currency === visibleSavedDeposit.currency && Number(payment.amount) === visibleSavedDeposit.amount) && <li><div className={workspace.depositHeading}><strong><bdi>{requestMoney(visibleSavedDeposit.amount, visibleSavedDeposit.currency, locale)}</bdi></strong><span className={workspace.depositMismatch}>{visibleSavedDeposit.currency !== expectedCurrency ? "Currency mismatch" : "Saved"}</span></div><span className={workspace.depositReference}>Bank reference: <bdi>{visibleSavedDeposit.reference}</bdi></span><span className={workspace.fieldHint}>Saved. Refresh to load the bank record details.</span></li>}</ol>
            {hasMismatchedDeposit && commands.includes("confirm_funds") && currentAction !== "confirm_funds" && <button type="button" className={workspace.textButton} disabled={busy} onClick={() => chooseAction("confirm_funds")}>Record a separate cleared deposit</button>}
          </section>}
          {actionPanel && <section className={`${styles.card} ${workspace.approvalCard}`}>{!currentAction && <div className={workspace.waitingAdmin}><Clock3 size={24} /><h2>{isRequestTerminal(request.status) ? requestStageLabel(request, locale) : journey?.customerActionRequired ? "Waiting for customer response" : hasMismatchedDeposit ? "Review recorded deposit" : journey?.fundsReceived || request.action_required ? "Admin review required" : "Waiting for customer receipt"}</h2></div>}{actionPanel}</section>}
          {request.status === "completed" && <section className={`${styles.card} ${workspace.receiptReady}`}><div><Check size={20} /><h2>Transfer completed</h2></div><a className={styles.button} href={`/api/requests/${request.id}/receipt`} target="_blank" rel="noopener noreferrer"><Download size={17} />Final receipt</a></section>}
          {currentAction !== "confirm_funds" && detail.receipts.length > 0 && <RequestReceiptUpload request={request} receipts={detail.receipts} admin locale={locale} onUploaded={refresh} />}
          <RequestConversation requestId={id} version={request.version} messages={messages} admin locale={locale} disabled={busy} onUpdated={refresh} onSendingChange={sending => { pending.current = sending; setBusy(sending); }} />
        </div>
        <div className={workspace.column}>
          <section className={styles.card}><h2>Transfer summary</h2><dl className={styles.facts}>
            <div className={styles.fact}><dt>Incoming from customer</dt><dd>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</dd></div>
            <div className={styles.fact}><dt>Cleared funds</dt><dd>{requestMoney(request.funding_received, request.quote.funding_currency, locale)}<span className={workspace.cellDetail}>{requestLabel(request.funding_status, locale)}</span></dd></div>
            <div className={styles.fact}><dt>Outgoing to recipient</dt><dd>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</dd></div>
            {request.service_tier === "priority" && <div className={styles.fact}><dt>Priority fee</dt><dd>{requestMoney(request.quote.priority_fee_amount, request.quote.funding_currency, locale)}<span className={workspace.cellDetail}>{requestLabel(request.priority_fee_status, locale)}</span></dd></div>}
            <div className={styles.fact}><dt>Funds confirmed</dt><dd>{requestDate(request.funds_confirmed_at, locale)}</dd></div>
            <div className={styles.fact}><dt>Handling due</dt><dd>{requestDate(request.handling_due_at, locale)}</dd></div>
          </dl><span className={workspace.timezone}>Sydney time</span></section>
          {request.action_required && request.action_required !== journey?.customerActionMessage && <section className={workspace.adminAlert}><strong>Admin review</strong><p dir="auto">{request.action_required}</p></section>}
          {journey?.customerActionRequired && <section className={workspace.adminAlert}><strong>Awaiting customer</strong><p dir="auto">{journey.customerActionMessage}</p></section>}
          <section className={styles.card}><h2>Destination account</h2><dl className={styles.facts}>
            {Boolean(request.quote.recipient_snapshot.bank_city) && <div className={styles.fact}><dt>Bank branch city</dt><dd>{String(request.quote.recipient_snapshot.bank_city)}</dd></div>}
            <div className={styles.fact}><dt>Recipient</dt><dd>{request.quote.institution_name || String(request.quote.recipient_snapshot.account_name || request.quote.recipient_snapshot.full_name || request.quote.recipient_snapshot.label || "—")}</dd></div>
            {request.quote.recipient_snapshot.bsb != null && <div className={styles.fact}><dt>BSB</dt><dd><bdi>{String(request.quote.recipient_snapshot.bsb)}</bdi></dd></div>}
            <div className={styles.fact}><dt>Account / IBAN</dt><dd><bdi>{String(request.quote.recipient_snapshot.account_number || request.quote.recipient_snapshot.shaba_number || request.quote.recipient_snapshot.irt_account_number || "—")}</bdi></dd></div>
            <div className={styles.fact}><dt>Amount</dt><dd>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</dd></div>
            {request.quote.invoice_reference && <div className={styles.fact}><dt>Invoice</dt><dd>{request.quote.invoice_reference}</dd></div>}
          </dl>{request.quote.payment_link && <a className={workspace.textButton} href={request.quote.payment_link} target="_blank" rel="noopener noreferrer">Open payment page</a>}</section>
          <details className={`${styles.card} ${workspace.disclosure}`}><summary>Accepted quote<ChevronDown size={16} /></summary><div className={workspace.disclosureBody}><RequestQuoteFacts quote={request.quote} locale={locale} /><dl className={styles.facts}><div className={styles.fact}><dt>Source of funds</dt><dd>{request.quote.source_of_funds}</dd></div><div className={styles.fact}><dt>Purpose</dt><dd>{request.quote.reason_for_transfer}</dd></div></dl></div></details>
          {milestoneHistory}
          <details className={`${styles.card} ${workspace.disclosure}`}><summary>Activity & email history<ChevronDown size={16} /></summary><div className={workspace.disclosureBody}>
            <ol className={workspace.activityList}>{[...detail.events].reverse().map(event => {
              const eventMessages = messages.filter(item => item.event_id === event.id);
              const actor = eventMessages[0]?.sender_role === "customer" || event.actor_id === request.user_id ? "Customer" : event.actor_id ? "Zarman team" : "System";
              const deliveries = detail.deliveries?.filter(delivery => delivery.event_id === event.id) || [];
              const privateNote = event.internal_message && event.internal_message !== event.public_message && !/^[\s]*[\[{]/.test(event.internal_message) ? event.internal_message : null;
              return <li key={event.id}><div className={workspace.activityHeading}><strong>{requestActivityLabel(event.event_type, locale)}</strong><time dir="ltr" dateTime={event.created_at}>{requestDate(event.created_at, locale)}</time></div><span className={workspace.activityActor}>{actor}</span>{privateNote && <details className={workspace.activityNotes}><summary>Internal note</summary><p dir="auto">{privateNote}</p></details>}{deliveries.length > 0 && <ul className={workspace.emailActivity}>{deliveries.map(delivery => <li key={delivery.id}><span><Mail size={13} />{delivery.audience === "customer" ? "Customer email" : "Management email"}</span><span>{requestEmailStatus(delivery.status, delivery.last_error, locale)}</span></li>)}</ul>}</li>;
            })}</ol>
          </div></details>
        </div>
      </div> : <>
        <RequestProgress request={request} events={detail.events} locale={locale} />
        <div className={workspace.customerLayout}>
          <div className={workspace.column}>
            {request.status === "completed" && <section className={`${styles.card} ${workspace.receiptReady}`}><div><Check size={20} /><h2>{fa ? "رسید نهایی آماده است" : "Your receipt is ready"}</h2></div><a className={styles.button} href={`/api/requests/${request.id}/receipt`} target="_blank" rel="noopener noreferrer"><Download size={17} />{fa ? "دریافت رسید" : "Download receipt"}</a></section>}
            {journey?.canPay && !journey.receiptSubmitted && <RequestPaymentInstructions request={request} locale={locale} />}
            <RequestReceiptUpload request={request} receipts={detail.receipts || []} locale={locale} onUploaded={refresh} />
            <RequestConversation requestId={id} version={request.version} messages={messages} locale={locale} disabled={busy} onUpdated={refresh} onSendingChange={sending => { pending.current = sending; setBusy(sending); }} />
          </div>
          <div className={workspace.column}>
            <section className={styles.card}><h2>{fa ? "خلاصه حواله" : "Transfer summary"}</h2><dl className={styles.facts}>
              <div className={`${styles.fact} ${styles.total}`}><dt>{fa ? "مجموع پرداخت" : "You send"}</dt><dd>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</dd></div>
              <div className={styles.fact}><dt>{fa ? "دریافتی گیرنده" : "Recipient gets"}</dt><dd>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</dd></div>
              <div className={styles.fact}><dt>{fa ? "گیرنده" : "Recipient"}</dt><dd>{request.quote.institution_name || String(request.quote.recipient_snapshot.account_name || request.quote.recipient_snapshot.full_name || request.quote.recipient_snapshot.label || "—")}</dd></div>
              {request.service_tier === "priority" && <div className={styles.fact}><dt>{fa ? "هزینه اولویت" : "Priority fee"}</dt><dd>{requestMoney(request.quote.priority_fee_amount, request.quote.funding_currency, locale)}</dd></div>}
              {request.handling_due_at && <div className={styles.fact}><dt>{fa ? "مهلت رسیدگی" : "Handling target"}</dt><dd><bdi dir="ltr">{requestDate(request.handling_due_at, locale)}</bdi></dd></div>}
            </dl><details className={workspace.inlineDisclosure}><summary>{fa ? "جزئیات حواله" : "Transfer details"}<ChevronDown size={15} /></summary><RequestQuoteFacts quote={request.quote} locale={locale} />{request.service_tier === "priority" && <p className={styles.muted}>{fa ? request.quote.policy_snapshot.priority_terms_fa : request.quote.policy_snapshot.priority_terms}</p>}{request.quote.payment_link && <a href={request.quote.payment_link} target="_blank" rel="noopener noreferrer">{fa ? "مشاهده صورتحساب" : "View invoice"}</a>}</details></section>
            {journey?.canPay && journey.receiptSubmitted && <RequestPaymentInstructions request={request} locale={locale} />}
            {actionPanel && <div className={workspace.customerExceptions}>{actionPanel}</div>}
          </div>
        </div>
      </>}
    </>}
  </Page>;
}
