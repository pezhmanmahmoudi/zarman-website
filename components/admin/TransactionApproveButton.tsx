"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, X, Archive } from "lucide-react";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { approveTransaction, rejectTransaction, archiveTransaction } from "@/app/actions/admin.actions";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";
import overlayStyles from "@/styles/admin/AdminOverlays.module.css";

export function TransactionApproveButton({
  transactionId,
  bankAccounts = [], // دریافت لیست کشوها از دیتابیس
}: {
  transactionId: string | number;
  bankAccounts?: any[];
}) {
  const router = useRouter();
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();

  // State برای مدیریت پنجره‌ی انتخاب کشوها
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [payerId, setPayerId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showApproveModal) return;

    const prevOverflow = document.body.style.overflow;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isApproving) {
        setShowApproveModal(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showApproveModal, isApproving]);

  // باز کردن مودال تایید چندکشویی
  const handleApproveClick = () => {
    setShowApproveModal(true);
  };

  // ارسال تراکنش و ثبت در لجر به صورت دوطرفه
  const submitApprove = async () => {
    if (!payerId || !receiverId) {
      showToast({ type: "error", message: "برای تایید تراکنش، انتخاب هر دو کشوی مبدأ و مقصد الزامی است." });
      return;
    }

    setIsApproving(true);
    // ارسال به اکشن سرور
    const result = await approveTransaction(
      transactionId, 
      payerId || undefined, 
      receiverId || undefined
    );
    setIsApproving(false);

    if (result.error) {
      showToast({ type: "error", message: result.error });
    } else {
      showToast({ type: "success", message: "تراکنش با موفقیت تایید و در دفتر کل ثبت شد." });
      setShowApproveModal(false);
      router.refresh();
    }
  };

  const handleReject = () => {
    confirm({
      title: "Reject Transaction",
      message: "Are you sure you want to reject this transaction?",
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
      message: "Archive this transaction? (Customer did not complete the transfer).",
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
      <AdminToast {...toastProps} />

      {mounted && showApproveModal && createPortal(
        <div
          className={overlayStyles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-transaction-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isApproving) {
              setShowApproveModal(false);
            }
          }}
        >
          <div className={overlayStyles.approveCard}>
            <div className={overlayStyles.approveHeader}>
              <h3 id="approve-transaction-title" className={overlayStyles.approveTitle}>
                <Check size={18} color="#059669" /> تایید نهایی تراکنش
              </h3>
              <p className={overlayStyles.approveHint}>
                لطفا حساب های درگیر در این تراکنش را مشخص کنید تا ثبت دفتر کل و مغایرت گیری دقیق انجام شود.
              </p>
            </div>

            <div className={overlayStyles.approveBody}>
              <div className={overlayStyles.field}>
                <label className={overlayStyles.label}>
                حساب دریافت‌کننده
                </label>
                <select
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  disabled={isApproving}
                  className={overlayStyles.nativeSelect}
                >
                  <option value="">--بانک دریافت کننده--</option>
                  {bankAccounts.map((b) => (
                    <option key={`receiver-${b.id}`} value={String(b.id)}>
                      {`${b.account_name} (${b.currency})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className={overlayStyles.field}>
                <label className={overlayStyles.label}>
                  حساب پرداخت‌کننده
                </label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  disabled={isApproving}
                  className={overlayStyles.nativeSelect}
                >
                  <option value="">--بانک پرداخت کننده--</option>
                  {bankAccounts.map((b) => (
                    <option key={`payer-${b.id}`} value={String(b.id)}>
                      {`${b.account_name} (${b.currency})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={overlayStyles.approveActions}>
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={isApproving}
                className={`${overlayStyles.btn} ${overlayStyles.btnCancel}`}
                type="button"
              >
                انصراف
              </button>
              <button
                onClick={submitApprove}
                disabled={isApproving || !payerId || !receiverId}
                className={`${overlayStyles.btn} ${overlayStyles.btnApprove}`}
                type="button"
              >
                {isApproving ? "در حال ثبت..." : "تایید قطعی و ثبت"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className={tableStyles.btnGroup}>
        <button type="button" onClick={handleApproveClick}
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