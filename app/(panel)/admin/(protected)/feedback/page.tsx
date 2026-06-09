import React from "react";
import Link from "next/link";
import { MessageSquare, Star, Clock, Archive } from "lucide-react";
import { getFeedbackQueue, getFeedbackHistory } from "@/app/actions/admin.actions";
import { FeedbackModerateButtons } from "@/components/admin/FeedbackModerateButtons";
import { AdminPagination } from "@/components/admin/AdminPagination";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";

export const metadata = { title: "Feedback Moderation | Zarman Admin" };

const PAGE_SIZE = 10;

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeApproved}`}>
        <span className={tableStyles.badgeDot} />
        Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeRejected}`}>
        <span className={tableStyles.badgeDot} />
        Rejected
      </span>
    );
  return (
    <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}>
      <span className={tableStyles.badgeDot} />
      Pending
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className={tableStyles.stars}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          fill={s <= rating ? "currentColor" : "none"}
          className={`${s <= rating ? tableStyles.starFilled : tableStyles.starEmpty} ${tableStyles.iconShiftRight}`}
        />
      ))}
    </span>
  );
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [pending, { data: moderated, total }] = await Promise.all([
    getFeedbackQueue(),
    getFeedbackHistory(currentPage, PAGE_SIZE),
  ]);

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Feedback Moderation</span>
        {pending.length > 0 && (
          <span className={`${tableStyles.badge} ${tableStyles.badgePending} ${tableStyles.badgeCompact}`}>
            {pending.length} Pending Review
          </span>
        )}
      </div>

      <div className={shellStyles.pageContent}>
        {/* Header Section */}
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <MessageSquare size={24} strokeWidth={2.5} />
              </span>
              Testimonial Moderation
            </h1>
            <p className={cardStyles.sectionDesc}>
              Approve customer feedback to display on the public testimonials section.
              Rejected items are strictly hidden from the website.
            </p>
          </div>
        </div>

        {/* 1. Pending Queue (Action Area) */}
        <div className={`${cardStyles.panel} ${pending.length > 0 ? cardStyles.panelWarning : ""}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={`${cardStyles.panelTitle} ${pending.length > 0 ? cardStyles.panelTitleWarning : ""}`}>
              <Clock size={18} />
              Awaiting Moderation ({pending.length})
            </h2>
          </div>
          {pending.length === 0 ? (
            <div className={cardStyles.emptyState}>
              <div className={cardStyles.emptyStateIcon}>
                <MessageSquare size={24} />
              </div>
              <div className={cardStyles.emptyStateText}>No feedback awaiting review at the moment.</div>
            </div>
          ) : (
            <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder} ${tableStyles.tableWrapTopFlat}`}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Rating</th>
                    <th>Message</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((f) => {
                    const profile = f.profiles as any;
                    const name = profile
                      ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
                      : "—";
                    return (
                      <tr key={f.id} className={tableStyles.rowTintWarning}>
                        <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                          {new Date(f.created_at).toLocaleDateString("en-AU", {
                            day: "2-digit", month: "2-digit", year: "2-digit",
                          })}
                        </td>
                        <td>
                          <Link href={`/admin/users?userId=${f.user_id}`} style={{ color: "inherit", textDecoration: "none" }}>
                            <div className={tableStyles.cellStrong} style={{ color: "var(--accent, #2563eb)" }}>{name}</div>
                            <div className={`${tableStyles.cellSmall} ${tableStyles.cellDim} ${tableStyles.cellSubtleTop}`}>
                              {profile?.email ?? ""}
                            </div>
                            {profile?.customer_code && (
                              <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", fontFamily: "monospace", marginTop: "2px" }}>
                                ({profile.customer_code})
                              </div>
                            )}
                          </Link>
                        </td>
                        <td>
                          <StarRating rating={f.rating ?? 5} />
                        </td>
                        <td className={tableStyles.cellMax320}>
                          <div className={`${tableStyles.cellRtl} ${tableStyles.quotePending}`}>
                            "{f.message}"
                          </div>
                        </td>
                        <td>
                          <FeedbackModerateButtons
                            feedbackId={f.id}
                            currentStatus={f.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2. Moderated History (paginated) */}
        <div className={`${cardStyles.panel} ${cardStyles.panelSoft}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={cardStyles.panelTitle}>
              <Archive size={18} color="var(--text-dim)" />
              Moderation History ({total} total)
            </h2>
          </div>
          {moderated.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact} ${cardStyles.emptyStateWithTopBorder}`}>
              <div className={`${cardStyles.emptyStateText} ${cardStyles.emptyStateDim}`}>No moderated feedback yet.</div>
            </div>
          ) : (
            <>
              <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder} ${tableStyles.tableWrapTopFlat}`}>
                <table className={tableStyles.table}>
                  <thead className={tableStyles.theadTransparent}>
                    <tr>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Rating</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moderated.map((f) => {
                      const profile = f.profiles as any;
                      const name = profile
                        ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
                        : "—";
                      return (
                        <tr key={f.id}>
                          <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                            {new Date(f.created_at).toLocaleDateString("en-AU", {
                              day: "2-digit", month: "2-digit", year: "2-digit",
                            })}
                          </td>
                          <td>
                            <Link href={`/admin/users?userId=${f.user_id}`} style={{ color: "inherit", textDecoration: "none" }}>
                              <div className={tableStyles.cellStrong} style={{ color: "var(--accent, #2563eb)" }}>{name}</div>
                              {profile?.customer_code && (
                                <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", fontFamily: "monospace", marginTop: "2px" }}>
                                  ({profile.customer_code})
                                </div>
                              )}
                            </Link>
                          </td>
                          <td>
                            <StarRating rating={f.rating ?? 5} />
                          </td>
                          <td className={tableStyles.cellMax280}>
                            <div className={`${tableStyles.cellRtl} ${tableStyles.quoteHistory}`}>
                              {f.message}
                            </div>
                          </td>
                          <td>
                            <StatusBadge status={f.status} />
                          </td>
                          <td>
                            <FeedbackModerateButtons
                              feedbackId={f.id}
                              currentStatus={f.status}
                            />
                          </td>
                        </tr>
                      );
                    })}
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