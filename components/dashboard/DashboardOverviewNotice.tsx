"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/app/[locale]/dashboard/dashboard.types";
import { useLocale } from "@/context/LocaleContext";
import { useDashboard } from "./DashboardShell";
import { DashboardIdentityCard } from "./DashboardIdentityCard";
import { TelegramNotifications } from "./TelegramNotifications";

/** Keep success on screen for its first visit; the next visit uses Telegram in the same slot. */
export function DashboardOverviewNotice({ profile, motionEnabled }: { profile: Profile | null; motionEnabled: boolean }) {
  return <OverviewNotice key={`${profile?.id}:${profile?.kyc_status}`} profile={profile} motionEnabled={motionEnabled} />;
}

function OverviewNotice({ profile, motionEnabled }: { profile: Profile | null; motionEnabled: boolean }) {
  const locale = useLocale();
  const { acknowledgeIdentityNotice } = useDashboard();
  const approved = profile?.kyc_status === "approved";
  // Freeze the decision for this mount so saving the acknowledgement does not remove the visible success message.
  const [showApproval] = useState(() => approved && !profile?.kyc_approval_notice_seen_at);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current, profileId = profile?.id;
    if (!showApproval || !profileId || !node) return;
    let visible = false, acknowledged = false;
    const recordView = () => {
      if (!visible || document.hidden || acknowledged) return;
      acknowledged = true;
      void acknowledgeIdentityNotice(profileId);
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      recordView();
    }, { threshold: 0.5 });
    observer.observe(node);
    document.addEventListener("visibilitychange", recordView);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", recordView); };
  }, [showApproval, profile?.id, acknowledgeIdentityNotice]);

  if (!approved || showApproval) return <div ref={host}><DashboardIdentityCard profile={profile} motionEnabled={motionEnabled} /></div>;
  return <TelegramNotifications locale={locale} overview motionEnabled={motionEnabled} />;
}
