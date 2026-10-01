import { AdminBadge } from "./AdminDataTable";

export function StatusBadge({ status }: { status: string | null }) {
  const value = status?.toLowerCase();
  const tone = value === "approved" ? "success" : value === "rejected" ? "rejected" : value === "archived" ? "closed" : value === "under_review" ? "review" : "funding";
  const label = value === "approved" ? "Approved" : value === "rejected" ? "Rejected" : value === "archived" ? "Archived" : value === "under_review" ? "Under review" : "Pending";
  return <AdminBadge tone={tone}>{label}</AdminBadge>;
}
