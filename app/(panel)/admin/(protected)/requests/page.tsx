import { redirect } from "next/navigation";

export const metadata = { title: "Request queue | Zarman Admin" };

export default function AdminRequestsPage() {
  redirect("/admin/transactions");
}
