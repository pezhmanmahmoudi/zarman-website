"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Match server HTML on hydration, then safely enable document.body portals. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
