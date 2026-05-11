"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { moderateFeedback } from "@/app/actions/admin.actions";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";

export function FeedbackModerateButtons({
  feedbackId,
  currentStatus,
}: {
  feedbackId: string | number;
  currentStatus: string;
}) {
  const router = useRouter();
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();

  const handle = (newStatus: "approved" | "rejected") => {
    const isApproving = newStatus === "approved";
    confirm({
      title: isApproving ? "Approve Feedback" : "Reject Feedback",
      message: isApproving
        ? "This review will appear in the public testimonials section."
        : "This review will be hidden from the testimonials section.",
      confirmLabel: isApproving ? "Approve" : "Reject",
      variant: isApproving ? "approve" : "reject",
      onConfirm: async () => {
        const result = await moderateFeedback(feedbackId, newStatus);
        if (result.error) showToast({ type: "error", message: result.error });
        else {
          showToast({ type: "success", message: `Feedback ${newStatus}.` });
          router.refresh();
        }
      },
    });
  };

  const isApproved = currentStatus === "approved";
  const isRejected = currentStatus === "rejected";

  return (
    <>
      <AdminConfirmDialog {...dialogProps} />
      <AdminToast        {...toastProps}  />
      <div className={tableStyles.cellActions}>
        {!isApproved && (
          <button
            type="button"
            onClick={() => handle("approved")}
            className={`${tableStyles.btnAction} ${tableStyles.btnApprove}`}
            title="Approve for testimonials"
          >
            <Check size={12} />
            Approve
          </button>
        )}
        {!isRejected && (
          <button
            type="button"
            onClick={() => handle("rejected")}
            className={`${tableStyles.btnAction} ${tableStyles.btnReject}`}
            title="Reject feedback"
          >
            <X size={12} />
            Reject
          </button>
        )}
      </div>
    </>
  );
}
