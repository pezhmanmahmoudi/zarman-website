import { getKycQueue, getKycHistory } from "@/app/actions/admin.actions";
import { KycWorkspace } from "@/components/admin/KycWorkspace";
import { parseAdminPage, parseAdminPageSize } from "@/lib/admin-pagination";

export const metadata = { title: "Identity Verification | Zarman Admin" };
export default async function KycQueuePage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string; view?: string }> }) {
  const params = await searchParams;
  const currentPage = parseAdminPage(params.page);
  const pageSize = parseAdminPageSize(params.pageSize);
  const historyView = params.view === "history" || (!!params.page && params.view !== "active");
  const [queue, history] = await Promise.all([getKycQueue(), getKycHistory(currentPage, pageSize)]);
  return <KycWorkspace key={currentPage + "-" + pageSize + "-" + historyView} currentPage={currentPage} pageSize={pageSize}
    historyView={historyView} initialData={{ queue, history: history.data, total: history.total }} />;
}
