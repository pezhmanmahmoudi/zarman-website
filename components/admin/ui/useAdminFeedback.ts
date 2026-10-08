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
 *       else { showToast({ type: "success", message: "KYC approved." }); refreshAdmin(); }
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
import { useState, useCallback, useContext, useEffect, useRef } from "react";
import { AdminFeedbackContext } from "./AdminFeedbackProvider";
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
  const sharedFeedback = useContext(AdminFeedbackContext);
  // ── Dialog state ─────────────────────────────────────────────────────────
  const [dialogOpts, setDialogOpts] = useState<ConfirmOptions | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Keep a stable ref to onConfirm so it doesn't cause re-renders
  const onConfirmRef = useRef<ConfirmOptions["onConfirm"] | null>(null);
  const confirmingRef = useRef(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    if (confirmingRef.current) return;
    onConfirmRef.current = opts.onConfirm;
    setDialogOpts(opts);
  }, []);

  const handleDialogConfirm = useCallback(async () => {
    if (!onConfirmRef.current || confirmingRef.current) return;
    confirmingRef.current = true;
    setDialogLoading(true);
    try {
      await onConfirmRef.current();
    } catch (error) {
      console.error("[admin confirmed action]", error);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      const notice: ToastOptions = { type: "error", duration: 10000, message: "We couldn’t confirm the result. Refresh the information before trying the action again." };
      if (sharedFeedback) sharedFeedback.showToast(notice);
      else setToastOpts(notice);
    } finally {
      confirmingRef.current = false;
      onConfirmRef.current = null;
      setDialogLoading(false);
      setDialogOpts(null);
    }
  }, [sharedFeedback]);

  const handleDialogCancel = useCallback(() => {
    if (confirmingRef.current) return; // also block before loading has rendered
    onConfirmRef.current = null;
    setDialogOpts(null);
  }, []);

  // ── Toast state ──────────────────────────────────────────────────────────
  const [toastOpts, setToastOpts] = useState<ToastOptions | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    if (sharedFeedback) { sharedFeedback.showToast(opts); return; }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastOpts(opts);
    toastTimerRef.current = setTimeout(
      () => setToastOpts(null),
      opts.duration ?? 4000,
    );
  }, [sharedFeedback]);

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
