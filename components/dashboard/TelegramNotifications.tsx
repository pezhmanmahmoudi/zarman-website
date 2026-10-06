"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bell, Check, CheckCheck, LoaderCircle, LockKeyhole, Send, Unplug } from "lucide-react";
import { beginCustomerTelegram, getCustomerTelegram, updateCustomerTelegram } from "@/app/actions/customer-telegram.actions";
import type { TelegramConnectionState } from "@/lib/notifications/customer-telegram-types";
import { DashboardButton, DashboardMagicCard } from "./dashboard-ui";
import { DashboardLottieScene } from "./DashboardLottieScene";
import { dashboardHref } from "@/lib/dashboard/navigation";
import styles from "@/styles/dashboard/TelegramNotifications.module.css";

export function TelegramNotifications({ locale, compact = false, overview = false, motionEnabled = true }: { locale: string; compact?: boolean; overview?: boolean; motionEnabled?: boolean }) {
  const fa = locale === "fa", text = (en: string, persian: string) => fa ? persian : en;
  const headingId = useId();
  const [state, setState] = useState<TelegramConnectionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [notice, setNotice] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const version = useRef(0), mutating = useRef(false), reading = useRef(false), mounted = useRef(false), lastRead = useRef(0);
  const refresh = useCallback(async () => {
    if (reading.current || mutating.current) return;
    reading.current = true; lastRead.current = Date.now();
    const requestVersion = version.current;
    try {
      const result = await getCustomerTelegram();
      if (mounted.current && requestVersion === version.current) {
        if (result.data) { setState(result.data); setError(""); if (!result.data.pending) setLink(""); }
        else setError(result.error || "telegram_unavailable");
      }
    } catch { if (mounted.current && requestVersion === version.current) setError("telegram_unavailable"); }
    finally { reading.current = false; if (mounted.current) setLoading(false); }
  }, []);

  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, [refresh]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRead.current > (state?.pending ? 3_000 : 20_000)) void refresh();
    };
    window.addEventListener("focus", onVisible); document.addEventListener("visibilitychange", onVisible);
    const timer = state?.pending ? window.setInterval(onVisible, 4_000) : null;
    return () => { window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); if (timer !== null) window.clearInterval(timer); };
  }, [state?.pending, refresh]);

  async function run(action: "begin" | "confirm" | "cancel" | "disconnect" | "preferences", previewMessages?: boolean) {
    if (mutating.current) return;
    mutating.current = true; version.current++; setBusy(true); setError(""); setNotice("");
    try {
      if (action === "begin") {
        const result = await beginCustomerTelegram(fa ? "fa" : "en");
        if (mounted.current) {
          if (result.data) { setState(result.data.state); setLink(result.data.url); }
          else setError(result.error || "telegram_unavailable");
        }
      } else {
        const id = ["confirm","cancel"].includes(action) ? state?.pending?.id : state?.connection?.id;
        if (!id) return;
        const result = await updateCustomerTelegram({ action, id, locale: fa ? "fa" : "en", previewMessages });
        if (mounted.current) {
          if (result.data) {
            setState(result.data); setLink(""); setDisconnecting(false);
            setNotice(action === "confirm" ? "connected" : action === "disconnect" ? "disconnected" : action === "preferences" ? "saved" : "");
          } else setError(result.error || "telegram_unavailable");
        }
      }
    } catch { if (mounted.current) setError("telegram_unavailable"); }
    finally { mutating.current = false; if (mounted.current) setBusy(false); }
  }

  const errors: Record<string, [string, string]> = {
    please_wait: ["Please wait 30 seconds before creating another link.", "برای ساخت لینک جدید ۳۰ ثانیه صبر کنید."],
    link_expired: ["This link has expired. Refresh your settings to get a new one.", "این لینک دیگر معتبر نیست. تنظیمات را به‌روز کنید و لینک تازه بگیرید."],
    verified_account_required: ["Verify your email address to connect Telegram.", "برای اتصال تلگرام، ابتدا ایمیل خود را تأیید کنید."],
    sign_in_required: ["Sign in again to manage your notifications.", "برای مدیریت اعلان‌ها دوباره وارد حساب شوید."],
    telegram_already_connected: ["This Telegram account is linked to another Zarman account. Disconnect it there first.", "این تلگرام به حساب دیگری در زرمان متصل است. ابتدا اتصال را از همان حساب قطع کنید."],
    already_connected: ["Your Telegram is already connected. Refresh to see your settings.", "تلگرام شما متصل است. برای دیدن تنظیمات، صفحه را به‌روز کنید."],
    connection_changed: ["Your connection has changed. Refresh and try again.", "وضعیت اتصال تغییر کرده است. صفحه را به‌روز کنید و دوباره تلاش کنید."],
    telegram_unavailable: ["We couldn't update your Telegram settings. Please try again.", "فعلاً امکان دریافت یا تغییر تنظیمات تلگرام نیست. لطفاً دوباره تلاش کنید."],
  };
  if (compact && (loading || error || !state?.available)) return null;
  const connected = !!state?.connection;
  const account = state?.connection || state?.pending;
  const settingsId = `${headingId}-settings`;
  const telegramButton = overview ? styles.telegramButton : undefined;
  const title = connected ? text("Telegram notifications are on", "اعلان‌های تلگرام فعال است") : text("Stay up to date with your transfer", "از انتقال خود باخبر بمانید");
  const description = state && !state.available
    ? text("Telegram is temporarily unavailable. Please try again shortly.", "در حال حاضر اتصال تلگرام در دسترس نیست. کمی بعد دوباره تلاش کنید.")
    : connected
      ? text("We'll let you know on Telegram when your transfer status changes or our team sends you a message.", "با تغییر وضعیت انتقال یا دریافت پیام از تیم زرمان، در تلگرام باخبر می‌شوید.")
      : text("Connect Telegram to follow your transfer and hear from the Zarman team.", "تلگرام خود را متصل کنید تا از وضعیت انتقال و پیام‌های تیم زرمان باخبر شوید.");
  const content = <>
    {overview ? <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
      <span aria-hidden="true" className="flex size-20 shrink-0 items-center justify-center rounded-3xl border border-white/80 bg-white/70 sm:size-24"><DashboardLottieScene name="telegram-chatbot" size={88} motionEnabled={motionEnabled} /></span>
      <div className="min-w-0 flex-1 sm:basis-60">
        <p className="m-0 text-xs font-medium text-[#5b6480]">{text("Telegram notifications", "اعلان‌های تلگرام")}</p>
        <h2 id={headingId} className="m-0! mt-1.5! text-lg! font-semibold leading-snug! text-[#24243f]!">{title}</h2>
        <p className="mb-0 mt-1.5 max-w-2xl text-xs leading-5 text-[#4e7187]">{description}</p>
      </div>
      <DashboardButton className={`${styles.telegramButton} w-full shrink-0 sm:w-auto`} disabled={busy || loading} aria-expanded={expanded} aria-controls={settingsId} onClick={() => {
        if (state?.available === false) { setLoading(true); void refresh(); return; }
        setExpanded(value => !value);
        if (!expanded && !connected && !state?.pending && state?.available) void run("begin");
      }}>
        {(busy || loading) && <LoaderCircle size={16} className={styles.spinner} aria-hidden="true"/>}
        {loading ? text("Checking connection…", "در حال بررسی…") : state?.available === false ? text("Try again", "تلاش دوباره") : expanded ? text("Close settings", "بستن تنظیمات") : connected || error ? text("Manage notifications", "تنظیمات اعلان‌ها") : state?.pending ? text("Finish connecting", "تکمیل اتصال") : text("Connect Telegram", "اتصال تلگرام")}
      </DashboardButton>
    </div> : <div className={styles.topline}>
      <span className={styles.icon} aria-hidden="true"><Send size={22}/></span>
      <div className={styles.heading}>
        {!compact && <span className={styles.eyebrow}>{text("NOTIFICATIONS", "اعلان‌ها")}</span>}
        <h2 id={headingId}>{title}</h2>
        <p>{description}</p>
      </div>
      {connected && <span className={styles.badge}><Check size={13}/>{text("Connected", "متصل")}</span>}
    </div>}
    {compact ? <Link className={styles.manage} href={`${dashboardHref(locale,"profile")}#telegram-notifications`}>{connected ? text("Manage notifications", "تنظیمات اعلان‌ها") : text("Enable Telegram notifications", "فعال‌سازی اعلان تلگرام")}<ArrowUpRight size={15} aria-hidden="true"/></Link> : <div id={settingsId} hidden={overview && !expanded} className={overview ? styles.overviewSettings : undefined}>{(!overview || expanded) && <>
      {loading ? <p className={styles.status} role="status"><LoaderCircle size={16} className={styles.spinner}/>{text("Loading your settings…", "در حال دریافت تنظیمات…")}</p> : state && !state.available ? <p className={styles.status}>{description}</p> : connected ? <>
        <div className={styles.connectedAccount} data-private-value><CheckCheck size={20} aria-hidden="true"/><div><strong dir="auto">{account?.displayName}</strong>{account?.username && <span dir="ltr">@{account.username}</span>}</div></div>
        <div className={styles.benefits}><span><Bell size={15}/>{text("Transfer status updates", "تغییر وضعیت انتقال")}</span><span><Check size={15}/>{text("Messages from Zarman", "پیام‌های زرمان")}</span></div>
        <label className={styles.preference}><input type="checkbox" checked={state!.connection!.previewMessages} disabled={busy} onChange={event => void run("preferences", event.target.checked)}/><span><strong>{text("Include message text", "متن پیام‌ها را هم در تلگرام دریافت کنم")}</strong><small>{text("When this is off, we'll let you know there's a new message and you can read it in your dashboard.", "اگر این گزینه خاموش باشد، فقط خبر پیام جدید را در تلگرام دریافت می‌کنید و متن آن را در داشبورد می‌خوانید.")}</small></span></label>
        {disconnecting ? <div className={styles.disconnect}><p>{text("Disconnect Telegram? You can still see every update and message in your dashboard.", "اتصال تلگرام قطع شود؟ همهٔ وضعیت‌ها و پیام‌ها همچنان در داشبورد در دسترس‌اند.")}</p><div className={styles.actions}><DashboardButton tone="secondary" disabled={busy} onClick={() => void run("disconnect")}>{text("Disconnect", "قطع اتصال")}</DashboardButton><DashboardButton tone="quiet" disabled={busy} onClick={() => setDisconnecting(false)}>{text("Keep connected", "حفظ اتصال")}</DashboardButton></div></div> : <button className={styles.quiet} type="button" disabled={busy} onClick={() => setDisconnecting(true)}><Unplug size={14}/>{text("Disconnect Telegram", "قطع اتصال تلگرام")}</button>}
      </> : state?.pending ? <div className={styles.setup} aria-live="polite">
        <ol className={styles.steps} aria-label={text("Connect Telegram", "اتصال تلگرام")}><li data-done={state.pending.claimed}><span>{state.pending.claimed ? <Check size={13}/> : "1"}</span>{text("Open Telegram & tap Start", "تلگرام را باز کنید و Start بزنید")}</li><li data-active={state.pending.claimed}><span>2</span>{text("Confirm your account here", "حساب خود را اینجا تأیید کنید")}</li></ol>
        {state.pending.claimed ? <><div className={styles.connectedAccount} data-private-value><Send size={20}/><div><strong dir="auto">{account?.displayName}</strong>{account?.username && <span dir="ltr">@{account.username}</span>}</div></div><p className={styles.hint}>{text("Confirm only if this is your own Telegram account. Notifications will start after you confirm.", "فقط اگر این حساب تلگرام متعلق به شماست تأیید کنید. اعلان‌ها پس از تأیید فعال می‌شوند.")}</p><DashboardButton className={telegramButton} disabled={busy} onClick={() => void run("confirm")}><Check size={16}/>{text("Confirm & enable notifications", "تأیید و فعال‌سازی اعلان‌ها")}</DashboardButton></> : <><p className={styles.hint}>{text("After tapping Start, return here to confirm. Your connection link expires after 10 minutes.", "پس از زدن Start به این صفحه برگردید و اتصال را تأیید کنید. لینک اتصال ۱۰ دقیقه اعتبار دارد.")}</p>{link && <DashboardButton className={telegramButton} asChild><a href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-private-value><Send size={16}/>{text("Open Telegram", "باز کردن تلگرام")}<ArrowUpRight size={15}/></a></DashboardButton>}<p className={styles.status} role="status"><LoaderCircle size={15} className={styles.spinner}/>{text("Waiting for you to start the bot…", "در انتظار شروع ربات…")}</p></>}
        {!state.pending.claimed && !link && <p className={styles.hint}>{text("If you have not opened the bot yet, cancel this setup and connect again to get a fresh link.", "اگر هنوز ربات را باز نکرده‌اید، این اتصال را لغو کنید و دوباره لینک بگیرید.")}</p>}
        <div className={styles.actions}><button className={styles.quiet} type="button" disabled={busy} onClick={() => void refresh()}>{text("Check connection", "بررسی اتصال")}</button><button className={styles.quiet} type="button" disabled={busy} onClick={() => void run("cancel")}>{text("Cancel setup", "لغو اتصال")}</button></div>
      </div> : state?.available && <div className={styles.start}><div className={styles.benefits}><span><Bell size={15}/>{text("Status updates", "وضعیت انتقال")}</span><span><Check size={15}/>{text("Team messages", "پیام‌های تیم زرمان")}</span></div><DashboardButton className={telegramButton} disabled={busy} onClick={() => void run("begin")}>{busy ? <LoaderCircle size={16} className={styles.spinner}/> : <Send size={16}/>} {text("Connect Telegram", "اتصال تلگرام")}</DashboardButton><p className={styles.privacy}><LockKeyhole size={14}/>{text("You can disconnect whenever you like. Message text is only sent to Telegram if you choose to include it.", "هر زمان بخواهید می‌توانید اتصال را قطع کنید. متن پیام‌ها فقط با انتخاب شما به تلگرام ارسال می‌شود.")}</p></div>}
      {error && <p role="alert" className={styles.error}>{(errors[error] || errors.telegram_unavailable)[fa ? 1 : 0]} <button type="button" disabled={busy} onClick={() => void refresh()}>{text("Refresh", "تازه‌سازی")}</button></p>}
      {notice && <p role="status" className={styles.notice}><Check size={15}/>{notice === "connected" ? text("Telegram notifications are on.", "اعلان تلگرام فعال شد.") : notice === "disconnected" ? text("Telegram disconnected.", "اتصال تلگرام قطع شد.") : text("Your preference is saved.", "تنظیمات شما ذخیره شد.")}</p>}
    </>}</div>}
  </>;
  return overview ? <DashboardMagicCard tone="telegram" replayLottieOnHover motionEnabled={motionEnabled} contentClassName="p-5 sm:p-7" data-overview-card="telegram">
    <section id="telegram-notifications" className={styles.overview} dir={fa ? "rtl" : "ltr"} aria-labelledby={headingId} aria-busy={busy || loading}>{content}</section>
  </DashboardMagicCard> : <section id={compact ? undefined : "telegram-notifications"} className={`${styles.card} ${compact ? styles.compact : ""}`} dir={fa ? "rtl" : "ltr"} aria-labelledby={headingId} aria-busy={busy || loading}>{content}</section>;
}
