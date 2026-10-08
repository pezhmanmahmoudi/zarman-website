"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminRefreshQueue } from "@/lib/admin-refresh-queue";

/** Keep the last successful snapshot visible when a subsequent read fails. */
export function useAdminSnapshot<T>(initialData: T, load: () => Promise<T>) {
  const [snapshot, setSnapshot] = useState({ source: initialData, value: initialData });
  const [status, setStatus] = useState({ source: initialData, pending: false, error: false });
  const data = snapshot.source === initialData ? snapshot.value : initialData;
  const queue = useMemo(() => createAdminRefreshQueue({
    load,
    onData: (value: T) => {
      setSnapshot({ source: initialData, value });
      setStatus({ source: initialData, pending: false, error: false });
    },
    onError: (error: unknown) => {
      console.error("[admin workspace refresh]", error);
      setStatus({ source: initialData, pending: false, error: true });
    },
    onPending: (pending: boolean) => setStatus(previous => ({
      source: initialData, pending, error: previous.source === initialData && previous.error,
    })),
  }), [initialData, load]);

  useEffect(() => {
    queue.activate();
    return () => queue.deactivate();
  }, [queue]);

  const update = useCallback((change: (previous: T) => T) => {
    queue.invalidate();
    setSnapshot(previous => ({ source: initialData,
      value: change(previous.source === initialData ? previous.value : initialData) }));
  }, [initialData, queue]);

  return { data, refresh: queue.refresh, update,
    refreshing: status.source === initialData && status.pending,
    refreshError: status.source === initialData && status.error };
}
