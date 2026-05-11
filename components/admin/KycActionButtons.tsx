"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Archive } from "lucide-react";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { approveKyc, rejectKyc, archiveKyc } from "@/app/actions/admin.actions";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";

export function KycActionButtons({ userId, currentStatus }: { userId: string; currentStatus?: string }) {
  const router = useRouter();
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();

  const handleApprove = () => {
    confirm({
      title: "Approve KYC",
      message: "This will grant the user full transaction access.",
      confirmLabel: "Approve",
      variant: "approve",
      onConfirm: async () => {
        const result = await approveKyc(userId);
        if (result.error) showToast({ type: "error", message: result.error });
        else { showToast({ type: "success", message: "KYC approved." }); router.refresh(); }
      },
    });
  };

  const handleReject = () => {
    confirm({
      title: "Reject KYC",
      message: "The user will not be able to transact.",
      confirmLabel: "Reject",
      variant: "reject",
      onConfirm: async () => {
        const result = await rejectKyc(userId);
        if (result.error) showToast({ type: "error", message: result.error });
        else { showToast({ type: "success", message: "KYC rejected." }); router.refresh(); }
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
        const result = await archiveKyc(userId);
        if (result.error) showToast({ type: "error", message: result.error });
        else { showToast({ type: "success", message: "KYC archived." }); router.refresh(); }
      },
    });
  };

  // Already decided — only show re-action buttons
  if (currentStatus === "approved" || currentStatus === "rejected" || currentStatus === "archived") {
    return (
      <>
        <AdminConfirmDialog {...dialogProps} />
        <AdminToast        {...toastProps}  />
        <div className={tableStyles.btnGroup}>
          {currentStatus !== "approved" && (
            <button type="button" onClick={handleApprove}
              className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnApprove}`} title="Approve KYC">
              <Check size={11} />
              Approve
            </button>
          )}
          {currentStatus !== "archived" && (
            <button type="button" onClick={handleArchive}
              className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnArchive}`} title="Archive">
              <Archive size={11} />
              Archive
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <AdminConfirmDialog {...dialogProps} />
      <AdminToast        {...toastProps}  />
      <div className={tableStyles.btnGroup}>
        <button type="button" onClick={handleApprove}
          className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnApprove}`} title="Approve KYC">
          <Check size={11} />
          Approve
        </button>
        <button type="button" onClick={handleReject}
          className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnReject}`} title="Reject KYC">
          <X size={11} />
          Reject
        </button>
        <button type="button" onClick={handleArchive}
          className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnArchive}`} title="Archive — incomplete/abandoned">
          <Archive size={11} />
          Archive
        </button>
      </div>
    </>
  );
}
