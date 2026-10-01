"use client";

import type { ExchangeRequest, RequestEvent, RequestLocale } from "@/lib/requests/types";
import { TransferOverviewCard } from "@/components/dashboard/TransferOverviewCard";
import { useDashboardMotion } from "@/components/dashboard/DashboardMotion";

/** One shared status card for the overview and the transaction detail page. */
export function RequestProgress({ request, events = [], locale, spotlight = false, refreshing = false, onRefresh }: {
  request: ExchangeRequest;
  events?: RequestEvent[];
  locale: RequestLocale;
  spotlight?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const motionEnabled = useDashboardMotion();
  return <TransferOverviewCard request={request} events={events} locale={locale}
    detailView={!spotlight} refreshing={refreshing} onRetry={onRefresh} motionEnabled={motionEnabled} />;
}
