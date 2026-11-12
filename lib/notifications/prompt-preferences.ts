"use client";

/**
 * Remembers on this device when a customer dismissed a home-page prompt.
 * "Later" / "Got it" hides it for a month; "Don't show again" hides it for good.
 * Storage can be unavailable (private mode, blocked site data): then the
 * prompt simply behaves as if never dismissed, and dismissal lasts the visit.
 */
export type HomePrompt = "notifications" | "install";
const KEY = "zarman:home-prompts:v1";
export const SNOOZE_DAYS = 30;
const FOREVER = -1;

function read(): Partial<Record<HomePrompt, number>> {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch { return {}; }
}

export function isPromptHidden(prompt: HomePrompt) {
  const until = read()[prompt];
  return until === FOREVER || (typeof until === "number" && until > Date.now());
}

export function hidePrompt(prompt: HomePrompt, mode: "snooze" | "forever") {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [prompt]: mode === "forever" ? FOREVER : Date.now() + SNOOZE_DAYS * 86_400_000 }));
  } catch { /* Storage unavailable: hidden for this visit only. */ }
}

/** Forget this device's dismissals (used by the `?app-prompt` link). */
export function resetPrompts() {
  try { window.localStorage.removeItem(KEY); } catch { /* Storage unavailable: nothing was stored. */ }
}
