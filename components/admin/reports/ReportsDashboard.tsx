"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, RefreshCw } from "lucide-react";
import { refreshEnterpriseReports } from "@/app/actions/report.actions";
import type { EnterpriseReportData, ReportDashboard, ReportKpi } from "@/lib/reporting/types";
import styles from "@/styles/admin/Reports.module.css";

const ReportsCharts = dynamic(() => import("./ReportsCharts"), { ssr: false, loading: () => <div className={styles.chartLoading}>Loading charts...</div> });
const fmt = (value: number, digits = 0) => value.toLocaleString("en-AU", { maximumFractionDigits: digits });

function formatMetric(metric: ReportKpi): string {
  if (metric.format === "percent") return `${fmt(metric.value, 1)}%`;
  if (metric.format === "aud") return `${fmt(metric.value, 2)} AUD`;
  if (metric.format === "number") return fmt(metric.value);
  return `${fmt(metric.value)}${metric.format === "irt" ? " IRT" : ""}`;
}

function KpiCard({ metric }: { metric: ReportKpi }) {
  const rawPositive = (metric.changePercent ?? 0) >= 0;
  const favorable = metric.positiveIsGood ? rawPositive : !rawPositive;
  return (
    <Link href={metric.drilldownHref} className={styles.kpiCard}>
      <div className={styles.kpiTop}><span>{metric.label}</span><ArrowRight size={14}/></div>
      <strong>{formatMetric(metric)}</strong>
      <div className={styles.kpiFooter}>
        <span className={favorable ? styles.trendGood : styles.trendBad}>
          {rawPositive ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {metric.changePercent === null ? "New" : `${Math.abs(metric.changePercent).toFixed(1)}%`}
        </span>
        <span>Prev. {fmt(metric.previousValue, metric.format === "aud" ? 2 : 0)}</span>
      </div>
    </Link>
  );
}

function StatementRows({ dashboard }: { dashboard: ReportDashboard }) {
  const href = `/admin/ledger?start=${dashboard.period.start}&end=${dashboard.period.end}`;
  const rows = [
    ["Revenue", dashboard.profitAndLoss.revenue], ["Trading profit", dashboard.profitAndLoss.tradingProfit],
    ["Fee income", dashboard.profitAndLoss.feeIncome], ["Other income", dashboard.profitAndLoss.otherIncome],
    ["Total income", dashboard.profitAndLoss.totalIncome], ["Total expenses", -dashboard.profitAndLoss.totalExpenses],
    ["Operating profit", dashboard.profitAndLoss.operatingProfit], ["FX gain / loss", dashboard.profitAndLoss.fxGainLoss],
    ["Net profit", dashboard.profitAndLoss.netProfit],
  ] as const;
  return <div className={styles.statement}>{rows.map(([label, value], index) => <Link href={href} className={index === 4 || index === 8 ? styles.statementTotal : styles.statementRow} key={label}><span>{label}</span><strong className={value < 0 ? styles.negative : ""}>{fmt(value)} IRT</strong></Link>)}</div>;
}

function exportCsv(data: EnterpriseReportData) {
  const headers = ["Date","Revenue","Expenses","Trading Profit","Fee Income","Net Profit","Transactions","Average Rate","AUD Bought","AUD Sold","Cash Flow"];
  const rows = data.dashboard.series.map((row) => [row.date,row.revenue,row.expenses,row.tradingProfit,row.feeIncome,row.netProfit,row.transactionCount,row.averageRate,row.audBought,row.audSold,row.cashFlow]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `zarman-report-${data.dashboard.period.start}-${data.dashboard.period.end}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

export function ReportsDashboard({ data }: { data: EnterpriseReportData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const dashboard = data.dashboard;
  const ledgerHref = `/admin/ledger?start=${dashboard.period.start}&end=${dashboard.period.end}`;
  const refresh = () => startTransition(async () => {
    const result = await refreshEnterpriseReports();
    if ("error" in result) setMessage(`Error: ${result.error}`); else { setMessage("Reports refreshed."); router.refresh(); }
  });

  return (
    <main className={styles.reports}>
      <section className={styles.toolbar} aria-label="Report period controls">
        <div className={styles.presets}>{[["this-month","This Month"],["last-month","Last Month"],["quarter","Quarter"],["year","Year"]].map(([preset,label]) => <Link key={preset} className={dashboard.period.preset === preset ? styles.presetActive : styles.preset} href={`/admin/reports?preset=${preset}`}>{label}</Link>)}</div>
        <form className={styles.customRange} action="/admin/reports" suppressHydrationWarning><input type="hidden" name="preset" value="custom" suppressHydrationWarning/><input aria-label="Start date" type="date" name="start" defaultValue={dashboard.period.start} suppressHydrationWarning/><span>to</span><input aria-label="End date" type="date" name="end" defaultValue={dashboard.period.end} suppressHydrationWarning/><button type="submit">Apply</button></form>
        <div className={styles.toolbarActions}><button type="button" onClick={() => exportCsv(data)}><Download size={15}/> CSV</button><button type="button" onClick={refresh} disabled={isPending}><RefreshCw size={15} className={isPending ? styles.spin : ""}/> Refresh</button></div>
      </section>

      {(data.refresh.isStale || message) && <div className={data.refresh.lastError || message?.startsWith("Error") ? styles.errorBanner : styles.staleBanner}><span>{message ?? "New ledger activity is waiting for a reporting refresh."}</span>{data.refresh.staleSince && <small>Stale since {new Date(data.refresh.staleSince).toLocaleString("en-AU")}</small>}</div>}
      {!dashboard.freshness && <div className={styles.emptyState}><h2>Reporting read model is empty</h2><p>Run the first refresh after applying the reporting migration.</p><button type="button" onClick={refresh} disabled={isPending}><RefreshCw size={16}/> Build reports</button></div>}

      <section><div className={styles.sectionTitle}><div><span>Executive view</span><h2>Financial pulse</h2></div><p>{dashboard.period.label}</p></div><div className={styles.kpiGrid}>{dashboard.kpis.map((metric) => <KpiCard key={metric.key} metric={metric}/>)}</div></section>
      <ReportsCharts dashboard={dashboard}/>

      <div className={styles.twoColumn}>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Profit & Loss</h2><p>Accrual-oriented operating statement</p></div><Link href={ledgerHref}>Drill down <ArrowRight size={14}/></Link></div><StatementRows dashboard={dashboard}/></section>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Cash Flow</h2><p>Sources and uses of cash</p></div><Link href={ledgerHref}>Drill down <ArrowRight size={14}/></Link></div><div className={styles.statement}>{[["Customer payments in",dashboard.cashFlow.customerPaymentsIn],["Owner injection",dashboard.cashFlow.ownerInjection],["Transfers in",dashboard.cashFlow.transfersIn],["Money in",dashboard.cashFlow.moneyIn],["Customer payments out",-dashboard.cashFlow.customerPaymentsOut],["Expenses",-dashboard.cashFlow.expenses],["Loan repayment",-dashboard.cashFlow.ownerLoanRepayment],["Transfers out",-dashboard.cashFlow.transfersOut],["Net cash flow",dashboard.cashFlow.netCashFlow]].map(([label,value], index) => <Link href={ledgerHref} className={index === 3 || index === 8 ? styles.statementTotal : styles.statementRow} key={String(label)}><span>{label}</span><strong className={Number(value) < 0 ? styles.negative : ""}>{fmt(Number(value))} IRT</strong></Link>)}</div></section>
      </div>

      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Monthly & Period Comparison</h2><p>Financial and operating performance by day; CSV preserves the complete dataset</p></div><button type="button" onClick={() => exportCsv(data)}><Download size={14}/> Export</button></div><div className={styles.tableWrap}><table><thead><tr><th>Period</th><th>Revenue</th><th>Expenses</th><th>Trading Profit</th><th>Fee Income</th><th>Net Profit</th><th>Transactions</th><th>Avg. Rate</th><th>AUD Bought</th><th>AUD Sold</th><th>Cash Flow</th></tr></thead><tbody>{dashboard.series.map((row) => <tr key={row.date}><td><Link href={`${ledgerHref}&date=${row.date}`}>{row.date}</Link></td>{[row.revenue,row.expenses,row.tradingProfit,row.feeIncome,row.netProfit,row.transactionCount,row.averageRate,row.audBought,row.audSold,row.cashFlow].map((value,index) => <td key={index}><Link href={`${ledgerHref}&date=${row.date}`}>{fmt(value, index > 6 && index < 9 ? 2 : 0)}</Link></td>)}</tr>)}</tbody></table></div></section>

      <div className={styles.analyticsGrid}>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Inventory Analytics</h2><p>Moving weighted average inventory</p></div></div><div className={styles.metricList}>{[["Opening inventory",dashboard.inventory.opening,"AUD"],["AUD purchased",dashboard.inventory.purchased,"AUD"],["AUD sold",dashboard.inventory.sold,"AUD"],["Closing inventory",dashboard.inventory.closing,"AUD"],["Inventory growth",dashboard.inventory.growth,"%"],["Turnover",dashboard.inventory.turnover,"x"],["Days of inventory",dashboard.inventory.daysOfInventory ?? 0,"days"],["Average cost",dashboard.inventory.averageCost,"IRT"]].map(([label,value,unit]) => <Link href={ledgerHref} key={String(label)}><span>{label}</span><strong>{fmt(Number(value),2)} {unit}</strong></Link>)}</div></section>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Transaction Analytics</h2><p>Size, direction and fee profile</p></div></div><div className={styles.metricList}>{[["Transactions",dashboard.transactions.count],["Buy count",dashboard.transactions.buyCount],["Sell count",dashboard.transactions.sellCount],["Average size",dashboard.transactions.averageSize],["Largest",dashboard.transactions.largest],["Smallest",dashboard.transactions.smallest],["Average fee",dashboard.transactions.averageFee]].map(([label,value]) => <Link href={ledgerHref} key={String(label)}><span>{label}</span><strong>{fmt(Number(value),2)}</strong></Link>)}</div></section>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Exchange Rate Analytics</h2><p>Executed trade rates</p></div></div><div className={styles.metricList}>{[["Average buy",dashboard.rates.averageBuy],["Average sell",dashboard.rates.averageSell],["Spread",dashboard.rates.spread],["Highest",dashboard.rates.highest],["Lowest",dashboard.rates.lowest]].map(([label,value]) => <Link href={ledgerHref} key={String(label)}><span>{label}</span><strong>{fmt(Number(value))}</strong></Link>)}</div></section>
      </div>

      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Treasury Analytics</h2><p>Every active bank account</p></div><Link href="/admin/treasury">Open treasury <ArrowRight size={14}/></Link></div><div className={styles.tableWrap}><table><thead><tr><th>Account</th><th>Opening</th><th>Deposits</th><th>Withdrawals</th><th>Transfers</th><th>Closing</th><th>Net movement</th></tr></thead><tbody>{data.accounts.map((account) => <tr key={account.id}><td><Link href={`/admin/reports/accounts?account=${account.id}&start=${dashboard.period.start}&end=${dashboard.period.end}`}>{account.name} <small>{account.currency}</small></Link></td>{[account.openingBalance,account.deposits,account.withdrawals,account.transfers,account.closingBalance,account.netMovement].map((value,index) => <td key={index}><Link href={`${ledgerHref}&account=${account.id}`}>{fmt(value,2)}</Link></td>)}</tr>)}</tbody></table></div></section>

      <div className={styles.twoColumn}>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Customer Analytics</h2><p>Retention and cohort quality</p></div></div><div className={styles.customerHeadline}><Link href="/admin/users"><span>New customers</span><strong>{dashboard.customers.newCustomers}</strong></Link><Link href="/admin/users"><span>Returning</span><strong>{dashboard.customers.returningCustomers}</strong></Link><Link href="/admin/users"><span>Retention</span><strong>{fmt(dashboard.customers.retention,1)}%</strong></Link></div><div className={styles.rankList}>{data.topCustomers.map((customer,index) => <Link href={`/admin/users?user=${customer.id}`} key={customer.id}><b>{index + 1}</b><span><strong>{customer.name}</strong><small>{customer.customerCode ?? "No code"} · {customer.transactionCount} transactions</small></span><em>{fmt(customer.audVolume,2)} AUD</em></Link>)}</div></section>
        <section className={styles.exportPanel}><div><span>Export Center</span><h2>Portable financial data</h2><p>Download the selected period with revenue, costs, profit, rates, inventory movement and cash flow.</p></div><button type="button" onClick={() => exportCsv(data)}><Download size={18}/> Download CSV</button><small>Generated locally from the authorized report payload. No credentials or customer identity fields are exported.</small></section>
      </div>
    </main>
  );
}