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
import {
  IRAN_BANK_TRANSFER_METHOD_OPTIONS,
  calcIranBankTransferFee,
  getIranBankTransferFeeError,
  type IranBankTransferMethod,
} from "@/lib/iran-bank-transfer-fees";
import { sortBankAccountsByPriority, type BankAccountLike } from "@/lib/bank-account-ordering";

export function TransactionApproveButton({
  transactionId,
  transactionAmountToman,
  transactionType,
  bankAccounts = [], // دریافت لیست کشوها از دیتابیس
}: {
  transactionId: string | number;
  transactionAmountToman: number;
  transactionType: "buy_aud" | "sell_aud" | string;
  bankAccounts?: { id: string; account_name?: string | null; currency?: string | null }[];
}) {
  const router = useRouter();
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();

  // State برای مدیریت پنجره‌ی انتخاب کشوها
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [payerId, setPayerId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [transferMethod, setTransferMethod] = useState<IranBankTransferMethod>("free");
  const [isApproving, setIsApproving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
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
    setTransferMethod("free");
    setPayerId("");
    setReceiverId("");
    setShowApproveModal(true);
  };

  const payerCurrency = transactionType === "buy_aud" ? "IRT" : "AUD";
  const receiverCurrency = transactionType === "buy_aud" ? "AUD" : "IRT";
  const payerLabelFA = payerCurrency === "IRT" ? "حساب پرداخت‌کننده ایران" : "حساب پرداخت‌کننده استرالیا";
  const receiverLabelFA = receiverCurrency === "IRT" ? "حساب دریافت‌کننده ایران" : "حساب دریافت‌کننده استرالیا";

  const normalizedBankAccounts: BankAccountLike[] = bankAccounts
    .filter((account): account is { id: string; account_name: string; currency: "AUD" | "IRT" } =>
      typeof account?.id === "string" &&
      typeof account?.account_name === "string" &&
      (account.currency === "AUD" || account.currency === "IRT")
    )
    .map((account) => ({
      id: account.id,
      account_name: account.account_name,
      currency: account.currency,
    }));

  const payerAccounts = sortBankAccountsByPriority(
    normalizedBankAccounts.filter((account) => account.currency === payerCurrency)
  );
  const receiverAccounts = sortBankAccountsByPriority(
    normalizedBankAccounts.filter((account) => account.currency === receiverCurrency)
  );
  const feeEligible = payerCurrency === "IRT";

  // ارسال تراکنش و ثبت در لجر به صورت دوطرفه
  const submitApprove = async () => {
    if (!payerId || !receiverId) {
      showToast({ type: "error", message: "برای تایید تراکنش، انتخاب هر دو کشوی مبدأ و مقصد الزامی است." });
      return;
    }

    if (feeEligible) {
      const transferFeeError = getIranBankTransferFeeError(transactionAmountToman, transferMethod);
      if (transferFeeError) {
        showToast({ type: "error", message: transferFeeError });
        return;
      }
    }

    setIsApproving(true);
    // ارسال به اکشن سرور
    const result = await approveTransaction(
      transactionId, 
      payerId || undefined, 
      receiverId || undefined,
      feeEligible ? transferMethod : "free"
    );
    setIsApproving(false);

    if (result.error) {
      showToast({ type: "error", message: result.error });
    } else {
      showToast({ type: "success", message: "تراکنش با موفقیت تایید و در دفتر کل ثبت شد." });
      setShowApproveModal(false);
      setTransferMethod("free");
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

  const selectedTransferFee = feeEligible ? calcIranBankTransferFee(transactionAmountToman, transferMethod) : 0;
  const settlementAmountText = transactionAmountToman.toLocaleString("en-US");
  const totalDebitText = (transactionAmountToman + selectedTransferFee).toLocaleString("en-US");

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
                  {receiverLabelFA}
                </label>
                <select
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  disabled={isApproving}
                  className={overlayStyles.nativeSelect}
                >
                  <option value="">-- انتخاب حساب --</option>
                  {receiverAccounts.map((b) => (
                    <option key={`receiver-${b.id}`} value={String(b.id)}>
                      {`${b.account_name} (${b.currency})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className={overlayStyles.field}>
                <label className={overlayStyles.label}>
                  {payerLabelFA}
                </label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  disabled={isApproving}
                  className={overlayStyles.nativeSelect}
                >
                  <option value="">-- انتخاب حساب --</option>
                  {payerAccounts.map((b) => (
                    <option key={`payer-${b.id}`} value={String(b.id)}>
                      {`${b.account_name} (${b.currency})`}
                    </option>
                  ))}
                </select>
              </div>

              {feeEligible && (
                <>
                  <div className={overlayStyles.field}>
                    <label className={overlayStyles.label}>
                      روش انتقال بانکی
                    </label>
                    <select
                      value={transferMethod}
                      onChange={(e) => setTransferMethod(e.target.value as IranBankTransferMethod)}
                      disabled={isApproving}
                      className={overlayStyles.nativeSelect}
                    >
                      {IRAN_BANK_TRANSFER_METHOD_OPTIONS.map((method) => {
                        const isDisabled = getIranBankTransferFeeError(transactionAmountToman, method.value) !== null;
                        return (
                          <option key={method.value} value={method.value} disabled={isDisabled}>
                            {`${method.labelFA} (${method.labelEN})`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className={overlayStyles.feeSummary}>
                    <div className={overlayStyles.feeSummaryRow}>
                      <span>مبلغ تسویه به مقصد</span>
                      <strong>{settlementAmountText} تومان</strong>
                    </div>
                    <div className={overlayStyles.feeSummaryRow}>
                      <span>کارمزد شبکه</span>
                      <strong>{selectedTransferFee.toLocaleString("en-US")} تومان</strong>
                    </div>
                    <div className={`${overlayStyles.feeSummaryRow} ${overlayStyles.feeSummaryTotal}`}>
                      <span>جمع برداشت از مبدأ</span>
                      <strong>{totalDebitText} تومان</strong>
                    </div>
                  </div>
                </>
              )}
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