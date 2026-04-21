import type { ReactNode } from "react";
import MarketProviders from "@/components/providers/MarketProviders";
import { getRatesSnapshot } from "@/lib/rates";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const rateSnapshot = await getRatesSnapshot();

  return (
    <MarketProviders initialData={rateSnapshot} withSmoothScroll={false}>
      {children}
    </MarketProviders>
  );
}
