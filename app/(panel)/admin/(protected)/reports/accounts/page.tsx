import Link from "next/link";
import { Landmark, MoveLeft } from "lucide-react";
import { getReportAccountStatement } from "@/app/actions/report.actions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/Reports.module.css";

export const metadata = { title: "Account Statement | Zarman Admin" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function AccountStatementPage({ searchParams }: {
  searchParams: Promise<{ account?: string; start?: string; end?: string; page?: string }>;
}) {
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const statement = await getReportAccountStatement({
    accountId: params.account,
    start: params.start ?? monthStart,
    end: params.end ?? today,
    page: Number(params.page ?? 1),
  });
  const selected = statement.accounts.find((account) => account.id === statement.selectedAccount);

  return (
    <>
      <div className={shellStyles.topBar}>
        <div className={styles.heading}><span className={styles.headingIcon}><Landmark size={20}/></span><div><h1>Account Statement</h1><p>{selected ? `${selected.name} · ${selected.currency}` : "Select an active bank account"}</p></div></div>
        <Link className={styles.backLink} href={`/admin/reports?preset=custom&start=${statement.period.start}&end=${statement.period.end}`}><MoveLeft size={15}/> Reports</Link>
      </div>
      <div className={shellStyles.pageContent}>
        <main className={styles.reports}>
          <form className={styles.statementFilters} action="/admin/reports/accounts">
            <label>Bank account<select name="account" defaultValue={statement.selectedAccount ?? ""}>{statement.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}</select></label>
            <label>From<input type="date" name="start" defaultValue={statement.period.start}/></label>
            <label>To<input type="date" name="end" defaultValue={statement.period.end}/></label>
            <button type="submit">Generate statement</button>
          </form>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>{selected?.name ?? "Account"}</h2><p>{statement.period.label} · {statement.total.toLocaleString("en-AU")} movements</p></div></div>
            <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Running Balance</th></tr></thead><tbody>{statement.rows.map((row) => <tr key={row.ledgerId}><td><Link href={`/admin/ledger?start=${row.date}&end=${row.date}`}>{row.date}</Link></td><td><Link href={`/admin/ledger?search=${encodeURIComponent(row.description)}`}>{row.description}</Link></td><td className={styles.negative}>{row.debit ? row.debit.toLocaleString("en-AU", { maximumFractionDigits: 2 }) : "-"}</td><td>{row.credit ? row.credit.toLocaleString("en-AU", { maximumFractionDigits: 2 }) : "-"}</td><td><strong>{row.balance.toLocaleString("en-AU", { maximumFractionDigits: 2 })}</strong></td></tr>)}</tbody></table></div>
            {!statement.rows.length && <div className={styles.chartEmpty}>No account movements in this period</div>}
            <AdminPagination currentPage={statement.page} totalCount={statement.total} pageSize={PAGE_SIZE}/>
          </section>
        </main>
      </div>
    </>
  );
}