import Link from "next/link";
import { ShieldAlert, MoveLeft } from "lucide-react";
import { getAustracComplianceStatus } from "@/app/actions/report.actions";
import { AustracComplianceDashboard } from "@/components/admin/reports/AustracComplianceDashboard";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/Reports.module.css";

export const metadata = { title: "AUSTRAC Compliance | Zarman Admin" };
export const dynamic = "force-dynamic";

export default async function AustracCompliancePage() {
  const { outgoing, incoming, recentBatches } = await getAustracComplianceStatus();

  return (
    <>
      <div className={shellStyles.topBar}>
        <div className={styles.heading}>
          <span className={styles.headingIcon}><ShieldAlert size={20} /></span>
          <div>
            <h1>AUSTRAC Reporting</h1>
            <p>Track outstanding IFTI-DRA transactions and the 10-business-day reporting deadline</p>
          </div>
        </div>
        <Link className={styles.backLink} href="/admin/reports"><MoveLeft size={15} /> Reports</Link>
      </div>
      <div className={shellStyles.pageContent}>
        <AustracComplianceDashboard outgoing={outgoing} incoming={incoming} recentBatches={recentBatches} />
      </div>
    </>
  );
}
