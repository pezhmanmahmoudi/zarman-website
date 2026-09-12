import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getTreasuryFullData } from "@/app/actions/treasury.actions";
import { resolveTreasuryView, treasuryViewHref } from "@/lib/treasury-navigation";
import TreasuryWorkspace from "@/components/admin/treasury/TreasuryWorkspace";
import { AdminRefreshButton } from "@/components/admin/ui/AdminRefreshButton";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import s from "@/styles/admin/Treasury.module.css";

export const metadata = { title: "Treasury | Zarman Admin" };
export const revalidate = 60;

type Props = { searchParams: Promise<{ view?: string | string[] }> };

export default async function TreasuryPage({ searchParams }: Props) {
  const [params, data] = await Promise.all([searchParams, getTreasuryFullData()]);
  const view = resolveTreasuryView(params.view);
  const criticalCount = data.strategy?.criticalAlertCount ?? 0;

  return (
    <>
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
        <TreasuryWorkspace view={view} data={data} />
      </div>
    </>
  );
}
