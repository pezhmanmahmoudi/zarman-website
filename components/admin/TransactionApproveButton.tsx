"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Archive } from "lucide-react";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import { approveTransaction, rejectTransaction, archiveTransaction } from "@/app/actions/admin.actions";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";

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

  // باز کردن مودال تایید چندکشویی
  const handleApproveClick = () => {
    setShowApproveModal(true);
  };

  // ارسال تراکنش و ثبت در لجر به صورت دوطرفه
  const submitApprove = async () => {
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

      {/* 🌟 پنجره‌ی هوشمند انتخاب کشوها 🌟 */}
      {showApproveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1rem', width: '90%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', direction: 'rtl', fontFamily: 'var(--font-fa-content, Tahoma, sans-serif)' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Check size={20} color="#059669" /> تایید نهایی تراکنش
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              لطفاً کشوهای درگیر در این تراکنش را مشخص کنید تا مغایرت‌گیری بانکی به صورت خودکار انجام شود.
            </p>

            <div style={{ marginBottom: '1rem' }}>
               <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#4b5563', marginBottom: '0.4rem' }}>
                 مشتری پول را به کدام حساب واریز کرد؟ (دریافتی ما)
               </label>
               <SelectBox
                  labeledOptions={[
                    { value: "", label: "-- در صورت واریز، کشوی مقصد را انتخاب کنید --" },
                    ...bankAccounts.map(b => ({ value: b.id, label: `${b.account_name} (${b.currency})` })),
                  ]}
                  value={receiverId}
                  onChange={(val) => setReceiverId(val)}
                  disabled={isApproving}
               />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
               <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#4b5563', marginBottom: '0.4rem' }}>
                 ارز از کدام حساب/انبار به مشتری داده شد؟ (پرداختی ما)
               </label>
               <SelectBox
                  labeledOptions={[
                    { value: "", label: "-- در صورت انتقال، کشوی مبدأ را انتخاب کنید --" },
                    ...bankAccounts.map(b => ({ value: b.id, label: `${b.account_name} (${b.currency})` })),
                  ]}
                  value={payerId}
                  onChange={(val) => setPayerId(val)}
                  disabled={isApproving}
               />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
               <button onClick={() => setShowApproveModal(false)} disabled={isApproving} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #d0d5dd', borderRadius: '0.5rem', cursor: 'pointer', color: '#4b5563', fontWeight: 600, fontFamily: 'inherit' }}>
                 انصراف
               </button>
               <button onClick={submitApprove} disabled={isApproving} style={{ padding: '0.5rem 1rem', background: '#059669', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'inherit' }}>
                 {isApproving ? 'در حال ثبت...' : 'تایید قطعی و ثبت'}
               </button>
            </div>
          </div>
        </div>
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