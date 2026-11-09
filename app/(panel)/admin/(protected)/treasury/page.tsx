import { getTreasuryFullData } from "@/app/actions/treasury.actions";
import { resolveProfitPeriod, resolveTreasuryView } from "@/lib/treasury-navigation";
import { TreasuryPageClient } from "@/components/admin/treasury/TreasuryPageClient";

export const metadata = { title: "Treasury | Zarman Admin" };
export const dynamic = "force-dynamic";
export default async function TreasuryPage({ searchParams }: { searchParams: Promise<{ view?: string | string[]; period?: string | string[] }> }) {
  const params = await searchParams;
  const view = resolveTreasuryView(params.view);
  const profitPeriod = view === "profitability" ? resolveProfitPeriod(params.period) : undefined;
  const data = await getTreasuryFullData({ profitPeriod });
  return <TreasuryPageClient view={view} profitPeriod={profitPeriod} initialData={data} />;
}
