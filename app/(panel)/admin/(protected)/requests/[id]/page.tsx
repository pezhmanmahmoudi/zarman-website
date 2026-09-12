import { RequestDetailView } from "@/components/requests/RequestDetailView";

export const metadata = { title: "Request details | Zarman Admin" };

export default async function AdminRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetailView id={id} admin />;
}
