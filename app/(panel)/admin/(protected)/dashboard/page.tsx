import Link from "next/link";
import { ShieldCheck, ArrowLeftRight, MessageSquare, Users, CheckCircle2, ArrowUpRight, ArrowRight, BookOpen, TrendingUp, ChartNoAxesCombined, Clock3, CalendarDays } from "lucide-react";
import { getAdminStats, getAuditLogs } from "@/app/actions/admin.actions";
import { AdminRefreshButton } from "@/components/admin/ui/AdminRefreshButton";
import shell from "@/styles/admin/AdminShell.module.css";
import table from "@/styles/admin/AdminTable.module.css";
import styles from "@/styles/admin/AdminDashboard.module.css";

export const metadata = { title: "Overview | Zarman Admin" };

export default async function AdminDashboardPage() {
  const [stats, logs] = await Promise.all([getAdminStats(), getAuditLogs(1, 7)]);
  const pendingCount = stats.pendingKycCount + stats.pendingTxCount + stats.pendingFeedbackCount;
  const updatedAt = new Date();
  const number = new Intl.NumberFormat("en-AU");
  const queues = [
    { label: "Transactions", value: stats.pendingTxCount, description: "Transfers waiting for your review", href: "/admin/transactions", icon: ArrowLeftRight, tone: styles.indigo, action: "Review transactions" },
    { label: "Identity verification", value: stats.pendingKycCount, description: "Customer identities to verify", href: "/admin/kyc", icon: ShieldCheck, tone: styles.amber, action: "Open verification queue" },
    { label: "Feedback", value: stats.pendingFeedbackCount, description: "Customer feedback to moderate", href: "/admin/feedback", icon: MessageSquare, tone: styles.blue, action: "Review feedback" },
  ];
  const shortcuts = [
    { href: "/admin/users", label: "Find a customer", detail: "Profiles, recipients and history", icon: Users },
    { href: "/admin/ledger", label: "Open the ledger", detail: "Balances and account movements", icon: BookOpen },
    { href: "/admin/treasury", label: "Manage treasury", detail: "Liquidity, expenses and capital", icon: TrendingUp },
    { href: "/admin/reports", label: "Explore reports", detail: "Performance and account statements", icon: ChartNoAxesCombined },
  ];

  return <>
    <header className={shell.topBar}>
      <div className={styles.breadcrumb}><span>Workspace</span><span aria-hidden="true">/</span><span className={shell.pageTitle}>Overview</span></div>
      <div className={shell.topBarActions}><AdminRefreshButton /></div>
    </header>
    <div className={shell.pageContent}>
      <div className={styles.dashboard}>
        <section className={styles.pageHeading} aria-labelledby="overview-title">
          <div><p className={styles.eyebrow}>YOUR OPERATIONS, AT A GLANCE</p><h1 id="overview-title">Workspace overview</h1><p>Review what needs attention and keep your exchange moving.</p></div>
          <div className={styles.date}><CalendarDays size={15} /><time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })}</time><span>Sydney</span></div>
        </section>

        <div className={`${styles.attentionBanner} ${pendingCount === 0 ? styles.allClear : ""}`}>
          <span className={styles.attentionIcon}>{pendingCount > 0 ? <Clock3 size={19} /> : <CheckCircle2 size={19} />}</span>
          <div><strong>{pendingCount > 0 ? `${number.format(pendingCount)} item${pendingCount === 1 ? "" : "s"} need${pendingCount === 1 ? "s" : ""} your attention` : "Your review queues are clear"}</strong><p>{pendingCount > 0 ? "Start with the queues below to review outstanding requests." : "No pending transactions, identity checks or feedback at this time."}</p></div>
          <span className={styles.snapshot}>Updated {updatedAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Sydney" })} Sydney</span>
        </div>

        <section aria-label="Pending review queues" className={styles.queueGrid}>
          {queues.map(({ icon: Icon, ...queue }) => <Link href={queue.href} key={queue.href} className={styles.queueCard}>
            <div className={styles.queueHeader}><span className={`${styles.iconBox} ${queue.tone}`}><Icon size={20} strokeWidth={1.7} /></span><span className={styles.queueStatus}>{queue.value > 0 ? "Awaiting review" : "Up to date"}</span></div>
            <div className={styles.queueValue}>{number.format(queue.value)}</div>
            <h2>{queue.label}</h2><p>{queue.description}</p>
            <div className={styles.queueAction}>{queue.action}<ArrowUpRight size={16} /></div>
          </Link>)}
        </section>

        <section className={styles.totals} aria-label="Platform totals">
          <div><Users size={18} /><span>Total customers</span><strong>{number.format(stats.totalUsersCount)}</strong><span className={styles.totalPeriod}>All time</span></div>
          <div><CheckCircle2 size={18} /><span>Approved transactions</span><strong>{number.format(stats.approvedTxCount)}</strong><span className={styles.totalPeriod}>All time</span></div>
        </section>

        <div className={styles.detailGrid}>
          <section className={styles.panel} aria-labelledby="activity-heading">
            <div className={styles.panelHeader}><div><h2 id="activity-heading">Recent activity</h2><p>The latest actions across your workspace</p></div><Link href="/admin/audit">View audit log <ArrowUpRight size={14} /></Link></div>
            <div className={table.tableWrap} role="region" aria-label="Recent admin activity" tabIndex={0}>
              <table className={`${table.table} ${styles.activityTable}`}>
                <thead><tr><th scope="col">Action</th><th scope="col">Administrator</th><th scope="col">Time · Sydney</th></tr></thead>
                <tbody>{logs.data.length === 0 ? <tr><td colSpan={3}><div className={styles.emptyState}><Clock3 size={24} /><strong>No recent activity</strong><span>Administrative actions will appear here as your team works.</span></div></td></tr> : logs.data.map(log => <tr key={log.id}>
                  <td><span className={`${table.badge} ${log.action.includes("APPROV") ? table.badgeApproved : log.action.includes("REJECT") ? table.badgeRejected : table.badgePending}`}>{log.action.replace(/_/g, " ")}</span><span className={styles.activityTarget}>{log.target_type?.replace(/_/g, " ") ?? "System"}{log.target_id ? ` · ${log.target_id.slice(0, 8)}` : ""}</span></td>
                  <td><span className={styles.actor} title={log.actor_email ?? undefined}>{log.actor_email || "Administrator"}</span></td>
                  <td><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Australia/Sydney" })}</time></td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>
          <section className={styles.panel} aria-labelledby="shortcuts-heading">
            <div className={styles.panelHeader}><div><h2 id="shortcuts-heading">Quick access</h2><p>Your everyday tools, one click away</p></div></div>
            <div className={styles.shortcuts}>{shortcuts.map(({ icon: Icon, ...link }) => <Link href={link.href} key={link.href} className={styles.shortcut}><span className={styles.shortcutIcon}><Icon size={18} strokeWidth={1.7} /></span><span><strong>{link.label}</strong><small>{link.detail}</small></span><ArrowRight size={15} /></Link>)}</div>
          </section>
        </div>
      </div>
    </div>
  </>;
}
