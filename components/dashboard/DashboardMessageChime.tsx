"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircleMore, X } from "lucide-react";
import { getMyLatestAdminMessage } from "@/app/actions/request.actions";
import { supabase } from "@/lib/supabase";
import type { RequestLocale } from "@/lib/requests/types";

export const ADMIN_MESSAGE_SEEN_KEY = "zarman:dashboard:last-admin-message";

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
}

/** Short two-note chime synthesised locally, so no audio file is downloaded. */
function synthesizeChime(context: AudioContext) {
  const start = context.currentTime;
  [[659.25, 0], [880, 0.14]].forEach(([frequency, offset]) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + offset);
    gain.gain.linearRampToValueAtTime(0.16, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.45);
    oscillator.connect(gain).connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.5);
  });
}

/** Safely resumes the shared Web Audio context (if needed) and plays the two-note notification chime. */
export async function playDashboardMessageChime(): Promise<boolean> {
  try {
    const context = getAudioContext();
    if (!context) return false;
    if (context.state === "suspended") {
      await context.resume();
    }
    if (context.state !== "running") return false;
    synthesizeChime(context);
    return true;
  } catch {
    return false;
  }
}

/** Chimes and shows a notice when Zarman sends a new message on any of the customer's requests. */
export function DashboardMessageChime({ locale, sound }: { locale: RequestLocale; sound: boolean }) {
  const fa = locale === "fa", pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  const soundRef = useRef(sound), timer = useRef<number>(undefined);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  // Browsers only allow audio after a user gesture; unlock and resume on interaction until running.
  useEffect(() => {
    const unlock = () => {
      try {
        const context = getAudioContext();
        if (!context) return;
        if (context.state === "suspended") void context.resume();
        if (context.state === "running") {
          window.removeEventListener("pointerdown", unlock);
          window.removeEventListener("keydown", unlock);
        }
      } catch {}
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const check = useCallback(async () => {
    const result = await getMyLatestAdminMessage().catch(() => null);
    if (!result || result.error) return;
    const latest = result.data;
    let seen: string | null = null;
    try { seen = window.localStorage.getItem(ADMIN_MESSAGE_SEEN_KEY); } catch {}
    if (!latest) {
      // Establish a baseline when the customer has zero prior messages so their very first admin message chimes.
      if (!seen) {
        try { window.localStorage.setItem(ADMIN_MESSAGE_SEEN_KEY, new Date(0).toISOString()); } catch {}
      }
      return;
    }
    try { window.localStorage.setItem(ADMIN_MESSAGE_SEEN_KEY, latest.createdAt); } catch {}
    // First visit with existing historical messages only records a baseline; older messages are not announced.
    if (!seen || Date.parse(latest.createdAt) <= Date.parse(seen)) return;
    if (!window.location.pathname.endsWith(`/dashboard/requests/${latest.requestId}`)) setNotice(latest.requestId);
    if (soundRef.current) void playDashboardMessageChime();
  }, []);

  useEffect(() => {
    // Initial check waits until the dashboard's own data has loaded.
    const initial = window.setTimeout(() => void check(), 1500);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void check(), 800);
      }
    };
    document.addEventListener?.("visibilitychange", onVisibility);
    if (typeof supabase.channel !== "function") {
      return () => {
        window.clearTimeout(initial);
        window.clearTimeout(timer.current);
        document.removeEventListener?.("visibilitychange", onVisibility);
      };
    }
    const channel = supabase
      .channel("customer-admin-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "exchange_request_realtime_signals" }, () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void check(), 800);
      })
      .subscribe();
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(timer.current);
      document.removeEventListener?.("visibilitychange", onVisibility);
      if (typeof supabase.removeChannel === "function") void supabase.removeChannel(channel);
    };
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

