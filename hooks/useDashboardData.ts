"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocale } from "@/context/LocaleContext";
import { supabase } from "@/lib/supabase";
import { isSigningOut, redirectToSignIn, SIGN_OUT_STARTED, SIGNED_OUT, SIGN_OUT_STORAGE_KEY } from "@/lib/auth/sign-out";
import { DASHBOARD_AUTO_REFRESH_MS, dashboardRefreshDue } from "@/lib/dashboard/refresh-policy";
import { readApprovedSummary, type ApprovedSummary, type DashboardInitialAccount } from "@/lib/dashboard/approved-summary";
import type { Profile } from "@/app/[locale]/dashboard/dashboard.types";

const noSummary: ApprovedSummary = { volume: 0, count: 0 };

/** `initial` is the account read during server rendering; when present the first client fetch is skipped. */
export function useDashboardData(initial?: DashboardInitialAccount | null) {
  const locale = useLocale();
  const ended = useRef(false);
  const [signedOut, setSignedOut] = useState(false);
  const generation = useRef(0), abort = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0), skipInitialRefresh = useRef(Boolean(initial));
  const seenIdentityNotices = useRef(new Map<string, string>());
  const [loading, setLoading] = useState(!initial), [sessionChecked, setSessionChecked] = useState(Boolean(initial));
  const [profile, setProfile] = useState<Profile | null>(initial?.profile ?? null), [approved, setApproved] = useState<ApprovedSummary>(initial?.approved ?? noSummary);
  const [error, setError] = useState(false);
  const invalidate = useCallback(() => { ++generation.current; abort.current?.abort(); }, []);
  const refresh = useCallback(async () => {
    if (ended.current || isSigningOut()) return;
    lastRefresh.current = Date.now();
    const current = ++generation.current;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setLoading(true); setError(false);
    try {
      // Auth validates the identity; RLS remains the authority for every read.
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (current !== generation.current) return;
      if (!user) {
        if (authError && authError.status !== 401 && authError.status !== 400 && authError.name !== "AuthSessionMissingError") throw authError;
        ended.current = true;
        setProfile(null); setApproved(noSummary); setSessionChecked(false); setSignedOut(true);
        const next = window.location.pathname + window.location.search;
        redirectToSignIn(locale, "session_expired", next); return;
      }
      const [profileRes, summary] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).abortSignal(controller.signal).single(),
        readApprovedSummary(supabase, user.id, controller.signal),
      ]);
      if (current !== generation.current) return;
      if (profileRes.error) throw new Error("dashboard_read_failed");
      const nextProfile = profileRes.data as Profile;
      // Keep an acknowledgement made during this read from being overwritten by its older snapshot.
      const seenAt = seenIdentityNotices.current.get(user.id);
      setProfile(seenAt ? { ...nextProfile, kyc_approval_notice_seen_at: nextProfile.kyc_approval_notice_seen_at || seenAt } : nextProfile);
      setApproved(summary);
      setSessionChecked(true);
    } catch {
      if (current === generation.current && !controller.signal.aborted) setError(true);
    } finally { if (current === generation.current) setLoading(false); }
  }, [locale]);
  const acknowledgeIdentityNotice = useCallback(async (profileId: string) => {
    if (seenIdentityNotices.current.has(profileId)) return;
    const seenAt = new Date().toISOString();
    seenIdentityNotices.current.set(profileId, seenAt);
    setProfile(current => current?.id === profileId && current.kyc_status === "approved"
      ? { ...current, kyc_approval_notice_seen_at: current.kyc_approval_notice_seen_at || seenAt } : current);
    try {
      // The RPC checks auth.uid() and approval itself; callers cannot mark another account.
      await supabase.rpc("acknowledge_kyc_approval_notice", { p_profile_id: profileId });
    } catch {
      // A cosmetic acknowledgement must never interrupt the dashboard. A later visit can save it again.
    }
  }, []);
  useEffect(() => {
    if (skipInitialRefresh.current) {
      skipInitialRefresh.current = false;
      lastRefresh.current = Date.now();
    } else void refresh();
    const onVisible = () => { if (document.visibilityState === "visible" && dashboardRefreshDue(lastRefresh.current)) void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, DASHBOARD_AUTO_REFRESH_MS);
    const clearAccount = () => {
      ended.current = true;
      invalidate();
      seenIdentityNotices.current.clear();
      setProfile(null); setApproved(noSummary); setSessionChecked(false);
      setLoading(false); setError(false); setSignedOut(true);
    };
    const onSignOutStarted = () => { invalidate(); setLoading(false); };
    const onSignedOut = () => { clearAccount(); redirectToSignIn(locale); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SIGN_OUT_STORAGE_KEY && event.newValue) onSignedOut();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      // Back/forward cache can restore the entire private document without a
      // server request. Hide its account data and revalidate the protected URL.
      if (event.persisted) { flushSync(clearAccount); window.location.reload(); }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") onSignedOut();
    });
    window.addEventListener(SIGN_OUT_STARTED, onSignOutStarted);
    window.addEventListener(SIGNED_OUT, clearAccount);
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      invalidate(); subscription.unsubscribe(); window.clearInterval(timer);
      window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(SIGN_OUT_STARTED, onSignOutStarted); window.removeEventListener(SIGNED_OUT, clearAccount);
      window.removeEventListener("storage", onStorage); window.removeEventListener("pageshow", onPageShow);
    };
  }, [refresh, locale, invalidate]);
  return { profile, approvedVolume: approved.volume, approvedCount: approved.count, loading, sessionChecked, signedOut, error, refresh, acknowledgeIdentityNotice };
}
