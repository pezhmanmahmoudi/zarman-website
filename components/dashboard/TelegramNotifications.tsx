"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, LoaderCircle, Send } from "lucide-react";
import { beginCustomerTelegram, getCustomerTelegram, updateCustomerTelegram } from "@/app/actions/customer-telegram.actions";
import type { TelegramConnectionState } from "@/lib/notifications/customer-telegram-types";
import { DashboardButton, DashboardMagicCard } from "./dashboard-ui";
import { DashboardLottieScene } from "./DashboardLottieScene";
import { dashboardHref } from "@/lib/dashboard/navigation";
import styles from "@/styles/dashboard/TelegramNotifications.module.css";

type TelegramAction = "begin" | "confirm" | "cancel" | "disconnect" | "preferences";

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
  const [expired, setExpired] = useState(false);
  const [openedLink, setOpenedLink] = useState("");
  const [slowLink, setSlowLink] = useState("");
  const [checking, setChecking] = useState(false);
  const [activeAction, setActiveAction] = useState<TelegramAction | null>(null);
  const headerAction = useRef<HTMLButtonElement>(null);
  const restoreActionFocus = useRef(false);
  const previousPending = useRef<TelegramConnectionState["pending"]>(null);
  const acceptState = useCallback((next: TelegramConnectionState) => {
    if (previousPending.current && !next.pending && !next.connection) setExpired(true);
    if (previousPending.current?.id !== next.pending?.id || !next.pending) setLink("");
    previousPending.current = next.pending;
    setState(next);
  }, []);
  const version = useRef(0), mutating = useRef(false), reading = useRef(false), mounted = useRef(false), lastRead = useRef(0);
  const refresh = useCallback(async () => {
    if (reading.current || mutating.current) return;
    reading.current = true; lastRead.current = Date.now();
    const requestVersion = version.current;
    try {
      const result = await getCustomerTelegram();
      if (mounted.current && requestVersion === version.current) {
        if (result.data) { acceptState(result.data); setError(""); }
        else setError(result.error || "telegram_unavailable");
      }
    } catch { if (mounted.current && requestVersion === version.current) setError("telegram_unavailable"); }
    finally { reading.current = false; if (mounted.current) setLoading(false); }
  }, [acceptState]);

  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, [refresh]);
  useEffect(() => {
    if (!busy && restoreActionFocus.current) {
      restoreActionFocus.current = false;
      headerAction.current?.focus();
    }
  }, [busy]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRead.current > (state?.pending ? 3_000 : 20_000)) void refresh();
    };
    window.addEventListener("focus", onVisible); document.addEventListener("visibilitychange", onVisible);
    const timer = state?.pending ? window.setInterval(onVisible, 4_000) : null;
    return () => { window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); if (timer !== null) window.clearInterval(timer); };
  }, [state?.pending, refresh]);

  const pendingId = state?.pending?.id, pendingClaimed = state?.pending?.claimed;
  useEffect(() => {
    if (!pendingId || pendingClaimed) return;
    const timer = window.setTimeout(() => setSlowLink(pendingId), 45_000);
    return () => window.clearTimeout(timer);
  }, [pendingId, pendingClaimed]);

  async function checkConnection() {
    if (checking || busy) return;
    setChecking(true);
    const pendingId = state?.pending?.id;
    await refresh();
    if (mounted.current) { setChecking(false); if (pendingId) setSlowLink(pendingId); }
  }

  async function run(action: TelegramAction, previewMessages?: boolean) {
    if (mutating.current) return;
    mutating.current = true; version.current++; setBusy(true); setActiveAction(action); setError(""); setNotice("");
    try {
      if (action === "begin") {
        const result = await beginCustomerTelegram(fa ? "fa" : "en");
        if (mounted.current) {
          if (result.data) { acceptState(result.data.state); setLink(result.data.url); setExpired(false); }
          else setError(result.error || "telegram_unavailable");
        }
      } else {
        const id = ["confirm","cancel"].includes(action) ? state?.pending?.id : state?.connection?.id;
        if (!id) return;
        const result = await updateCustomerTelegram({ action, id, locale: fa ? "fa" : "en", previewMessages });
        if (mounted.current) {
          if (result.data) {
            acceptState(result.data); setLink(""); setDisconnecting(false);
            if (action === "cancel" || action === "disconnect" || action === "confirm") {
              setExpired(false); setExpanded(false); restoreActionFocus.current = true;
            }
            setNotice(action === "confirm" ? "connected" : action === "disconnect" ? "disconnected" : action === "preferences" ? "saved" : "");
          } else setError(result.error || "telegram_unavailable");
        }
      }
    } catch { if (mounted.current) setError("telegram_unavailable"); }
    finally { mutating.current = false; if (mounted.current) { setBusy(false); setActiveAction(null); } }
  }

  const errors: Record<string, [string, string]> = {
    please_wait: ["Please wait 30 seconds before getting another link.", "برای دریافت لینک تازه، ۳۰ ثانیه صبر کنید."],
    link_expired: ["This link has expired. Get a new link to continue.", "لینک منقضی شده است. برای ادامه، لینک تازه بگیرید."],
    verified_account_required: ["Verify your email before connecting Telegram.", "ابتدا ایمیل خود را تأیید کنید، سپس تلگرام را متصل کنید."],
    sign_in_required: ["Sign in again to change your Telegram settings.", "برای تغییر تنظیمات تلگرام، دوباره وارد حساب شوید."],
    telegram_already_connected: ["This Telegram account is connected to another Zarman account.", "این حساب تلگرام به حساب دیگری در زرمان متصل است."],
    already_connected: ["Telegram is already connected. Refresh to see your settings.", "تلگرام متصل است. وضعیت اتصال را دوباره بررسی کنید."],
    connection_changed: ["Your connection changed. Refresh and try again.", "وضعیت اتصال تغییر کرده است. دوباره بررسی کنید."],
    telegram_unavailable: ["We couldn't reach Telegram. Please try again.", "ارتباط با تلگرام برقرار نشد. دوباره تلاش کنید."],
    telegram_setup_required: ["Telegram is unavailable right now. Please try later or contact Zarman.", "اتصال تلگرام فعلاً در دسترس نیست. کمی بعد تلاش کنید یا به تیم زرمان اطلاع دهید."],
  };
  if (compact && (loading || error || !state?.available)) return null;

  const connected = !!state?.connection;
  const pending = state?.pending;
  const account = state?.connection || pending;
  const settingsId = headingId + "-settings";
  const preferenceId = headingId + "-message-text";
  const preferenceLabelId = preferenceId + "-label";
  const preferenceDescriptionId = preferenceId + "-description";
  const showDetails = connected ? expanded : !!pending;
  const unavailable = !!state && !state.available;
  const primaryClass = [styles.button, styles.primary].join(" ");
  const secondaryClass = [styles.button, styles.secondary].join(" ");
  const headerPrimaryClass = [primaryClass, styles.headerButton].join(" ");
  const headerSecondaryClass = [secondaryClass, styles.headerButton].join(" ");
  const disconnectClass = [styles.button, styles.danger].join(" ");
  const busyLabel = activeAction === "confirm" ? text("Confirming…", "در حال تأیید…")
    : activeAction === "disconnect" ? text("Disconnecting…", "در حال قطع اتصال…")
    : text("Preparing…", "آماده‌سازی…");
  const title = unavailable ? text("Telegram notifications", "اعلان‌های تلگرام")
    : connected ? text("Telegram is connected", "تلگرام شما متصل است")
    : pending?.claimed ? text("Confirm your Telegram account", "حساب تلگرامتان را تأیید کنید")
    : pending && link ? text("Tap Start in Telegram", "در تلگرام Start را بزنید")
    : text("Stay up to date with your transfer", "از انتقال خود باخبر بمانید");
  const description = unavailable
    ? text("Telegram is unavailable right now. Please try again later.", "اتصال تلگرام فعلاً در دسترس نیست. کمی بعد دوباره تلاش کنید.")
    : connected ? text("Transfer updates and messages from Zarman go to your Telegram.", "وضعیت انتقال و پیام‌های زرمان را در تلگرام دریافت می‌کنید.")
    : pending?.claimed ? text("Is the account below yours? Confirm it to connect.", "حساب زیر متعلق به شماست؟ آن را تأیید کنید تا اتصال برقرار شود.")
    : pending && link ? text("Open the bot, tap Start, then return here to confirm your account.", "ربات را باز کنید، Start بزنید و برای تأیید حساب به همین صفحه برگردید.")
    : pending ? text("Get a new link to continue. Already tapped Start? Check the connection below.", "برای ادامه لینک تازه بگیرید. اگر Start را زده‌اید، اتصال را بررسی کنید.")
    : expired ? text("Your link expired. Get a new link to connect.", "لینک قبلی منقضی شد. برای اتصال، لینک تازه بگیرید.")
    : text("Receive transfer updates and messages from Zarman on Telegram.", "وضعیت انتقال و پیام‌های زرمان را در تلگرام دریافت کنید.");

  const primaryAction = compact ? null : connected ? (
    <DashboardButton ref={headerAction} type="button" tone="secondary" className={headerSecondaryClass} disabled={busy || loading}
      aria-expanded={showDetails} aria-controls={settingsId} onClick={() => { setExpanded(value => !value); setDisconnecting(false); }}>
      {expanded ? text("Close settings", "بستن تنظیمات") : text("Settings", "تنظیمات")}
      <ChevronDown size={16} className={styles.chevron} data-expanded={expanded} aria-hidden="true" />
    </DashboardButton>
  ) : pending?.claimed ? null : pending && link && !busy ? (
    <DashboardButton className={headerPrimaryClass} asChild>
      <a href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-private-value onClick={() => setOpenedLink(pending.id)}>
        <Send size={16} aria-hidden="true" />{text("Open Zarman bot", "باز کردن ربات زرمان")}
      </a>
    </DashboardButton>
  ) : (
    <DashboardButton ref={headerAction} type="button" className={headerPrimaryClass} disabled={busy || loading || checking} onClick={() => {
      if (!state?.available) { setLoading(true); void refresh(); return; }
      void run("begin");
    }}>
      {(busy || loading) && <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" />}
      {loading ? text("Checking…", "در حال بررسی…") : busy ? busyLabel
        : !state?.available ? text("Try again", "تلاش دوباره")
        : pending || expired ? text("Get a new link", "دریافت لینک تازه") : text("Connect Telegram", "اتصال تلگرام")}
    </DashboardButton>
  );

  const accountDetails = (
    <div className={styles.accountRow} data-private-value>
      <span className={styles.fieldLabel}>{connected ? text("Connected account", "حساب متصل") : text("Telegram account", "حساب تلگرام")}</span>
      <div className={styles.accountDetails}>
        <strong dir="auto">{account?.displayName || text("Telegram account", "حساب تلگرام")}</strong>
        {account?.username && <span dir="ltr">@{account.username}</span>}
      </div>
    </div>
  );

  const content = <>
    <div className={styles.header}>
      {!compact && <span aria-hidden="true" className={styles.illustration}>
        <DashboardLottieScene name="telegram-chatbot" size={88} motionEnabled={motionEnabled} className={styles.scene} />
      </span>}
      <div className={styles.heading}>
        {!compact && <p className={styles.eyebrow}><span dir="ltr">@ZarmanConnectBot</span></p>}
        <h2 id={headingId}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
      {primaryAction && <div className={styles.headerAction}>{primaryAction}</div>}
    </div>

    {compact ? (
      <DashboardButton tone="secondary" className={secondaryClass} asChild>
        <Link href={dashboardHref(locale, "profile") + "#telegram-notifications"}>
          {connected ? text("Telegram settings", "تنظیمات تلگرام") : text("Connect Telegram", "اتصال تلگرام")}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </DashboardButton>
    ) : <>
      <div id={settingsId} hidden={!showDetails} className={styles.details}>
        {showDetails && (connected ? <>
          {accountDetails}
          <label className={styles.preference} htmlFor={preferenceId} data-disabled={busy}>
            <span className={styles.preferenceText}>
              <strong id={preferenceLabelId}>{text("Include message text", "دریافت متن پیام‌ها")}</strong>
              <small id={preferenceDescriptionId}>
                {activeAction === "preferences" ? text("Saving…", "در حال ذخیره…")
                  : text("When off, you only receive a new-message notification.", "اگر خاموش باشد، فقط از پیام تازه باخبر می‌شوید.")}
              </small>
            </span>
            <span className={styles.switchControl} dir="ltr">
              <input id={preferenceId} type="checkbox" role="switch" aria-labelledby={preferenceLabelId} aria-describedby={preferenceDescriptionId}
                checked={state!.connection!.previewMessages} disabled={busy}
                onChange={event => void run("preferences", event.target.checked)} />
              <span className={styles.switchTrack} aria-hidden="true"><span className={styles.switchThumb}><Check size={12} /></span></span>
            </span>
          </label>
          <div className={styles.settingsFooter}>
            {disconnecting ? <>
              <div className={styles.confirmation}>
                <strong>{text("Turn off Telegram notifications?", "اعلان‌های تلگرام قطع شوند؟")}</strong>
                <p>{text("You can reconnect whenever you like.", "هر زمان بخواهید می‌توانید دوباره متصل شوید.")}</p>
              </div>
              <div className={styles.actions}>
                <DashboardButton autoFocus type="button" tone="secondary" className={secondaryClass} disabled={busy} onClick={() => setDisconnecting(false)}>
                  {text("Cancel", "انصراف")}
                </DashboardButton>
                <DashboardButton type="button" className={[styles.button, styles.dangerPrimary].join(" ")} disabled={busy} onClick={() => void run("disconnect")}>
                  {activeAction === "disconnect" && <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" />}
                  {activeAction === "disconnect" ? busyLabel : text("Disconnect", "قطع اتصال")}
                </DashboardButton>
              </div>
            </> : <DashboardButton type="button" tone="secondary" className={disconnectClass} disabled={busy} onClick={() => setDisconnecting(true)}>
              {text("Disconnect Telegram", "قطع اتصال تلگرام")}
            </DashboardButton>}
          </div>
        </> : pending ? <>
          {pending.claimed ? <>
            {accountDetails}
            <div className={styles.actions}>
              <DashboardButton type="button" className={primaryClass} disabled={busy} onClick={() => void run("confirm")}>
                {activeAction === "confirm" && <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" />}
                {activeAction === "confirm" ? busyLabel : text("Confirm and connect", "تأیید و اتصال")}
              </DashboardButton>
              <DashboardButton type="button" tone="secondary" className={secondaryClass} disabled={busy} onClick={() => void run("cancel")}>
                {text("This isn't my account", "این حساب من نیست")}
              </DashboardButton>
            </div>
          </> : <>
            {slowLink === pending.id ? <p className={styles.setupStatus} role="status">
              {text("No response yet. Open the bot with this link and tap Start again.", "هنوز پاسخی نرسیده است. ربات را از همین لینک باز کنید و دوباره Start بزنید.")}
            </p> : openedLink === pending.id && <p className={styles.setupStatus} role="status">
              <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" />
              {text("Waiting for Start…", "منتظر زدن Start در تلگرام…")}
            </p>}
            <div className={styles.actions}>
              <DashboardButton type="button" tone="secondary" className={secondaryClass} disabled={busy || checking} onClick={() => void checkConnection()}>
                {checking && <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" />}
                {checking ? text("Checking…", "در حال بررسی…") : text("I've tapped Start", "Start را زدم")}
              </DashboardButton>
              <DashboardButton type="button" tone="secondary" className={secondaryClass} disabled={busy || checking} onClick={() => void run("cancel")}>
                {text("Cancel", "انصراف")}
              </DashboardButton>
            </div>
          </>}
        </> : null)}
      </div>
      {error && <div role="alert" className={styles.error}>
        <p>{(errors[error] || errors.telegram_unavailable)[fa ? 1 : 0]}</p>
        {state?.available && <DashboardButton type="button" tone="secondary" className={secondaryClass} disabled={busy || checking} onClick={() => void checkConnection()}>
          {text("Try again", "تلاش دوباره")}
        </DashboardButton>}
      </div>}
      <span className={styles.screenReaderOnly} role="status" aria-live="polite">
        {pending?.claimed ? text("Your Telegram account is ready to confirm.", "حساب تلگرام آماده تأیید است.")
          : notice === "connected" ? text("Telegram connected.", "تلگرام متصل شد.")
          : notice === "disconnected" ? text("Telegram disconnected.", "اتصال تلگرام قطع شد.")
          : notice === "saved" ? text("Settings saved.", "تنظیمات ذخیره شد.") : ""}
      </span>
    </>}
  </>;

  const panel = <section id={compact ? undefined : "telegram-notifications"}
    className={[styles.panel, compact ? styles.compact : ""].join(" ")}
    dir={fa ? "rtl" : "ltr"} aria-labelledby={headingId} aria-busy={busy || loading}>{content}</section>;

  return overview ? (
    <DashboardMagicCard tone="telegram" replayLottieOnHover motionEnabled={motionEnabled} className={styles.surface}
      style={{ background: "var(--telegram-surface)", borderColor: "var(--telegram-border)" }}
      contentClassName="p-5 sm:p-7" data-overview-card="telegram">{panel}</DashboardMagicCard>
  ) : <div className={styles.card}>{panel}</div>;
}
