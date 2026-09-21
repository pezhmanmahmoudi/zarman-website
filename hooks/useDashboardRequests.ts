"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listMyRequests } from "@/app/actions/request.actions";
import type { ExchangeRequest } from "@/lib/requests/types";
import { supabase } from "@/lib/supabase";

export function useDashboardRequests() {
  const [requests, setRequests] = useState<ExchangeRequest[]>([]);
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState(false);
  const active = useRef(false), generation = useRef(0), pending = useRef(false);
  const stop = useCallback(() => { active.current = false; ++generation.current; pending.current = false; }, []);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    const ticket = ++generation.current; setRefreshing(true);
    try {
      const result = await listMyRequests();
      if (!active.current || ticket !== generation.current) return;
      if (result.error || !result.data) throw new Error("requests_unavailable");
      setRequests(result.data); setError(false);
    } catch { if (active.current && ticket === generation.current) setError(true); }
    finally { if (ticket === generation.current) { pending.current = false; if (active.current) { setLoading(false); setRefreshing(false); } } }
  }, []);
  useEffect(() => {
    active.current = true; pending.current = false; void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(onVisible, 30000);
    window.addEventListener("focus", onVisible); document.addEventListener("visibilitychange", onVisible);
    return () => { stop(); window.clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh, stop]);
  useEffect(() => {
    if (typeof supabase.channel !== "function") return;
    const channel = supabase
      .channel("customer-request-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "exchange_request_realtime_signals" }, () => { void refresh(); })
      .subscribe();
    return () => { if (typeof supabase.removeChannel === "function") void supabase.removeChannel(channel); };
  }, [refresh]);
  return { requests, loading, refreshing, error, refresh };
}
