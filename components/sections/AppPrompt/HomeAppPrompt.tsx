"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { isPromptHidden, resetPrompts } from "@/lib/notifications/prompt-preferences";

const HomeAppPromptCard = dynamic(() => import("./HomeAppPromptCard"), { ssr: false });

/** Settle time after the page is idle, so the popup never appears during first paint. */
const SETTLE_MS = 1_800;
/** `?app-prompt` on the home page shows the popup again on this device. */
const REOPEN_PARAM = "app-prompt";

const busyTyping = () => {
  const active = document.activeElement;
  return !!active && (active.matches("input, textarea, select, [contenteditable='true']") || !!document.querySelector("dialog[open]"));
};

/**
 * Home-page popup inviting customers to turn on transfer notifications (or
 * install the app), shown to everyone until they dismiss it. Visitors are asked
 * to sign in first and cause no server calls. It waits until the page is idle,
 * and never interrupts someone typing (e.g. in the rate calculator) or another
 * open dialog. Anyone who dismissed it gets nothing: no extra code, no request.
 *
 * Opening the home page with `?app-prompt` (e.g. /fa?app-prompt) clears this
 * device's earlier dismissal and shows the popup again.
 */
export default function HomeAppPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(REOPEN_PARAM)) {
      resetPrompts();
      // Tidy the address bar so a later reload respects the customer's next choice.
      url.searchParams.delete(REOPEN_PARAM);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    if (isPromptHidden("notifications") && isPromptHidden("install")) return;
    let timer = 0, idle = 0, cancelled = false;
    const attempt = () => {
      if (cancelled) return;
      if (busyTyping()) { timer = window.setTimeout(attempt, 2_000); return; }
      setShow(true);
    };
    const settle = () => { timer = window.setTimeout(attempt, SETTLE_MS); };
    if ("requestIdleCallback" in window) idle = window.requestIdleCallback(settle, { timeout: 2_500 });
    else settle();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idle && "cancelIdleCallback" in window) window.cancelIdleCallback(idle);
    };
  }, []);
  return show ? <HomeAppPromptCard /> : null;
}
