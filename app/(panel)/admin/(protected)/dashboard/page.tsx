import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeftRight,
  MessageSquare,
  Users,
  CheckCircle,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { getAdminStats, getAuditLogs } from "@/app/actions/admin.actions";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";

export const metadata = { title: "Dashboard | Zarman Admin" };

export default async function AdminDashboardPage() {
  const [stats, recentLogs] = await Promise.all([
    getAdminStats(),
    getAuditLogs(0, 7),
  ]);

  const actionCards = [
    {
      label: "Pending KYC",
      value: stats.pendingKycCount,
      icon: <ShieldCheck size={22} strokeWidth={1.5} />,
      colorClass: cardStyles.statIconWarning,
      href: "/admin/kyc",
    },
    {
      label: "Pending Transactions",
      value: stats.pendingTxCount,
      icon: <ArrowLeftRight size={22} strokeWidth={1.5} />,
      colorClass: cardStyles.statIconDanger,
      href: "/admin/transactions",
    },
    {
      label: "Pending Feedback",
      value: stats.pendingFeedbackCount,
      icon: <MessageSquare size={22} strokeWidth={1.5} />,
      colorClass: cardStyles.statIconInfo,
      href: "/admin/feedback",
    },
  ];

  const infoCards = [
    {
      label: "Total Users",
      value: stats.totalUsersCount,
      icon: <Users size={22} strokeWidth={1.5} />,
      colorClass: cardStyles.statIconAccent,
    },
    {
      label: "Approved Transactions",
      value: stats.approvedTxCount,
      icon: <CheckCircle size={22} strokeWidth={1.5} />,
      colorClass: cardStyles.statIconSuccess,
    },
  ];

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Dashboard Overview</span>
      </div>

      <div className={shellStyles.pageContent}>
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <Activity size={24} strokeWidth={2.5} />
              </span>
              Welcome to Control Panel
            </h1>
            <p className={cardStyles.sectionDesc}>
              Real-time summary of pending tasks and platform activity for Zarman Exchange.
            </p>
          </div>
        </div>

        {/* Action Cards (Compact Style) */}
        <div className={`${cardStyles.statsGrid} ${cardStyles.statsGridMb1}`}>
          {actionCards.map((s) => (
            <Link key={s.label} href={s.href} className={cardStyles.linkReset}>
              <div className={`${cardStyles.statCardCompact} ${cardStyles.statCardInteractive}`}>
                <div className={`${cardStyles.statIconCompact} ${s.colorClass}`}>
                  {s.icon}
                </div>
                <div className={cardStyles.statInfo}>
                  <div className={cardStyles.statValue}>{s.value}</div>
                  <div className={cardStyles.statLabel}>{s.label}</div>
                </div>
                <div className={cardStyles.statActionArrow}>
                  <ArrowUpRight size={18} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info Cards (Compact Style) */}
        <div className={`${cardStyles.statsGrid} ${cardStyles.statsGridMb2}`}>
          {infoCards.map((s) => (
            <div key={s.label} className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${s.colorClass}`}>
                {s.icon}
              </div>
              <div className={cardStyles.statInfo}>
                <div className={cardStyles.statValue}>{s.value}</div>
                <div className={cardStyles.statLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity Table */}
        <div className={cardStyles.panel}>
          <div className={`${cardStyles.panelHeader} ${cardStyles.panelHeaderSpacious}`}>
            <h2 className={cardStyles.panelTitle}>
              <Activity size={18} color="var(--accent)" />
              Recent Activity
            </h2>
            <Link href="/admin/audit" className={cardStyles.linkAccent}>
              View Full Audit Log &rarr;
            </Link>
          </div>
          
          <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapNoBorder} ${tableStyles.tableWrapTopFlat}`}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateLoose}`}>
                        <div className={cardStyles.emptyStateText}>No recent activities found.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((log) => (
                    <tr key={log.id}>
                      <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                        {new Date(log.created_at).toLocaleString("en-AU", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className={`${tableStyles.cellSmall} ${tableStyles.cellTruncate}`}>
                        {log.actor_email}
                      </td>
                      <td>
                        <span
                          className={`${tableStyles.badge} ${
                            log.action.includes("APPROVE") || log.action.includes("APPROVED")
                              ? tableStyles.badgeApproved
                              : log.action.includes("REJECT") || log.action.includes("REJECTED")
                              ? tableStyles.badgeRejected
                              : tableStyles.badgePending
                          }`}
                        >
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={`${tableStyles.cellDim} ${tableStyles.cellSmall}`}>
                        <span className={tableStyles.cellUpper}>{log.target_type ?? "—"}</span>
                        {log.target_id ? <span className={tableStyles.cellMono}> · {log.target_id.slice(0, 8)}…</span> : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}