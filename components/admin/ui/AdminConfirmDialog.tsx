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
import React, { useId, useRef } from "react";
import { AdminDialog } from "./AdminDialog";
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

  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AdminDialog
      open={open}
      onClose={onCancel}
      dismissible={!loading}
      labelledBy={titleId}
      describedBy={messageId}
      initialFocusRef={cancelRef}
      className={`${styles.dialog} ${isFa ? styles.dialogFa : ""}`}
      dir={isFa ? "rtl" : "ltr"}
    >
        <div className={`${styles.iconWrap} ${VARIANT_ICON_CLASS[variant]}`}>
          {VARIANT_ICON[variant]}
        </div>

        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={messageId} className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <button
            type="button"
            ref={cancelRef}
            className={styles.btnCancel}
            onClick={onCancel}
            disabled={loading}
          >
            {isFa ? "انصراف" : "Cancel"}
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
    </AdminDialog>
  );
}
