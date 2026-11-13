/**
 * Runs complex ("heavy") Lottie scenes one at a time, and only after the page has finished loading
 * and the browser is idle. Each of these scenes animates 500-1,600 vector shapes; starting several at
 * once while the dashboard renders kept the main thread busy and delayed the page and its first taps.
 */
type Grant = () => void;

/** Longest a scene may hold the slot. Every scene is under 10 s; a stalled load must not block the rest. */
export const HEAVY_SCENE_MAX_HOLD_MS = 10_000;

export function createHeavySceneQueue(whenPageIdle: () => Promise<void>, maxHoldMs = HEAVY_SCENE_MAX_HOLD_MS, timers: Pick<typeof globalThis, "setTimeout" | "clearTimeout"> = globalThis) {
  let active: symbol | null = null;
  let activeTimer: ReturnType<typeof setTimeout> | null = null;
  let idle = false;
  let idleRequested = false;
  const waiting: { id: symbol; grant: Grant }[] = [];

  const release = (id: symbol) => {
    if (active !== id) return;
    active = null;
    if (activeTimer !== null) timers.clearTimeout(activeTimer);
    activeTimer = null;
    pump();
  };
  const pump = () => {
    if (!idle || active || waiting.length === 0) return;
    const next = waiting.shift()!;
    active = next.id;
    activeTimer = timers.setTimeout(() => release(next.id), maxHoldMs);
    next.grant();
  };

  /** Queues a scene; `grant` runs when it may play. The returned function cancels or releases it. */
  return function requestHeavySceneSlot(grant: Grant): () => void {
    const id = Symbol("heavy-lottie-scene");
    waiting.push({ id, grant });
    if (!idleRequested) {
      idleRequested = true;
      void whenPageIdle().then(() => { idle = true; pump(); });
    } else pump();
    return () => {
      const index = waiting.findIndex(item => item.id === id);
      if (index >= 0) waiting.splice(index, 1);
      release(id);
    };
  };
}

function browserIdle(): Promise<void> {
  if (typeof window === "undefined") return new Promise<void>(() => undefined);
  return new Promise<void>(resolve => {
    const afterLoad = () => {
      const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number };
      if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(() => resolve(), { timeout: 2000 });
      else window.setTimeout(resolve, 500);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
  });
}

export const requestHeavySceneSlot = createHeavySceneQueue(browserIdle);
