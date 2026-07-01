import React from "react";
import { Wallet, Building2, UserCircle, RefreshCw } from "lucide-react";
import { fmtAUD, fmtIRT } from "@/lib/accounting-engine";
import { FA } from "@/lib/treasury-utils";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import s from "@/styles/admin/Treasury.module.css";

export default function ReconciliationGrid({ accounting: a }: { accounting: any }) {
  const drawers = Object.values(a.drawerBalances) as Array<{
    accountId: string;
    accountName: string;
    currency: string;
    type: "bank" | "virtual" | "transit";
    balance: number;
  }>;

  return (
    <section className={s.reconSectionCard}>
      <summary className={s.reconSummary}>
        <span className={s.reconSummaryTitle}>{FA.secRecon}</span>
        <span className={s.reconSummaryDesc}>{FA.secReconDesc}</span>
      </summary>
      
      <div className={`${s.reconBody} ${s.reconBodyAuto}`}>
        <div className={`${s.reconAccount} ${s.reconAccountPrimary}`}>
          <div className={`${s.reconAccountTitle} ${s.reconAccountTitleRow}`}>
            <div className={`${s.reconTitleMeta} ${s.reconTitleMetaAccent}`}>
              <Wallet size={16} />
              انبار مرکزی زرمان (AUD)
            </div>
            <span className={`${s.reconCurrencyBadge} ${s.reconCurrencyBadgeAccent}`}>AUD</span>
          </div>
          <div className={`${s.reconAccountBody} ${s.reconBalance} ${s.reconBalanceAccent}`}>
            {fmtAUD(a.audInventory)}
          </div>
          <div className={s.reconMetaRow}>
            {/* 🌟 تولتیپ در اینجا اضافه شد 🌟 */}
            <span>
              <Tooltip text="میانگین موزون بهای تمام‌شده خریدهای قبلی (Weighted Average Cost). این عدد پایه محاسبه سود و زیان شماست.">میانگین خرید (WAC)</Tooltip>
            </span>
            <span className={s.reconMono}>{fmtIRT(a.wac)}</span>
          </div>
        </div>

        {drawers.map(drawer => {
          const isBank = drawer.type === "bank";
          const isVirtual = drawer.type === "virtual";
          const formattedBalance = drawer.currency === "IRT" ? fmtIRT(drawer.balance) : fmtAUD(drawer.balance);
          
          return (
            <div key={drawer.accountId} className={`${s.reconAccount} ${s.reconAccountDrawer}`}>
              <div className={`${s.reconAccountTitle} ${s.reconAccountTitleRow}`}>
                <div className={s.reconTitleMeta}>
                  {isBank ? <Building2 size={16} color="var(--accent)" /> : isVirtual ? <UserCircle size={16} color="var(--text-dim)" /> : <RefreshCw size={16} color="#eab308" />}
                  {drawer.accountName}
                </div>
                <span className={`${s.reconCurrencyBadge} ${isBank ? s.reconCurrencyBadgeAccent : s.reconCurrencyBadgeMuted}`}>
                  {drawer.currency}
                </span>
              </div>
              <div className={`${s.reconAccountBody} ${s.reconBalance}`}>
                {formattedBalance}
              </div>
              <div className={s.reconDesc}>
                {isBank ? "موجودی سیستمی بانکی" : isVirtual ? "تعهدات جاری مشتری" : "وجه در حال انتقال"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}