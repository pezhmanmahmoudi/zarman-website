"use client";

import { useContext, useEffect, useRef, useState, type ComponentType } from "react";
import { DashboardLottieReplay } from "./DashboardLottieReplay";
import { useReducedMotion } from "framer-motion";
import {
  BadgeCheck, ChartNoAxesCombined, CircleAlert, CircleCheck, CircleX, Clock3,
  CreditCard, Fingerprint, Gift, Hand, Heart, Hourglass, LoaderCircle, Megaphone,
  MessageCircleHeart, ReceiptText, Send, Smartphone, TriangleAlert, UserRound,
  WalletCards, CloudUpload, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardLottieScenes, type DashboardLottieSceneAsset, type DashboardLottieSceneName } from "@/lib/dashboard/lottie-scenes";
import { useDashboardMotion } from "./DashboardMotion";
import type { DashboardLottieScenePlayerProps } from "./DashboardLottieScenePlayer";

type Props = {
  name: DashboardLottieSceneName;
  size?: number;
  motionEnabled?: boolean;
  className?: string;
};

const fallbacks: Record<DashboardLottieSceneName, LucideIcon> = {
  "document-upload-idle": CloudUpload,
  "document-upload-success": CircleCheck,
  "document-upload": CloudUpload,
  "receipt-upload": ReceiptText,
  chat: MessageCircleHeart,
  "feedback-heart": Heart,
  alert: CircleAlert,
  announcement: Megaphone,
  "activity-history": ChartNoAxesCombined,
  "bank-card": CreditCard,
  "dashboard-loading": Hand,
  "loyalty-milestone": Gift,
  "compliance-review": Hourglass,
  "mobile-payment": Smartphone,
  "transfer-setup": Smartphone,
  "payment-failed": CircleX,
  "payment-confirmed": CircleCheck,
  "transfer-complete": BadgeCheck,
  "request-submitted": Send,
  "recipient-avatar": UserRound,
  "recipient-selection": UserRound,
  "feedback-review": MessageCircleHeart,
  "identity-approved": Send,
  "identity-rejected": Fingerprint,
  "identity-fingerprint": Fingerprint,
  warning: TriangleAlert,
  "loyalty-savings": WalletCards,
  waiting: Clock3,
  loading: LoaderCircle,
  "text-loading": ChartNoAxesCombined,
};

/** Decorative scene; adjacent copy remains the accessible source of truth. */
export function DashboardLottieScene({ name, size = 96, motionEnabled = true, className }: Props) {
  const dashboardMotion = useDashboardMotion();
  const reduced = useReducedMotion();
  const replayKey = useContext(DashboardLottieReplay);
  return <LottieScene key={name} name={name} size={size} className={className} replayKey={replayKey} animate={dashboardMotion && motionEnabled && reduced === false} />;
}

function LottieScene({ name, size, className, animate, replayKey }: Omit<Props, "motionEnabled"> & { size: number; animate: boolean; replayKey: number }) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [Player, setPlayer] = useState<ComponentType<DashboardLottieScenePlayerProps> | null>(null);
  const [ready, setReady] = useState(false);
  const [completedReplay, setCompletedReplay] = useState<number | null>(null);
  const complete = completedReplay === replayKey;
  const [failed, setFailed] = useState(false);
  const asset: DashboardLottieSceneAsset = dashboardLottieScenes[name];
  const Fallback = fallbacks[name];

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const onVisibility = () => setForeground(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(
      entries => setVisible(entries.some(entry => entry.isIntersecting)),
      { rootMargin: "80px", threshold: .05 },
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
    void import("./DashboardLottieScenePlayer").then(module => {
      if (active) setPlayer(() => module.DashboardLottieScenePlayer);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [animate, visible, foreground, complete, failed, Player]);

  const mounted = Player && (!complete || asset.holdOnComplete) && !failed;
  const showPlayer = mounted && animate && visible && foreground && ready;
  return <span ref={host} aria-hidden="true" dir="ltr" data-lottie-scene={name}
    className={cn("pointer-events-none relative inline-grid shrink-0 select-none place-items-center overflow-hidden align-middle", className)}
    style={{ width: size, height: size, maxWidth: "100%" }}>
    <span className={cn("absolute inset-[12%] grid place-items-center transition-opacity motion-reduce:transition-none", name === "dashboard-loading" ? "text-[#3d4853]" : "rounded-[28%] border border-white/75 bg-white/65 text-[#67558c] shadow-[0_10px_35px_-24px_#392b66]", showPlayer && "opacity-0")}>
      <Fallback size={Math.max(20, Math.min(40, size * .34))} strokeWidth={1.55} />
    </span>
    {mounted && <span className={showPlayer ? undefined : "invisible"}>
      <Player name={name} replayKey={replayKey} playing={animate && visible && foreground && !complete}
        onReady={() => setReady(true)} onComplete={() => setCompletedReplay(replayKey)} onError={() => setFailed(true)} />
    </span>}
  </span>;
}
