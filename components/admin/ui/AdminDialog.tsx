"use client";

import React, { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getActiveAdminDialog, registerAdminDialog } from "./admin-dialog-stack";
import styles from "@/styles/admin/AdminDialogSurface.module.css";

type AdminDialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: "modal" | "drawer-left" | "drawer-right";
  labelledBy?: string;
  describedBy?: string;
  "aria-label"?: string;
  dismissible?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  dir?: "ltr" | "rtl";
};

const subscribeHydration = () => () => {};
const getHydrated = () => true;
const getServerHydrated = () => false;
const focusableSelector = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';

/** A browser top-layer surface, independent of ancestor overflow and transforms. */
export function AdminDialog({
  open, onClose, children, className, style, variant = "modal", labelledBy,
  describedBy, "aria-label": ariaLabel, dismissible = true, initialFocusRef, dir = "ltr",
}: AdminDialogProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, getHydrated, getServerHydrated);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pointerStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !hydrated || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const unregister = registerAdminDialog(dialog);
    const preferredFocus = initialFocusRef?.current
      ?? dialog.querySelector<HTMLElement>("[data-autofocus]")
      ?? panelRef.current;
    preferredFocus?.focus({ preventScroll: true });

    return () => {
      const wasActive = getActiveAdminDialog() === dialog;
      unregister();
      dialog.close();
      const remainingDialog = getActiveAdminDialog();
      if (wasActive && previousFocus?.isConnected && (!remainingDialog || remainingDialog.contains(previousFocus))) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open, hydrated, initialFocusRef]);

  if (!open || !hydrated) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.surface}
      data-variant={variant}
      data-admin-dialog=""
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      dir={dir}
      onCancel={event => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onPointerDown={event => {
        pointerStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={event => {
        if (pointerStartedOnBackdrop.current && event.target === event.currentTarget && dismissible) onClose();
        pointerStartedOnBackdrop.current = false;
      }}
      onKeyDown={event => {
        if (event.key !== "Tab" || event.defaultPrevented || getActiveAdminDialog() !== dialogRef.current) return;
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
          .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[inert]") && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          event.preventDefault();
          panelRef.current?.focus();
        } else if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement as HTMLElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement as HTMLElement))) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div ref={panelRef} tabIndex={-1} className={`${styles.panel} ${className ?? ""}`} style={style}>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
