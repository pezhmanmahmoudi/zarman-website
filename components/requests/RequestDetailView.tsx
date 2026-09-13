"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Download, Mail, RefreshCw } from "lucide-react";
import { getAdminRequest, getMyRequest, getRequestBankAccounts, mutateAdminRequest, mutateMyRequest } from "@/app/actions/request.actions";
import type { ExchangeRequest, RequestCommand, RequestDetail, RequestMutationInput } from "@/lib/requests/types";
import { requestDate, requestLabel, requestMoney, requestError, isRequestTerminal, type RequestLocale } from "./request-labels";
import { RequestQuoteFacts } from "./RequestQuoteFacts";
import { RequestProgress } from "./RequestProgress";
import { RequestPaymentInstructions } from "./RequestPaymentInstructions";
import { RequestReceiptUpload } from "./RequestReceiptUpload";
import { RequestAdminMessageBanner, RequestConversation } from "./RequestConversation";
import styles from "@/styles/requests/Requests.module.css";
import workspace from "@/styles/requests/RequestWorkspace.module.css";

const commandLabels: Record<RequestCommand, [string, string]> = {
  review: ["Start review", "شروع بررسی"], request_info: ["Request information", "درخواست اطلاعات"], respond: ["Send response", "ارسال پاسخ"],
  await_funds: ["Approve request", "تأیید درخواست"], confirm_funds: ["Approve cleared funds", "تأیید وصول وجه"],
  resume_funded_request: ["Approve funded request", "تأیید درخواست تأمین‌شده"],
  start_processing: ["Approve & start processing", "تأیید و شروع پردازش"], record_uncertain_payout: ["Reconcile payout", "بررسی نتیجه پرداخت"],
  complete: ["Approve completion", "تأیید تکمیل"], cancel: ["Cancel request", "لغو درخواست"], reject: ["Reject request", "رد درخواست"],
  confirm_refund: ["Approve returned refund", "تأیید بازپرداخت"], payment_evidence: ["Add payment reference", "ثبت شماره پیگیری واریز"],
};

function allowedCommands(request: ExchangeRequest, admin: boolean): RequestCommand[] {
  const commands: RequestCommand[] = [];
  const hasRefund = ["refund_pending", "refunded"].includes(request.funding_status) || ["refund_pending", "refunded"].includes(request.priority_fee_status);
  if (admin) {
    if (["submitted", "action_required", "awaiting_funds"].includes(request.status)) commands.push("review");
    if (["submitted", "under_review", "awaiting_funds", "action_required"].includes(request.status)) commands.push("request_info");
    if (["submitted", "under_review", "action_required"].includes(request.status)) commands.push("await_funds");
    if (!hasRefund && request.funding_status !== "confirmed" && ["submitted", "under_review", "awaiting_funds", "action_required", "expired"].includes(request.status)) commands.push("confirm_funds");
    if (!hasRefund && request.funding_status === "confirmed" && ["under_review", "action_required"].includes(request.status)) commands.push("resume_funded_request");
    if (request.status === "ready") commands.push("start_processing");
    if (request.status === "processing") commands.push("record_uncertain_payout");
    if (["processing", "reconciliation"].includes(request.status)) commands.push("complete");
    if (!isRequestTerminal(request.status) && !["processing", "reconciliation"].includes(request.status)) commands.push("reject");
    if (request.priority_fee_status === "refund_pending" || request.funding_status === "refund_pending") commands.push("confirm_refund");
  } else {
    if (["awaiting_funds", "action_required"].includes(request.status)) commands.push("payment_evidence");
    if (["submitted", "under_review", "action_required", "awaiting_funds", "ready"].includes(request.status)) commands.push("cancel");
  }
  return commands;
}

function recommendedCommand(request: ExchangeRequest, commands: RequestCommand[]): RequestCommand | undefined {
  const order: RequestCommand[] = ["confirm_refund", "resume_funded_request", "start_processing", "complete", ...(request.status === "awaiting_funds" || request.evidence_submitted_at ? ["confirm_funds" as const] : []), "await_funds", "review", "confirm_funds"];
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
  const [receivedCurrency, setReceivedCurrency] = useState<"AUD" | "IRT">("AUD");
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
  const pending = useRef(false);
  const attempt = useRef<{ signature: string; key: string; expectedVersion: number } | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await (admin ? getAdminRequest(id) : getMyRequest(id));
      if (result.error) setError(result.error);
      else if (result.data) { setDetail(result.data); setError(""); }
    } catch { setError(fa ? "دریافت وضعیت ممکن نشد. دوباره تلاش کنید." : "Could not load the latest status. Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id, admin, fa]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && !pending.current) void refresh(); }, 20000);
    const onFocus = () => { if (!pending.current) void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  useEffect(() => {
    if (!admin) return;
    getRequestBankAccounts().then(result => {
      if (result.data) setAccounts(result.data.map(account => ({ ...account, id: String(account.id) })));
      else if (result.error) setError(result.error);
    }).catch(() => setError("Could not load bank accounts."));
  }, [admin]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !action || pending.current || !confirmed) return;
    const payload: NonNullable<RequestMutationInput["payload"]> = {};
    if (message.trim()) payload.message = message.trim();
    if (action === "payment_evidence" || action === "confirm_funds") payload.payment_reference = paymentReference.trim();
    if (action === "confirm_funds") { payload.received_amount = Number(receivedAmount); payload.received_currency = receivedCurrency; payload.receiver_account_id = fundingAccount; }
    if (action === "resume_funded_request") payload.honour_quote = honourQuote;
    if (action === "complete") { payload.settlement_reference = settlementReference.trim(); payload.payer_account_id = payerAccount; payload.receiver_account_id = receiverAccount; payload.transfer_method = transferMethod; }
    if (action === "confirm_refund") { payload.refund_kind = refundKind; payload.refund_reference = refundReference.trim(); payload.payer_account_id = refundAccount; }
    const input = { requestId: id, action, payload, ...(admin ? { sendEmail } : {}) };
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
      }
      else {
        attempt.current = null; setAction(""); setMessage(""); setPaymentReference(""); setConfirmed(false); setHonourQuote(false);
        setReceivedAmount(""); setSettlementReference(""); setPayerAccount(""); setReceiverAccount(""); setFundingAccount(""); setRefundAccount(""); setRefundReference("");
        setNotice(fa ? "تغییرات ثبت شد." : "Update saved.");
        await refresh();
      }
    } catch { setError(fa ? "ثبت تأیید نشد. دوباره تلاش کنید." : "The update was not confirmed. Please retry."); }
    finally { pending.current = false; setBusy(false); }
  }

  const request = detail?.request;
  const commands = request ? allowedCommands(request, admin) : [];
  const currentAction = commands.includes(action as RequestCommand) ? action : "";
  const recommended = request ? recommendedCommand(request, commands) : undefined;
  const orderedCommands = recommended ? [recommended, ...commands.filter(command => command !== recommended)] : commands;
  const referenceRequired = currentAction === "payment_evidence" || currentAction === "confirm_funds";
  const messageRequired = ["request_info", "respond", "cancel", "reject", "record_uncertain_payout"].includes(currentAction);
  const accountsFor = (currency: "AUD" | "IRT") => accounts.filter(account => account.currency.toUpperCase() === currency || (currency === "IRT" && account.currency.toLowerCase() === "toman"));
  const messages = detail?.messages || [];
  const chooseAction = (command: RequestCommand) => {
    if (!request) return;
    setAction(command); setConfirmed(false); setHonourQuote(false); setNotice(""); setMessage(""); setSendEmail(true);
    setRefundKind(request.priority_fee_status === "refund_pending" ? "priority" : "principal"); setReceivedCurrency(request.quote.funding_currency);
  };

  const actionPanel = request && commands.length > 0 && <div>
    <div className={workspace.actionChoices} role="group" aria-label={admin ? "Approval actions" : (fa ? "اقدام روی درخواست" : "Request actions")}>
      {orderedCommands.map(command => <button key={command} type="button" className={`${workspace.actionChoice} ${admin && command === recommended ? workspace.recommendedAction : ""}`} aria-pressed={currentAction === command} disabled={busy} onClick={() => chooseAction(command)}>{admin && command === recommended && <Check size={16} aria-hidden="true" />}{commandLabels[command][fa ? 1 : 0]}</button>)}
    </div>
    {currentAction && <form onSubmit={submit} className={workspace.actionForm}>
      <fieldset disabled={busy} className={workspace.fieldset}>
        <h3>{commandLabels[currentAction][fa ? 1 : 0]}</h3>
        {referenceRequired && <label className={styles.field}>{fa ? "شماره پیگیری بانکی واریز" : "Bank payment reference"}<input value={paymentReference} onChange={event => setPaymentReference(event.target.value)} required maxLength={200} autoComplete="off" dir="ltr" /></label>}
        {currentAction === "confirm_funds" && <>
          <div className={styles.fields}><label className={styles.field}>Newly received amount<input type="number" inputMode="decimal" required min="0.01" step={receivedCurrency === "AUD" ? ".01" : "1"} value={receivedAmount} onChange={event => setReceivedAmount(event.target.value)} /></label><label className={styles.field}>Currency<select value={receivedCurrency} onChange={event => setReceivedCurrency(event.target.value as "AUD" | "IRT")}><option value="AUD">AUD</option><option value="IRT">Toman (IRT)</option></select></label></div>
          <label className={styles.field}>Account credited<select required value={fundingAccount} onChange={event => setFundingAccount(event.target.value)}><option value="">Select account</option>{accountsFor(receivedCurrency).map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label>
          <p className={workspace.actionNote}>Verify cleared funds, including the priority fee. Enter only the new payment; previous payments are retained.</p>
        </>}
        {currentAction === "resume_funded_request" && <label className={styles.checkbox}><input type="checkbox" required checked={honourQuote} onChange={event => setHonourQuote(event.target.checked)} /><span>Checks complete. Honour the accepted quote and release the confirmed funds for processing.</span></label>}
        {currentAction === "complete" && <>
          <p className={workspace.actionNote}>Confirm successful bank settlement. Completion posts the accounting entries.</p>
          <label className={styles.field}>Settlement reference<input required value={settlementReference} onChange={event => setSettlementReference(event.target.value)} maxLength={200} /></label>
          <div className={styles.fields}><label className={styles.field}>Payout account<select required value={payerAccount} onChange={event => setPayerAccount(event.target.value)}><option value="">Select account</option>{accountsFor(request.quote.recipient_currency).map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label><label className={styles.field}>Collection account<select required value={receiverAccount} onChange={event => setReceiverAccount(event.target.value)}><option value="">Select account</option>{accountsFor(request.quote.funding_currency).map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label></div>
          <label className={styles.field}>Transfer method<select required value={transferMethod} onChange={event => setTransferMethod(event.target.value as typeof transferMethod)}><option value="free">Free transfer</option><option value="pol">Pol</option><option value="paya">Paya</option><option value="satna">Satna</option></select></label>
        </>}
        {currentAction === "start_processing" && <p className={workspace.actionNote}>Assign this request to you and begin processing. If the bank result is uncertain, use Reconcile payout.</p>}
        {currentAction === "confirm_refund" && <>
          <label className={styles.field}>Refund<select value={refundKind} onChange={event => setRefundKind(event.target.value as "priority" | "principal")}><option value="priority" disabled={request.priority_fee_status !== "refund_pending"}>Priority fee</option><option value="principal" disabled={request.funding_status !== "refund_pending"}>Principal</option></select></label>
          <label className={styles.field}>Return reference<input required value={refundReference} onChange={event => setRefundReference(event.target.value)} maxLength={200} /></label>
          <label className={styles.field}>Account debited<select required value={refundAccount} onChange={event => setRefundAccount(event.target.value)}><option value="">Select account</option>{accountsFor(request.quote.funding_currency).map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label>
          <p className={workspace.actionNote}>Record a verified return in the original currency. This does not send a bank transfer.</p>
        </>}
        {messageRequired && <label className={styles.field}>{currentAction === "record_uncertain_payout" ? "Internal reconciliation note" : admin ? "Message to customer" : (fa ? "دلیل" : "Reason")}<textarea value={message} onChange={event => setMessage(event.target.value)} required minLength={3} maxLength={2000} rows={2} dir="auto" /></label>}
        {admin && <label className={`${styles.checkbox} ${workspace.emailChoice}`}><input type="checkbox" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} /><Mail size={16} aria-hidden="true" /><span>Send email to customer and management</span></label>}
        <label className={`${styles.checkbox} ${workspace.confirmChoice}`}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required /><span>{currentAction === "cancel" ? (fa ? "لغو را تأیید می‌کنم؛ بازپرداخت جداگانه پیگیری می‌شود." : "Confirm cancellation; any refund is tracked separately.") : currentAction === "confirm_funds" ? "I verified this payment in the bank account." : currentAction === "complete" ? "I verified successful settlement." : (fa ? "اطلاعات را بررسی و تأیید می‌کنم." : "I reviewed and approve this update.")}</span></label>
        <div className={styles.actions}><button className={["cancel", "reject"].includes(currentAction) ? styles.danger : styles.button} type="submit" disabled={!confirmed}>{busy ? (fa ? "در حال ثبت…" : "Saving…") : commandLabels[currentAction][fa ? 1 : 0]}</button><button type="button" className={workspace.textButton} onClick={() => { setAction(""); setConfirmed(false); }}>{fa ? "انصراف" : "Dismiss"}</button></div>
      </fieldset>
    </form>}
  </div>;

  return <main className={`${styles.workspace} ${workspace.workspace} ${admin ? workspace.adminWorkspace : ""}`} dir={fa ? "rtl" : "ltr"}>
    <header className={`${styles.header} ${workspace.header}`}>
      <div><Link className={workspace.backLink} href={admin ? "/admin/requests" : `/${locale}/dashboard/requests`}><ArrowLeft size={15} />{fa ? "درخواست‌ها" : "Requests"}</Link><div className={workspace.titleRow}><h1><bdi>{request?.reference_code || (fa ? "پیگیری درخواست" : "Request")}</bdi></h1>{request && <><span className={styles.badge}>{requestLabel(request.status, locale)}</span>{request.service_tier === "priority" && <span className={`${styles.badge} ${styles.priority}`}>{fa ? "اولویت‌دار" : "Priority"}</span>}</>}</div>{admin && request && <p className={workspace.customerIdentity}>{request.quote.sender_snapshot.name}<span>{request.quote.sender_snapshot.email}</span></p>}</div>
      <button className={styles.secondary} type="button" onClick={() => void refresh()} disabled={refreshing || busy}><RefreshCw size={16} />{fa ? "به‌روزرسانی" : "Refresh"}</button>
    </header>
    {error && <p className={styles.error} role="alert">{requestError(error, locale)}</p>}{notice && <p className={workspace.saved} role="status">{notice}</p>}
    {loading && <p className={styles.loading} role="status">{fa ? "در حال بارگذاری…" : "Loading…"}</p>}
    {request && detail && <>
      {!admin && <RequestAdminMessageBanner messages={messages} fallbackMessage={request.action_required} locale={locale} />}
      {request.status === "reconciliation" && <p className={styles.warning}>{admin ? "Verify the bank result before retrying a payout." : (fa ? "نتیجه پرداخت بانکی در حال بررسی است." : "We’re checking the bank settlement.")}</p>}
      {(request.priority_fee_status === "refund_pending" || request.funding_status === "refund_pending") && <p className={styles.warning}>{admin ? "Refund approval required." : (fa ? "بازپرداخت در حال پیگیری است." : "Your refund is being arranged.")}</p>}
      {admin ? <div className={workspace.adminLayout}>
        <div className={workspace.column}>
          <section className={`${styles.card} ${workspace.approvalCard}`}><div className={workspace.sectionHeading}><h2>Review & approve</h2><span className={styles.badge}>{requestLabel(request.status, locale)}</span></div>{actionPanel || <p className={styles.muted}>No further approval needed.</p>}</section>
          <RequestReceiptUpload request={request} receipts={detail.receipts || []} admin locale={locale} onUploaded={refresh} />
          <RequestConversation requestId={id} version={request.version} messages={messages} admin locale={locale} disabled={busy} onUpdated={refresh} onSendingChange={sending => { pending.current = sending; setBusy(sending); }} />
        </div>
        <div className={workspace.column}>
          <section className={styles.card}><h2>Transfer summary</h2><dl className={styles.facts}>
            <div className={styles.fact}><dt>To collect</dt><dd>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</dd></div>
            <div className={styles.fact}><dt>Cleared funds</dt><dd>{requestMoney(request.funding_received, request.quote.funding_currency, locale)}<span className={workspace.cellDetail}>{requestLabel(request.funding_status, locale)}</span></dd></div>
            <div className={styles.fact}><dt>Recipient gets</dt><dd>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</dd></div>
            {request.service_tier === "priority" && <div className={styles.fact}><dt>Priority fee</dt><dd>{requestMoney(request.quote.priority_fee_amount, request.quote.funding_currency, locale)}<span className={workspace.cellDetail}>{requestLabel(request.priority_fee_status, locale)}</span></dd></div>}
            <div className={styles.fact}><dt>Funds confirmed</dt><dd>{requestDate(request.funds_confirmed_at, locale)}</dd></div>
            <div className={styles.fact}><dt>Handling due</dt><dd>{requestDate(request.handling_due_at, locale)}</dd></div>
            <div className={styles.fact}><dt>Processing</dt><dd>{request.handling_started_at ? requestDate(request.handling_started_at, locale) : "Not started"}</dd></div>
          </dl><span className={workspace.timezone}>Sydney time</span></section>
          {request.action_required && <section className={workspace.adminAlert}><strong>Awaiting customer</strong><p dir="auto">{request.action_required}</p></section>}
          {request.status === "completed" && <a className={styles.button} href={`/api/requests/${request.id}/receipt`} target="_blank" rel="noopener noreferrer"><Download size={17} />Final receipt</a>}
          <details className={`${styles.card} ${workspace.disclosure}`}><summary>Quote & recipient<ChevronDown size={16} /></summary><div className={workspace.disclosureBody}><RequestQuoteFacts quote={request.quote} locale={locale} /><dl className={styles.facts}><div className={styles.fact}><dt>Source of funds</dt><dd>{request.quote.source_of_funds}</dd></div><div className={styles.fact}><dt>Purpose</dt><dd>{request.quote.reason_for_transfer}</dd></div></dl></div></details>
          <details className={`${styles.card} ${workspace.disclosure}`}><summary>Payment instructions<ChevronDown size={16} /></summary><div className={workspace.disclosureBody}><RequestPaymentInstructions request={request} locale={locale} /></div></details>
          <details className={`${styles.card} ${workspace.disclosure}`}><summary>Activity & emails<ChevronDown size={16} /></summary><div className={workspace.disclosureBody}>
            <ol className={styles.timeline}>{detail.events.map(event => <li key={event.id}><strong>{requestLabel(event.status, locale)}</strong>{event.public_message && <p dir="auto">{event.public_message}</p>}<time dateTime={event.created_at}>{requestDate(event.created_at, locale)}</time>{event.internal_message && event.internal_message !== event.public_message && <p className={styles.notice}>{event.internal_message}</p>}</li>)}</ol>
            {detail.deliveries && detail.deliveries.length > 0 && <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Email</th><th>Status</th></tr></thead><tbody>{detail.deliveries.map(delivery => <tr key={delivery.id}><td>{delivery.audience}<span className={workspace.cellDetail}>{delivery.recipient_email}</span></td><td>{delivery.status === "skipped" && delivery.last_error === "admin_email_opt_out" ? "Not requested" : delivery.status}{delivery.last_error && delivery.last_error !== "admin_email_opt_out" && <p className={styles.error}>{delivery.last_error}</p>}</td></tr>)}</tbody></table></div>}
            <p className={styles.muted}>Version {request.version} · {request.owner_id ? `Operator ${request.owner_id}` : "Unassigned"}</p>
          </div></details>
        </div>
      </div> : <>
        <RequestProgress request={request} locale={locale} />
        <div className={workspace.customerLayout}>
          <div className={workspace.column}>
            {request.status === "completed" && <section className={`${styles.card} ${workspace.receiptReady}`}><div><Check size={20} /><h2>{fa ? "رسید نهایی آماده است" : "Your receipt is ready"}</h2></div><a className={styles.button} href={`/api/requests/${request.id}/receipt`} target="_blank" rel="noopener noreferrer"><Download size={17} />{fa ? "دریافت رسید" : "Download receipt"}</a></section>}
            <RequestPaymentInstructions request={request} locale={locale} />
            <RequestReceiptUpload request={request} receipts={detail.receipts || []} locale={locale} onUploaded={refresh} />
            <RequestConversation requestId={id} version={request.version} messages={messages} locale={locale} disabled={busy} onUpdated={refresh} onSendingChange={sending => { pending.current = sending; setBusy(sending); }} />
          </div>
          <div className={workspace.column}>
            <section className={styles.card}><h2>{fa ? "خلاصه حواله" : "Transfer summary"}</h2><dl className={styles.facts}>
              <div className={`${styles.fact} ${styles.total}`}><dt>{fa ? "مجموع پرداخت" : "You send"}</dt><dd>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</dd></div>
              <div className={styles.fact}><dt>{fa ? "دریافتی گیرنده" : "Recipient gets"}</dt><dd>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</dd></div>
              <div className={styles.fact}><dt>{fa ? "گیرنده" : "Recipient"}</dt><dd>{request.quote.institution_name || String(request.quote.recipient_snapshot.account_name || request.quote.recipient_snapshot.full_name || request.quote.recipient_snapshot.label || "—")}</dd></div>
              {request.service_tier === "priority" && <div className={styles.fact}><dt>{fa ? "هزینه اولویت" : "Priority fee"}</dt><dd>{requestMoney(request.quote.priority_fee_amount, request.quote.funding_currency, locale)}</dd></div>}
              {request.handling_due_at && <div className={styles.fact}><dt>{fa ? "مهلت شروع رسیدگی" : "Handling target"}</dt><dd>{requestDate(request.handling_due_at, locale)}</dd></div>}
            </dl><details className={workspace.inlineDisclosure}><summary>{fa ? "جزئیات حواله" : "Transfer details"}<ChevronDown size={15} /></summary><RequestQuoteFacts quote={request.quote} locale={locale} />{request.service_tier === "priority" && <p className={styles.muted}>{fa ? request.quote.policy_snapshot.priority_terms_fa : request.quote.policy_snapshot.priority_terms}</p>}{request.quote.payment_link && <a href={request.quote.payment_link} target="_blank" rel="noopener noreferrer">{fa ? "مشاهده صورتحساب" : "View invoice"}</a>}</details></section>
            {actionPanel && <details className={`${styles.card} ${workspace.disclosure}`}><summary>{fa ? "سایر اقدامات" : "Other actions"}<ChevronDown size={16} /></summary><div className={workspace.disclosureBody}>{actionPanel}</div></details>}
            <details className={`${styles.card} ${workspace.disclosure}`}><summary>{fa ? "تاریخچه وضعیت" : "Status history"}<ChevronDown size={16} /></summary><div className={workspace.disclosureBody}><ol className={styles.timeline}>{detail.events.filter((event, index, events) => index === 0 || event.status !== events[index - 1].status).map(event => <li key={event.id}><strong>{requestLabel(event.status, locale)}</strong><time className={workspace.historyTime} dateTime={event.created_at}>{requestDate(event.created_at, locale)}</time></li>)}</ol><span className={workspace.timezone}>{fa ? "زمان‌ها به وقت سیدنی" : "Sydney time"}</span></div></details>
          </div>
        </div>
      </>}
    </>}
  </main>;
}
