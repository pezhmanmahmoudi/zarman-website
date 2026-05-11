"use client";

/**
 * AdminConfirmDialog — replaces native window.confirm().
 *
 * Renders an inline fixed-position modal (no portal) so it inherits
 * the CSS custom properties from the parent .adminShell scope.
 *
 * Usage (via useAdminFeedback hook):
 *   const { confirm, dialogProps } = useAdminFeedback();
 *   <AdminConfirmDialog {...dialogProps} />
 */
import React from "react";
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
  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-dialog-title"
      // Prevent clicks on the backdrop from bubbling up to table rows, etc.
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.dialog}>
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
}
