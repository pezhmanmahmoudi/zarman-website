import React from "react";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { getTreasuryFullData } from "@/app/actions/treasury.actions";
import { FA } from "@/lib/treasury-utils";

// وارد کردن ماژول‌های UI تفکیک‌شده
import AlertsSection from "@/components/admin/treasury/AlertsSection";
import StrategyCenter from "@/components/admin/treasury/StrategyCenter";
import MarketInventory from "@/components/admin/treasury/MarketInventory";
import LiquidityAccounts from "@/components/admin/treasury/LiquidityAccounts";
import ReconciliationGrid from "@/components/admin/treasury/ReconciliationGrid";
import ExposureSection from "@/components/admin/treasury/ExposureSection";
import ProfitabilitySection from "@/components/admin/treasury/ProfitabilitySection";
import CapitalAndForms from "@/components/admin/treasury/CapitalAndForms";
import TreasurySettings from "@/components/admin/treasury/TreasurySettings";

// استایل‌های پوسته اصلی
import shellStyles from "@/styles/admin/AdminShell.module.css";
import tbStyles from "@/styles/admin/TreasuryShell.module.css";
import s from "@/styles/admin/Treasury.module.css";

export const metadata = { title: "Treasury | Zarman Admin" };
export const revalidate = 60;

export default async function TreasuryPage() {
  const { accounting, treasury, strategy, ownerLoans, expenses, recurringExpenses, bankAccounts, settings } = await getTreasuryFullData();

  const {
    alerts = [],
    criticalAlertCount = 0,
    accountingWarnings = [],
  } = strategy || {};

  return (
    <>
      <div className={shellStyles.topBar}>
        <div className={tbStyles.topBarText}>
          <h1>{FA.pageTitle}</h1>
          <p>{FA.pageDesc}</p>
        </div>
        <div className={shellStyles.topBarActions}>
          {criticalAlertCount > 0 && (
            <span className={s.criticalAlertBadge}>
              <AlertTriangle size={14} />
              {criticalAlertCount} {FA.riskCritical}
            </span>
          )}
          {accountingWarnings.length > 0 && (
            <span className={s.warnCountBadge}>
              <AlertCircle size={14} />
              {accountingWarnings.length} {FA.warnUnit}
            </span>
          )}
        </div>
      </div>

      <div className={shellStyles.pageContent}>
        <div className={s.treasuryPage}>
          
          <AlertsSection alerts={alerts} accountingWarnings={accountingWarnings} />

          <StrategyCenter strategy={strategy} treasury={treasury} />
          <hr className={s.sectionDivider} />

          <MarketInventory treasury={treasury} strategy={strategy} />
          <hr className={s.sectionDivider} />

          <LiquidityAccounts treasury={treasury} strategy={strategy} />
          <hr className={s.sectionDivider} />

          <ReconciliationGrid accounting={accounting} />
          <hr className={s.sectionDivider} />
          
          <ExposureSection treasury={treasury} strategy={strategy} />
          <hr className={s.sectionDivider} />
          
          <ProfitabilitySection accounting={accounting} strategy={strategy} />
          <hr className={s.sectionDivider} />

          <CapitalAndForms 
            accounting={accounting} 
            bankAccounts={bankAccounts} 
            expenses={expenses} 
            recurringExpenses={recurringExpenses}
            ownerLoans={ownerLoans} 
          />
          <hr className={s.sectionDivider} />

          <TreasurySettings settings={settings} />

        </div>
      </div>
    </>
  );
}