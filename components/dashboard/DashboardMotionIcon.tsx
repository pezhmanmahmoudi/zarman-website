"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { dashboardMotionIcons, type DashboardMotionIconName } from "@/lib/dashboard/motion-icons";
import { useDashboardMotion } from "./DashboardMotion";
import type { DashboardLottiePlayerProps } from "./DashboardLottiePlayer";

type Props = {
  name: DashboardMotionIconName;
  size?: number;
  motionEnabled?: boolean;
  className?: string;
};

/** Decorative only: the adjacent heading describes the actual business state. */
export function DashboardMotionIcon({ name, size = 64, motionEnabled = true, className }: Props) {
  const enabled = useDashboardMotion();
  const reduced = useReducedMotion();
  return <MotionIcon key={name} name={name} size={size} className={className} animate={enabled && motionEnabled && reduced === false} />;
}

function MotionIcon({ name, size, className, animate }: Omit<Props, "motionEnabled"> & { size: number; animate: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [Player, setPlayer] = useState<ComponentType<DashboardLottiePlayerProps> | null>(null);
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [failed, setFailed] = useState(false);
  const asset = dashboardMotionIcons[name];

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const onVisibility = () => setForeground(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    // Static art is the deliberate fallback on browsers without observation.
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(
      entries => setVisible(entries.some(entry => entry.isIntersecting)),
      { threshold: .15 },
    );
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!animate || !visible || !foreground || complete || failed || Player) return;
    let active = true;
    // The SVG-only, expression-free engine is a separate chunk, loaded on demand.
    void import("./DashboardLottiePlayer").then(module => {
      if (active) setPlayer(() => module.DashboardLottiePlayer);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [animate, visible, foreground, complete, failed, Player]);

  // A loaded player is retained while paused so resuming cannot briefly hide the
  // poster behind a new, unready SVG. It remains idle until motion is enabled.
  const mounted = Player && !complete && !failed;
  return <span ref={host} aria-hidden="true" dir="ltr" data-motion-icon={name}
    className={cn("pointer-events-none relative inline-block shrink-0 select-none align-middle", className)}
    style={{ width: size, height: size }}>
    <Image src={asset.poster} alt="" width={size} height={size} unoptimized draggable={false}
      className={cn("absolute inset-0 z-10 size-full", mounted && animate && ready && "invisible")} />
    {mounted && <span className={animate ? undefined : "invisible"}>
      <Player name={name} playing={animate && visible && foreground}
        onReady={() => setReady(true)} onComplete={() => setComplete(true)} onError={() => setFailed(true)} />
    </span>}
  </span>;
}
