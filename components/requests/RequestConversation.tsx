"use client";

import { useRef, useState } from "react";
import { Mail, MessageSquare, Send } from "lucide-react";
import { sendAdminRequestMessage, sendMyRequestMessage } from "@/app/actions/request.actions";
import type { RequestLocale, RequestMessage } from "@/lib/requests/types";
import { requestDate, requestError } from "./request-labels";
import styles from "@/styles/requests/Requests.module.css";
import workspace from "@/styles/requests/RequestWorkspace.module.css";

export function RequestAdminMessageBanner({ messages, fallbackMessage, locale }: { messages: RequestMessage[]; fallbackMessage?: string | null; locale: RequestLocale }) {
  const latest = [...messages].reverse().find(message => message.sender_role === "admin");
  const body = latest?.body || fallbackMessage;
  if (!body) return null;
  return <aside className={workspace.messageBanner} aria-label={locale === "fa" ? "پیام زرمان" : "Message from Zarman"}>
    <MessageSquare size={20} aria-hidden="true" />
    <div><div className={workspace.bannerHeading}><strong>{locale === "fa" ? "پیام زرمان" : "Message from Zarman"}</strong>{latest && <time dateTime={latest.created_at}>{requestDate(latest.created_at, locale)}</time>}</div><p dir="auto">{body}</p><a href="#request-conversation">{locale === "fa" ? "ارسال پاسخ" : "Reply"}</a></div>
  </aside>;
}

export function RequestConversation({ requestId, version, messages, admin = false, locale, disabled = false, onUpdated, onSendingChange }: {
  requestId: string; version: number; messages: RequestMessage[]; admin?: boolean; locale: RequestLocale;
  disabled?: boolean; onUpdated: () => Promise<void>; onSendingChange?: (sending: boolean) => void;
}) {
  const fa = locale === "fa";
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAll, setShowAll] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ signature: string; key: string; expectedVersion: number } | null>(null);
  const visible = showAll ? messages : messages.slice(-4);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || disabled || message.trim().length < 1) return;
    const input = { requestId, message: message.trim(), ...(admin ? { sendEmail } : {}) };
    const signature = JSON.stringify(input);
    // A background refresh can observe a committed message whose response was lost.
    // Retry the same intent with its original key AND version until acknowledged.
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID(), expectedVersion: version };
    pending.current = true; setBusy(true); onSendingChange?.(true); setError(""); setNotice("");
    try {
      const result = await (admin ? sendAdminRequestMessage : sendMyRequestMessage)({ ...input, commandKey: attempt.current.key, expectedVersion: attempt.current.expectedVersion });
      if (result.error) {
        setError(result.error);
        if (result.error === "This request has changed. Refresh the page before continuing." || result.error === "REQUEST_CONFLICT") {
          attempt.current = null;
          await onUpdated();
        }
      }
      else {
        attempt.current = null; setMessage("");
        setNotice(fa ? "پیام ارسال شد." : "Message sent.");
        await onUpdated();
      }
    } catch { setError(fa ? "ارسال تأیید نشد. دوباره تلاش کنید." : "Sending was not confirmed. Please retry."); }
    finally { pending.current = false; setBusy(false); onSendingChange?.(false); }
  }

  return <section id="request-conversation" tabIndex={-1} aria-labelledby="request-conversation-title" className={`${styles.card} ${workspace.conversation}`}>
    <div className={workspace.sectionHeading}><h2 id="request-conversation-title"><MessageSquare size={18} aria-hidden="true" />{admin ? "Customer messages" : (fa ? "پیام به مدیر" : "Message to admin")}</h2>{messages.length > 0 && <span className={styles.badge}>{messages.length}</span>}</div>
    {messages.length > 4 && <button className={workspace.textButton} type="button" onClick={() => setShowAll(value => !value)}>{showAll ? (fa ? "نمایش پیام‌های اخیر" : "Show recent messages") : (fa ? `نمایش ${messages.length - 4} پیام قبلی` : `Show ${messages.length - 4} earlier messages`)}</button>}
    {visible.length > 0 && <ol className={workspace.messages}>{visible.map(item => {
      const own = item.sender_role === (admin ? "admin" : "customer");
      return <li key={item.id} className={workspace.message} data-own={own}>
        <div className={workspace.messageMeta}><strong>{item.sender_role === "admin" ? (fa ? "زرمان" : "Zarman") : admin ? "Customer" : (fa ? "شما" : "You")}</strong><time dateTime={item.created_at}>{requestDate(item.created_at, locale)}</time></div>
        <p dir="auto">{item.body}</p>
        {admin && item.sender_role === "admin" && <span className={workspace.messageEmail}>{item.send_email ? "Email requested" : "Website only"}</span>}
      </li>;
    })}</ol>}
    <form onSubmit={submit} className={workspace.messageForm}>
      <label className={styles.field}>{admin ? "Reply to customer" : (fa ? "پیام شما" : "Your message")}<textarea value={message} onChange={event => { setMessage(event.target.value); setNotice(""); }} required minLength={1} maxLength={2000} rows={3} dir="auto" disabled={busy || disabled} placeholder={admin ? "Write a message…" : (fa ? "پیام خود را بنویسید…" : "Write your message…")} /></label>
      <div className={workspace.messageControls}>{admin && <label className={`${styles.checkbox} ${workspace.emailChoice}`}><input type="checkbox" checked={sendEmail} onChange={event => setSendEmail(event.target.checked)} disabled={busy || disabled} /><Mail size={16} aria-hidden="true" /><span>Send email</span></label>}<button className={styles.button} type="submit" disabled={busy || disabled || message.trim().length < 1}><Send size={16} aria-hidden="true" />{busy ? (fa ? "در حال ارسال…" : "Sending…") : (fa ? "ارسال پیام" : "Send message")}</button></div>
      {error && <p className={styles.error} role="alert">{requestError(error, locale)}</p>}{notice && <p className={workspace.saved} role="status">{notice}</p>}
    </form>
  </section>;
}
