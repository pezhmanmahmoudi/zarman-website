"use client";

import { useRef, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { signOutAndRedirect } from "@/lib/auth/sign-out";

export function useSignOut() {
  const locale = useLocale();
  const inFlight = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSigningOut(true); setSignOutError(false);
    try { await signOutAndRedirect(locale); }
    catch { inFlight.current = false; setSigningOut(false); setSignOutError(true); }
  }
  return { signOut, signingOut, signOutError };
}
