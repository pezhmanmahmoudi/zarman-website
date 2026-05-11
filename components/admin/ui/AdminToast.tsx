"use client";

/**
 * AdminToast — replaces native alert().
 *
 * Renders fixed bottom-right; inherits .adminShell CSS variable scope.
 *
 * Usage (via useAdminFeedback hook):
 *   const { showToast, toastProps } = useAdminFeedback();
 *   <AdminToast {...toastProps} />
 */
import React from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
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
  if (!visible) return null;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={`${styles.toast} ${TOAST_CLASS[type]}`}>
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
    </div>
  );
}
