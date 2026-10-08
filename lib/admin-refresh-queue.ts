/** Coalesce refresh requests without publishing a read started before a mutation. */
export function createAdminRefreshQueue<T>({
  load, onData, onError, onPending,
}: {
  load: () => Promise<T>;
  onData: (data: T) => void;
  onError: (error: unknown) => void;
  onPending: (pending: boolean) => void;
}) {
  let active = true;
  let revision = 0;
  let queued = false;
  let running: Promise<void> | null = null;

  async function drain() {
    try {
      if (!active) return;
      onPending(true);
      while (active && queued) {
        queued = false;
        const startedAt = revision;
        try {
          const data = await load();
          if (active && startedAt === revision) onData(data);
        } catch (error) {
          if (active && startedAt === revision) onError(error);
        }
      }
    } finally {
      running = null;
      if (active) onPending(false);
    }
  }

  return {
    refresh() {
      if (!active) return Promise.resolve();
      revision += 1;
      queued = true;
      running ??= Promise.resolve().then(drain);
      return running;
    },
    // A confirmed local change must survive an older response, even if its next
    // refresh fails. This never retries a write or invents a successful mutation.
    invalidate() { revision += 1; },
    activate() { active = true; },
    deactivate() { active = false; queued = false; revision += 1; },
  };
}
