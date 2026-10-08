import { getFeedbackQueue, getFeedbackHistory } from "@/app/actions/admin.actions";
import { FeedbackWorkspace } from "@/components/admin/FeedbackWorkspace";
import { parseAdminPage, parseAdminPageSize } from "@/lib/admin-pagination";
export const metadata = { title: "Feedback Moderation | Zarman Admin" };
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ page?: string; pageSize?: string }> }) {
  const params = await searchParams;
  const currentPage = parseAdminPage(params.page);
  const pageSize = parseAdminPageSize(params.pageSize);
  const [pending, history] = await Promise.all([getFeedbackQueue(), getFeedbackHistory(currentPage, pageSize)]);
  return <FeedbackWorkspace key={currentPage + "-" + pageSize} currentPage={currentPage} pageSize={pageSize}
    initialData={{ pending, moderated: history.data, total: history.total }} />;
}
