import { RequestList } from "@/components/requests/RequestList";

export default async function MyRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RequestList locale={locale === "fa" ? "fa" : "en"} />;
}
