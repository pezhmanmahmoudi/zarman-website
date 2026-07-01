import React from "react";
import Link from "next/link";
import { ArrowLeftRight, Clock, DollarSign, Archive, LinkIcon } from "lucide-react";
import {
  getPendingTransactionsWithDetails,
  getTransactionHistoryWithDetails,
  getTransactionHistoryStatusCounts,
} from "@/app/actions/admin.actions";
import { TransactionApproveButton } from "@/components/admin/TransactionApproveButton";
import { createClient } from "@supabase/supabase-js";
import { SendReceiptButton } from "@/components/admin/SendReceiptButton";
import { RejectApprovedButton } from "@/components/admin/RejectApprovedButton";
import { EditableReferenceCode } from "@/components/admin/EditableReferenceCode";
import { EditableAmount } from "@/components/admin/EditableAmount";
import { AdminPagination } from "@/components/admin/AdminPagination";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import tableStyles from "@/styles/admin/AdminTable.module.css";

export const metadata = { title: "Transactions | Zarman Admin" };

const PAGE_SIZE = 10;
type HistoryStatusFilter = "all" | "approved" | "rejected" | "archived";

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (s === "approved")
    return <span className={`${tableStyles.badge} ${tableStyles.badgeApproved}`}><span className={tableStyles.badgeDot} />Approved</span>;
  if (s === "rejected")
    return <span className={`${tableStyles.badge} ${tableStyles.badgeRejected}`}><span className={tableStyles.badgeDot} />Rejected</span>;
  if (s === "archived")
    return <span className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}><span className={tableStyles.badgeDot} />Archived</span>;
  return <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}><span className={tableStyles.badgeDot} />Pending</span>;
}

type TxRow = Awaited<ReturnType<typeof getPendingTransactionsWithDetails>>[number];

/** Extracts a payment link URL embedded in reason_for_transfer (legacy) or from the payment_link field. */
function getPaymentLink(paymentLink?: string | null, reason?: string | null): string | null {
  if (paymentLink) return paymentLink;
  if (!reason) return null;
  const m = reason.match(/لینک پرداخت:\s*(\S+)/);
  return m ? m[1] : null;
}

function RecipientCell({
  recipient,
  paymentLink,
  reasonForTransfer,
}: {
  recipient: TxRow["recipients"];
  paymentLink?: string | null;
  reasonForTransfer?: string | null;
}) {
  const normalizedRecipient = Array.isArray(recipient)
    ? (recipient.find(Boolean) ?? null)
    : (recipient ?? null);

  const link = getPaymentLink(paymentLink, reasonForTransfer);
  if (!normalizedRecipient && link) {
    return (
      <div style={{ fontSize: "0.68rem", lineHeight: 1.7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: 700, color: "var(--accent, #2563eb)" }}>
          <LinkIcon size={11} />
          Payment Link
        </div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--text-dim)", fontSize: "0.63rem", textDecoration: "underline", fontWeight: 600 }}
        >
          Open payment link
        </a>
      </div>
    );
  }

  if (!normalizedRecipient) return <span style={{ color: "var(--text-dim)" }}>—</span>;

  const r = normalizedRecipient as any;
  const recipientTitle = r.account_name ?? r.full_name ?? r.label ?? "—";
  if (r.direction === "aud") {
    return (
      <div style={{ fontSize: "0.68rem", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700 }}>{recipientTitle}</div>
        {r.bank_name && <div>{r.bank_name}</div>}
        {r.bsb && <div style={{ color: "var(--text-dim)" }}>BSB {r.bsb}</div>}
        {r.account_number && <div style={{ color: "var(--text-dim)" }}>Acc {r.account_number}</div>}
      </div>
    );
  }

  const isMelli = r.bank_type === "bank_melli";
  return (
    <div style={{ fontSize: "0.68rem", lineHeight: 1.7 }}>
      <div style={{ fontWeight: 700 }}>{recipientTitle}</div>
      <div>{isMelli ? "Bank Melli" : (r.bank_name ?? "Iranian Bank")}</div>
      {isMelli
        ? r.card_number && <div style={{ color: "var(--text-dim)" }}>Card {r.card_number}</div>
        : r.shaba_number && <div style={{ color: "var(--text-dim)" }}>Shaba {r.shaba_number}</div>
      }
    </div>
  );
}

function TxTable({
  rows,
  isPending,
  bankAccounts = [], // 🌟 دریافت کشوها از پراپ
}: {
  rows: TxRow[];
  isPending: boolean;
  bankAccounts?: any[];
}) {
  return (
    <div className={`${tableStyles.tableWrap} ${tableStyles.tableWrapTopBorder} ${tableStyles.tableWrapTopFlat}`}>
      <table className={tableStyles.table}>
        <thead className={isPending ? undefined : tableStyles.theadTransparent}>
          <tr>
            <th>Reference</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Type</th>
            <th>AUD ($)</th>
            <th>Toman (IRT)</th>
            <th>Recipient</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => {
            const profile = tx.profiles as any;
            const name = profile
              ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
              : "—";
            const customerCode = profile?.customer_code as string | null | undefined;

            return (
              <tr
                key={tx.id}
                className={isPending ? tableStyles.rowTintWarning : tableStyles.rowTransparent}
              >
                {/* Reference — editable */}
                <td>
                  <EditableReferenceCode
                    transactionId={tx.id}
                    currentCode={(tx as any).reference_code ?? null}
                  />
                </td>

                {/* Customer — link to user profile */}
                <td>
                  <Link
                    href={`/admin/users?userId=${tx.user_id}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    <div className={tableStyles.cellStrong} style={{ color: "var(--accent, #2563eb)" }}>
                      {name || "Unknown"}
                    </div>
                    <div className={`${tableStyles.cellSmall} ${tableStyles.cellDim} ${tableStyles.cellSubtleTop}`}>
                      {profile?.email ?? "—"}
                    </div>
                    {customerCode && (
                      <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", fontFamily: "monospace", marginTop: "2px" }}>
                        ({customerCode})
                      </div>
                    )}
                  </Link>
                </td>

                {/* Date */}
                <td className={`${tableStyles.cellMono} ${tableStyles.cellSmall} ${tableStyles.cellDim}`}>
                  {new Date(tx.created_at).toLocaleString("en-AU", {
                    day: "2-digit", month: "2-digit", year: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </td>

                {/* Type */}
                <td>
                  <span className={`${tableStyles.badge} ${tx.type === "buy_aud" ? tableStyles.txBuy : tableStyles.txSell}`}>
                    {tx.type === "buy_aud" ? "Buy AUD" : "Sell AUD"}
                  </span>
                </td>

                {/* AUD — editable */}
                <td dir="ltr">
                  <EditableAmount
                    transactionId={tx.id}
                    field="amount_aud"
                    currentValue={Number(tx.amount_aud)}
                    placeholder="e.g. 2254"
                  />
                </td>

                {/* Toman — editable */}
                <td dir="ltr">
                  <EditableAmount
                    transactionId={tx.id}
                    field="equivalent_toman"
                    currentValue={Number(tx.equivalent_toman)}
                    placeholder="e.g. 279496000"
                  />
                </td>

                {/* Recipient */}
                <td style={{ minWidth: "150px" }}>
                  <RecipientCell
                    recipient={tx.recipients}
                    paymentLink={(tx as any).payment_link ?? null}
                    reasonForTransfer={(tx as any).reason_for_transfer}
                  />
                </td>

                {/* Status */}
                <td><StatusBadge status={tx.status} /></td>

                {/* Actions */}
                <td>
                  {isPending ? (
                    // 🌟 ارسال کشوها به دکمه تایید تراکنش
                    <TransactionApproveButton transactionId={tx.id} bankAccounts={bankAccounts} />
                  ) : (
                    tx.status === "approved" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <SendReceiptButton
                          transactionId={tx.id}
                          customerEmail={profile?.email ?? undefined}
                          initiallySent={(tx as any).receipt_sent === true}
                        />
                        <RejectApprovedButton transactionId={tx.id} />
                      </div>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const normalizedStatus = (params.status ?? "all").toLowerCase();
  const historyStatus: HistoryStatusFilter =
    normalizedStatus === "approved" ||
    normalizedStatus === "rejected" ||
    normalizedStatus === "archived"
      ? (normalizedStatus as HistoryStatusFilter)
      : "all";

  // تعریف کلاینت دیتابیس برای خواندن حساب‌های بانکی
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // اجرای موازی و سریع ۳ کوئری دیتابیس
  const [pending, { data: history, total }, statusCounts, { data: bankAccounts }] = await Promise.all([
    getPendingTransactionsWithDetails(),
    getTransactionHistoryWithDetails(currentPage, PAGE_SIZE, historyStatus),
    getTransactionHistoryStatusCounts(),
    db.from("bank_accounts").select("*").eq("is_active", true)
  ]);

  const statusTabs: Array<{ key: HistoryStatusFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "approved", label: "Approved", count: statusCounts.approved },
    { key: "rejected", label: "Rejected", count: statusCounts.rejected },
    { key: "archived", label: "Archived", count: statusCounts.archived },
  ];

  const historyHeadingLabel = historyStatus === "all"
    ? "Transaction History"
    : historyStatus === "approved"
      ? "Approved Transactions"
      : historyStatus === "rejected"
        ? "Rejected Transactions"
        : "Archived Transactions";

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Transactions</span>
        {pending.length > 0 && (
          <span className={`${tableStyles.badge} ${tableStyles.badgePending} ${tableStyles.badgeCompact}`}>
            {pending.length} Pending
          </span>
        )}
      </div>

      <div className={shellStyles.pageContent}>
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <ArrowLeftRight size={24} strokeWidth={2.5} />
              </span>
              Transaction Processing
            </h1>
            <p className={cardStyles.sectionDesc}>
              Review pending transfers and send receipts to approved customers.
            </p>
          </div>
        </div>

        {/* Pending Queue */}
        <div className={`${cardStyles.panel} ${pending.length > 0 ? cardStyles.panelWarning : ""}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={`${cardStyles.panelTitle} ${pending.length > 0 ? cardStyles.panelTitleWarning : ""}`}>
              <Clock size={18} />
              Awaiting Action ({pending.length})
            </h2>
          </div>

          {pending.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateLoose}`}>
              <div className={cardStyles.emptyStateIcon}><DollarSign size={24} /></div>
              <div className={cardStyles.emptyStateText}>Queue is clear — no pending transactions.</div>
            </div>
          ) : (
            <TxTable rows={pending} isPending={true} bankAccounts={bankAccounts || []} />
          )}
        </div>

        {/* History — paginated 10 per page */}
        <div className={`${cardStyles.panel} ${cardStyles.panelSoft} ${cardStyles.panelMt}`}>
          <div className={cardStyles.panelHeader}>
            <h2 className={cardStyles.panelTitle}>
              <Archive size={18} color="var(--text-dim)" />
              {historyHeadingLabel} ({total} total)
            </h2>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {statusTabs.map((tab) => {
                const isActive = historyStatus === tab.key;
                const href = tab.key === "all" ? "/admin/transactions?page=1" : `/admin/transactions?page=1&status=${tab.key}`;
                return (
                  <Link
                    key={tab.key}
                    href={href}
                    className={`${tableStyles.badge} ${isActive ? tableStyles.badgeApproved : tableStyles.badgeArchived}`}
                    style={{ textDecoration: "none", fontWeight: 700 }}
                  >
                    {tab.label} ({tab.count})
                  </Link>
                );
              })}
            </div>
          </div>

          {history.length === 0 ? (
            <div className={`${cardStyles.emptyState} ${cardStyles.emptyStateCompact} ${cardStyles.emptyStateWithTopBorder}`}>
              <div className={`${cardStyles.emptyStateText} ${cardStyles.emptyStateDim}`}>No history records found.</div>
            </div>
          ) : (
            <>
              {/* جدول تاریخچه نیازی به لیست کشوها ندارد چون دکمه تایید در آن نیست */}
              <TxTable rows={history} isPending={false} />
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