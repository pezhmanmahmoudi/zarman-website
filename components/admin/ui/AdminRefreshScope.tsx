"use client";

import { createContext, type ReactNode } from "react";

export const AdminRefreshContext = createContext<(() => Promise<void>) | null>(null);

/** Child actions refresh their workspace's data, without re-rendering the route. */
export function AdminRefreshScope({ refresh, children }: {
  refresh: () => Promise<void>;
  children: ReactNode;
}) {
  return <AdminRefreshContext.Provider value={refresh}>{children}</AdminRefreshContext.Provider>;
}
