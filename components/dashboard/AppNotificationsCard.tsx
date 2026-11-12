"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BellRing, CheckCircle2, ChevronDown, LoaderCircle, TrendingUp, Zap } from "lucide-react";
import { PUSH_ERRORS, usePushNotifications } from "@/hooks/usePushNotifications";
import { useInstallApp } from "@/hooks/useInstallApp";
import { DashboardMagicCard } from "./dashboard-ui";
import { DashboardLottieScene } from "./DashboardLottieScene";
import styles from "@/styles/dashboard/AppNotifications.module.css";

const BRAND = "ZarmanEx";
const noSubscribe = () => () => {};
// Arriving from the home popup's "Sign in" (…?focus=notifications): open and show this card.
const focusRequested = () => new URLSearchParams(window.location.search).get("focus") === "notifications";

/**
 * The ZarmanEx app and its notifications, for the dashboard overview and the profile.
 * Like the Telegram card: a short pitch with one main action, and a dropdown with
 * the features, how to install the app, and the notification controls.
 */
export function AppNotificationsCard({ locale, motionEnabled = true, anchor = false }: { locale: string; motionEnabled?: boolean; anchor?: boolean }) {
  const fa = locale === "fa", t = (en: string, persian: string) => fa ? persian : en;
  const headingId = useId(), detailsId = useId();
  const push = usePushNotifications(locale);
  const app = useInstallApp();
  const requested = useSyncExternalStore(noSubscribe, () => anchor && focusRequested(), () => false);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? requested;
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!requested) return;
    section.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [requested]);

  const { phase, busy } = push;
  const title = phase === "on" ? t("Notifications are on", "نوتیفیکیشن روشن است")
    : phase === "denied" ? t("Notifications are blocked", "نوتیفیکیشن مسدود است")
    : t("Get our messages instantly", "پیام‌های ما را همان لحظه دریافت کنید");
  const description = phase === "on"
    ? t("Our messages and every update on your transfers come straight to this device.", "پیام‌های ما و هر تغییر در وضعیت حواله‌هایتان مستقیم روی همین دستگاه به شما می‌رسد.")
    : phase === "denied"
    ? t(`Your browser is blocking notifications from ${BRAND}. Open the guide to allow them.`, `مرورگرتان جلوی نوتیفیکیشن‌های ${BRAND} را گرفته است. برای مجاز کردن، راهنما را باز کنید.`)
    : t(`Install the ${BRAND} app and turn on notifications to get our messages and every change in your transfer status, the moment it happens.`,
      `با نصب اپلیکیشن ${BRAND} و روشن کردن نوتیفیکیشن، پیام‌های ما و هر تغییر در وضعیت حواله‌تان را همان لحظه دریافت می‌کنید.`);

  const spinner = <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" />;
  const enableButton = (extra = "") => (
    <button type="button" className={`${styles.button} ${styles.primary} ${extra}`} disabled={!!busy || phase === "loading"} onClick={() => void push.enable()}>
      {busy === "enable" ? spinner : <BellRing size={16} aria-hidden="true" />}
      {busy === "enable" ? t("Turning on…", "در حال روشن کردن…") : t("Turn on notifications", "روشن کردن نوتیفیکیشن")}
    </button>
  );
  const installButton = (extra = "") => (
    <button type="button" className={`${styles.button} ${phase === "off" ? styles.secondary : styles.primary} ${extra}`} onClick={() => void app.install()}>
      {t("Install the app", "نصب اپلیکیشن")}
    </button>
  );

  const features: { icon: ReactNode; label: string; detail: string }[] = [
    { icon: <TrendingUp size={18} />, label: t("Track the live dollar rate", "پیگیری نرخ لحظه‌ای دلار"), detail: t("The live AUD rate, always at hand.", "نرخ لحظه‌ای دلار استرالیا همیشه دم دستتان است.") },
    { icon: <BellRing size={18} />, label: t("Notifications when your transfer status changes", "دریافت نوتیفیکیشن با تغییر وضعیت حواله"), detail: t("Stay up to date with your transfer, step by step.", "گام به گام از تغییرات حواله‌تان باخبر باشید.") },
    { icon: <Zap size={18} />, label: t("Light and fast", "سبک و سریع"), detail: t("Installs quickly and is as easy to use as any app.", "سریع نصب می‌شود و به‌راحتی مثل یک اپلیکیشن از آن استفاده می‌کنید.") },
  ];
  const chip = (text: string) => <bdi dir="ltr" className={styles.chip}>{text}</bdi>;
  const installSteps: { device: string; how: ReactNode }[] = [
    { device: t("Android", "اندروید"), how: <>{t("In Chrome, open the menu", "در Chrome منوی")} {chip("⋮")} {t("and tap", "را باز کنید و")} {chip("Install app")}{t("", " را بزنید")}</> },
    { device: t("iPhone", "آیفون"), how: <>{t("In Safari, tap", "در Safari روی")} {chip("Share")} {t("and choose", "بزنید و")} {chip("Add to Home Screen")}{t("", " را انتخاب کنید")}</> },
    { device: t("Computer", "کامپیوتر"), how: t("In Chrome or Edge, click the install icon at the end of the address bar.", "در Chrome یا Edge روی آیکون نصب در انتهای نوار آدرس کلیک کنید.") },
  ];

  const notificationControls = phase === "on" ? <>
      <p className={styles.status}><CheckCircle2 size={16} aria-hidden="true" />{t("On for this device.", "روی این دستگاه روشن است.")}</p>
      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.secondary}`} disabled={!!busy} onClick={() => void push.test()}>
          {busy === "test" && spinner}{t("Send a test notification", "ارسال نوتیفیکیشن آزمایشی")}
        </button>
        <button type="button" className={`${styles.button} ${styles.danger}`} disabled={!!busy} onClick={() => void push.disable()}>
          {busy === "disable" && spinner}{t("Turn off", "خاموش کردن")}
        </button>
      </div>
    </>
    : phase === "denied" ? <>
      <ol className={styles.steps}>
        <li>{t("On a computer, click the icon next to the address bar and choose", "در کامپیوتر روی آیکون کنار نوار آدرس بزنید و")} {chip("Notifications › Allow")}{t("", " را انتخاب کنید")}.</li>
        <li>{t("On a phone, open the browser menu and go to", "در گوشی از منوی مرورگر به")} {chip("Site settings › Notifications")}{t("", " بروید")}.</li>
      </ol>
      <div className={styles.actions}><button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => window.location.reload()}>{t("Reload page", "بارگذاری دوباره")}</button></div>
    </>
    : phase === "install" ? <p className={styles.text}>{t(`First add ${BRAND} to your iPhone's Home Screen, then turn on notifications from inside the app.`, `ابتدا ${BRAND} را به صفحهٔ اصلی آیفون اضافه کنید و سپس از داخل اپلیکیشن نوتیفیکیشن را روشن کنید.`)}</p>
    : phase === "unsupported" ? <p className={styles.text}>{t("This browser can't show notifications. Use Chrome, Edge or Safari.", "این مرورگر نوتیفیکیشن را پشتیبانی نمی‌کند. از Chrome، Edge یا Safari استفاده کنید.")}</p>
    : <>
      <p className={styles.text}>{t("Off on this device.", "روی این دستگاه خاموش است.")}</p>
      <div className={styles.actions}>{enableButton()}</div>
    </>;

  const headerPrimary = phase === "off" ? enableButton(styles.headerButton)
    : app.canInstall ? installButton(styles.headerButton) : null;

  return (
    <DashboardMagicCard tone="violet" replayLottieOnHover motionEnabled={motionEnabled} className={styles.surface}
      style={{ background: "var(--app-surface)", borderColor: "var(--app-border)" }} contentClassName="p-5 sm:p-7" data-overview-card="app">
      <section ref={section} id={anchor ? "push-notifications" : undefined} className={styles.panel} dir={fa ? "rtl" : "ltr"} aria-labelledby={headingId} aria-busy={!!busy}>
        <div className={styles.header}>
          <span aria-hidden="true" className={styles.illustration}>
            <DashboardLottieScene name="announcement" size={88} motionEnabled={motionEnabled} className={styles.scene} />
          </span>
          <div className={styles.heading}>
            <p className={styles.eyebrow}><bdi dir="ltr">{BRAND} app</bdi></p>
            <h2 id={headingId}>{title}</h2>
            <p className={styles.description}>{description}</p>
          </div>
          <div className={styles.headerAction}>
            {/* With the dropdown open, its own buttons take over; avoid showing the same action twice. */}
            {!open && headerPrimary}
            <button type="button" className={`${styles.button} ${styles.secondary} ${styles.headerButton}`} aria-expanded={open} aria-controls={detailsId}
              onClick={() => setUserOpen(!open)}>
              {phase === "on" ? t("Settings", "تنظیمات") : t("Guide and features", "راهنما و ویژگی‌ها")}
              <ChevronDown size={16} className={styles.chevron} data-expanded={open} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div id={detailsId} hidden={!open} className={styles.details}>
          {open && <>
            <section className={styles.block} aria-label={t("Notifications", "نوتیفیکیشن")}>
              <h3>{t("Notifications", "نوتیفیکیشن")}</h3>
              {notificationControls}
            </section>

            <section className={styles.block} aria-label={t("Installing the app", "نصب اپلیکیشن")}>
              <h3>{t("Installing the app", "نصب اپلیکیشن")}</h3>
              {app.installed
                ? <p className={styles.status}><CheckCircle2 size={16} aria-hidden="true" />{t(`${BRAND} is installed on this device.`, `اپلیکیشن ${BRAND} روی این دستگاه نصب است.`)}</p>
                : <>
                  <ul className={styles.devices}>
                    {installSteps.map(step => <li key={step.device}><strong>{step.device}</strong><span>{step.how}</span></li>)}
                  </ul>
                  {app.canInstall && <div className={styles.actions}>{installButton()}</div>}
                </>}
            </section>

            <section className={styles.block} aria-label={t("What you get", "ویژگی‌ها")}>
              <h3>{t("What you get", "ویژگی‌ها")}</h3>
              <ul className={styles.features}>
                {features.map(item => <li key={item.label}><span className={styles.featureIcon} aria-hidden="true">{item.icon}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span></li>)}
              </ul>
            </section>
          </>}
        </div>

        {push.error && <p role="alert" className={styles.error}>{(PUSH_ERRORS[push.error] || PUSH_ERRORS.push_unavailable)[fa ? 1 : 0]}</p>}
        <span className={styles.srOnly} role="status" aria-live="polite">
          {push.notice === "enabled" ? t("Notifications turned on.", "نوتیفیکیشن روشن شد.")
            : push.notice === "disabled" ? t("Notifications turned off.", "نوتیفیکیشن خاموش شد.")
            : push.notice === "tested" ? t("Test notification sent. It should appear in a few seconds.", "نوتیفیکیشن آزمایشی ارسال شد و تا چند ثانیهٔ دیگر نمایش داده می‌شود.") : ""}
        </span>
      </section>
    </DashboardMagicCard>
  );
}
