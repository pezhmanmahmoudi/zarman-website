"use client";

/**
 * AdminToast — replaces native alert().
 *
 * Uses a fixed notification inside the active dialog's top layer, or the body.
 * It has no imperative popover lifecycle that can fail when a row/dialog closes.
 *
 * Usage (via useAdminFeedback hook):
 *   const { showToast, toastProps } = useAdminFeedback();
 *   <AdminToast {...toastProps} />
 */
import React, { useSyncExternalStore } from "react";
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

const subscribeHydration = () => () => {};
const getHydrated = () => true;
const getServerHydrated = () => false;

export function AdminToast({ visible, type, message, onClose }: AdminToastProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, getHydrated, getServerHydrated);
  const activeDialog = useSyncExternalStore(subscribeAdminDialogs, getActiveAdminDialog, getServerAdminDialog);
  if (!visible || !hydrated) return null;
  const isFa = /[\u0600-\u06FF]/.test(message);

  return createPortal(
    <div className={styles.container} role={type === "error" ? "alert" : "status"} aria-live={type === "error" ? "assertive" : "polite"} aria-atomic="true">
      <div className={`${styles.toast} ${TOAST_CLASS[type]} ${isFa ? styles.toastFa : ""}`} dir={isFa ? "rtl" : "ltr"}>
        <span className={styles.icon}>{TOAST_ICON[type]}</span>
        <span className={styles.message}>{message}</span>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={isFa ? "بستن پیام" : "Dismiss notification"}
        >
          <X size={14} />
        </button>
      </div>
    </div>,
    activeDialog ?? document.body,
  );
}
