import React from "react";
import { CreditCard, Briefcase } from "lucide-react";
import { fmtIRT } from "@/lib/accounting-engine";
import { FA } from "@/lib/treasury-utils";
import BankAccountManager from "@/components/admin/treasury/BankAccountManager";
import ExpenseForm from "@/components/admin/treasury/ExpenseForm";
import OwnerLoanForm from "@/components/admin/treasury/OwnerLoanForm";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import s from "@/styles/admin/Treasury.module.css";

export default function CapitalAndForms({ 
  accounting: a, 
  bankAccounts, 
  expenses, 
  ownerLoans 
}: { 
  accounting: any, 
  bankAccounts: any[], 
  expenses: any[], 
  ownerLoans: any[] 
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
          <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconWarning}`}>
            <CreditCard size={20} />
          </div>
          <div className={cardStyles.statInfo}>
            <span className={`${cardStyles.statValue} ${a.ownerLoanBalanceIRT > 0 ? s.valAmber : s.valNeutral}`}>
              {fmtIRT(a.ownerLoanBalanceIRT)}
            </span>
            <span className={cardStyles.statLabel}>
              <Tooltip text="تراز خالصِ بدهی سیستم به مالک (مجموع تزریق‌های سرمایه منهای برداشت‌های شخصی مالک).">{FA.loanBalance}</Tooltip>
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

      <div className={s.splitLayout}>
        <ExpenseForm expenses={expenses} bankAccounts={bankAccounts} />
        <OwnerLoanForm loans={ownerLoans} bankAccounts={bankAccounts} />
      </div>
    </section>
  );
}