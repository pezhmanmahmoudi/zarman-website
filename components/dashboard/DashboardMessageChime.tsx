"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircleMore, X } from "lucide-react";
import { getMyLatestAdminMessage } from "@/app/actions/request.actions";
import { supabase } from "@/lib/supabase";
import type { RequestLocale } from "@/lib/requests/types";

const SEEN_KEY = "zarman:dashboard:last-admin-message";

/** Short two-note chime synthesised locally, so no audio file is downloaded. */
function playChime(context: AudioContext) {
  const start = context.currentTime;
  [[659.25, 0], [880, .14]].forEach(([frequency, offset]) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + offset);
    gain.gain.linearRampToValueAtTime(.16, start + offset + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, start + offset + .45);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + .5);
  });
}

/** Chimes and shows a notice when Zarman sends a new message on any of the customer's requests. */
export function DashboardMessageChime({ locale, sound }: { locale: RequestLocale; sound: boolean }) {
  const fa = locale === "fa", pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null), soundRef = useRef(sound), timer = useRef<number>(undefined);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  // Browsers only allow audio after a user gesture, so the context is created on the first one.
  useEffect(() => {
    const unlock = () => {
      if (!audio.current && typeof AudioContext !== "undefined") audio.current = new AudioContext();
      void audio.current?.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);
  useEffect(() => () => { void audio.current?.close(); }, []);

  const check = useCallback(async () => {
    const result = await getMyLatestAdminMessage().catch(() => null);
    const latest = result?.data;
    if (!latest) return;
    const seen = window.localStorage.getItem(SEEN_KEY);
    window.localStorage.setItem(SEEN_KEY, latest.createdAt);
    // First visit only records a baseline; older messages are not announced.
    if (!seen || Date.parse(latest.createdAt) <= Date.parse(seen)) return;
    if (!window.location.pathname.endsWith(`/dashboard/requests/${latest.requestId}`)) setNotice(latest.requestId);
    if (soundRef.current && audio.current?.state === "running") playChime(audio.current);
  }, []);

  useEffect(() => {
    // Initial check waits until the dashboard's own data has loaded.
    const initial = window.setTimeout(() => void check(), 1500);
    if (typeof supabase.channel !== "function") return () => window.clearTimeout(initial);
    const channel = supabase
      .channel("customer-admin-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "exchange_request_realtime_signals" }, () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void check(), 800);
      })
      .subscribe();
    return () => { window.clearTimeout(initial); window.clearTimeout(timer.current); if (typeof supabase.removeChannel === "function") void supabase.removeChannel(channel); };
  }, [check]);

  const href = notice ? `/${locale}/dashboard/requests/${notice}` : "";
  if (!notice || pathname === href) return null;
  return <div role="status" aria-live="polite" dir={fa ? "rtl" : "ltr"} className="fixed inset-x-4 top-24 z-50 flex items-center gap-3 rounded-2xl border border-[#e4ddef] bg-white p-3 pe-2 shadow-[0_18px_40px_-20px_#392b6680] sm:inset-x-auto sm:end-6 sm:w-96">
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f0eefe] text-[#635bff]"><MessageCircleMore size={20} strokeWidth={1.8} /></span>
    <div className="min-w-0 flex-1">
      <p className="m-0 text-sm font-semibold text-[#25213e]">{fa ? "پیام جدید از زرمان" : "New message from Zarman"}</p>
      <Link href={`${href}#request-conversation`} onClick={() => setNotice(null)} className="text-xs font-semibold text-[#4f46c8] no-underline hover:text-[#3730a3]">{fa ? "مشاهده پیام" : "View message"}</Link>
    </div>
    <button type="button" onClick={() => setNotice(null)} aria-label={fa ? "بستن" : "Dismiss"} className="grid size-9 shrink-0 place-items-center rounded-full text-[#6a6279] hover:bg-[#f4f2f8]"><X size={16} aria-hidden="true" /></button>
  </div>;
}
