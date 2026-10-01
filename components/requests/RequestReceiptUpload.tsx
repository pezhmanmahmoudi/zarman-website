"use client";

import { useRef, useState } from "react";
import { Download, FileText, FileUp, Plus } from "lucide-react";
import { getRequestReceiptUrl, uploadRequestReceipt } from "@/app/actions/request.actions";
import type { ExchangeRequest, RequestLocale, RequestReceipt } from "@/lib/requests/types";
import { getRequestJourney } from "@/lib/requests/journey";
import { MAX_REQUEST_RECEIPT_BYTES } from "@/lib/requests/receipt-upload";
import { DashboardCard, StatusBadge } from "@/components/dashboard/dashboard-ui";
import { DashboardLottieScene } from "@/components/dashboard/DashboardLottieScene";
import { requestDate, requestError } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";
import kyc from "@/styles/dashboard/KycDocumentEvidence.module.css";

export function RequestReceiptUpload({ request, receipts, admin = false, locale, onUploaded }: {
  request: ExchangeRequest; receipts: RequestReceipt[]; admin?: boolean; locale: RequestLocale; onUploaded: () => Promise<void>;
}) {
  const fa = locale === "fa";
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [additional, setAdditional] = useState(false);
  const [sent, setSent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const attempt = useRef<{ requestId: string; file: File; key: string } | null>(null);
  const journey = getRequestJourney(request);
  const canUpload = !admin && journey.canUpload;
  const hasReceipt = sent || journey.receiptSubmitted || receipts.length > 0;
  const showForm = canUpload && (!hasReceipt || additional);
  const paymentFailed = ["rejected", "expired"].includes(request.status);
  const transferComplete = request.status === "completed";

  function chooseFile(nextFile: File | null) {
    setFile(nextFile);
    attempt.current = null;
    setError("");
    setNotice("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpload || !file || pending.current) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size === 0 || file.size > MAX_REQUEST_RECEIPT_BYTES) {
      setError(fa ? "فایل PDF، JPG یا PNG با حجم حداکثر ۴ مگابایت انتخاب کنید." : "Choose a non-empty PDF, JPG or PNG file, no larger than 4 MB.");
      return;
    }
    pending.current = true; setBusy(true); setError(""); setNotice("");
    if (attempt.current?.file !== file || attempt.current.requestId !== request.id) attempt.current = { requestId: request.id, file, key: crypto.randomUUID() };
    const body = new FormData();
    body.set("requestId", request.id); body.set("commandKey", attempt.current.key); body.set("file", file);
    try {
      const result = await uploadRequestReceipt(body);
      if (result.error) setError(result.error);
      else {
        attempt.current = null; setFile(null); setSent(true); setAdditional(false);
        if (input.current) input.current.value = "";
        setNotice(fa ? "رسید ارسال شد؛ در حال بررسی واریز شما هستیم." : "Receipt sent — we are checking your payment.");
        try { await onUploaded(); }
        catch { setError(fa ? "رسید ارسال شد. برای دریافت آخرین وضعیت، صفحه را تازه کنید." : "Receipt sent. Refresh to see the latest status."); }
      }
    } catch { setError(fa ? "ارسال رسید تأیید نشد. با همین فایل دوباره تلاش کنید." : "Sending was not confirmed. Retry with the same receipt."); }
    finally { pending.current = false; setBusy(false); }
  }

  async function openReceipt(receiptId: string) {
    if (opening) return;
    setOpening(receiptId); setError("");
    const opened = window.open("", "_blank");
    if (opened) opened.opener = null;
    try {
      const result = await getRequestReceiptUrl(receiptId);
      if (result.error) { opened?.close(); setError(result.error); }
      else if (result.data) {
        if (opened) opened.location.href = result.data.url;
        else window.location.assign(result.data.url);
      }
    } catch { opened?.close(); setError(fa ? "دریافت فایل ممکن نشد. دوباره تلاش کنید." : "Could not retrieve the receipt. Please try again."); }
    finally { setOpening(""); }
  }

  if (!admin && !journey.approved) return null;
  const content = <>
    <div className={compact.heading}><div>{!admin && <StatusBadge tone={hasReceipt ? "neutral" : "attention"}>{hasReceipt ? (fa ? "ارسال شده" : "Sent") : (fa ? "نیازمند اقدام شما" : "Action Required")}</StatusBadge>}<h2>{fa ? "بارگذاری رسید بانکی" : admin ? "Payment evidence" : "Upload bank receipt"}</h2></div>{receipts.length > 0 && <span className={styles.badge}>{receipts.length}</span>}</div>
    {!admin && hasReceipt && !journey.fundsReceived && !journey.closed && <div className={compact.receiptStatus} role="status"><DashboardLottieScene name="document-upload-success" size={64} /><p>{fa ? "رسید ارسال شد؛ در حال بررسی واریز شما هستیم." : "Receipt sent — we are checking your payment."}</p></div>}
    {!admin && journey.fundsReceived && !transferComplete && !journey.closed && <div className={compact.receiptStatus} role="status"><DashboardLottieScene name="payment-confirmed" size={54} /><p>{fa ? "واریز شما توسط زرمان تأیید شد." : "Your payment has been confirmed by Zarman."}</p></div>}
    {!admin && transferComplete && <div className={compact.receiptStatus} role="status"><DashboardLottieScene name="transfer-complete" size={54} /><p>{fa ? "پرداخت به گیرنده تکمیل و حواله نهایی شد." : "The recipient payment is complete and your transfer is finalised."}</p></div>}
    {!admin && paymentFailed && <div className={compact.receiptStatus} role="status"><DashboardLottieScene name="payment-failed" size={54} /><p>{fa ? "پرداخت تکمیل نشد. برای جزئیات، وضعیت درخواست یا پیام‌های زرمان را بررسی کنید." : "The payment was not completed. Check the request status or Zarman messages for details."}</p></div>}
    {showForm && <form onSubmit={submit} className={`${compact.receiptForm} ${hasReceipt ? compact.additionalReceipt : ""}`}>
      <div
        className={`${kyc.upload} ${compact.receiptDropzone}`}
        data-dragging={dragging}
        onDragEnter={event => { if (!busy) { event.preventDefault(); setDragging(true); } }}
        onDragOver={event => { if (!busy) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) chooseFile(event.dataTransfer.files?.[0] ?? null); }}
      >
        <div className={kyc.uploadHeading}><span className={kyc.animation}><DashboardLottieScene name={busy ? "document-upload" : "document-upload-idle"} size={80}/></span><div><h3>{fa ? "فایل رسید بانکی" : "Bank receipt file"}</h3><p>{file ? file.name : dragging ? (fa ? "رسید را اینجا رها کنید" : "Drop receipt here") : (fa ? "فایل رسید را اینجا رها کنید یا برای انتخاب کلیک کنید" : "Drop your receipt here or click to select a file")}</p></div></div>
        <label className={kyc.fileButton} aria-disabled={busy}><FileUp size={18} aria-hidden="true"/>{file ? (fa ? "تغییر فایل" : "Replace file") : (fa ? "انتخاب فایل" : "Choose file")}<input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" required={!file} disabled={busy} onChange={event => chooseFile(event.target.files?.[0] ?? null)} /></label>
        <p className={kyc.fileHint}>{fa ? "PDF، JPG یا PNG · حداکثر ۴ مگابایت" : "PDF, JPG or PNG · up to 4 MB"}</p>
      </div>
      <button className={admin ? styles.button : `${styles.button} ${compact.customerPrimary}`} type="submit" disabled={!file || busy}>{busy ? (fa ? "در حال ارسال…" : "Sending receipt…") : (fa ? "ارسال و ثبت نهایی رسید" : "Submit and finalize receipt")}</button>
    </form>}
    {canUpload && hasReceipt && !additional && <button type="button" className={`${compact.secondaryButton} ${compact.additionalReceipt} ${compact.customerSecondary}`} onClick={() => setAdditional(true)}><Plus size={14} aria-hidden="true" />{fa ? "افزودن رسید دیگر" : "Add another receipt"}</button>}
    {error && <p className={styles.error} role="alert">{requestError(error, locale)}</p>}
    {notice && !(hasReceipt && !journey.fundsReceived && !journey.closed) && <span className={styles.srOnly} role="status">{notice}</span>}
    {receipts.length > 0 && <ul className={compact.receiptFiles}>{receipts.map(receipt => <li key={receipt.id}>
      <div><FileText size={17} aria-hidden="true" /><div><strong>{receipt.original_name}</strong><small><bdi dir="ltr">{requestDate(receipt.created_at, locale)}</bdi> · {Math.ceil(receipt.size_bytes / 1024)} {fa ? "کیلوبایت" : "KB"}</small></div></div>
      <button className={`${compact.secondaryButton} ${!admin ? compact.fileAction : ""}`} type="button" aria-label={`${fa ? "مشاهده رسید" : "View receipt"}: ${receipt.original_name}`} onClick={() => void openReceipt(receipt.id)} disabled={Boolean(opening)}><Download size={14} aria-hidden="true" />{fa ? "مشاهده" : "View"}</button>
    </li>)}</ul>}
    {!receipts.length && admin && <p className={styles.muted}>{fa ? "مشتری هنوز رسیدی ارسال نکرده است." : "The customer has not sent a receipt yet."}</p>}
  </>;
  if (admin) return <section id="request-receipt-upload" className={`${styles.card} ${compact.compactCard}`} dir={fa ? "rtl" : "ltr"}>{content}</section>;
  return <DashboardCard id="request-receipt-upload" className={compact.compactCard} dir={fa ? "rtl" : "ltr"} role="region" aria-label={fa ? "بارگذاری رسید بانکی" : "Upload bank receipt"}>{content}</DashboardCard>;
}
