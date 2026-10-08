"use client";
import { useCallback } from "react";
import { useAdminSnapshot } from "@/components/admin/ui/useAdminSnapshot";
import { AdminRefreshScope } from "@/components/admin/ui/AdminRefreshScope";
import { AdminRefreshNotice } from "@/components/admin/ui/AdminRefreshNotice";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getTreasuryFullData, type TreasuryPageData } from "@/app/actions/treasury.actions";
import { treasuryViewHref, type TreasuryView } from "@/lib/treasury-navigation";
import TreasuryWorkspace from "@/components/admin/treasury/TreasuryWorkspace";
import { AdminRefreshButton } from "@/components/admin/ui/AdminRefreshButton";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import s from "@/styles/admin/TreasuryWorkspace.module.css";

export function TreasuryPageClient({ initialData, view }: { initialData: TreasuryPageData; view: TreasuryView }) {
  const load = useCallback(() => getTreasuryFullData(), []);
  const { data, refresh, refreshing, refreshError } = useAdminSnapshot(initialData, load);
  const criticalCount = data.strategy?.criticalAlertCount ?? 0;

  return (
    <AdminRefreshScope refresh={refresh}>
      <div className={shellStyles.topBar}>
        <h1 className={shellStyles.pageTitle}>Treasury</h1>
        <div className={shellStyles.topBarActions}>
          {criticalCount > 0 && (
            <Link href={treasuryViewHref("alerts")} prefetch={false} className={s.criticalAlertBadge}>
              <AlertTriangle size={14} aria-hidden="true" />
              {criticalCount} critical {criticalCount === 1 ? "alert" : "alerts"}
            </Link>
          )}
          <AdminRefreshButton />
        </div>
      </div>
      <div className={shellStyles.pageContent}>
        <AdminRefreshNotice error={refreshError} refreshing={refreshing} onRefresh={refresh} />
        <TreasuryWorkspace view={view} data={data} />
      </div>
    </AdminRefreshScope>
  );
}
