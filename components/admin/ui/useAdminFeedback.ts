"use client";

/**
 * useAdminFeedback — combines dialog + toast state into a single, ergonomic hook.
 *
 * Designed to completely replace window.confirm() and alert() in admin action
 * button components. The hook is self-contained; no provider required.
 *
 * Usage:
 *   const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();
 *
 *   // trigger a confirmation
 *   confirm({
 *     title: "Approve KYC",
 *     message: "Grant this user transaction access?",
 *     confirmLabel: "Approve",
 *     variant: "approve",
 *     onConfirm: async () => {
 *       const result = await approveKyc(userId);
 *       if (result.error) showToast({ type: "error", message: result.error });
 *       else { showToast({ type: "success", message: "KYC approved." }); router.refresh(); }
 *     },
 *   });
 *
 *   // In JSX:
 *   <>
 *     <AdminConfirmDialog {...dialogProps} />
 *     <AdminToast        {...toastProps}  />
 *     // ...your buttons...
 *   </>
 */
import { useState, useCallback, useEffect, useRef } from "react";
import type { ConfirmVariant, AdminConfirmDialogProps } from "./AdminConfirmDialog";
import type { ToastType, AdminToastProps } from "./AdminToast";

// ── Types ──────────────────────────────────────────────────────────────────
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => Promise<void> | void;
}

interface ToastOptions {
  type: ToastType;
  message: string;
  /** Auto-dismiss after this many ms. Defaults to 4 000. */
  duration?: number;
}

export interface UseAdminFeedbackReturn {
  /** Open the confirmation dialog. */
  confirm: (opts: ConfirmOptions) => void;
  /** Show a toast notification. */
  showToast: (opts: ToastOptions) => void;
  /** Spread onto <AdminConfirmDialog>. */
  dialogProps: AdminConfirmDialogProps;
  /** Spread onto <AdminToast>. */
  toastProps: AdminToastProps;
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useAdminFeedback(): UseAdminFeedbackReturn {
  // ── Dialog state ─────────────────────────────────────────────────────────
  const [dialogOpts, setDialogOpts] = useState<ConfirmOptions | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Keep a stable ref to onConfirm so it doesn't cause re-renders
  const onConfirmRef = useRef<ConfirmOptions["onConfirm"] | null>(null);
  const confirmingRef = useRef(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    onConfirmRef.current = opts.onConfirm;
    setDialogOpts(opts);
  }, []);

  const handleDialogConfirm = useCallback(async () => {
    if (!onConfirmRef.current || confirmingRef.current) return;
    confirmingRef.current = true;
    setDialogLoading(true);
    try {
      await onConfirmRef.current();
    } catch {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastOpts({ type: "error", message: "The action could not be completed. Please try again." });
    } finally {
      confirmingRef.current = false;
      setDialogLoading(false);
      setDialogOpts(null);
    }
  }, []);

  const handleDialogCancel = useCallback(() => {
    if (dialogLoading) return; // block cancel while in-flight
    setDialogOpts(null);
  }, [dialogLoading]);

  // ── Toast state ──────────────────────────────────────────────────────────
  const [toastOpts, setToastOpts] = useState<ToastOptions | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastOpts(opts);
    toastTimerRef.current = setTimeout(
      () => setToastOpts(null),
      opts.duration ?? 4000,
    );
  }, []);

  const handleToastClose = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastOpts(null);
  }, []);

  // ── Composed return ──────────────────────────────────────────────────────
  return {
    confirm,
    showToast,
    dialogProps: {
      open: !!dialogOpts,
      title:        dialogOpts?.title        ?? "",
      message:      dialogOpts?.message      ?? "",
      confirmLabel: dialogOpts?.confirmLabel,
      variant:      dialogOpts?.variant,
      loading:      dialogLoading,
      onConfirm:    handleDialogConfirm,
      onCancel:     handleDialogCancel,
    },
    toastProps: {
      visible: !!toastOpts,
      type:    toastOpts?.type    ?? "info",
      message: toastOpts?.message ?? "",
      onClose: handleToastClose,
    },
  };
}
