"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BellRing, LoaderCircle, Share, SquarePlus, TrendingUp, X, Zap } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { PUSH_ERRORS, usePushNotifications } from "@/hooks/usePushNotifications";
import { useInstallApp } from "@/hooks/useInstallApp";
import { hidePrompt, isPromptHidden, type HomePrompt } from "@/lib/notifications/prompt-preferences";
import styles from "./HomeAppPrompt.module.css";

export type PromptVariant = "install" | "ios" | "notifications" | "signin" | "enabled" | "blocked" | "unsupported";
type PushView = Pick<ReturnType<typeof usePushNotifications>, "busy" | "error" | "enable">;

const BRAND = "ZarmanEx";
const SWIPE_TO_CLOSE_PX = 110;

/**
 * Decides what to offer. The app comes first: install it where the browser can,
 * explain Add to Home Screen on iPhone, and only then (inside the installed app,
 * or where installing isn't possible) ask to turn on notifications.
 */
export default function HomeAppPromptCard() {
  const locale = useLocale();
  const push = usePushNotifications(locale);
  const app = useInstallApp();
  const [hidden, setHidden] = useState(() => ({ notifications: isPromptHidden("notifications"), install: isPromptHidden("install") }));
  const [attempted, setAttempted] = useState(false);
  const [closed, setClosed] = useState(false);

  const variant: PromptVariant | null = closed ? null
    // "attempted": the customer tapped Turn on here, so show the outcome here.
    : attempted && push.phase === "on" ? "enabled"
    : attempted && push.phase === "denied" ? "blocked"
    : !hidden.install && app.canInstall ? "install"
    : !hidden.notifications && push.phase === "install" ? "ios"
    : !hidden.notifications && push.phase === "off" ? "notifications"
    : !hidden.notifications && push.phase === "signed-out" ? "signin"
    : !hidden.notifications && push.phase === "denied" ? "blocked"
    : !hidden.notifications && push.phase === "unsupported" ? "unsupported"
    : null;
  if (!variant) return null;

  // "Later" quiets the popup for a while, "Don't show again" for good, whichever invitation it was.
  const hide = (mode: "snooze" | "forever") => {
    for (const kind of ["notifications", "install"] as HomePrompt[]) hidePrompt(kind, mode);
    setHidden({ notifications: true, install: true });
  };
  return <HomeAppPromptView locale={locale} variant={variant}
    push={{ ...push, enable: async () => { setAttempted(true); await push.enable(); } }}
    onInstall={async () => { if (await app.install() === "dismissed") hide("snooze"); else setClosed(true); }}
    onLater={() => hide("snooze")}
    onNever={() => hide("forever")}
    onClose={() => setClosed(true)} />;
}

/**
 * The popup: a native modal dialog (focus trap, Esc, top layer). A centred window
 * on larger screens; on phones a bottom sheet that can be swiped down to close.
 */
export function HomeAppPromptView({ locale, variant, push, onInstall, onLater, onNever, onClose }: {
  locale: string; variant: PromptVariant; push: PushView;
  onInstall: () => void; onLater: () => void; onNever: () => void; onClose: () => void;
}) {
  const fa = locale === "fa", t = (en: string, persian: string) => fa ? persian : en;
  const lang = fa ? "fa" : "en";
  const titleId = useId(), bodyId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; offset: number } | null>(null);
  const [phone] = useState(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1);

  useEffect(() => {
    const node = dialog.current;
    if (!node || node.open) return;
    node.showModal();
    // Start on the title, not the close button: screen readers hear what the popup is about,
    // and no focus ring is drawn around ✕ when it opens.
    node.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, []);

  // Close first so the browser returns focus to where the customer was, then update state.
  const finish = (action: () => void) => { dialog.current?.close(); action(); };
  // Outcome screens just close; invitations are postponed.
  const dismiss = () => finish(variant === "enabled" ? onClose : onLater);

  // Swipe the sheet's top area down to close (phones only).
  const onDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || !window.matchMedia("(max-width: 560px)").matches) return;
    drag.current = { start: event.clientY, offset: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (sheet.current) sheet.current.style.transition = "none";
  };
  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !sheet.current) return;
    drag.current.offset = Math.max(0, event.clientY - drag.current.start);
    sheet.current.style.transform = `translateY(${drag.current.offset}px)`;
  };
  const onDragEnd = () => {
    if (!drag.current || !sheet.current) return;
    const { offset } = drag.current;
    drag.current = null;
    sheet.current.style.transition = "";
    if (offset > SWIPE_TO_CLOSE_PX) dismiss();
    else sheet.current.style.transform = "";
  };

  // After signing in, land on the Profile notifications card (login only returns to dashboard pages).
  const signInHref = `/${lang}/login?next=${encodeURIComponent(`/${lang}/dashboard?tab=profile&focus=notifications`)}`;
  const place = phone ? t("home screen", "صفحهٔ اصلی گوشی") : t("desktop", "دسکتاپ");

  const copy: Record<PromptVariant, { title: string; body: string }> = {
    install: {
      title: t(`Get the ${BRAND} app`, `اپلیکیشن ${BRAND} را نصب کنید`),
      body: t(`Check the rate and follow your transfers right from your ${place}. No app store needed.`,
        `نرخ روز را ببینید و حواله‌هایتان را مستقیم از ${place} دنبال کنید. نیازی به اپ‌استور یا گوگل‌پلی نیست.`),
    },
    ios: {
      title: t(`Get the ${BRAND} app`, `اپلیکیشن ${BRAND} را نصب کنید`),
      body: t(`Add ${BRAND} to your Home Screen. It opens like an app and can let you know how your transfer is going.`,
        `${BRAND} را به صفحهٔ اصلی آیفون اضافه کنید تا مثل یک اپ باز شود و از وضعیت حواله‌تان خبرتان کند.`),
    },
    notifications: {
      title: t("Turn on notifications", "اعلان‌ها را روشن کنید"),
      body: t("We'll let you know as soon as your transfer is approved, when we receive your payment, and when it's done.",
        "به محض تأیید حواله، دریافت واریزی شما و انجام حواله، خبرتان می‌کنیم."),
    },
    signin: {
      title: t("Turn on notifications", "اعلان‌ها را روشن کنید"),
      body: t("Sign in and we'll let you know as soon as your transfer is approved, when we receive your payment, and when it's done.",
        "وارد حساب خود شوید تا به محض تأیید حواله، دریافت واریزی و انجام حواله خبرتان کنیم."),
    },
    enabled: {
      title: t("Notifications are on", "اعلان‌ها روشن شد"),
      body: t("From now on, you'll hear from us here whenever there's news about your transfer.",
        "از این به بعد، هر خبری از حواله‌تان باشد همین‌جا به شما می‌رسد."),
    },
    blocked: {
      title: t("Notifications are turned off", "اعلان‌ها خاموش است"),
      body: t(`Your browser is blocking notifications from ${BRAND}. Allow them in its settings, then reload the page.`,
        `مرورگرتان جلوی اعلان‌های ${BRAND} را گرفته است. از تنظیمات مرورگر اجازه بدهید و صفحه را دوباره باز کنید.`),
    },
    unsupported: {
      title: t("This browser can't show notifications", "این مرورگر اعلان را پشتیبانی نمی‌کند"),
      body: t(`To get updates on your transfers, open ${BRAND} in Chrome or Safari.`,
        `برای دریافت خبر حواله‌ها، ${BRAND} را در Chrome یا Safari باز کنید.`),
    },
  };

  // Phones get the same three points, shorter, so the sheet stays compact.
  const features: { icon: ReactNode; label: string; detail: string }[] = phone ? [
    { icon: <TrendingUp size={18} strokeWidth={2.2} />, label: t("Live dollar rate", "نرخ لحظه‌ای دلار"), detail: t("Always at hand", "همیشه دم دستتان") },
    { icon: <BellRing size={18} strokeWidth={2.2} />, label: t("Transfer notifications", "نوتیفیکیشن حواله"), detail: t("Know whenever your transfer moves", "با هر تغییر وضعیت باخبر می‌شوید") },
    { icon: <Zap size={18} strokeWidth={2.2} />, label: t("Light and fast", "سبک و سریع"), detail: t("Works just like an app", "درست مثل یک اپلیکیشن") },
  ] : [
    { icon: <TrendingUp size={20} strokeWidth={2.2} />, label: t("Track the live dollar rate", "پیگیری نرخ لحظه‌ای دلار"),
      detail: t("The live AUD rate, always at hand.", "نرخ لحظه‌ای دلار استرالیا همیشه دم دستتان است.") },
    { icon: <BellRing size={20} strokeWidth={2.2} />, label: t("Notifications when your transfer status changes", "دریافت نوتیفیکیشن با تغییر وضعیت حواله"),
      detail: t("Stay up to date with your transfer, step by step.", "گام به گام از تغییرات حواله‌تان باخبر باشید.") },
    { icon: <Zap size={20} strokeWidth={2.2} />, label: t("Light and fast", "سبک و سریع"),
      detail: t("Installs quickly and is as easy to use as any app.", "سریع نصب می‌شود و به‌راحتی مثل یک اپلیکیشن از آن استفاده می‌کنید.") },
  ];
  const steps: Partial<Record<PromptVariant, ReactNode[]>> = {
    ios: [
      <>{t("Tap", "روی")} <span dir="ltr" className={styles.chip}><Share size={14} aria-hidden="true" /> Share</span> {t("in your browser", "در مرورگر بزنید")}</>,
      <>{t("Choose", "گزینهٔ")} <span dir="ltr" className={styles.chip}><SquarePlus size={14} aria-hidden="true" /> Add to Home Screen</span>{t("", " را انتخاب کنید")}</>,
      <>{t(`Open ${BRAND} from your Home Screen`, `${BRAND} را از صفحهٔ اصلی باز کنید`)}</>,
    ],
    blocked: [
      <>{t("On a computer, click the icon next to the address bar and choose", "در کامپیوتر، روی آیکون کنار نوار آدرس بزنید و")} <bdi dir="ltr" className={styles.chip}>Notifications › Allow</bdi>{t("", " را انتخاب کنید")}</>,
      <>{t("On a phone, open the browser menu and go to", "در گوشی، از منوی مرورگر به")} <bdi dir="ltr" className={styles.chip}>Site settings › Notifications</bdi>{t("", " بروید")}</>,
    ],
  };
  const number = (index: number) => fa ? "۱۲۳۴"[index] : String(index + 1);

  const primary = variant === "install"
    ? <button type="button" className={styles.primary} onClick={() => finish(onInstall)}>{t("Install the app", "نصب اپلیکیشن")}</button>
    : variant === "notifications"
    ? <button type="button" className={styles.primary} disabled={!!push.busy} onClick={() => void push.enable()}>
        {push.busy === "enable" && <LoaderCircle size={18} className={styles.spin} aria-hidden="true" />}
        {push.busy === "enable" ? t("Turning on…", "در حال روشن کردن…") : t("Turn on notifications", "روشن کردن اعلان‌ها")}
      </button>
    : variant === "signin"
    ? <Link className={styles.primary} href={signInHref}>{t("Sign in", "ورود به حساب")}</Link>
    : variant === "blocked"
    ? <button type="button" className={styles.primary} onClick={() => window.location.reload()}>{t("Reload page", "بارگذاری دوباره")}</button>
    : variant === "enabled"
    ? <button type="button" className={styles.primary} onClick={() => finish(onClose)}>{t("Done", "بستن")}</button>
    // iPhone steps and unsupported browsers: nothing to press here, just acknowledge.
    : <button type="button" className={styles.primary} onClick={() => finish(onLater)}>{t("Got it", "متوجه شدم")}</button>;
  const showLater = variant === "install" || variant === "notifications" || variant === "signin" || variant === "blocked";

  const banner = variant === "enabled"
    ? { title: "Notifications are on", body: "You'll hear from us here." }
    : { title: "Transfer approved", body: "Transfer ZE9999 is approved. Your payment details are ready." };

  return (
    <dialog ref={dialog} className={styles.dialog} dir={fa ? "rtl" : "ltr"} lang={lang} data-variant={variant}
      aria-labelledby={titleId} aria-describedby={bodyId}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <div ref={sheet} className={styles.sheet}>
        <div className={styles.dragZone} onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
          <span className={styles.grabber} aria-hidden="true" />
          {/* A phone home screen with the ZarmanEx app and one of its notifications (sent in English). */}
          <div className={styles.hero} aria-hidden="true">
            <div className={styles.phone}>
              <div className={styles.screen} data-muted={variant === "blocked" || variant === "unsupported" || undefined}>
                <div className={styles.status} dir="ltr"><span>9:41</span><span className={styles.island} /></div>
                <div className={styles.banner} dir="ltr">
                  <Image src="/images/icon-192.png" unoptimized alt="" width={28} height={28} className={styles.bannerIcon} />
                  <div className={styles.bannerText}>
                    <div className={styles.bannerMeta}><strong>{BRAND}</strong><span>now</span></div>
                    <p className={styles.bannerTitle}>{banner.title}</p>
                    <p className={styles.bannerBody}>{banner.body}</p>
                  </div>
                </div>
                <div className={styles.apps} dir="ltr">
                  {/* ZarmanEx sits in the first row so the frame never crops it. */}
                  {Array.from({ length: 8 }, (_, index) => index === 1
                    ? <span key={index} className={styles.ourApp}><Image src="/images/icon-192.png" unoptimized alt="" width={40} height={40} /><em>{BRAND}</em></span>
                    : <span key={index} className={styles.otherApp} />)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="button" className={styles.close} aria-label={t("Close", "بستن")} onClick={dismiss}>
          <X size={16} strokeWidth={2.6} aria-hidden="true" />
        </button>

        <div className={styles.content}>
          <h2 id={titleId} tabIndex={-1} className={styles.title}>{copy[variant].title}</h2>
          <p id={bodyId} className={styles.body}>{copy[variant].body}</p>

          {variant === "install" && <ul className={styles.list}>
            {features.map(item => (
              <li key={item.label} className={styles.item}>
                <span className={styles.itemIcon} aria-hidden="true">{item.icon}</span>
                <span className={styles.itemText}><strong>{item.label}</strong><span>{item.detail}</span></span>
              </li>
            ))}
          </ul>}
          {steps[variant] && <ol className={styles.list}>
            {steps[variant]!.map((step, index) => (
              <li key={index} className={styles.item}>
                <span className={styles.stepNumber} aria-hidden="true">{number(index)}</span>
                <span className={styles.itemText}><span className={styles.stepText}>{step}</span></span>
              </li>
            ))}
          </ol>}

          {push.error && <p role="alert" className={styles.error}>{(PUSH_ERRORS[push.error] || PUSH_ERRORS.push_unavailable)[fa ? 1 : 0]}</p>}

          <div className={styles.actions}>
            {primary}
            {showLater && <button type="button" className={styles.secondary} onClick={() => finish(onLater)}>{t("Not now", "بعداً")}</button>}
          </div>

          {variant !== "enabled" && <div className={styles.footer}>
            <button type="button" className={styles.never} onClick={() => finish(onNever)}>{t("Don't show again", "دیگر نمایش داده نشود")}</button>
          </div>}
        </div>
      </div>
    </dialog>
  );
}
