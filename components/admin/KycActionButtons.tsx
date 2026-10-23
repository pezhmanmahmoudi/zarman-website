"use client";

import React from "react";
import { Check, X, Archive, Ban } from "lucide-react";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { approveKyc, rejectKyc, archiveKyc, suspendKyc } from "@/app/actions/admin.actions";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";
import { useAdminRefresh } from "@/components/admin/ui/useAdminRefresh";

export type KycDecisionStatus = "approved" | "rejected" | "archived" | "suspended";

export function KycSuspendButton({ userId, currentStatus, onCommitted }: {
  userId: string; currentStatus?: string; onCommitted?: (status: any) => void;
}) {
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();
  const refreshAdmin = useAdminRefresh();

  if (currentStatus === "suspended") return null;

  const handleSuspend = () => {
    confirm({
      title: "Suspend Account",
      message: "This will immediately suspend the customer's account, display an official suspension notice, and block all access to their dashboard.",
      confirmLabel: "Suspend",
      variant: "danger",
      onConfirm: async () => {
        const result = await suspendKyc(userId, currentStatus);
        if (result.error) showToast({ type: "error", message: result.error });
        else if (result.success) {
          showToast({ type: result.warning ? "warning" : "success", message: result.warning ?? "Account suspended.", duration: result.warning ? 10000 : undefined });
          onCommitted?.("suspended");
          refreshAdmin();
        }
      },
    });
  };

  return (
    <>
      <AdminConfirmDialog {...dialogProps} />
      <AdminToast        {...toastProps}  />
      <button
        type="button"
        onClick={handleSuspend}
        className={tableStyles.btnSuspend}
        title="Suspend Account"
      >
        <Ban size={13} />
        Suspend Account
      </button>
    </>
  );
}

export function KycActionButtons({ userId, currentStatus, onCommitted, showSuspend = true }: {
  userId: string; currentStatus?: string; onCommitted?: (status: any) => void; showSuspend?: boolean;
}) {
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();
  const refreshAdmin = useAdminRefresh();

  const handleApprove = () => {
    confirm({
      title: "Approve KYC",
      message: "This will grant the user full transaction access.",
      confirmLabel: "Approve",
      variant: "approve",
      onConfirm: async () => {
        const result = await approveKyc(userId);
        if (result.error) showToast({ type: "error", message: result.error });
        else { showToast({ type: "success", message: "KYC approved." }); onCommitted?.("approved"); refreshAdmin(); }
      },
    });
  };

  const handleReject = () => {
    confirm({
      title: "Reject KYC",
      message: "The customer will not be able to transact and will be prompted to update and resubmit their details.",
      confirmLabel: "Reject",
      variant: "reject",
      onConfirm: async () => {
        const result = await rejectKyc(userId);
        if (result.error) showToast({ type: "error", message: result.error });
        else { showToast({ type: "success", message: "KYC rejected." }); onCommitted?.("rejected"); refreshAdmin(); }
      },
    });
  };

  const handleSuspend = () => {
    confirm({
      title: "Suspend Account",
      message: "This will immediately suspend the customer's account, display an official suspension notice, and block all access to their dashboard.",
      confirmLabel: "Suspend",
      variant: "danger",
      onConfirm: async () => {
        const result = await suspendKyc(userId, currentStatus);
        if (result.error) showToast({ type: "error", message: result.error });
        else if (result.success) {
          showToast({ type: result.warning ? "warning" : "success", message: result.warning ?? "Account suspended.", duration: result.warning ? 10000 : undefined });
          onCommitted?.("suspended");
          refreshAdmin();
        }
      },
    });
  };

  const handleArchive = () => {
    confirm({
      title: "Archive KYC",
      message: "Use this for incomplete or abandoned submissions.",
      confirmLabel: "Archive",
      variant: "archive",
      onConfirm: async () => {
        const result = await archiveKyc(userId, currentStatus);
        if (result.error) showToast({ type: "error", message: result.error });
        else if (result.success) {
          showToast({ type: result.warning ? "warning" : "success", message: result.warning ?? "KYC archived.", duration: result.warning ? 10000 : undefined });
          onCommitted?.("archived");
          refreshAdmin();
        }
      },
    });
  };

  const isDecided =
    currentStatus === "approved" ||
    currentStatus === "rejected" ||
    currentStatus === "archived" ||
    currentStatus === "suspended";

  return (
    <>
      <AdminConfirmDialog {...dialogProps} />
      <AdminToast        {...toastProps}  />
      <div className={tableStyles.kycActionsRow}>
        <div className={tableStyles.btnGroup}>
          {currentStatus !== "approved" && (
            <button type="button" onClick={handleApprove}
              className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnApprove}`} title="Approve KYC">
              <Check size={11} />
              Approve
            </button>
          )}
          {currentStatus !== "rejected" && (
            <button type="button" onClick={handleReject}
              className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnReject}`} title="Reject KYC">
              <X size={11} />
              Reject
            </button>
          )}
          {currentStatus !== "archived" && (
            <button type="button" onClick={handleArchive}
              className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnArchive}`} title={isDecided ? "Archive" : "Archive — incomplete/abandoned"}>
              <Archive size={11} />
              Archive
            </button>
          )}
        </div>
        {showSuspend && currentStatus !== "suspended" && (
          <button type="button" onClick={handleSuspend}
            className={tableStyles.btnSuspend} title="Suspend Account">
            <Ban size={13} />
            Suspend Account
          </button>
        )}
      </div>
    </>
  );
}
