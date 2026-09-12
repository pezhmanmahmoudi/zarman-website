import { RequestList } from "@/components/requests/RequestList";

export const metadata = { title: "Request queue | Zarman Admin" };

export default function AdminRequestsPage() {
  return <RequestList admin />;
}
