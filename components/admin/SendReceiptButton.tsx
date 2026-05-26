"use client";

import React, { useState } from "react";
import { Mail, CheckCircle } from "lucide-react";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { sendTransactionReceipt } from "@/app/actions/email.actions";
import { AdminToast } from "@/components/admin/ui/AdminToast";

type ToastState = {
  visible: boolean;
  type: "success" | "error";
  message: string;
};

export function SendReceiptButton({
  transactionId,
  customerEmail,
  initiallySent = false,
}: {
  transactionId: string | number;
  /** Shown in the tooltip for confirmation UX */
  customerEmail?: string;
  /** Whether the receipt was already marked as sent in DB */
  initiallySent?: boolean;
}) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(initiallySent);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    type: "success",
    message: "",
  });

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ visible: true, type, message });
  };

  const handleSend = async () => {
    // Require a second click to confirm (acts as lightweight confirmation)
    if (!sent && !isSending) {
      setIsSending(true);
      try {
        const result = await sendTransactionReceipt(transactionId);
        if ("error" in result) {
          showToast("error", result.error);
        } else {
          setSent(true);
          showToast(
            "success",
            customerEmail
              ? `Receipt sent to ${customerEmail}`
              : "Receipt email sent successfully."
          );
        }
      } catch (err) {
        showToast("error", "Unexpected error — please try again.");
        console.error("[SendReceiptButton]", err);
      } finally {
        setIsSending(false);
      }
    }
  };

  return (
    <>
      <AdminToast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={isSending || sent}
        className={`${tableStyles.btnAction} ${tableStyles.btnActionCompact} ${
          sent ? tableStyles.btnApprove : ""
        }`}
        title={
          sent
            ? "Receipt already sent"
            : customerEmail
            ? `Send receipt to ${customerEmail}`
            : "Send transaction receipt"
        }
        style={
          sent
            ? { opacity: 0.7, cursor: "default" }
            : undefined
        }
      >
        {isSending ? (
          // Simple CSS spinner using border trick — no extra dependency
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }}
          />
        ) : sent ? (
          <CheckCircle size={11} />
        ) : (
          <Mail size={11} />
        )}
        {isSending ? "Sending…" : sent ? "Sent" : "Send Receipt"}
      </button>

      {/* Keyframe for the spinner — injected once per mount */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
