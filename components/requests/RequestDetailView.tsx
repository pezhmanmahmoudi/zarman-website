"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Download, ExternalLink, Mail, RefreshCw, Trash2 } from "lucide-react";
import { deleteAdminRequest, getAdminRequest, getMyRequest, getRequestBankAccounts, mutateAdminRequest, mutateMyRequest } from "@/app/actions/request.actions";
import type { ExchangeRequest, RequestCommand, RequestDetail, RequestMutationInput } from "@/lib/requests/types";
import { requestDate, requestLabel, requestMoney, requestError, isRequestTerminal, type RequestLocale } from "./request-labels";
import { getRequestJourney, requestActivityLabel, requestEmailStatus, requestMilestones, requestStageLabel } from "@/lib/requests/journey";
import { isMoney } from "@/lib/requests/validation";
import { RequestTransactionSummary } from "./RequestTransactionSummary";
import { RequestPaymentAccount } from "./RequestPaymentAccount";
import { AdminCopyButton, AdminCopyRow } from "./AdminCopyField";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { sortBankAccountsByPriority } from "@/lib/bank-account-ordering";
import { RequestProgress } from "./RequestProgress";
import { RequestPaymentInstructions } from "./RequestPaymentInstructions";
import { RequestReceiptUpload } from "./RequestReceiptUpload";
import { RequestAdminMessageBanner, RequestConversation } from "./RequestConversation";
import { supabase } from "@/lib/supabase";
import { DashboardButton } from "@/components/dashboard/dashboard-ui";
import { DASHBOARD_AUTO_REFRESH_MS, dashboardRefreshDue } from "@/lib/dashboard/refresh-policy";
import { DashboardLottieScene } from "@/components/dashboard/DashboardLottieScene";
import styles from "@/styles/requests/Requests.module.css";
import workspace from "@/styles/requests/RequestWorkspace.module.css";
import customer from "@/styles/requests/RequestCustomerDetail.module.css";

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

export function RequestDetailView({ id, admin = false, locale = "en", initialIntent }: { id: string; admin?: boolean; locale?: RequestLocale; initialIntent?: "reject" | "email" }) {
  const fa = locale === "fa";
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<RequestCommand | "">(admin && initialIntent === "reject" ? "reject" : "");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  // null = use the prefilled default derived from the request.
  const [receivedAmount, setReceivedAmount] = useState<string | null>(null);
  const [accountingFee, setAccountingFee] = useState<string | null>(null);
  const [accountingRate, setAccountingRate] = useState<string | null>(null);
  const [receivedCurrency, setReceivedCurrency] = useState<"AUD" | "IRT" | "">("");
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
  const [savedDeposit, setSavedDeposit] = useState<{ requestId: string; amount: number; currency: "AUD" | "IRT"; version: number } | null>(null);
  const pending = useRef(false);
  const attempt = useRef<{ signature: string; key: string; expectedVersion: number } | null>(null);
  const intentFocused = useRef(false);
  const lastRefresh = useRef(0), refreshPending = useRef(false);

  // A row shortcut only opens the existing form. Allowed commands, confirmation,
  // version checks and the user's explicit submit still govern every mutation.
  useEffect(() => {
    if (!admin || loading || !detail?.request.id || !initialIntent || intentFocused.current) return;
    const target = document.getElementById(initialIntent === "email" ? "request-conversation" : "request-action-panel");
    if (!target) return;
    intentFocused.current = true;
    target.scrollIntoView({ block: "start" });
    target.querySelector<HTMLElement>("textarea")?.focus({ preventScroll: true });
  }, [admin, loading, detail?.request.id, initialIntent]);

  const refresh = useCallback(async () => {
    if (refreshPending.current) return;
    refreshPending.current = true; lastRefresh.current = Date.now();
    setRefreshing(true);
    try {
      const result = await (admin ? getAdminRequest(id) : getMyRequest(id));
      if (result.error) setError(result.error);
      else if (result.data) {
        const latest = result.data;
        setDetail(current => current?.request.id === latest.request.id && current.request.version > latest.request.version ? current : latest);
        setSavedDeposit(saved => saved && saved.requestId === latest.request.id && latest.request.version >= saved.version && latest.payments?.some(payment => payment.currency === saved.currency && Number(payment.amount) === saved.amount) ? null : saved);
        setError("");
      }
    } catch { setError(fa ? "دریافت وضعیت ممکن نشد. دوباره تلاش کنید." : "Could not load the latest status. Please try again."); }
    finally { refreshPending.current = false; setLoading(false); setRefreshing(false); }
  }, [id, admin, fa]);

  const autoRefresh = useCallback(() => {
    if (document.visibilityState === "visible" && !pending.current && dashboardRefreshDue(lastRefresh.current)) void refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(autoRefresh, DASHBOARD_AUTO_REFRESH_MS);
    const onFocusOrVisible = autoRefresh;
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocusOrVisible); document.removeEventListener("visibilitychange", onFocusOrVisible); };
  }, [refresh, autoRefresh]);

  useEffect(() => {
    if (typeof supabase.channel !== "function") return;
    const channel = supabase
      .channel(`request-status:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exchange_request_realtime_signals", filter: `request_id=eq.${id}` }, () => {
        autoRefresh();
      })
      .subscribe();
    return () => { if (typeof supabase.removeChannel === "function") void supabase.removeChannel(channel); };
  }, [id, autoRefresh]);

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
      if (!isMoney(Number(receivedAmountValue)) || (fundingCurrency === "IRT" && !Number.isInteger(Number(receivedAmountValue)))) return invalid("received-amount", fundingCurrency === "IRT" ? (fa ? "مبلغ دریافتی را به تومان و بدون اعشار وارد کنید." : "Enter the cleared amount in whole Toman (IRT).") : (fa ? "مبلغ دریافت‌شده به دلار استرالیا را با حداکثر دو رقم اعشار وارد کنید." : "Enter the cleared amount in AUD, with up to two decimal places."));
      if (showAccountingTerms && !(accountingFeeValue.trim() !== "" && (Number(accountingFeeValue) === 0 || isMoney(Number(accountingFeeValue), 100_000)))) return invalid("accounting-fee", "Enter the fee in AUD (0 or more, up to two decimal places).");
      if (showAccountingTerms && !isMoney(Number(accountingRateValue), 100_000_000)) return invalid("accounting-rate", "Enter the exchange rate in Toman per AUD.");
      if (!fundingAccount) return invalid("funding-account", fa ? "حسابی که وجه در آن تسویه شده را انتخاب کنید." : `Select the ${currencyLabel(fundingCurrency)} account that received the cleared deposit.`);
    }
    if (currentAction === "resume_funded_request" && !honourQuote) return invalid("honour-quote", fa ? "پس از بررسی، نرخ پذیرفته‌شده را تأیید کنید." : "Confirm the accepted quote after completing the checks.");
    if (["complete", "reconcile_complete"].includes(currentAction)) {
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
    const submittedAmount = Number(receivedAmountValue);
    if (submittedAction === "confirm_funds") { payload.received_amount = submittedAmount; payload.received_currency = fundingCurrency; payload.receiver_account_id = fundingAccount; }
    if (submittedAction === "confirm_funds" && showAccountingTerms) { payload.accounting_fee_aud = Number(accountingFeeValue); payload.accounting_rate = Number(accountingRateValue); }
    if (submittedAction === "resume_funded_request") payload.honour_quote = honourQuote;
    if (["complete", "reconcile_complete"].includes(submittedAction)) { payload.payer_account_id = payerAccount; payload.receiver_account_id = receiverAccount; payload.transfer_method = transferMethod; }
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
        attempt.current = null; setAction(""); setMessage(""); setConfirmed(false); setHonourQuote(false);
        setReceivedAmount(null); setAccountingFee(null); setAccountingRate(null); setPayerAccount(""); setReceiverAccount(""); setFundingAccount(""); setRefundAccount(""); setRefundReference("");
        setDifferentCurrency(false); setSeparateDeposit(false); setReceivedCurrency("");
        if (submittedAction === "confirm_funds") {
          setSavedDeposit({ requestId: updated.id, amount: submittedAmount, currency: fundingCurrency, version: updated.version });
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
  const outstandingFunding = request ? Math.max(0, Number(request.quote.funding_total) - Number(request.funding_received)) : 0;
  const receivedAmountValue = receivedAmount ?? (fundingCurrency === expectedCurrency && outstandingFunding > 0 ? (expectedCurrency === "AUD" ? outstandingFunding.toFixed(2) : String(Math.round(outstandingFunding))) : "");
  const showAccountingTerms = admin && fundingCurrency === expectedCurrency;
  const accountingFeeValue = accountingFee ?? String(Number(request?.quote.base_fee_aud ?? 0));
  const accountingRateValue = accountingRate ?? String(Number(request?.quote.applied_rate ?? 0));
  const activeRefundKind = refundKind === "priority" && request?.priority_fee_status !== "refund_pending" ? "principal" : refundKind;
  const journey = request ? getRequestJourney(request) : null;
  const milestones = request ? requestMilestones(request, detail?.events || []) : [];
  const messageRequired = ["request_info", "respond", "cancel", "reject", "record_uncertain_payout"].includes(currentAction);
  const accountsFor = (currency: "AUD" | "IRT") => sortBankAccountsByPriority(accounts
    .filter(account => account.currency.toUpperCase() === currency || (currency === "IRT" && account.currency.toLowerCase() === "toman"))
    .map(account => ({ ...account, currency })));
  const messages = detail?.messages || [];
  const recipientSnapshot = request?.quote.recipient_snapshot ?? {};
  const snapshotText = (key: string) => String(recipientSnapshot[key] ?? "").trim();
  const recipientName = request?.quote.institution_name || snapshotText("account_name") || snapshotText("full_name") || snapshotText("label") || "—";
  const recipientBsb = snapshotText("bsb").replace(/\D/g, "");
  const recipientIban = snapshotText("shaba_number").replace(/\s/g, "").toUpperCase();
  const recipientAccount = snapshotText("account_number") || snapshotText("irt_account_number");
  const recipientCard = snapshotText("card_number").replace(/\D/g, "");
  const payoutAmount = !request ? "" : request.quote.recipient_currency === "AUD" ? Number(request.quote.recipient_amount).toFixed(2) : String(Math.round(Number(request.quote.recipient_amount)));
  const accountSelect = (field: string, label: string, value: string, onChange: (value: string) => void, currency: "AUD" | "IRT") => <div className={`${styles.field} ${workspace.selectField}`} data-invalid={validation?.field === field || undefined}><span>{label} *</span><SelectBox id={`request-${field}`} ariaLabel={label} dir="ltr" placeholder="Select account" value={value} onChange={onChange} disabled={busy} labeledOptions={accountsFor(currency).map(account => ({ value: account.id, label: `${account.account_name} (${account.currency})` }))} /></div>;
  const actionLabel = (command: RequestCommand) => command === "await_funds" && request?.payment_approved_at ? (fa ? "ادامه پرداخت" : "Resume payment") : commandLabels[command][fa ? 1 : 0];
  const fieldValidation = (field: string) => ({ "aria-invalid": validation?.field === field || undefined, "aria-describedby": validation?.field === field ? "request-form-feedback" : undefined });
  const chooseAction = (command: RequestCommand) => {
    if (!request) return;
    setAction(command); setConfirmed(false); setHonourQuote(false); setNotice(""); setMessage(""); setSendEmail(false);
    setValidation(null); setDifferentCurrency(false); setSeparateDeposit(command === "confirm_funds" && hasMismatchedDeposit);
    setReceivedAmount(command === "confirm_funds" && hasMismatchedDeposit ? "" : null); setAccountingFee(null); setAccountingRate(null);
    if (command === "confirm_funds" && hasMismatchedDeposit) setFundingAccount("");
    setRefundKind(request.priority_fee_status === "refund_pending" ? "priority" : "principal"); setReceivedCurrency("");
  };

  const hardDeleteRequest = async () => {
    if (!admin || !request || pending.current) return;
    if (!window.confirm(`Permanently delete request ${request.reference_code}, its linked transaction, accounting entries, messages, receipts, and all other associated records? This cannot be undone.`)) return;

    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await deleteAdminRequest(request.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.data?.warning) window.alert(result.data.warning);
      window.location.assign("/admin/transactions");
    } catch {
      setError("The request could not be permanently deleted.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const milestoneHistory = <section className={styles.card}><h2>{fa ? "مراحل انجام حواله" : "Transfer milestones"}</h2><ol className={workspace.milestoneList}>{milestones.filter(milestone => milestone.done).map(milestone => <li key={milestone.key}><Check size={15} /><div><strong>{milestone.label[fa ? 1 : 0]}</strong>{milestone.at && <time dir="ltr" dateTime={milestone.at}>{requestDate(milestone.at, locale)}</time>}</div></li>)}</ol><span className={workspace.timezone}>{fa ? "زمان‌ها به وقت سیدنی" : "Sydney time"}</span></section>;
  const actionTitle = currentAction === "await_funds" ? (request?.payment_approved_at ? "Resume customer payment" : "Request approval") : currentAction === "confirm_funds" ? "Verify incoming payment" : ["complete", "reconcile_complete"].includes(currentAction) ? "Reconcile destination payment" : currentAction === "confirm_refund" ? "Refund confirmation" : currentAction ? actionLabel(currentAction) : "";
  const actionPanel = request && commands.length > 0 && <div id="request-action-panel">
    {currentAction && <form onSubmit={submit} className={workspace.actionForm} noValidate>
      <fieldset disabled={busy} className={workspace.fieldset}>
        <div className={workspace.actionHeading}>{admin && <span className={workspace.kicker}>Next step</span>}<h2>{actionTitle}</h2></div>
        {currentAction === "await_funds" && <div className={workspace.approvalSummary}><span>{request.quote.sender_snapshot.name}</span><strong>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}<ArrowRight size={16} />{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</strong></div>}
        {referenceRequired && <div className={workspace.paymentDirection}><div><span>Incoming from customer</span><strong><bdi>{requestMoney(request.quote.funding_total, expectedCurrency, locale)}</bdi></strong></div><div><span>Outgoing to recipient</span><bdi>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</bdi></div></div>}
        {admin && currentAction === "confirm_funds" && (detail?.receipts.length || 0) > 0 && <div className={workspace.evidenceReview}><RequestReceiptUpload request={request} receipts={detail?.receipts || []} admin locale={locale} onUploaded={refresh} /></div>}
        {currentAction === "confirm_funds" && <>
          <div className={styles.fields}><label className={styles.field}>Received amount ({currencyLabel(fundingCurrency)}) *<input id="request-received-amount" type="number" inputMode="decimal" required min={fundingCurrency === "AUD" ? "0.01" : "1"} step={fundingCurrency === "AUD" ? ".01" : "1"} value={receivedAmountValue} onChange={event => setReceivedAmount(event.target.value)} dir="ltr" {...fieldValidation("received-amount")} aria-describedby={`request-received-amount-hint${validation?.field === "received-amount" ? " request-form-feedback" : ""}`} /><span className={workspace.fieldHint} id="request-received-amount-hint">{Number(request.funding_received) > 0 ? <>Already confirmed <bdi>{requestMoney(request.funding_received, request.quote.funding_currency, locale)}</bdi>. Prefilled with the remaining amount.</> : "Prefilled with the expected amount. Edit it if the bank shows a different figure."}</span></label><div className={workspace.lockedCurrency}><span>Incoming currency</span><strong>{currencyLabel(fundingCurrency)}</strong></div></div>
          {showAccountingTerms && <div className={styles.fields}>
            <label className={styles.field}>Transfer fee (AUD) *<input id="request-accounting-fee" type="number" inputMode="decimal" min="0" step=".01" value={accountingFeeValue} onChange={event => setAccountingFee(event.target.value)} dir="ltr" {...fieldValidation("accounting-fee")} /></label>
            <label className={styles.field}>Exchange rate (Toman per AUD) *<input id="request-accounting-rate" type="number" inputMode="decimal" min="0.01" step="any" value={accountingRateValue} onChange={event => setAccountingRate(event.target.value)} dir="ltr" {...fieldValidation("accounting-rate")} /></label>
          </div>}
          {showAccountingTerms && <p className={workspace.fieldHint}>Fee and rate are prefilled from the accepted quote. Changes affect the accounting record only; the customer and recipient amounts stay the same.</p>}
          {accountSelect("funding-account", `Account credited (${currencyLabel(fundingCurrency)})`, fundingAccount, setFundingAccount, fundingCurrency)}
          <details className={workspace.depositException}><summary>Deposit arrived in another currency</summary><label className={styles.checkbox}><input type="checkbox" checked={differentCurrency} onChange={event => { setDifferentCurrency(event.target.checked); setReceivedCurrency(expectedCurrency === "AUD" ? "IRT" : "AUD"); setReceivedAmount(null); setFundingAccount(""); setConfirmed(false); setValidation(null); }} /><span>Record an actual {currencyLabel(expectedCurrency === "AUD" ? "IRT" : "AUD")} deposit for finance review</span></label>{differentCurrency && <p className={workspace.actionNote}>This records the deposit in its actual currency. It does not confirm the expected {currencyLabel(expectedCurrency)} payment.</p>}</details>
        </>}
        {currentAction === "resume_funded_request" && <label className={styles.checkbox}><input id="request-honour-quote" type="checkbox" required checked={honourQuote} onChange={event => setHonourQuote(event.target.checked)} {...fieldValidation("honour-quote")} /><span>Checks complete. Honour the accepted quote and release the confirmed funds for processing. *</span></label>}
        {["complete", "reconcile_complete"].includes(currentAction) && <>
          <div className={styles.fields}>{accountSelect("payer-account", "Payout account", payerAccount, setPayerAccount, request.quote.recipient_currency)}{accountSelect("receiver-account", "Collection account", receiverAccount, setReceiverAccount, request.quote.funding_currency)}</div>
          <div className={styles.field}><span>Transfer method *</span><SelectBox ariaLabel="Transfer method" dir="ltr" value={transferMethod} onChange={value => setTransferMethod(value as typeof transferMethod)} disabled={busy} labeledOptions={[{ value: "free", label: "Free transfer" }, { value: "pol", label: "Pol" }, { value: "paya", label: "Paya" }, { value: "satna", label: "Satna" }]} /></div>
        </>}
        {currentAction === "confirm_refund" && <>
          <div className={styles.field}><span>Refund</span><SelectBox ariaLabel="Refund" dir="ltr" value={activeRefundKind} onChange={value => setRefundKind(value as "priority" | "principal")} disabled={busy} labeledOptions={[...(request.priority_fee_status === "refund_pending" ? [{ value: "priority", label: "Priority fee" }] : []), ...(request.funding_status === "refund_pending" ? [{ value: "principal", label: "Principal" }] : [])]} /></div>
          <label className={styles.field}>Return reference *<input id="request-refund-reference" required value={refundReference} onChange={event => setRefundReference(event.target.value)} maxLength={200} {...fieldValidation("refund-reference")} /></label>
          {accountSelect("refund-account", "Account debited", refundAccount, setRefundAccount, request.quote.funding_currency)}
        </>}
        {messageRequired && <label className={styles.field}>{currentAction === "record_uncertain_payout" ? "Internal reconciliation note" : admin ? "Message to customer" : (fa ? "دلیل" : "Reason")} *<textarea id="request-action-message" value={message} onChange={event => setMessage(event.target.value)} required minLength={3} maxLength={2000} rows={2} dir="auto" {...fieldValidation("action-message")} /></label>}
        {admin && <label className={`${styles.checkbox} ${workspace.emailChoice}`}><input type="checkbox" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} /><Mail size={16} aria-hidden="true" /><span>Send email to customer and management</span></label>}
        <label className={`${styles.checkbox} ${workspace.confirmChoice}`}><input id="request-confirmation" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required {...fieldValidation("confirmation")} /><span>{currentAction === "cancel" ? (fa ? "لغو را تأیید می‌کنم؛ بازپرداخت جداگانه پیگیری می‌شود." : "Confirm cancellation; any refund is tracked separately.") : currentAction === "confirm_funds" ? `I verified cleared funds in the bank account: the entered amount and ${currencyLabel(fundingCurrency)} currency.` : ["complete", "reconcile_complete"].includes(currentAction) ? "I verified the destination account, amount and successful settlement." : currentAction === "confirm_refund" ? "I verified the returned funds in the original currency." : (fa ? "اطلاعات را بررسی و تأیید می‌کنم." : "I checked and approve the request details.")} *</span></label>
        {validation && <p id="request-form-feedback" className={workspace.formFeedback} role="alert" tabIndex={-1}>{validation.message}</p>}
        <div className={styles.actions}><button className={["cancel", "reject"].includes(currentAction) ? styles.danger : styles.button} type="submit" disabled={busy}>{busy ? (fa ? "در حال ثبت…" : "Saving…") : referenceRequired && fundingCurrency !== expectedCurrency ? "Record deposit for review" : actionLabel(currentAction)}</button>{(currentAction !== recommended || separateDeposit) && <button type="button" className={workspace.textButton} onClick={() => { setAction(""); setSeparateDeposit(false); setConfirmed(false); setValidation(null); }}>{fa ? "انصراف" : "Back"}</button>}</div>
      </fieldset>
    </form>}
    {otherCommands.length > 0 && (admin ? <details className={workspace.exceptionActions}><summary>{fa ? "سایر اقدامات" : "Other actions"}<ChevronDown size={14} /></summary><div className={workspace.actionChoices}>{otherCommands.map(command => <button key={command} type="button" className={workspace.actionChoice} aria-pressed={currentAction === command} disabled={busy} onClick={() => chooseAction(command)}>{actionLabel(command)}</button>)}</div></details> : <div className={customer.actionChoices}>{otherCommands.filter(command => command !== currentAction).map(command => <DashboardButton key={command} tone="secondary" type="button" className={command === "cancel" ? customer.cancelChoice : undefined} disabled={busy} onClick={() => chooseAction(command)}>{actionLabel(command)}</DashboardButton>)}</div>)}
  </div>;

  const Page = admin ? "div" : "section";
  return <Page className={`${styles.workspace} ${workspace.workspace} ${admin ? workspace.adminWorkspace : ""}`} dir={fa ? "rtl" : "ltr"}>
    {admin ? <header className={workspace.adminHeader}>
      <Link className={workspace.backLink} href="/admin/transactions"><ArrowLeft size={15} />Transactions</Link>
      <div className={workspace.adminHeaderMain}>
        <div className={workspace.adminHeaderTitle}>
          <span className={workspace.kicker}>{request ? `${request.quote.customer_request_type === "buy_aud" ? "Buy AUD" : "Sell AUD"} request` : "Request"}</span>
          <div className={workspace.titleRow}><h1><bdi>{request?.reference_code || "Request"}</bdi></h1>{request && <AdminCopyButton value={request.reference_code} label="reference code" />}</div>
          {request && <ul className={workspace.headerMeta}>
            <li><span className={workspace.stageBadge}>{requestStageLabel(request, locale)}</span>{request.service_tier === "priority" && <span className={`${styles.badge} ${styles.priority}`}>Priority</span>}</li>
            <li><strong dir="auto">{request.quote.sender_snapshot.name}</strong><bdi className={workspace.headerEmail}>{request.quote.sender_snapshot.email}</bdi></li>
            <li>Submitted <time dir="ltr" dateTime={request.created_at}>{requestDate(request.created_at, locale)}</time></li>
          </ul>}
        </div>
        <div className={workspace.adminHeaderActions}>
          <button className={styles.secondary} type="button" onClick={() => void refresh()} disabled={refreshing || busy}><RefreshCw size={16} />Refresh</button>
          {request && <button className={workspace.deleteButton} type="button" onClick={() => void hardDeleteRequest()} disabled={busy}><Trash2 size={16} />Delete</button>}
        </div>
      </div>
    </header> : <nav className={customer.pageNav} aria-label={fa ? "بازگشت به درخواست‌ها" : "Back to requests"}><h1 className={styles.srOnly}>{fa ? "جزئیات تراکنش" : "Transaction details"}</h1><DashboardButton asChild tone="secondary"><Link href={`/${locale}/dashboard/requests`}>{fa ? <ArrowRight size={16} aria-hidden="true"/> : <ArrowLeft size={16} aria-hidden="true"/>}{fa ? "درخواست‌ها" : "Requests"}</Link></DashboardButton></nav>}
    {error && (!currentAction || validation?.field !== "submission") && <p className={styles.error} role="alert">{requestError(error, locale)}</p>}{notice && <p className={workspace.saved} role="status">{notice}</p>}
    {!admin && error && !detail && <DashboardButton tone="secondary" onClick={() => void refresh()} disabled={refreshing}>{fa ? "تلاش مجدد" : "Try again"}</DashboardButton>}
    {loading && <p className={styles.loading} role="status">{fa ? "در حال بارگذاری…" : "Loading…"}</p>}
    {refreshing && !loading && <p className={styles.loading} role="status">{fa ? "در حال به‌روزرسانی…" : "Refreshing the latest status…"}</p>}
    {request && detail && <>
      {!admin && <RequestAdminMessageBanner messages={messages} fallbackMessage={journey?.customerActionMessage} replyRequired={journey?.customerActionRequired} locale={locale} />}
      {request.status === "reconciliation" && (admin ? <p className={styles.warning}>Verify the bank result before retrying a payout.</p> : <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#e1e5ec] bg-[#f7f8fa] px-4 py-3"><DashboardLottieScene name="compliance-review" size={44}/><p className="m-0 text-sm text-[#586270]">{fa ? "نتیجه پرداخت بانکی در حال بررسی است." : "We’re checking the bank settlement."}</p></div>)}
      {(request.priority_fee_status === "refund_pending" || request.funding_status === "refund_pending") && (admin ? <p className={styles.warning}>Refund approval required.</p> : <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#e1e5ec] bg-[#f7f8fa] px-4 py-3"><DashboardLottieScene name="waiting" size={44}/><p className="m-0 text-sm text-[#586270]">{fa ? "بازپرداخت در حال پیگیری است." : "Your refund is being arranged."}</p></div>)}
      {admin ? <>
        {((request.action_required && request.action_required !== journey?.customerActionMessage) || journey?.customerActionRequired) && <div className={workspace.adminAlerts}>
          {request.action_required && request.action_required !== journey?.customerActionMessage && <section className={workspace.adminAlert}><strong>Admin review</strong><p dir="auto">{request.action_required}</p></section>}
          {journey?.customerActionRequired && <section className={workspace.adminAlert}><strong>Awaiting customer</strong><p dir="auto">{journey.customerActionMessage}</p></section>}
        </div>}
        <section className={workspace.summaryCard} aria-label="Transfer summary">
          <div className={workspace.summaryFlow}>
            <div><span>Customer pays</span><strong><bdi>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</bdi></strong></div>
            <ArrowRight size={18} aria-hidden="true" className={workspace.summaryArrow} />
            <div><span>Recipient gets</span><strong><bdi>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</bdi></strong></div>
          </div>
          <ul className={workspace.summaryMeta}>
            <li data-tone={request.funding_status === "confirmed" ? "good" : request.funding_status === "partial" ? "warn" : undefined}>{request.funding_status === "confirmed" ? <><Check size={14} aria-hidden="true" />Funds received</> : request.funding_status === "partial" ? <><Clock3 size={14} aria-hidden="true" /><bdi>{requestMoney(request.funding_received, request.quote.funding_currency, locale)}</bdi>&nbsp;of&nbsp;<bdi>{requestMoney(request.quote.funding_total, request.quote.funding_currency, locale)}</bdi>&nbsp;received</> : <><Clock3 size={14} aria-hidden="true" />{request.funding_status === "unpaid" ? "Awaiting payment" : requestLabel(request.funding_status, locale)}</>}</li>
            <li>Rate <bdi>{requestMoney(request.quote.applied_rate, "IRT", locale)}</bdi></li>
            {request.handling_due_at && <li>Due <time dir="ltr" dateTime={request.handling_due_at}>{requestDate(request.handling_due_at, locale)}</time>&nbsp;(Sydney)</li>}
            {request.service_tier === "priority" && <li>Express fee <bdi>{requestMoney(request.quote.priority_fee_amount, request.quote.funding_currency, locale)}</bdi>&nbsp;· {requestLabel(request.priority_fee_status, locale)}</li>}
          </ul>
        </section>
        <div className={workspace.adminLayout}>
        <div className={workspace.column}>
          {(payments.length > 1 || hasMismatchedDeposit || visibleSavedDeposit || payments.some(payment => !payment.payment_reference.startsWith("AUTO-"))) && <section className={`${styles.card} ${workspace.recordedDeposits}`}><h2>Recorded deposits</h2>
            {hasMismatchedDeposit && <p className={workspace.depositWarning}>Finance review required. Expected incoming currency: <strong>{currencyLabel(expectedCurrency)}</strong>.</p>}
            <ol className={workspace.depositList}>{payments.map(payment => <li key={payment.id}>
              <div className={workspace.depositHeading}><strong><bdi>{requestMoney(payment.amount, payment.currency, locale)}</bdi></strong>{payment.currency !== expectedCurrency && <span className={workspace.depositMismatch}>Currency mismatch</span>}</div>
              {!payment.payment_reference.startsWith("AUTO-") && <span className={workspace.depositReference}>Bank reference: <bdi>{payment.payment_reference}</bdi></span>}
              <time dir="ltr" dateTime={payment.created_at}>{requestDate(payment.created_at, locale)}</time>
            </li>)}{visibleSavedDeposit && !payments.some(payment => payment.currency === visibleSavedDeposit.currency && Number(payment.amount) === visibleSavedDeposit.amount) && <li><div className={workspace.depositHeading}><strong><bdi>{requestMoney(visibleSavedDeposit.amount, visibleSavedDeposit.currency, locale)}</bdi></strong><span className={workspace.depositMismatch}>{visibleSavedDeposit.currency !== expectedCurrency ? "Currency mismatch" : "Saved"}</span></div><span className={workspace.fieldHint}>Saved. Refresh to load the bank record details.</span></li>}</ol>
            {hasMismatchedDeposit && commands.includes("confirm_funds") && currentAction !== "confirm_funds" && <button type="button" className={workspace.textButton} disabled={busy} onClick={() => chooseAction("confirm_funds")}>Record a separate cleared deposit</button>}
          </section>}
          {actionPanel && <section className={`${styles.card} ${workspace.approvalCard}`}>{!currentAction && <div className={workspace.waitingAdmin}><Clock3 size={24} /><h2>{isRequestTerminal(request.status) ? requestStageLabel(request, locale) : journey?.customerActionRequired ? "Waiting for customer response" : hasMismatchedDeposit ? "Review recorded deposit" : journey?.fundsReceived || request.action_required ? "Admin review required" : "Waiting for customer receipt"}</h2></div>}{actionPanel}</section>}
          {request.status === "completed" && <section className={`${styles.card} ${workspace.receiptReady}`}><div><Check size={20} /><h2>Transfer completed</h2></div><a className={styles.button} href={`/api/requests/${request.id}/receipt`} target="_blank" rel="noopener noreferrer"><Download size={17} />Final receipt</a></section>}
          {currentAction !== "confirm_funds" && detail.receipts.length > 0 && <RequestReceiptUpload request={request} receipts={detail.receipts} admin locale={locale} onUploaded={refresh} />}
          <RequestConversation requestId={id} version={request.version} messages={messages} admin locale={locale} disabled={busy} onUpdated={refresh} onSendingChange={sending => { pending.current = sending; setBusy(sending); }} />
        </div>
        <div className={`${workspace.column} ${workspace.sideColumn}`}>
          <section className={`${styles.card} ${workspace.payoutCard}`} aria-labelledby="request-payout-title">
            <div className={workspace.cardHeading}><h2 id="request-payout-title">Payout details</h2><span className={styles.badge}>{request.quote.institution_name ? "Institution payment" : request.quote.recipient_currency === "AUD" ? "AUD bank transfer" : "Toman bank transfer"}</span></div>
            <div className={workspace.payoutAmount}><div><span>Amount to send</span><strong><bdi>{requestMoney(request.quote.recipient_amount, request.quote.recipient_currency, locale)}</bdi></strong></div><AdminCopyButton value={payoutAmount} label="amount to send" /></div>
            <dl className={workspace.copyList}>
              <AdminCopyRow label={request.quote.institution_name ? "Institution" : "Recipient name"} value={recipientName} />
              {snapshotText("bank_name") && <AdminCopyRow label="Bank" value={snapshotText("bank_name")} copy={false} />}
              {snapshotText("bank_city") && <AdminCopyRow label="Branch city" value={snapshotText("bank_city")} copy={false} />}
              {recipientBsb && <AdminCopyRow label="BSB" value={recipientBsb.length === 6 ? `${recipientBsb.slice(0, 3)}-${recipientBsb.slice(3)}` : recipientBsb} copyValue={recipientBsb} mono />}
              {recipientAccount && <AdminCopyRow label="Account number" value={recipientAccount} mono />}
              {recipientIban && <AdminCopyRow label="IBAN (Sheba)" value={recipientIban} mono />}
              {recipientCard && <AdminCopyRow label="Card number" value={recipientCard.replace(/(\d{4})(?=\d)/g, "$1 ")} copyValue={recipientCard} mono />}
              {request.quote.invoice_reference && <AdminCopyRow label="Invoice reference" value={request.quote.invoice_reference} mono />}
            </dl>
            {request.quote.payment_link && <div className={workspace.paymentLinkRow}><a className={styles.button} href={request.quote.payment_link} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true" />Open payment page</a><AdminCopyButton value={request.quote.payment_link} label="payment link" /></div>}
            {request.quote.institution_name && <RequestPaymentAccount key={request.id + request.funding_status} requestId={request.id} funded={request.funding_status === "confirmed"} />}
          </section>
          {milestoneHistory}
          <details className={`${styles.card} ${workspace.disclosure}`}><summary>Accepted quote<ChevronDown size={16} /></summary><div className={workspace.disclosureBody}><dl className={styles.facts}>
            <div className={styles.fact}><dt>Transfer fee</dt><dd><bdi>{requestMoney(request.quote.base_fee_aud, "AUD", locale)}</bdi></dd></div>
            {Number(request.quote.discount_amount) > 0 && <div className={styles.fact}><dt>Promo discount{request.quote.promo_code ? ` (${request.quote.promo_code})` : ""}</dt><dd><bdi>{requestMoney(request.quote.discount_amount, "AUD", locale)}</bdi></dd></div>}
            {Number(request.quote.loyalty_discount) > 0 && <div className={styles.fact}><dt>Loyalty discount</dt><dd><bdi>{requestMoney(request.quote.loyalty_discount, "AUD", locale)}</bdi></dd></div>}
            <div className={styles.fact}><dt>Source of funds</dt><dd dir="auto">{request.quote.source_of_funds}</dd></div>
            <div className={styles.fact}><dt>Purpose</dt><dd dir="auto">{request.quote.reason_for_transfer}</dd></div>
          </dl></div></details>
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
      </div></> : <>
        <RequestProgress request={request} events={detail.events} locale={locale} refreshing={refreshing || busy} onRefresh={() => void refresh()} />
        <div className={`${workspace.customerLayout} ${customer.layout}`}>
          <div className={`${workspace.column} ${customer.column}`}>
            {journey?.canPay && !journey.receiptSubmitted && <RequestPaymentInstructions request={request} locale={locale} />}
            <RequestReceiptUpload request={request} receipts={detail.receipts || []} locale={locale} onUploaded={refresh} />
            <RequestConversation requestId={id} version={request.version} messages={messages} locale={locale} disabled={busy} onUpdated={refresh} onSendingChange={sending => { pending.current = sending; setBusy(sending); }} />
          </div>
          <div className={`${workspace.column} ${customer.column}`}>
            <RequestTransactionSummary request={request} locale={locale}/>
            {journey?.canPay && journey.receiptSubmitted && <RequestPaymentInstructions request={request} locale={locale} />}
            {actionPanel && <details className={`${customer.accordion} ${customer.exceptionPanel}`} open={Boolean(currentAction) || undefined}><summary><span>{fa ? "سایر اقدامات" : "Other actions"}</span><ChevronDown size={17} aria-hidden="true"/></summary><div className={customer.accordionBody}>{actionPanel}</div></details>}
          </div>
        </div>
      </>}
    </>}
  </Page>;
}
