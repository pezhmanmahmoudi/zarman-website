import Link from "next/link";
import {
  ArrowRight, BarChart3, BriefcaseBusiness, CheckCircle2, CircleAlert,
  LayoutDashboard, Landmark, ReceiptText, Repeat2, Settings2, Wallet,
} from "lucide-react";
import type { TreasuryPageData } from "@/app/actions/treasury.actions";
import { fmtAUD, fmtIRT } from "@/lib/accounting-engine";
import { TREASURY_GROUPS, TREASURY_VIEWS, treasuryViewHref, type TreasuryView } from "@/lib/treasury-navigation";
import AlertsSection from "@/components/admin/treasury/AlertsSection";
import StrategyCenter from "@/components/admin/treasury/StrategyCenter";
import MarketInventory from "@/components/admin/treasury/MarketInventory";
import LiquidityAccounts from "@/components/admin/treasury/LiquidityAccounts";
import ReconciliationGrid from "@/components/admin/treasury/ReconciliationGrid";
import ExposureSection from "@/components/admin/treasury/ExposureSection";
import ProfitabilitySection from "@/components/admin/treasury/ProfitabilitySection";
import BankAccountManager from "@/components/admin/treasury/BankAccountManager";
import BankTransferFees from "@/components/admin/treasury/BankTransferFees";
import ExpenseForm from "@/components/admin/treasury/ExpenseForm";
import RecurringExpenseForm from "@/components/admin/treasury/RecurringExpenseForm";
import OwnerLoanForm from "@/components/admin/treasury/OwnerLoanForm";
import TreasurySettings from "@/components/admin/treasury/TreasurySettings";
import s from "@/styles/admin/TreasuryWorkspace.module.css";
import treasuryStyles from "@/styles/admin/Treasury.module.css";

const GROUP_ICONS = { overview: LayoutDashboard, accounts: Landmark, expenses: ReceiptText, capital: BriefcaseBusiness, insights: BarChart3, settings: Settings2 };

function TreasuryOverview({ data }: { data: TreasuryPageData }) {
  const { accounting, treasury, strategy } = data;
  const alertCount = (strategy.alerts?.length ?? 0) + (strategy.accountingWarnings?.length ?? 0);
  const criticalCount = strategy.criticalAlertCount ?? 0;
  const metrics: { label: string; value: string; hint: string; view: TreasuryView; negative?: boolean }[] = [
    { label: "AUD inventory", value: fmtAUD(treasury.audInventory), hint: "AUD · View inventory", view: "inventory" },
    { label: "Iran liquidity", value: fmtIRT(treasury.totalIranLiquidityIRT), hint: "IRT · View liquidity", view: "accounts", negative: treasury.totalIranLiquidityIRT < 0 },
    { label: "Operating profit", value: fmtIRT(accounting.operatingProfit), hint: "IRT · View profitability", view: "profitability", negative: accounting.operatingProfit < 0 },
    { label: "Owner loan balance", value: fmtIRT(accounting.ownerLoanBalanceIRT), hint: "IRT · View capital", view: "capital" },
  ];
  const actions: { title: string; description: string; view: TreasuryView; icon: typeof Wallet }[] = [
    { title: "Account balances", description: "Review bank, customer, and transit balances.", view: "reconciliation", icon: Landmark },
    { title: "Manage expenses", description: "Add an expense or update an existing entry.", view: "expenses", icon: ReceiptText },
    { title: "Recurring payments", description: "Check due dates and post scheduled costs.", view: "recurring", icon: Repeat2 },
    { title: "Bank transfer fees", description: "Review and record monthly bank charges.", view: "bank-fees", icon: Wallet },
    { title: "Owner capital", description: "Record funding and manage repayments.", view: "capital", icon: BriefcaseBusiness },
    { title: "Manage accounts", description: "Maintain bank and virtual account details.", view: "bank-accounts", icon: Settings2 },
  ];

  return (
    <div className={s.overview}>
      <div className={s.metrics} aria-label="Treasury balances">
        {metrics.map(metric => (
          <Link key={metric.view} href={treasuryViewHref(metric.view)} className={s.metric} prefetch={false}>
            <span className={s.metricLabel}>{metric.label}</span>
            <strong className={`${s.metricValue} ${metric.negative ? s.negative : ""}`} dir="ltr">{metric.value}</strong>
            <span className={s.metricHint}>{metric.hint}<ArrowRight size={12} aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
      <div className={`${s.attention} ${alertCount > 0 ? s.attentionWarning : ""}`}>
        <div className={s.attentionText}>
          {alertCount > 0 ? <CircleAlert size={21} aria-hidden="true" /> : <CheckCircle2 size={21} aria-hidden="true" />}
          <div>
            <strong>{alertCount > 0 ? `${alertCount} ${alertCount === 1 ? "item needs" : "items need"} your attention` : "No treasury alerts"}</strong>
            <p>{criticalCount > 0 ? `${criticalCount} critical ${criticalCount === 1 ? "alert" : "alerts"}. Review risks and accounting warnings.` : "Monitor treasury risks and accounting data quality."}</p>
          </div>
        </div>
        <Link href={treasuryViewHref("alerts")} className={s.actionLink} prefetch={false}>Review alerts<ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
      <section aria-labelledby="treasury-tasks-title">
        <h3 id="treasury-tasks-title" className={s.sectionHeading}>Quick access</h3>
        <div className={s.quickGrid}>
          {actions.map(action => (
            <Link key={action.view} href={treasuryViewHref(action.view)} className={s.quickLink} prefetch={false}>
              <span className={s.quickIcon}><action.icon size={17} aria-hidden="true" /></span>
              <div><strong>{action.title}</strong><p>{action.description}</p></div>
            </Link>
          ))}
        </div>
      </section>
      <section className={s.insight} aria-labelledby="treasury-strategy-title">
        <div className={s.insightText}>
          <h3 id="treasury-strategy-title">Strategy snapshot · Health score {strategy.healthScore.score}/100</h3>
          <p dir="rtl" lang="fa">{strategy.recommendation.titleFA}</p>
        </div>
        <Link href={treasuryViewHref("strategy")} className={s.actionLink} prefetch={false}>Explore insights<ArrowRight size={14} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}

// Select on the server so inactive forms are neither mounted nor hydrated.
// In particular, monthly bank-fee requests only run in the bank-fees workspace.
function TreasuryContent({ view, data }: { view: TreasuryView; data: TreasuryPageData }) {
  const { accounting, treasury, strategy, bankAccounts, expenses, recurringExpenses, ownerLoans, settings } = data;
  switch (view) {
    case "overview": return <TreasuryOverview data={data} />;
    case "alerts": return (
      (strategy.alerts?.length ?? 0) + (strategy.accountingWarnings?.length ?? 0) > 0
        ? <div className={treasuryStyles.treasuryPage} lang="fa"><AlertsSection alerts={strategy.alerts} accountingWarnings={strategy.accountingWarnings} /></div>
        : <div className={s.attention}><div className={s.attentionText}><CheckCircle2 size={21} aria-hidden="true" /><div><strong>No treasury alerts</strong><p>There are no treasury alerts or accounting warnings in this snapshot.</p></div></div></div>
    );
    case "accounts": return <LiquidityAccounts treasury={treasury} strategy={strategy} accounting={accounting} />;
    case "reconciliation": return <ReconciliationGrid accounting={accounting} />;
    case "bank-accounts": return <BankAccountManager bankAccounts={bankAccounts} defaultOpen />;
    case "expenses": return <ExpenseForm expenses={expenses} bankAccounts={bankAccounts} defaultOpen />;
    case "recurring": return <RecurringExpenseForm recurringExpenses={recurringExpenses} bankAccounts={bankAccounts} defaultOpen />;
    case "bank-fees": return <BankTransferFees />;
    case "capital": return (
      <div>
        <div className={s.capitalSummary}>
          <div className={s.capitalCard}>
            <span>بدهی به مالک (تومان)</span>
            <strong dir="ltr">{fmtIRT(accounting.ownerLoanBalanceIRT)}</strong>
            <small>عدد مثبت یعنی مبلغی که باید به مالک بازپرداخت شود.</small>
          </div>
          <div className={s.capitalCard}>
            <span>ارزش خالص کسب‌وکار (تومان)</span>
            <strong className={accounting.netBusinessValueIRT < 0 ? s.negative : undefined} dir="ltr">{fmtIRT(accounting.netBusinessValueIRT)}</strong>
            <small>کل دارایی‌ها پس از کسر تمامی بدهی‌ها.</small>
          </div>
        </div>
        <OwnerLoanForm loans={ownerLoans} bankAccounts={bankAccounts} defaultOpen />
      </div>
    );
    case "strategy": return <StrategyCenter strategy={strategy} treasury={treasury} />;
    case "inventory": return <MarketInventory treasury={treasury} strategy={strategy} />;
    case "exposure": return <ExposureSection treasury={treasury} strategy={strategy} />;
    case "profitability": return <ProfitabilitySection accounting={accounting} strategy={strategy} />;
    case "settings": return <TreasurySettings settings={settings} />;
  }
}

export default function TreasuryWorkspace({ view, data }: { view: TreasuryView; data: TreasuryPageData }) {
  const current = TREASURY_VIEWS[view];
  const sections = (Object.keys(TREASURY_VIEWS) as TreasuryView[]).filter(key => TREASURY_VIEWS[key].group === current.group);
  const alertCount = (data.strategy.alerts?.length ?? 0) + (data.strategy.accountingWarnings?.length ?? 0);

  return (
    <div className={s.workspace}>
      <nav className={s.navigation} aria-label="Treasury workspaces">
        {TREASURY_GROUPS.map(group => {
          const active = group.id === current.group;
          const Icon = GROUP_ICONS[group.id];
          return <Link key={group.id} href={treasuryViewHref(group.view)} prefetch={false} aria-current={active ? "location" : undefined} className={`${s.navLink} ${active ? s.navLinkActive : ""}`}><Icon size={17} aria-hidden="true" />{group.label}</Link>;
        })}
      </nav>
      <section className={s.panel} aria-labelledby="treasury-workspace-title">
        <div className={s.panelHeader}>
          <div><h2 id="treasury-workspace-title">{current.title}</h2><p>{current.description}</p></div>
          {current.group !== "overview" && alertCount > 0 && <Link href={treasuryViewHref("alerts")} prefetch={false} className={s.actionLink}><CircleAlert size={15} aria-hidden="true" />{alertCount} {alertCount === 1 ? "alert" : "alerts"}</Link>}
        </div>
        {sections.length > 1 && (
          <nav className={s.subnav} aria-label={`${TREASURY_GROUPS.find(group => group.id === current.group)?.label} sections`}>
            {sections.map(section => <Link key={section} href={treasuryViewHref(section)} prefetch={false} aria-current={section === view ? "page" : undefined} className={`${s.sublink} ${section === view ? s.sublinkActive : ""}`}>{TREASURY_VIEWS[section].label}{section === "alerts" && alertCount > 0 && <span className={s.count}>{alertCount}</span>}</Link>)}
          </nav>
        )}
        <div key={view} className={`${s.content} ${view !== "overview" && view !== "alerts" ? treasuryStyles.treasuryPage : ""}`} lang={view !== "overview" && view !== "alerts" ? "fa" : undefined}>
          <TreasuryContent view={view} data={data} />
        </div>
      </section>
    </div>
  );
}
