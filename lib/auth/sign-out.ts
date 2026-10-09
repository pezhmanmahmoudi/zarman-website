"use client";

import { supabase } from "@/lib/supabase";

export const SIGN_OUT_STARTED = "zarman:sign-out-started";
export const SIGNED_OUT = "zarman:signed-out";
export const SIGN_OUT_STORAGE_KEY = "zarman:sign-out";
let pending: Promise<void> | null = null;
let navigating = false;

export const isSigningOut = () => pending !== null;

export function signInPath(locale: string, reason?: "timeout" | "session_expired", next?: string) {
  const query = new URLSearchParams();
  if (reason) query.set("reason", reason);
  if (next) query.set("next", next);
  return `/${locale === "en" ? "en" : "fa"}/login${query.size ? `?${query}` : ""}`;
}

export function redirectToSignIn(locale: string, reason?: "timeout" | "session_expired", next?: string) {
  if (navigating) return;
  navigating = true;
  // A fresh document discards the private Next router cache and client memory.
  // replace also removes this dashboard entry from the current history position.
  window.location.replace(signInPath(locale, reason, next));
}

/** One request shared by mobile/desktop controls; no browser auth lock or RSC refresh. */
export function signOutAndRedirect(locale: string, reason?: "timeout") {
  if (pending) return pending;
  pending = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    window.dispatchEvent(new Event(SIGN_OUT_STARTED));
    // Do not wait on a browser auth lock while ending the server session.
    void supabase.auth.stopAutoRefresh().catch(() => {});
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
      });
      if (!response.ok || (await response.json()).signedOut !== true) throw new Error("signout_failed");
      // Only a notification is stored, never a session or token.
      try { window.localStorage.setItem(SIGN_OUT_STORAGE_KEY, crypto.randomUUID()); } catch { /* Storage can be disabled. */ }
      window.dispatchEvent(new Event(SIGNED_OUT));
      redirectToSignIn(locale, reason);
    } catch (error) {
      pending = null;
      void supabase.auth.startAutoRefresh().catch(() => {});
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  })();
  return pending;
}
