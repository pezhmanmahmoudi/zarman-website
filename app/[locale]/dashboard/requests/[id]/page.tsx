import { RequestDetailView } from "@/components/requests/RequestDetailView";

export default async function MyRequestPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  return <RequestDetailView id={id} locale={locale === "fa" ? "fa" : "en"} />;
}
