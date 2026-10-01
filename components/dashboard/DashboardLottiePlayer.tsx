"use client";

import { useEffect, useRef } from "react";
import { LottieLight, type LottieHandle } from "lottie-react";
import { dashboardMotionIcons, type DashboardMotionAsset, type DashboardMotionIconName } from "@/lib/dashboard/motion-icons";

export type DashboardLottiePlayerProps = {
  name: DashboardMotionIconName;
  playing: boolean;
  onReady: () => void;
  onComplete: () => void;
  onError: () => void;
};

/** Loaded only by DashboardMotionIcon after it becomes visible with motion enabled. */
export function DashboardLottiePlayer({ name, playing, onReady, onComplete, onError }: DashboardLottiePlayerProps) {
  const player = useRef<LottieHandle>(null);
  const asset: DashboardMotionAsset = dashboardMotionIcons[name];
  useEffect(() => {
    if (playing) player.current?.play();
    else player.current?.pause();
  }, [playing]);

  return <LottieLight as="span" src={asset.src} lottieRef={player}
    autoplay={false} loop={asset.loop ?? false} renderer="svg"
    rendererSettings={{ preserveAspectRatio: "xMidYMid meet", progressiveLoad: true, runExpressions: false }}
    className="absolute inset-0 block size-full" aria-hidden="true"
    subscriptions={{
      ready: () => { onReady(); if (playing) player.current?.play(); },
      complete: onComplete,
      error: onError,
    }} />;
}
