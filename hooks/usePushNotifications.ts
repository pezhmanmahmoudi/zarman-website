"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCustomerPush, removeCustomerPush, saveCustomerPush, sendCustomerPushTest } from "@/app/actions/customer-push.actions";

/**
 * hidden: reserved; the hook no longer hides itself. If the server can't be reached the
 *   phase is "off" and tapping Turn on retries, then explains the problem.
 * signed-out: push works here, but notifications belong to an account, so the visitor must sign in first.
 * install: iPhone/iPad in Safari; push needs Zarman added to the Home Screen first.
 */
export type PushPhase = "loading" | "hidden" | "unsupported" | "install" | "denied" | "signed-out" | "off" | "on";

// Supabase keeps the session in a readable `sb-<project>-auth-token` cookie (possibly split into .0, .1…).
// Only a hint to skip server calls for visitors; the server still verifies the session.
export const hasSessionCookie = () => /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.0)?=/.test(document.cookie);
export type PushBusy = "enable" | "disable" | "test" | null;
export type PushNotice = "enabled" | "disabled" | "tested" | "";

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isInstalledApp = () => window.matchMedia("(display-mode: standalone)").matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - base64url.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64), bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
function sameKey(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current), b = keyBytes(publicKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Web push for this browser or installed app, linked to the signed-in customer. */
export function usePushNotifications(locale: string) {
  const language = locale === "fa" ? "fa" : "en";
  const [phase, setPhase] = useState<PushPhase>("loading");
  const [busy, setBusy] = useState<PushBusy>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<PushNotice>("");
  const publicKey = useRef<string | null>(null);
  const loadError = useRef("");
  const mounted = useRef(false);

  const load = useCallback(async () => {
    if (!pushSupported()) { setPhase(isIOS() && !isInstalledApp() ? "install" : "unsupported"); return; }
    if (Notification.permission === "denied") { setPhase("denied"); return; }
    if (!hasSessionCookie()) { setPhase("signed-out"); return; }
    try {
      let subscription = await currentSubscription();
      const result = await getCustomerPush(subscription?.endpoint ?? null);
      if (!mounted.current) return;
      if (result.error === "sign_in_required") { setPhase("signed-out"); return; }
      // Server unreachable or not set up: still offer the button; tapping it retries and explains.
      if (!result.data?.available || !result.data.publicKey) { loadError.current = result.error || "push_unavailable"; setPhase("off"); return; }
      publicKey.current = result.data.publicKey;
      // A subscription made with an old server key can no longer receive messages.
      if (subscription && !sameKey(subscription, result.data.publicKey)) { await subscription.unsubscribe().catch(() => {}); subscription = null; }
      if (subscription && Notification.permission === "granted") {
        // Keep the server copy current (endpoints rotate) and linked to whoever is signed in now.
        const saved = result.data.thisDevice ? result : await saveCustomerPush({ subscription: subscription.toJSON(), locale: language });
        if (mounted.current) setPhase(saved.data?.thisDevice ? "on" : "off");
        return;
      }
      setPhase("off");
    } catch { if (mounted.current) { loadError.current = "push_unavailable"; setPhase("off"); } }
  }, [language]);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void load(), 0);
    return () => { mounted.current = false; window.clearTimeout(timer); };
  }, [load]);

  const enable = useCallback(async () => {
    if (busy) return;
    setBusy("enable"); setError(""); setNotice("");
    try {
      // Ask first, while the tap still counts as a user gesture (required by Safari).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { if (mounted.current) setPhase(permission === "denied" ? "denied" : "off"); return; }
      if (!publicKey.current) {
        const retry = await getCustomerPush(null);
        if (retry.error === "sign_in_required") { if (mounted.current) setPhase("signed-out"); return; }
        if (!retry.data?.available || !retry.data.publicKey) { if (mounted.current) setError(retry.error || loadError.current || "push_unavailable"); return; }
        publicKey.current = retry.data.publicKey;
      }
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey.current) });
      const result = await saveCustomerPush({ subscription: subscription.toJSON(), locale: language });
      if (!mounted.current) return;
      if (result.data) { setPhase("on"); setNotice("enabled"); }
      else setError(result.error || "push_unavailable");
    } catch { if (mounted.current) setError("push_unavailable"); }
    finally { if (mounted.current) setBusy(null); }
  }, [busy, language]);

  const disable = useCallback(async () => {
    if (busy) return;
    setBusy("disable"); setError(""); setNotice("");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const result = await removeCustomerPush(subscription.endpoint);
        if (result.error) throw new Error(result.error);
        await subscription.unsubscribe().catch(() => {});
      }
      if (mounted.current) { setPhase("off"); setNotice("disabled"); }
    } catch { if (mounted.current) setError("push_unavailable"); }
    finally { if (mounted.current) setBusy(null); }
  }, [busy]);

  const test = useCallback(async () => {
    if (busy) return;
    setBusy("test"); setError(""); setNotice("");
    try {
      const subscription = await currentSubscription();
      if (!subscription) { if (mounted.current) setPhase("off"); return; }
      const result = await sendCustomerPushTest(subscription.endpoint);
      if (!mounted.current) return;
      if (result.data) setNotice("tested");
      else {
        if (result.error === "subscription_expired") setPhase("off");
        setError(result.error || "push_unavailable");
      }
    } catch { if (mounted.current) setError("push_unavailable"); }
    finally { if (mounted.current) setBusy(null); }
  }, [busy]);

  return { phase, busy, error, notice, enable, disable, test };
}

export const PUSH_ERRORS: Record<string, [en: string, fa: string]> = {
  please_wait: ["Please wait 30 seconds before sending another test.", "برای ارسال اعلان آزمایشی دیگر، ۳۰ ثانیه صبر کنید."],
  subscription_expired: ["This device was disconnected. Turn notifications on again.", "اتصال این دستگاه قطع شده است. اعلان‌ها را دوباره روشن کنید."],
  sign_in_required: ["Sign in again to change notification settings.", "برای تغییر تنظیمات اعلان، دوباره وارد حساب شوید."],
  verified_account_required: ["Verify your email before turning on notifications.", "ابتدا ایمیل خود را تأیید کنید، سپس اعلان‌ها را روشن کنید."],
  push_unavailable: ["We couldn't change notifications on this device. Please try again.", "تنظیم اعلان روی این دستگاه انجام نشد. دوباره تلاش کنید."],
};
