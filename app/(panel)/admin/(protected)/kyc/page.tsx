import React from "react";
import { ShieldCheck, Clock, Archive, IdCard, Hash, CalendarDays } from "lucide-react";
import { getKycQueue, getKycHistory } from "@/app/actions/admin.actions";
import { KycActionButtons } from "@/components/admin/KycActionButtons";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";

export const metadata = { title: "KYC Queue | Zarman Admin" };

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}>Pending</span>;
  
  const s = status.toLowerCase();
  if (s === "approved")
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeApproved}`}>
        <span className={tableStyles.badgeDot} />
        Approved
      </span>
    );
  if (s === "rejected")
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeRejected}`}>
        <span className={tableStyles.badgeDot} />
        Rejected
      </span>
    );
  if (s === "archived")
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}>
        <span className={tableStyles.badgeDot} />
        Archived
      </span>
    );
  if (s === "under_review")
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeReview}`}>
        <span className={tableStyles.badgeDot} />
        Under Review
      </span>
    );
    
  return (
    <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}>
      <span className={tableStyles.badgeDot} />
      Pending
    </span>
  );
}

export default async function KycQueuePage() {
  const [queue, history] = await Promise.all([getKycQueue(), getKycHistory(50)]);

  function docLabel(type: string | null | undefined) {
    if (type === "driver_license") return "Driver's Licence";
    if (type === "passport") return "Passport";
    return type ?? "—";
  }

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>KYC Verification Queue</span>
        {queue.length > 0 && (
          <div className={shellStyles.topBarActions}>
            <span className={`${tableStyles.badge} ${tableStyles.badgePending} ${tableStyles.badgeCompact}`}>
              {queue.length} Pending Review
            </span>
          </div>
        )}
      </div>

      <div className={shellStyles.pageContent}>
        {/* Header Section */}
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <ShieldCheck size={24} strokeWidth={2.5} />
              </span>
              Identity Verification
            </h1>
            <p className={cardStyles.sectionDesc}>
              Review and approve customer identity documents. Approving unlocks the transaction section for that customer. Archive incomplete or abandoned submissions to keep the queue clean.
            </p>
          </div>
        </div>

        {/* 1. Awaiting Review Panel (Active Queue) */}
        <div className={`${cardStyles.panel} ${queue.length > 0 ? cardStyles.panelWarning : ""}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={`${cardStyles.panelTitle} ${queue.length > 0 ? cardStyles.panelTitleWarning : ""}`}>
              <Clock size={18} />
              Awaiting Review ({queue.length})
            </h2>
          </div>
          
          {queue.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateLoose}`}>
              <div className={cardStyles.emptyStateIcon}>
                <ShieldCheck size={24} />
              </div>
              <div className={cardStyles.emptyStateText}>
                No pending KYC applications. All clear!
              </div>
            </div>
          ) : (
            <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder} ${tableStyles.tableWrapTopFlat}`}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Customer Info</th>
                    <th>Contact</th>
                    <th>DOB</th>
                    <th>Address</th>
                    <th>Identity Document</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((user) => {
                    const anyDocNum =
                      (user as Record<string, unknown>).license_number as string | null |undefined ||
                      (user as Record<string, unknown>).passport_number as string | null | undefined;
                    const licenceNum  = (user as Record<string, unknown>).license_number  as string | null | undefined;
                    const cardNum     = (user as Record<string, unknown>).card_number     as string | null | undefined;
                    const passNum     = (user as Record<string, unknown>).passport_number as string | null | undefined;
                    const expiryDate  = (user as Record<string, unknown>).expiry_date     as string | null | undefined;

                    return (
                      <tr key={user.id} className={tableStyles.rowTintWarning}>
                        <td>
                          <div className={tableStyles.cellStrong}>
                            {user.first_name} {user.last_name}
                          </div>
                          <div className={`${tableStyles.cellSmall} ${tableStyles.cellDim} ${tableStyles.cellSubtleTop}`}>
                            Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString("en-AU") : "—"}
                          </div>
                        </td>
                        <td>
                          <div className={`${tableStyles.cellDim} ${tableStyles.cellSmallEmail}`}>{user.email ?? "—"}</div>
                          <div className={`${tableStyles.cellMono} ${tableStyles.cellDim} ${tableStyles.cellSmallPhone}`}>
                            {user.mobile_number ?? "—"}
                          </div>
                        </td>
                        <td className={`${tableStyles.cellMono} ${tableStyles.cellDim}`}>
                          {user.dob ?? "—"}
                        </td>
                        <td
                          className={`${tableStyles.cellTruncate} ${tableStyles.cellDim} ${tableStyles.cellMax150}`}
                          title={[user.address, user.city, user.state, user.country].filter(Boolean).join(", ")}
                        >
                          {[user.address, user.city, user.state].filter(Boolean).join(", ") || "—"}
                        </td>
                        {/* Identity Document */}
                        <td>
                          {anyDocNum ? (
                            <div>
                              <div className={`${tableStyles.cellStrong}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <IdCard size={13} />
                                {docLabel(user.document_type)}
                              </div>
                              {user.document_type === "driver_license" && (
                                <div 
                                  className={`${tableStyles.cellSmall} ${tableStyles.cellDim} ${tableStyles.cellMono}`}
                                  style={{ display: 'flex', flexDirection: 'column', gap: '3px', whiteSpace: 'nowrap' }}
                                >
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Licence No.">
                                    <Hash size={10} /> {licenceNum ?? "—"}
                                    {cardNum && <span style={{ opacity: 0.6 }}>| Card: {cardNum}</span>}
                                  </span>
                                  {expiryDate && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Expiry Date">
                                      <CalendarDays size={10} /> Exp: {expiryDate}
                                    </span>
                                  )}
                                </div>
                              )}
                              {user.document_type === "passport" && (
                                <div 
                                  className={`${tableStyles.cellSmall} ${tableStyles.cellDim} ${tableStyles.cellMono}`}
                                  style={{ display: 'flex', flexDirection: 'column', gap: '3px', whiteSpace: 'nowrap' }}
                                >
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Passport No.">
                                    <Hash size={10} /> {passNum ?? "—"}
                                  </span>
                                  {expiryDate && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Expiry Date">
                                      <CalendarDays size={10} /> Exp: {expiryDate}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className={`${tableStyles.badge} ${tableStyles.badgePending}`} title="No document number on record">
                              Not Provided
                            </span>
                          )}
                        </td>
                        <td><StatusBadge status={user.kyc_status} /></td>
                        <td>
                          <KycActionButtons userId={user.id} currentStatus={user.kyc_status ?? undefined} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2. KYC History Panel (با لیمیت 50 نفر و استایل بهینه) */}
        <div className={`${cardStyles.panel} ${cardStyles.panelSoft} ${cardStyles.panelMt}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={cardStyles.panelTitle}>
              <Archive size={18} color="var(--text-dim)" />
              Recent History (Last 50 records)
            </h2>
          </div>
          
          {history.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact} ${cardStyles.emptyStateWithTopBorder}`}>
              <div className={`${cardStyles.emptyStateText} ${cardStyles.emptyStateDim}`}>
                No history records found.
              </div>
            </div>
          ) : (
            <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder} ${tableStyles.tableWrapTopFlat}`}>
              <table className={tableStyles.table}>
                <thead className={tableStyles.theadTransparent}>
                  <tr>
                    <th>Customer Name</th>
                    <th>Email</th>
                    <th>Document Type</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((user) => (
                    <tr key={user.id}>
                      <td className={tableStyles.cellStrong}>
                        {user.first_name} {user.last_name}
                      </td>
                      <td className={tableStyles.cellDim}>{user.email ?? "—"}</td>
                      <td className={`${tableStyles.cellDim} ${tableStyles.cellCapitalize}`}>
                        {docLabel(user.document_type)}
                      </td>
                      <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                        {user.created_at ? new Date(user.created_at).toLocaleDateString("en-AU") : "—"}
                      </td>
                      <td><StatusBadge status={user.kyc_status} /></td>
                      <td>
                        <KycActionButtons userId={user.id} currentStatus={user.kyc_status ?? undefined} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* بخش Footer برای راهنمای Pagination */}
          {history.length >= 50 && (
            <div className={tableStyles.paginationFooter}>
               <button className={tableStyles.paginationBtn} disabled>
                 Previous
               </button>
               <span className={tableStyles.paginationNote}>
                 Showing top 50 records
               </span>
               <button className={tableStyles.paginationBtn}>
                 Next
               </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}