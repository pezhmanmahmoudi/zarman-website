"use client";

/**
 * AdminConfirmDialog — replaces native window.confirm().
 *
 * Renders via React portal onto document.body so it is never clipped by
 * a scrollable ancestor (e.g. the mainArea overflow-y:auto container on
 * iOS Safari). On mobile it presents as a bottom-sheet; on desktop it is
 * a centred modal.
 *
 * Usage (via useAdminFeedback hook):
 *   const { confirm, dialogProps } = useAdminFeedback();
 *   <AdminConfirmDialog {...dialogProps} />
 */
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, X, Archive, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import styles from "@/styles/admin/AdminDialog.module.css";

export type ConfirmVariant = "approve" | "reject" | "archive" | "danger" | "default";

export interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_ICON: Record<ConfirmVariant, React.ReactNode> = {
  approve: <Check    size={20} />,
  reject:  <X        size={20} />,
  archive: <Archive  size={20} />,
  danger:  <AlertTriangle size={20} />,
  default: <HelpCircle   size={20} />,
};

const VARIANT_ICON_CLASS: Record<ConfirmVariant, string> = {
  approve: styles.iconApprove,
  reject:  styles.iconReject,
  archive: styles.iconArchive,
  danger:  styles.iconDanger,
  default: styles.iconDefault,
};

const VARIANT_BTN_CLASS: Record<ConfirmVariant, string> = {
  approve: styles.btnConfirmApprove,
  reject:  styles.btnConfirmReject,
  archive: styles.btnConfirmArchive,
  danger:  styles.btnConfirmDanger,
  default: styles.btnConfirmDefault,
};

export function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const isFa = /[\u0600-\u06FF]/.test(`${title} ${message} ${confirmLabel}`);

  // Lock body scroll while dialog is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Keyboard: Escape closes, Tab traps inside dialog
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCancel(); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled])"
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    // Auto-focus the cancel button for safe default
    setTimeout(() => dialogRef.current?.querySelector<HTMLElement>(`.${styles.btnCancel}`)?.focus(), 0);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const content = (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-dialog-title"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div ref={dialogRef} className={`${styles.dialog} ${isFa ? styles.dialogFa : ""}`} dir={isFa ? "rtl" : "ltr"}>
        <div className={`${styles.iconWrap} ${VARIANT_ICON_CLASS[variant]}`}>
          {VARIANT_ICON[variant]}
        </div>

        <h2 id="admin-dialog-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btnConfirm} ${VARIANT_BTN_CLASS[variant]}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
