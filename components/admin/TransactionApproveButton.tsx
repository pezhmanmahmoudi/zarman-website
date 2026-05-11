"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Archive } from "lucide-react";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { approveTransaction, rejectTransaction, archiveTransaction } from "@/app/actions/admin.actions";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";

export function TransactionActionButtons({
  transactionId,
}: {
  transactionId: string | number;
}) {
  const router = useRouter();
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();

  const handleApprove = () => {
    confirm({
      title: "Approve Transaction",
      message: "The customer's loyalty tier will reflect this approval.",
      confirmLabel: "Approve",
      variant: "approve",
      onConfirm: async () => {
        const result = await approveTransaction(transactionId);
        if (result.error) showToast({ type: "error", message: result.error });
        else { showToast({ type: "success", message: "Transaction approved." }); router.refresh(); }
      },
    });
  };

  const handleReject = () => {
    confirm({
      title: "Reject Transaction",
      message: "This transaction will be marked as rejected.",
      confirmLabel: "Reject",
      variant: "reject",
      onConfirm: async () => {
        const result = await rejectTransaction(transactionId);
        if (result.error) showToast({ type: "error", message: result.error });
        else { showToast({ type: "success", message: "Transaction rejected." }); router.refresh(); }
      },
    });
  };

  const handleArchive = () => {
    confirm({
      title: "Archive Transaction",
      message: "Use this when the customer did not complete the transfer.",
      confirmLabel: "Archive",
      variant: "archive",
      onConfirm: async () => {
        const result = await archiveTransaction(transactionId);
        if (result.error) showToast({ type: "error", message: result.error });
        else { showToast({ type: "success", message: "Transaction archived." }); router.refresh(); }
      },
    });
  };

  return (
    <>
      <AdminConfirmDialog {...dialogProps} />
      <AdminToast        {...toastProps}  />
      <div className={tableStyles.btnGroup}>
        <button type="button" onClick={handleApprove}
          className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnApprove}`} title="Approve transaction">
          <Check size={11} />
          Approve
        </button>
        <button type="button" onClick={handleReject}
          className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnReject}`} title="Reject transaction">
          <X size={11} />
          Reject
        </button>
        <button type="button" onClick={handleArchive}
          className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnArchive}`} title="Archive — customer did not complete">
          <Archive size={11} />
          Archive
        </button>
      </div>
    </>
  );
}

// Keep old export name as alias for backwards compat
export { TransactionActionButtons as TransactionApproveButton };
