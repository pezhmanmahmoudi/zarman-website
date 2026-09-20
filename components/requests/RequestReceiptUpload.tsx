"use client";

import { useRef, useState } from "react";
import { Clock3, Download, FileText, FileUp, Plus } from "lucide-react";
import { getRequestReceiptUrl, uploadRequestReceipt } from "@/app/actions/request.actions";
import type { ExchangeRequest, RequestLocale, RequestReceipt } from "@/lib/requests/types";
import { getRequestJourney } from "@/lib/requests/journey";
import { MAX_REQUEST_RECEIPT_BYTES } from "@/lib/requests/receipt-upload";
import { requestDate, requestError } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";
import compact from "@/styles/requests/RequestPayment.module.css";

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
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const attempt = useRef<{ requestId: string; file: File; key: string } | null>(null);
  const journey = getRequestJourney(request);
  const canUpload = !admin && journey.canUpload;
  const hasReceipt = sent || journey.receiptSubmitted || receipts.length > 0;
  const showForm = canUpload && (!hasReceipt || additional);

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
  return <section id="request-receipt-upload" className={`${styles.card} ${compact.compactCard}`} dir={fa ? "rtl" : "ltr"}>
    <div className={compact.heading}><h2>{fa ? "رسید واریز" : admin ? "Payment evidence" : "Payment receipt"}</h2>{receipts.length > 0 && <span className={styles.badge}>{receipts.length}</span>}</div>
    {!admin && hasReceipt && !journey.fundsReceived && !journey.closed && <div className={compact.receiptStatus} role="status"><Clock3 size={17} aria-hidden="true" /><p>{fa ? "رسید ارسال شد؛ در حال بررسی واریز شما هستیم." : "Receipt sent — we are checking your payment."}</p></div>}
    {showForm && <form onSubmit={submit} className={`${compact.receiptForm} ${hasReceipt ? compact.additionalReceipt : ""}`}>
      <label className={compact.filePicker} data-disabled={busy}>
        <FileUp size={22} aria-hidden="true" />
        <span><strong>{file ? file.name : (fa ? "انتخاب رسید واریز" : "Choose your bank receipt")}</strong><small>{fa ? "PDF، JPG یا PNG · حداکثر ۴ مگابایت" : "PDF, JPG or PNG · up to 4 MB"}</small></span>
        <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" required disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); attempt.current = null; setError(""); setNotice(""); }} />
      </label>
      <button className={styles.button} type="submit" disabled={!file || busy}>{busy ? (fa ? "در حال ارسال…" : "Sending receipt…") : (fa ? "ارسال رسید برای بررسی" : "Send receipt for review")}</button>
    </form>}
    {canUpload && hasReceipt && !additional && <button type="button" className={`${compact.secondaryButton} ${compact.additionalReceipt}`} onClick={() => setAdditional(true)}><Plus size={14} aria-hidden="true" />{fa ? "افزودن رسید دیگر" : "Add another receipt"}</button>}
    {error && <p className={styles.error} role="alert">{requestError(error, locale)}</p>}
    {notice && !(hasReceipt && !journey.fundsReceived && !journey.closed) && <span className={styles.srOnly} role="status">{notice}</span>}
    {receipts.length > 0 && <ul className={compact.receiptFiles}>{receipts.map(receipt => <li key={receipt.id}>
      <div><FileText size={17} aria-hidden="true" /><div><strong>{receipt.original_name}</strong><small><bdi dir="ltr">{requestDate(receipt.created_at, locale)}</bdi> · {Math.ceil(receipt.size_bytes / 1024)} {fa ? "کیلوبایت" : "KB"}</small></div></div>
      <button className={compact.secondaryButton} type="button" aria-label={`${fa ? "مشاهده رسید" : "View receipt"}: ${receipt.original_name}`} onClick={() => void openReceipt(receipt.id)} disabled={Boolean(opening)}><Download size={14} aria-hidden="true" />{fa ? "مشاهده" : "View"}</button>
    </li>)}</ul>}
    {!receipts.length && admin && <p className={styles.muted}>{fa ? "مشتری هنوز رسیدی ارسال نکرده است." : "The customer has not sent a receipt yet."}</p>}
  </section>;
}
