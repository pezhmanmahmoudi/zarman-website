"use client";

/**
 * AdminToast — replaces native alert().
 *
 * Uses the browser top layer, attached to the active dialog when one is open.
 *
 * Usage (via useAdminFeedback hook):
 *   const { showToast, toastProps } = useAdminFeedback();
 *   <AdminToast {...toastProps} />
 */
import React, { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { getActiveAdminDialog, getServerAdminDialog, subscribeAdminDialogs } from "./admin-dialog-stack";
import styles from "@/styles/admin/AdminToast.module.css";

export type ToastType = "success" | "error" | "warning" | "info";

export interface AdminToastProps {
  visible: boolean;
  type: ToastType;
  message: string;
  onClose: () => void;
}

const TOAST_ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle   size={16} />,
  error:   <XCircle       size={16} />,
  warning: <AlertTriangle size={16} />,
  info:    <Info          size={16} />,
};

const TOAST_CLASS: Record<ToastType, string> = {
  success: styles.toastSuccess,
  error:   styles.toastError,
  warning: styles.toastWarning,
  info:    styles.toastInfo,
};

export function AdminToast({ visible, type, message, onClose }: AdminToastProps) {
  const activeDialog = useSyncExternalStore(subscribeAdminDialogs, getActiveAdminDialog, getServerAdminDialog);
  const toastRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toast = toastRef.current;
    if (!visible || !toast) return;
    if (typeof toast.showPopover === "function") toast.showPopover();
    else toast.removeAttribute("popover");
    return () => { if (toast.isConnected && typeof toast.hidePopover === "function" && toast.matches(":popover-open")) toast.hidePopover(); };
  }, [visible, activeDialog]);
  if (!visible || typeof document === "undefined") return null;
  const isFa = /[\u0600-\u06FF]/.test(message);

  return createPortal(
    <div ref={toastRef} popover="manual" className={styles.container} role={type === "error" ? "alert" : "status"} aria-live={type === "error" ? "assertive" : "polite"} aria-atomic="true">
      <div className={`${styles.toast} ${TOAST_CLASS[type]} ${isFa ? styles.toastFa : ""}`} dir={isFa ? "rtl" : "ltr"}>
        <span className={styles.icon}>{TOAST_ICON[type]}</span>
        <span className={styles.message}>{message}</span>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>,
    activeDialog ?? document.body,
  );
}
