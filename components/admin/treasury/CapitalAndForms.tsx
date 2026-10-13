import React from "react";
import { CreditCard, Briefcase, Landmark } from "lucide-react";
import { fmtIRT, type AccountingSnapshot } from "@/lib/accounting-engine";
import { FA } from "@/lib/treasury-utils";
import BankAccountManager from "@/components/admin/treasury/BankAccountManager";
import BankTransferFees from "@/components/admin/treasury/BankTransferFees";
import ExpenseForm from "@/components/admin/treasury/ExpenseForm";
import OwnerLoanForm from "@/components/admin/treasury/OwnerLoanForm";
import RecurringExpenseForm from "@/components/admin/treasury/RecurringExpenseForm";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import s from "@/styles/admin/Treasury.module.css";

export default function CapitalAndForms({ 
  accounting: a, 
  bankAccounts, 
  expenses, 
  recurringExpenses,
  ownerLoans 
}: { 
  accounting: AccountingSnapshot,
  bankAccounts: React.ComponentProps<typeof BankAccountManager>["bankAccounts"],
  expenses: React.ComponentProps<typeof ExpenseForm>["expenses"],
  recurringExpenses: React.ComponentProps<typeof RecurringExpenseForm>["recurringExpenses"],
  ownerLoans: React.ComponentProps<typeof OwnerLoanForm>["loans"]
}) {
  return (
    <section>
      <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
        <div>
          <h2 className={cardStyles.sectionTitle}>{FA.sec5}</h2>
          <p className={cardStyles.sectionDesc}>{FA.sec5Desc}</p>
        </div>
      </div>

      <div className={`${cardStyles.statsGrid} ${s.statsGridBottomMd}`}>
        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconSuccess}`}>
            <Landmark size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${a.ownerCapitalHistoricalIRT >= 0 ? s.valPositive : s.valNegative}`}>
              {fmtIRT(a.ownerCapitalHistoricalIRT)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="آورده دائمی مالک منهای برداشت‌های ثبت‌شده، به ارزش تاریخی تومان. این مبلغ بدهی قابل‌بازپرداخت نیست و تسعیر وام ندارد.">
                {FA.ownerCapital} (تومان تاریخی)
              </Tooltip>
            </span>
          </div>
        </div>
        <div className={cardStyles.statCardCompact}>
          <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconWarning}`}>
            <CreditCard size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${a.ownerLoanBalanceIRT > 0 ? s.valAmber : s.valNeutral}`}>
              {fmtIRT(a.ownerLoanBalanceIRT)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="مانده وام‌های قابل‌بازپرداخت به مالک؛ آورده دائمی مالک در این مبلغ قرار ندارد.">
                بدهی وام به مالک
              </Tooltip>
            </span>
          </div>
        </div>

        <div className={`${cardStyles.statCardCompact} ${s.statCardStrongBorder}`}>
          <div className={`${cardStyles.statIconCompact} ${a.netBusinessValueIRT >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
            <Briefcase size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${a.netBusinessValueIRT >= 0 ? s.valPositive : s.valNegative}`}>
              {fmtIRT(a.netBusinessValueIRT)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="ارزش خالص کسب‌وکار (Net Business Value): کل دارایی‌های نقد و غیرنقدِ صرافی، پس از کسر تمامی بدهی‌ها.">{FA.netBV}</Tooltip>
            </span>
          </div>
        </div>
      </div>

      <BankAccountManager bankAccounts={bankAccounts} />

      <BankTransferFees />

      <div className={s.splitLayout}>
        <ExpenseForm expenses={expenses} bankAccounts={bankAccounts} />
        <OwnerLoanForm loans={ownerLoans} bankAccounts={bankAccounts} />
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <RecurringExpenseForm
          recurringExpenses={recurringExpenses}
          bankAccounts={bankAccounts}
        />
      </div>
    </section>
  );
}
