"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { supabase } from "@/lib/supabase";
import type { Profile, Transaction } from "@/app/[locale]/dashboard/dashboard.types";

export function useDashboardData() {
  const router = useRouter(), locale = useLocale();
  const generation = useRef(0), abort = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true), [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null), [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState(false);
  const invalidate = useCallback(() => { ++generation.current; abort.current?.abort(); }, []);
  const refresh = useCallback(async () => {
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
        setProfile(null); setTransactions([]); setSessionChecked(false);
        const next = window.location.pathname + window.location.search;
        router.replace(`/${locale}/login?next=${encodeURIComponent(next)}`); return;
      }
      const [profileRes, txRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).abortSignal(controller.signal).single(),
        supabase.from("transactions")
          .select("id,user_id,type,amount_aud,equivalent_toman,status,created_at,recipient_id,promo_code,discount_amount,loyalty_discount,final_amount,reference_code,recipients(id,label,full_name,account_name)")
          .eq("user_id", user.id).order("created_at", { ascending: false }).abortSignal(controller.signal),
      ]);
      if (current !== generation.current) return;
      if (profileRes.error || txRes.error) throw new Error("dashboard_read_failed");
      setProfile(profileRes.data as Profile);
      setTransactions((txRes.data || []) as unknown as Transaction[]);
      setSessionChecked(true);
    } catch {
      if (current === generation.current && !controller.signal.aborted) setError(true);
    } finally { if (current === generation.current) setLoading(false); }
  }, [locale, router]);
  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 60000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") {
        invalidate();
        setProfile(null); setTransactions([]); setSessionChecked(false);
        router.replace(`/${locale}/login`);
      }
    });
    return () => { invalidate(); subscription.unsubscribe(); window.clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh, locale, router, invalidate]);
  return { profile, transactions, totalVolume: transactions.reduce((sum, tx) => sum + Number(tx.amount_aud || 0), 0), loading, sessionChecked, error, refresh };
}
