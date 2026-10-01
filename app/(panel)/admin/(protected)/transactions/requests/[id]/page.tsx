import { RequestDetailView } from "@/components/requests/RequestDetailView";
import shellStyles from "@/styles/admin/AdminShell.module.css";

export const metadata = { title: "Transfer details | Zarman Admin" };

export default async function TransactionRequestPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ intent?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const initialIntent = query.intent === "email" || query.intent === "reject" ? query.intent : undefined;
  return <>
    <div className={shellStyles.topBar}><span className={shellStyles.pageTitle}>Transactions / Transfer details</span></div>
    <div className={shellStyles.pageContent} style={{ padding: 0 }}><RequestDetailView key={`${id}-${initialIntent || "review"}`} id={id} admin initialIntent={initialIntent} /></div>
  </>;
}
