"use client";

import { startTransition, useCallback } from "react";
import { useRouter } from "next/navigation";

/** Refresh committed server data while keeping the admin shell and local UI mounted. */
export function useAdminRefresh() {
  const router = useRouter();
  return useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);
}
