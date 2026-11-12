"use client";

import { useSyncExternalStore } from "react";
import { isInstalledApp } from "./usePushNotifications";

type InstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window { __zarmanInstallPrompt?: InstallPromptEvent | null }
}

// The layout's inline script stores the browser's install event and announces changes.
const subscribeInstallable = (onChange: () => void) => {
  window.addEventListener("zarman:installable", onChange);
  return () => window.removeEventListener("zarman:installable", onChange);
};
const subscribeDisplayMode = (onChange: () => void) => {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  window.addEventListener("zarman:installable", onChange);
  return () => { query.removeEventListener("change", onChange); window.removeEventListener("zarman:installable", onChange); };
};

/**
 * One-tap install where the browser supports it (Chrome, Edge, Samsung Internet).
 * Safe to render on the server: there it reports "not installable, not installed".
 */
export function useInstallApp() {
  const event = useSyncExternalStore(subscribeInstallable, () => window.__zarmanInstallPrompt ?? null, () => null);
  const installed = useSyncExternalStore(subscribeDisplayMode, isInstalledApp, () => false);

  async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
    const prompt = window.__zarmanInstallPrompt;
    if (!prompt) return "unavailable";
    // An install prompt can be shown only once.
    window.__zarmanInstallPrompt = null;
    window.dispatchEvent(new Event("zarman:installable"));
    try {
      await prompt.prompt();
      return (await prompt.userChoice).outcome;
    } catch { return "unavailable"; }
  }

  return { canInstall: !!event && !installed, installed, install };
}
