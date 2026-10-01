"use client";

import type { ReactNode } from "react";
import { DashboardLottieScene } from "./DashboardLottieScene";
import type { DashboardLottieSceneName } from "@/lib/dashboard/lottie-scenes";

/** The same compact illustration and heading hierarchy across the three overview cards. */
export function DashboardOverviewCardHeading({ eyebrow, title, scene, motionEnabled, children }: {
  eyebrow: string; title: string; scene: DashboardLottieSceneName; motionEnabled: boolean; children?: ReactNode;
}) {
  return <div className="flex min-w-0 items-start justify-between gap-3">
    <div className="min-w-0"><p className="m-0 text-xs font-medium text-[#5b6480]">{eyebrow}</p><h2 className="m-0! mt-1.5! text-lg! font-semibold leading-snug! text-[#24243f]!">{title}</h2>{children}</div>
    <span aria-hidden="true" className="relative flex size-[68px] shrink-0 items-center justify-center rounded-full border border-[#d5cde7] bg-white/75 shadow-[0_8px_24px_-14px_#4d3a7360,inset_0_0_0_4px_#ffffff80]"><DashboardLottieScene name={scene} size={60} motionEnabled={motionEnabled} /></span>
  </div>;
}
