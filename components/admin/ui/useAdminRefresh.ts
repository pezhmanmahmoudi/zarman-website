"use client";

import { startTransition, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { AdminRefreshContext } from "./AdminRefreshScope";

/** Refresh committed server data while keeping the admin shell and local UI mounted. */
export function useAdminRefresh() {
  const router = useRouter();
  const refreshWorkspace = useContext(AdminRefreshContext);
  return useCallback(() => {
    if (refreshWorkspace) { void refreshWorkspace(); return; }
    startTransition(() => router.refresh());
  }, [router, refreshWorkspace]);
}
