import { Suspense } from "react";
import { BarChart3, DatabaseZap } from "lucide-react";
import { getEnterpriseReportData } from "@/app/actions/report.actions";
import { ReportsDashboard } from "@/components/admin/reports/ReportsDashboard";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/Reports.module.css";

export const metadata = { title: "Enterprise Reports | Zarman Admin" };
export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams: Promise<{ preset?: string; start?: string; end?: string }>;
};

async function ReportContent({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const data = await getEnterpriseReportData(params);
  return <ReportsDashboard data={data} />;
}

export default function ReportsPage(props: ReportsPageProps) {
  return (
    <>
      <div className={shellStyles.topBar}>
        <div className={styles.heading}>
          <span className={styles.headingIcon}><BarChart3 size={20} /></span>
          <div>
            <h1>Enterprise Reports</h1>
            <p>Financial intelligence generated from the ledger reporting read model</p>
          </div>
        </div>
        <div className={styles.sourceBadge}><DatabaseZap size={14} /> Ledger source of truth</div>
      </div>
      <div className={shellStyles.pageContent}>
        <Suspense fallback={<div className={styles.loading}>Preparing financial reports...</div>}>
          <ReportContent {...props} />
        </Suspense>
      </div>
    </>
  );
}