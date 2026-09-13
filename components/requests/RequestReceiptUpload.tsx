"use client";

import { useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { getRequestReceiptUrl, uploadRequestReceipt } from "@/app/actions/request.actions";
import type { ExchangeRequest, RequestLocale, RequestReceipt } from "@/lib/requests/types";
import { MAX_REQUEST_RECEIPT_BYTES } from "@/lib/requests/receipt-upload";
import { requestDate } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";

export function RequestReceiptUpload({ request, receipts, admin = false, locale, onUploaded }: {
  request: ExchangeRequest; receipts: RequestReceipt[]; admin?: boolean; locale: RequestLocale; onUploaded: () => Promise<void>;
}) {
  const fa = locale === "fa";
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const attempt = useRef<{ file: File; key: string } | null>(null);
  const canUpload = !admin && ["submitted", "under_review", "awaiting_funds", "action_required"].includes(request.status)
    && ["unpaid", "partial"].includes(request.funding_status)
    && !["refund_pending", "refunded"].includes(request.priority_fee_status);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || pending.current) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size === 0 || file.size > MAX_REQUEST_RECEIPT_BYTES) {
      setError(fa ? "فایل PDF، JPG یا PNG با حجم حداکثر ۴ مگابایت انتخاب کنید." : "Choose a non-empty PDF, JPG or PNG file, no larger than 4 MB.");
      return;
    }
    pending.current = true; setBusy(true); setError(""); setNotice("");
    if (attempt.current?.file !== file) attempt.current = { file, key: crypto.randomUUID() };
    const body = new FormData();
    body.set("requestId", request.id); body.set("commandKey", attempt.current.key); body.set("file", file);
    try {
      const result = await uploadRequestReceipt(body);
      if (result.error) setError(result.error);
      else {
        attempt.current = null; setFile(null); if (input.current) input.current.value = "";
        setNotice(fa ? "رسید شما ثبت شد و تیم مالی مطلع می‌شود. تأیید دریافت وجه پس از تطبیق بانکی انجام می‌شود." : "Your receipt was saved and finance will be notified. Funds are confirmed separately after bank reconciliation.");
        await onUploaded();
      }
    } catch { setError(fa ? "نتیجه آپلود دریافت نشد. با همین فایل دوباره تلاش کنید." : "We could not confirm the upload. Retry with the same file."); }
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

  return <section className={styles.card}>
    <h2>{fa ? "رسید واریز بانکی" : "Bank transfer receipt"}</h2>
    <p className={styles.muted}>{fa ? "فایل رسید فقط برای تطبیق واریز استفاده می‌شود و دریافت وجه یا شروع زمان سرویس را تأیید نمی‌کند." : "A receipt helps finance match your payment. It does not confirm cleared funds or start the service time target."}</p>
    {canUpload && <form onSubmit={submit}>
      <label className={styles.field}>{fa ? "انتخاب رسید (PDF، JPG یا PNG؛ حداکثر ۴ مگابایت)" : "Choose receipt (PDF, JPG or PNG; maximum 4 MB)"}
        <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" required disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); attempt.current = null; setError(""); setNotice(""); }} />
      </label>
      <button className={styles.button} type="submit" disabled={!file || busy} style={{ marginTop: 14 }}><FileUp size={17} />{busy ? (fa ? "در حال آپلود…" : "Uploading…") : (fa ? "آپلود رسید واریز" : "Upload bank receipt")}</button>
    </form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <ul className={styles.receiptList}>{receipts.map(receipt => <li key={receipt.id}>
      <div><span className={styles.receiptName}>{receipt.original_name}</span><p className={styles.muted}>{requestDate(receipt.created_at, locale)} · {Math.ceil(receipt.size_bytes / 1024)} KB</p></div>
      <button className={styles.secondary} type="button" aria-label={`${fa ? "مشاهده رسید" : "View receipt"}: ${receipt.original_name}`} onClick={() => void openReceipt(receipt.id)} disabled={Boolean(opening)}><Download size={16} />{fa ? "مشاهده رسید" : "View receipt"}</button>
    </li>)}</ul>
    {!receipts.length && <p className={styles.muted}>{fa ? "هنوز رسیدی آپلود نشده است." : "No bank receipts uploaded yet."}</p>}
  </section>;
}
