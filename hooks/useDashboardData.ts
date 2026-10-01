"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { supabase } from "@/lib/supabase";
import { DASHBOARD_AUTO_REFRESH_MS, dashboardRefreshDue } from "@/lib/dashboard/refresh-policy";
import type { Profile } from "@/app/[locale]/dashboard/dashboard.types";

type ApprovedSummary = { volume: number; count: number };
const noSummary: ApprovedSummary = { volume: 0, count: 0 };
const SUMMARY_BATCH = 1000;

/** Only the approved amounts are read; history pages load their own records on demand. */
async function readApprovedSummary(userId: string, signal: AbortSignal): Promise<ApprovedSummary> {
  let volume = 0, count = 0;
  for (let from = 0; ; from += SUMMARY_BATCH) {
    const { data, error } = await supabase.from("transactions").select("amount_aud").eq("user_id", userId).eq("status", "approved")
      .order("id", { ascending: true }).range(from, from + SUMMARY_BATCH - 1).abortSignal(signal);
    if (error) throw error;
    for (const row of data ?? []) volume += Number(row.amount_aud) || 0;
    count += data?.length ?? 0;
    if ((data?.length ?? 0) < SUMMARY_BATCH) return { volume, count };
  }
}

export function useDashboardData() {
  const router = useRouter(), locale = useLocale();
  const generation = useRef(0), abort = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0);
  const [loading, setLoading] = useState(true), [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null), [approved, setApproved] = useState<ApprovedSummary>(noSummary);
  const [error, setError] = useState(false);
  const invalidate = useCallback(() => { ++generation.current; abort.current?.abort(); }, []);
  const refresh = useCallback(async () => {
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
        setProfile(null); setApproved(noSummary); setSessionChecked(false);
        const next = window.location.pathname + window.location.search;
        router.replace(`/${locale}/login?next=${encodeURIComponent(next)}`); return;
      }
      const [profileRes, summary] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).abortSignal(controller.signal).single(),
        readApprovedSummary(user.id, controller.signal),
      ]);
      if (current !== generation.current) return;
      if (profileRes.error) throw new Error("dashboard_read_failed");
      setProfile(profileRes.data as Profile);
      setApproved(summary);
      setSessionChecked(true);
    } catch {
      if (current === generation.current && !controller.signal.aborted) setError(true);
    } finally { if (current === generation.current) setLoading(false); }
  }, [locale, router]);
  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible" && dashboardRefreshDue(lastRefresh.current)) void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, DASHBOARD_AUTO_REFRESH_MS);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") {
        invalidate();
        setProfile(null); setApproved(noSummary); setSessionChecked(false);
        router.replace(`/${locale}/login`);
      }
    });
    return () => { invalidate(); subscription.unsubscribe(); window.clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh, locale, router, invalidate]);
  return { profile, approvedVolume: approved.volume, approvedCount: approved.count, loading, sessionChecked, error, refresh };
}
