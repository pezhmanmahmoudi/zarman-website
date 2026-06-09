"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { rejectTransaction } from "@/app/actions/admin.actions";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";

export function RejectApprovedButton({
  transactionId,
}: {
  transactionId: string | number;
}) {
  const router = useRouter();
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();

  const handleReject = () => {
    confirm({
      title: "Reject Approved Transaction",
      message: "This will change the status from Approved to Rejected. This cannot be undone easily.",
      confirmLabel: "Reject",
      variant: "reject",
      onConfirm: async () => {
        const result = await rejectTransaction(transactionId);
        if (result.error) showToast({ type: "error", message: result.error });
        else { showToast({ type: "success", message: "Transaction rejected." }); router.refresh(); }
      },
    });
  };

  return (
    <>
      <AdminConfirmDialog {...dialogProps} />
      <AdminToast        {...toastProps}  />
      <button
        type="button"
        onClick={handleReject}
        className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${tableStyles.btnReject}`}
        title="Reject this transaction"
      >
        <X size={11} />
        Reject
      </button>
    </>
  );
}
