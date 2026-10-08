import { getTreasuryFullData } from "@/app/actions/treasury.actions";
import { resolveTreasuryView } from "@/lib/treasury-navigation";
import { TreasuryPageClient } from "@/components/admin/treasury/TreasuryPageClient";

export const metadata = { title: "Treasury | Zarman Admin" };
export const dynamic = "force-dynamic";
export default async function TreasuryPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const [params, data] = await Promise.all([searchParams, getTreasuryFullData()]);
  return <TreasuryPageClient view={resolveTreasuryView(params.view)} initialData={data} />;
}
