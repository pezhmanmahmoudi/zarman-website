"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getAdminRequest, getMyRequest, getRequestBankAccounts, mutateAdminRequest, mutateMyRequest } from "@/app/actions/request.actions";
import type { ExchangeRequest, RequestCommand, RequestDetail, RequestMutationInput } from "@/lib/requests/types";
import { requestDate, requestLabel, requestMoney, isRequestTerminal, type RequestLocale } from "./request-labels";
import { RequestQuoteFacts } from "./RequestQuoteFacts";
import styles from "@/styles/requests/Requests.module.css";

const commandLabels: Record<RequestCommand, [string, string]> = {
  review: ["Start review", "شروع بررسی"], request_info: ["Request information", "درخواست اطلاعات"], respond: ["Send response", "ارسال پاسخ"],
  await_funds: ["Issue payment instructions", "صدور راهنمای واریز"], confirm_funds: ["Reconcile received funds", "تطبیق وجه دریافتی"],
  start_processing: ["Claim and begin processing", "پذیرش و شروع رسیدگی"], record_uncertain_payout: ["Place payout in reconciliation", "بررسی نتیجه نامشخص پرداخت"],
  complete: ["Confirm settlement and complete", "تأیید تسویه و تکمیل"], cancel: ["Cancel request", "لغو درخواست"], reject: ["Reject request", "رد درخواست"],
  confirm_refund: ["Confirm returned refund", "تأیید بازپرداخت"], payment_evidence: ["Submit payment reference", "ثبت اطلاعات واریز"],
};

function allowedCommands(request: ExchangeRequest, admin: boolean): RequestCommand[] {
  const commands: RequestCommand[] = [];
  if (admin) {
    if (["submitted", "action_required"].includes(request.status)) commands.push("review");
    if (["submitted", "under_review", "awaiting_funds", "action_required"].includes(request.status)) commands.push("request_info");
    if (["submitted", "under_review", "action_required"].includes(request.status)) commands.push("await_funds");
    if (["awaiting_funds", "action_required"].includes(request.status)) commands.push("confirm_funds");
    if (request.status === "ready") commands.push("start_processing");
    if (request.status === "processing") commands.push("record_uncertain_payout");
    if (["processing", "reconciliation"].includes(request.status)) commands.push("complete");
    if (!isRequestTerminal(request.status) && !["processing", "reconciliation"].includes(request.status)) commands.push("reject");
    if (request.priority_fee_status === "refund_pending" || request.funding_status === "refund_pending") commands.push("confirm_refund");
  } else {
    if (request.status === "action_required") commands.push("respond");
    if (["awaiting_funds", "action_required"].includes(request.status)) commands.push("payment_evidence");
    if (["submitted", "under_review", "action_required", "awaiting_funds", "ready"].includes(request.status)) commands.push("cancel");
  }
  return commands;
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
  const [paymentReference, setPaymentReference] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedCurrency, setReceivedCurrency] = useState<"AUD" | "IRT">("AUD");
  const [settlementReference, setSettlementReference] = useState("");
  const [payerAccount, setPayerAccount] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");
  const [refundKind, setRefundKind] = useState<"priority" | "principal">("priority");
  const [refundReference, setRefundReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; account_name: string; currency: string }>>([]);
  const pending = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

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
    }).catch(() => setError("Could not load settlement bank accounts."));
  }, [admin]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !action || pending.current || !confirmed) return;
    const payload: NonNullable<RequestMutationInput["payload"]> = {};
    if (message.trim()) payload.message = message.trim();
    if (action === "payment_evidence" || action === "confirm_funds") payload.payment_reference = paymentReference.trim();
    if (action === "confirm_funds") { payload.received_amount = Number(receivedAmount); payload.received_currency = receivedCurrency; }
    if (action === "complete") { payload.settlement_reference = settlementReference.trim(); payload.payer_account_id = payerAccount; payload.receiver_account_id = receiverAccount; payload.transfer_method = "bank_transfer"; }
    if (action === "confirm_refund") { payload.refund_kind = refundKind; payload.refund_reference = refundReference.trim(); }
    const input = { requestId: id, expectedVersion: detail.request.version, action, payload };
    const signature = JSON.stringify(input);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await (admin ? mutateAdminRequest : mutateMyRequest)({ ...input, commandKey: attempt.current.key });
      if (result.error) setError(result.error);
      else {
        attempt.current = null; setAction(""); setMessage(""); setPaymentReference(""); setConfirmed(false);
        setNotice(fa ? "اقدام شما ثبت شد. آخرین وضعیت در این صفحه نمایش داده می‌شود." : "Your update was saved. The latest request status is shown below.");
        await refresh();
      }
    } catch { setError(fa ? "تأیید اقدام دریافت نشد. اطلاعات فرم حفظ شده؛ دوباره تلاش کنید." : "We could not confirm this update. Your form is preserved; please retry."); }
    finally { pending.current = false; setBusy(false); }
  }

  const request = detail?.request;
  const commands = request ? allowedCommands(request, admin) : [];
  const currentAction = commands.includes(action as RequestCommand) ? action : "";
  const referenceRequired = currentAction === "payment_evidence" || currentAction === "confirm_funds";
  const messageRequired = ["request_info", "respond", "cancel", "reject", "record_uncertain_payout"].includes(currentAction);

  return <main className={styles.workspace} dir={fa ? "rtl" : "ltr"}>
    <header className={styles.header}>
      <div><Link className={styles.secondary} href={admin ? "/admin/requests" : `/${locale}/dashboard/requests`}><ArrowLeft size={16} />{fa ? "همه درخواست‌ها" : "All requests"}</Link>
        <h1><bdi>{request?.reference_code || (fa ? "پیگیری درخواست" : "Request tracking")}</bdi></h1>
        {request && <div className={styles.actions}><span className={styles.badge}>{requestLabel(request.status, locale)}</span><span className={`${styles.badge} ${request.service_tier === "priority" ? styles.priority : ""}`}>{request.service_tier === "priority" ? (fa ? "اولویت‌دار" : "Priority") : (fa ? "استاندارد" : "Standard")}</span></div>}
      </div>
      <button className={styles.secondary} type="button" onClick={() => void refresh()} disabled={refreshing || busy}><RefreshCw size={16} />{fa ? "به‌روزرسانی" : "Refresh"}</button>
    </header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {loading && <p className={styles.loading} role="status">{fa ? "در حال دریافت درخواست…" : "Loading request…"}</p>}
    {request && detail && <>
      {request.action_required && <section className={styles.warning}><strong>{fa ? "اقدام بعدی" : "Next action"}</strong><p className={styles.pre}>{request.action_required}</p></section>}
      {request.status === "reconciliation" && <p className={styles.warning}>{fa ? "نتیجه پرداخت در حال تطبیق است. تیم مالی نتیجه بانکی را بررسی می‌کند." : "The payout outcome is being reconciled. Finance must verify the bank result before any further payment attempt."}</p>}
      <div className={styles.grid} style={{ marginTop: 22 }}>
        <div className={styles.stack}>
          <section className={styles.card}>
            <h2>{fa ? "وضعیت درخواست" : "Request progress"}</h2>
            <dl className={styles.facts}>
              <div className={styles.fact}><dt>{fa ? "ثبت درخواست" : "Submitted"}</dt><dd>{requestDate(request.created_at, locale)}</dd></div>
              <div className={styles.fact}><dt>{fa ? "وضعیت وجه" : "Funding status"}</dt><dd>{requestLabel(request.funding_status, locale)}</dd></div>
              <div className={styles.fact}><dt>{fa ? "وجه تأییدشده" : "Confirmed received amount"}</dt><dd>{requestMoney(request.funding_received, request.quote.funding_currency, locale)}</dd></div>
              <div className={styles.fact}><dt>{fa ? "وضعیت هزینه اولویت" : "Priority fee status"}</dt><dd>{requestLabel(request.priority_fee_status, locale)}</dd></div>
              {request.handling_due_at && <div className={styles.fact}><dt>{fa ? "مهلت شروع رسیدگی" : "Handling target due"}</dt><dd>{requestDate(request.handling_due_at, locale)}</dd></div>}
              {request.handling_started_at && <div className={styles.fact}><dt>{fa ? "شروع رسیدگی" : "Processing started"}</dt><dd>{requestDate(request.handling_started_at, locale)}</dd></div>}
              <div className={styles.fact}><dt>{fa ? "تیم مسئول" : "Responsible team"}</dt><dd>{request.owner_id ? (fa ? "کارشناس عملیات" : "Assigned operations specialist") : (fa ? "تیم عملیات زرمان" : "Zarman operations")}</dd></div>
              {admin && <><div className={styles.fact}><dt>Customer</dt><dd>{request.quote.sender_snapshot.name}<div className={styles.muted}>{request.quote.sender_snapshot.email}</div></dd></div><div className={styles.fact}><dt>Assigned operator ID</dt><dd><bdi>{request.owner_id || "Unassigned"}</bdi></dd></div><div className={styles.fact}><dt>Record version</dt><dd>{request.version}</dd></div></>}
            </dl>
            <p className={styles.muted}>{fa ? "همه زمان‌ها به وقت سیدنی نمایش داده می‌شود. ارسال اطلاعات واریز به معنی تأیید دریافت وجه نیست." : "All dates use Sydney time. Submitting a payment reference does not confirm cleared funds."}</p>
            {(request.priority_fee_status === "refund_pending" || request.funding_status === "refund_pending") && <p className={styles.warning}>{fa ? "بازپرداخت در انتظار تأیید مالی است. پس از تأیید برگشت وجه، وضعیت این صفحه به‌روزرسانی می‌شود." : "A refund is pending finance confirmation. This page will update after the returned funds are verified."}</p>}
          </section>
          {request.payment_instructions && <section className={styles.card}>
            <h2>{fa ? "راهنمای واریز" : "Payment instructions"}</h2>
            <p className={styles.pre}>{request.payment_instructions}</p>
            <dl className={styles.facts}>
              <div className={styles.fact}><dt>{fa ? "مبلغ و ارز دقیق" : "Exact amount and currency"}</dt><dd>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</dd></div>
              <div className={styles.fact}><dt>{fa ? "شناسه واریز" : "Payment reference"}</dt><dd><bdi>{request.reference_code}</bdi></dd></div>
              <div className={styles.fact}><dt>{fa ? "مهلت واریز" : "Funding deadline"}</dt><dd>{requestDate(request.funding_due_at, locale)}</dd></div>
            </dl>
            {isRequestTerminal(request.status) && <p className={styles.warning}>{fa ? "این درخواست بسته شده است؛ برای آن وجه جدید واریز نکنید." : "This request is closed. Do not send a new payment for it."}</p>}
          </section>}
          {commands.length > 0 && <section className={styles.card}>
            <h2>{admin ? "Manage request" : (fa ? "اقدام روی درخواست" : "Take action")}</h2>
            <form onSubmit={submit}>
              <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
                <label className={styles.field}>{fa ? "انتخاب اقدام" : "Choose an action"}<select value={currentAction} required onChange={e => { setAction(e.target.value as RequestCommand); setConfirmed(false); setNotice(""); if (request) setReceivedCurrency(request.quote.funding_currency); }}><option value="">{fa ? "انتخاب کنید" : "Select action"}</option>{commands.map(command => <option key={command} value={command}>{commandLabels[command][fa ? 1 : 0]}</option>)}</select></label>
                {currentAction && <div className={styles.stack} style={{ marginTop: 18 }}>
                  {referenceRequired && <label className={styles.field}>{fa ? "شماره پیگیری بانکی واریز" : "Bank payment reference"}<input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} required maxLength={200} autoComplete="off" /></label>}
                  {currentAction === "confirm_funds" && <>
                    <div className={styles.fields}><label className={styles.field}>Received amount<input type="number" inputMode="decimal" required min="0.01" step={receivedCurrency === "AUD" ? ".01" : "1"} value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} /></label><label className={styles.field}>Received currency<select value={receivedCurrency} onChange={e => setReceivedCurrency(e.target.value as "AUD" | "IRT")}><option value="AUD">AUD</option><option value="IRT">Toman (IRT)</option></select></label></div>
                    <p className={styles.warning}>Confirm against cleared bank funds, including any priority fee. A customer reference or screenshot is not reconciliation evidence.</p>
                  </>}
                  {currentAction === "complete" && <>
                    <p className={styles.warning}>Confirm successful bank settlement before completing. This action posts the linked accounting entries. For an uncertain bank result, keep the request in reconciliation.</p>
                    <label className={styles.field}>Confirmed settlement reference<input required value={settlementReference} onChange={e => setSettlementReference(e.target.value)} maxLength={200} /></label>
                    <div className={styles.fields}>
                      <label className={styles.field}>Payer bank account<select required value={payerAccount} onChange={e => setPayerAccount(e.target.value)}><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label>
                      <label className={styles.field}>Receiver bank account<select required value={receiverAccount} onChange={e => setReceiverAccount(e.target.value)}><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.currency})</option>)}</select></label>
                    </div>
                  </>}
                  {currentAction === "start_processing" && <p className={styles.warning}>This claims the request and records the execution intent. Begin the handling step now; if the bank outcome becomes uncertain, record reconciliation before any retry.</p>}
                  {currentAction === "confirm_refund" && <>
                    <label className={styles.field}>Refund obligation<select value={refundKind} onChange={e => setRefundKind(e.target.value as "priority" | "principal")}><option value="priority" disabled={request.priority_fee_status !== "refund_pending"}>Priority fee</option><option value="principal" disabled={request.funding_status !== "refund_pending"}>Principal</option></select></label>
                    <label className={styles.field}>Confirmed return reference<input required value={refundReference} onChange={e => setRefundReference(e.target.value)} maxLength={200} /></label>
                    <p className={styles.warning}>Record only a verified return in the original collection currency. This records the confirmed refund; it does not initiate a bank transfer.</p>
                  </>}
                  <label className={styles.field}>{admin ? "Customer-visible explanation" : (fa ? "توضیحات" : "Message")} {messageRequired ? "*" : (fa ? "(اختیاری)" : "(optional)")}<textarea value={message} onChange={e => setMessage(e.target.value)} required={messageRequired} minLength={messageRequired ? 3 : undefined} maxLength={2000} /></label>
                  {currentAction === "payment_evidence" && <p className={styles.muted}>{fa ? "شماره پیگیری را ثبت کنید. تیم مالی واریز را با حساب بانکی تطبیق می‌دهد." : "Submit your reference here. Finance will match it to the bank account before marking funds confirmed."}</p>}
                  <label className={styles.checkbox}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required /><span>{currentAction === "cancel" ? (fa ? "درخواست لغو را تأیید می‌کنم. بازپرداخت احتمالی جداگانه پیگیری می‌شود." : "I confirm cancellation. Any required refund will be tracked separately.") : (fa ? "صحت اطلاعات واردشده و ثبت این اقدام را تأیید می‌کنم." : "I confirm the information is accurate and want to record this action.")}</span></label>
                  <button className={["cancel", "reject"].includes(currentAction) ? styles.danger : styles.button} type="submit" disabled={!confirmed}>{busy ? (fa ? "در حال ثبت…" : "Saving…") : commandLabels[currentAction][fa ? 1 : 0]}</button>
                </div>}
              </fieldset>
            </form>
          </section>}
          <section className={styles.card}>
            <h2>{fa ? "رویدادهای درخواست" : "Request timeline"}</h2>
            <ol className={styles.timeline}>{detail.events.map(event => <li key={event.id}>
              <strong>{requestLabel(event.status, locale)}</strong><p>{event.public_message || requestLabel(event.event_type, locale)}</p><time dateTime={event.created_at}>{requestDate(event.created_at, locale)}</time>
            </li>)}</ol>
            {!detail.events.length && <p className={styles.muted}>{fa ? "رویدادها پس از ثبت به‌روزرسانی نمایش داده می‌شوند." : "Events appear here as updates are recorded."}</p>}
          </section>
        </div>
        <div className={styles.stack}>
          <section className={styles.card}>
            <h2>{fa ? "پیش‌فاکتور پذیرفته‌شده" : "Accepted quote"}</h2><RequestQuoteFacts quote={request.quote} locale={locale} />
            <p className={styles.muted}>{fa ? "منبع وجه: " : "Source of funds: "}{request.quote.source_of_funds}</p><p className={styles.muted}>{fa ? "دلیل انتقال: " : "Transfer purpose: "}{request.quote.reason_for_transfer}</p>
            {request.service_tier === "priority" && <p className={styles.notice}>{fa ? request.quote.policy_snapshot.priority_terms_fa : request.quote.policy_snapshot.priority_terms}</p>}
            {request.quote.payment_link && <p className={styles.muted}>{fa ? "لینک صورتحساب: " : "Invoice link: "}<a href={request.quote.payment_link} target="_blank" rel="noopener noreferrer">{fa ? "مشاهده وب‌سایت موسسه" : "Open institution website"}</a></p>}
          </section>
          {admin && detail.deliveries && <section className={styles.card}>
            <h2>Notification deliveries</h2><p className={styles.muted}>Each milestone queues independent customer and management messages. Provider acceptance is separate from mailbox delivery.</p>
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Audience</th><th>Status</th><th>Attempts</th></tr></thead><tbody>{detail.deliveries.map(delivery => <tr key={delivery.id}><td>{delivery.audience}<div className={styles.muted}>{delivery.recipient_email}</div></td><td>{delivery.status}{delivery.last_error && <p className={styles.error}>{delivery.last_error}</p>}</td><td>{delivery.attempts}</td></tr>)}</tbody></table></div>
            {!detail.deliveries.length && <p className={styles.muted}>No delivery records yet.</p>}
          </section>}
        </div>
      </div>
    </>}
  </main>;
}
