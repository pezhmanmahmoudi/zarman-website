"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AdminToast, type ToastType } from "./AdminToast";

export type AdminNotification = { type: ToastType; message: string; duration?: number };
export const AdminFeedbackContext = createContext<{ showToast: (toast: AdminNotification) => void } | null>(null);

/** Notifications survive a row disappearing after its successful mutation. */
export function AdminFeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<AdminNotification | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);
  const showToast = useCallback((next: AdminNotification) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    timer.current = setTimeout(() => setToast(null), next.duration ?? 5000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);
  return <AdminFeedbackContext.Provider value={value}>
    {children}
    <AdminToast visible={!!toast} type={toast?.type ?? "info"} message={toast?.message ?? ""} onClose={close} />
  </AdminFeedbackContext.Provider>;
}
