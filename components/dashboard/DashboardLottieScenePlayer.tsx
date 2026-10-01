"use client";

import { useEffect, useRef } from "react";
import { LottieLight, type LottieHandle } from "lottie-react";
import { dashboardLottieScenes, type DashboardLottieSceneAsset, type DashboardLottieSceneName } from "@/lib/dashboard/lottie-scenes";

export type DashboardLottieScenePlayerProps = {
  name: DashboardLottieSceneName;
  playing: boolean;
  replayKey?: number;
  onReady: () => void;
  onComplete: () => void;
  onError: () => void;
};

/** SVG-only runtime, split from the cards so the player is never in the first dashboard chunk. */
export function DashboardLottieScenePlayer({ name, playing, replayKey = 0, onReady, onComplete, onError }: DashboardLottieScenePlayerProps) {
  const player = useRef<LottieHandle>(null);
  const lastReplay = useRef(replayKey);
  const asset: DashboardLottieSceneAsset = dashboardLottieScenes[name];

  useEffect(() => {
    if (playing && lastReplay.current !== replayKey) {
      player.current?.seek(0);
      player.current?.play();
      lastReplay.current = replayKey;
    } else if (playing) player.current?.play();
    else player.current?.pause();
  }, [playing, replayKey]);

  return <LottieLight as="span" src={asset.src} lottieRef={player}
    autoplay={false} loop={asset.loop ?? false} speed={1} segment={asset.segment} renderer="svg"
    rendererSettings={{ preserveAspectRatio: "xMidYMid meet", progressiveLoad: true, runExpressions: false }}
    className={`absolute inset-0 block size-full${name === "transfer-complete" ? " scale-[2.8]" : ""}`} aria-hidden="true"
    style={asset.zoom ? { transform: `scale(${asset.zoom.scale})`, transformOrigin: asset.zoom.origin } : undefined}
    subscriptions={{
      ready: () => { onReady(); if (playing) player.current?.play(); },
      complete: onComplete,
      error: onError,
    }} />;
}
