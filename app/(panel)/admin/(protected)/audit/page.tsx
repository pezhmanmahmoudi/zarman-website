import React from "react";
import { ClipboardList } from "lucide-react";
import { getAuditLogs } from "@/app/actions/admin.actions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";

export const metadata = { title: "Audit Logs | Zarman Admin" };

const PAGE_SIZE = 10;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const { data: logs, total } = await getAuditLogs(currentPage, PAGE_SIZE);

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Audit Logs</span>
      </div>

      <div className={shellStyles.pageContent}>
        <div className={cardStyles.sectionHeader}>
          <div>
            {/* استفاده از Flexbox برای ترازبندی بی‌نقص آیکون و متن */}
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <ClipboardList size={24} strokeWidth={2.5} />
              </span>
              Compliance Audit Trail
            </h1>
            <p className={cardStyles.sectionDesc}>
              Immutable log of all sensitive admin actions. Records who did what, when, and what changed.
            </p>
          </div>
        </div>

        <div className={cardStyles.panel}>
          {logs.length === 0 ? (
            <div className={cardStyles.emptyState}>
              <div className={cardStyles.emptyStateIcon}>
                <ClipboardList size={24} />
              </div>
              <div className={cardStyles.emptyStateText}>No audit log entries yet.</div>
            </div>
          ) : (
            <>
              <div className={tableStyles.tableWrap}>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Admin</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Target Type</th>
                      <th>Target ID</th>
                      <th>Before</th>
                      <th>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                          {new Date(log.created_at).toLocaleString("en-AU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className={`${tableStyles.cellSmall} ${tableStyles.cellStrong}`}>
                          {log.actor_is_admin ? log.actor_email : "—"}
                        </td>
                        <td className={`${tableStyles.cellSmall} ${tableStyles.cellStrong}`}>
                          {log.actor_email || "—"}
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
                        <td className={`${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                          {log.target_type ?? "—"}
                        </td>
                        <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                          {log.target_id ? `${log.target_id.slice(0, 12)}…` : "—"}
                        </td>
                        <td className={`${tableStyles.cellSmall} ${tableStyles.cellMax180}`}>
                          {log.old_value ? (
                            <code className={tableStyles.codeChip}>
                              {JSON.stringify(log.old_value)}
                            </code>
                          ) : (
                            <span className={tableStyles.cellDim}>—</span>
                          )}
                        </td>
                        <td className={`${tableStyles.cellSmall} ${tableStyles.cellMax180}`}>
                          {log.new_value ? (
                            <code className={tableStyles.codeChip}>
                              {JSON.stringify(log.new_value)}
                            </code>
                          ) : (
                            <span className={tableStyles.cellDim}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdminPagination
                currentPage={currentPage}
                totalCount={total}
                pageSize={PAGE_SIZE}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}