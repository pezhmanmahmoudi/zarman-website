"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { listMyOverviewRequests, listMyRequestPage, listMyRequests } from "@/app/actions/request.actions";
import type { ActivityFilter, RequestPage } from "@/lib/dashboard/activity";
import type { ExchangeRequest } from "@/lib/requests/types";
import { supabase } from "@/lib/supabase";

import { DASHBOARD_AUTO_REFRESH_MS, dashboardRefreshDue } from "@/lib/dashboard/refresh-policy";

export function useDashboardRequests({ autoRefresh: autoRefreshEnabled = true, overview = false }: { autoRefresh?: boolean; overview?: boolean } = {}) {
  const [requests, setRequests] = useState<ExchangeRequest[]>([]);
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState(false);
  const active = useRef(false), generation = useRef(0), pending = useRef(false);
  const lastRefresh = useRef(0);
  const stop = useCallback(() => { active.current = false; ++generation.current; pending.current = false; }, []);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    lastRefresh.current = Date.now();
    pending.current = true;
    const ticket = ++generation.current; setRefreshing(true);
    try {
      const result = await (overview ? listMyOverviewRequests() : listMyRequests());
      if (!active.current || ticket !== generation.current) return;
      if (result.error || !result.data) throw new Error("requests_unavailable");
      setRequests(result.data); setError(false);
    } catch { if (active.current && ticket === generation.current) setError(true); }
    finally { if (ticket === generation.current) { pending.current = false; if (active.current) { setLoading(false); setRefreshing(false); } } }
  }, [overview]);
  const autoRefresh = useCallback(() => {
    if (document.visibilityState === "visible" && dashboardRefreshDue(lastRefresh.current)) void refresh();
  }, [refresh]);
  useEffect(() => {
    active.current = true; pending.current = false; void refresh();
    if (!autoRefreshEnabled) return stop;
    const onVisible = autoRefresh;
    const timer = window.setInterval(onVisible, DASHBOARD_AUTO_REFRESH_MS);
    window.addEventListener("focus", onVisible); document.addEventListener("visibilitychange", onVisible);
    return () => { stop(); window.clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh, stop, autoRefresh, autoRefreshEnabled]);
  useEffect(() => {
    // supabase.channel/removeChannel are guarded because dashboard test harnesses mock a partial client without realtime methods.
    if (!autoRefreshEnabled || typeof supabase.channel !== "function") return;
    const channel = supabase
      .channel("customer-request-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "exchange_request_realtime_signals" }, autoRefresh)
      .subscribe();
    return () => { if (typeof supabase.removeChannel === "function") void supabase.removeChannel(channel); };
  }, [autoRefresh, autoRefreshEnabled]);
  return { requests, loading, refreshing, error, refresh };
}

/** Transactions page feed: fetches one server page at a time for the active filter and (debounced) search. */
export function useDashboardRequestPage() {
  const [query, setQuery] = useState<{ filter: ActivityFilter; search: string; page: number }>({ filter: "all", search: "", page: 1 });
  const [search, setSearch] = useState(""), [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data: RequestPage | null; error: boolean }>({ key: "", data: null, error: false });
  const key = JSON.stringify([query.filter, search, query.page, attempt]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.search), 300);
    return () => window.clearTimeout(timer);
  }, [query.search]);
  useEffect(() => {
    let active = true;
    listMyRequestPage({ filter: query.filter, search, page: query.page }).then(result => {
      if (!active) return;
      const data = result.data;
      setState(previous => data ? { key, data, error: false } : { key, data: previous.data, error: true });
      if (data && data.page !== query.page) setQuery(current => ({ ...current, page: data.page }));
    }).catch(() => { if (active) setState(previous => ({ key, data: previous.data, error: true })); });
    return () => { active = false; };
  }, [key, query.filter, query.page, search]);
  const settled = state.key === key;
  return {
    requests: state.data?.items ?? [], total: state.data?.total ?? 0, counts: state.data?.counts ?? { all: 0, active: 0, attention: 0, completed: 0 },
    filter: query.filter, search: query.search, page: state.data?.page ?? query.page,
    loading: !state.data && !(settled && state.error), refreshing: !settled, error: settled && state.error,
    refresh: useCallback(() => setAttempt(value => value + 1), []),
    setFilter: useCallback((filter: ActivityFilter) => setQuery(current => ({ ...current, filter, page: 1 })), []),
    setSearch: useCallback((value: string) => setQuery(current => ({ ...current, search: value, page: 1 })), []),
    setPage: useCallback((page: number) => setQuery(current => ({ ...current, page })), []),
  };
}
