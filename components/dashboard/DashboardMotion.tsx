"use client";
import { createContext, useContext, type ReactNode } from "react";

const DashboardMotionContext = createContext(true);

export function DashboardMotionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <DashboardMotionContext.Provider value={enabled}>{children}</DashboardMotionContext.Provider>;
}

/** Also works on standalone/admin pages, where only system reduced-motion applies. */
export function useDashboardMotion() { return useContext(DashboardMotionContext); }
