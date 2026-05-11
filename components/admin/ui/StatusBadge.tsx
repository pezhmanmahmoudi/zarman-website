/**
 * StatusBadge — shared badge for KYC / Transaction / Feedback / Audit status.
 *
 * Handles: approved | rejected | archived | under_review | pending (fallback).
 * Intentionally has no state — safe to use in server and client components.
 */
import tableStyles from "@/styles/admin/AdminTable.module.css";

interface StatusBadgeProps {
  status: string | null;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) {
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}>
        <span className={tableStyles.badgeDot} />
        Pending
      </span>
    );
  }

  const s = status.toLowerCase();

  if (s === "approved") {
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeApproved}`}>
        <span className={tableStyles.badgeDot} />
        Approved
      </span>
    );
  }

  if (s === "rejected") {
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeRejected}`}>
        <span className={tableStyles.badgeDot} />
        Rejected
      </span>
    );
  }

  if (s === "archived") {
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeArchived}`}>
        <span className={tableStyles.badgeDot} />
        Archived
      </span>
    );
  }

  if (s === "under_review") {
    return (
      <span className={`${tableStyles.badge} ${tableStyles.badgeReview}`}>
        <span className={tableStyles.badgeDot} />
        Under Review
      </span>
    );
  }

  // Unknown status — render as pending
  return (
    <span className={`${tableStyles.badge} ${tableStyles.badgePending}`}>
      <span className={tableStyles.badgeDot} />
      Pending
    </span>
  );
}
