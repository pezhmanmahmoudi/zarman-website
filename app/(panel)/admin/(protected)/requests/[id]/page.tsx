import { redirect } from "next/navigation";
import { transactionRequestHref } from "@/lib/admin-transaction-workspace";

export const metadata = { title: "Request details | Zarman Admin" };

export default async function AdminRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(transactionRequestHref(id));
}
