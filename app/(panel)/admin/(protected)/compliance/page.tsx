import { getComplianceOverview } from "@/app/actions/compliance.actions";
import { ComplianceListsWorkspace } from "@/components/admin/compliance/ComplianceListsWorkspace";
import shellStyles from "@/styles/admin/AdminShell.module.css";

export const metadata = { title: "Compliance lists | Zarman Admin" };
export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const result = await getComplianceOverview();
  return <>
    <div className={shellStyles.topBar}><span className={shellStyles.pageTitle}>Compliance lists</span></div>
    <div className={shellStyles.pageContent}>
      <ComplianceListsWorkspace overview={result.data ?? null} error={result.error ?? null} />
    </div>
  </>;
}
