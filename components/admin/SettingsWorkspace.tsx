"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SlidersHorizontal, TrendingUp } from "lucide-react";
import { RequestSettingsForm } from "@/components/requests/RequestSettingsForm";
import styles from "@/styles/admin/AdminWorkspace.module.css";

export function SettingsWorkspace({ platform }: { platform: ReactNode }) {
  const [section, setSection] = useState<"platform" | "transfers">("platform");
  useEffect(() => {
    const followHash = () => setSection(window.location.hash.startsWith("#request-") ? "transfers" : "platform");
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);

  return <div className={styles.settings}>
    <nav className={styles.tabs} aria-label="Settings sections">
      <button type="button" aria-pressed={section === "platform"} aria-controls="platform-settings"
        onClick={() => { setSection("platform"); window.history.replaceState(null, "", "#platform"); }}>
        <TrendingUp size={17} aria-hidden="true" />Rates, fees & rewards
      </button>
      <button type="button" aria-pressed={section === "transfers"} aria-controls="transfer-settings"
        onClick={() => { setSection("transfers"); window.history.replaceState(null, "", "#request-service"); }}>
        <SlidersHorizontal size={17} aria-hidden="true" />Transfer service
      </button>
    </nav>
    {/* Both forms stay mounted so switching sections preserves unsaved edits. */}
    <section id="platform-settings" hidden={section !== "platform"} aria-label="Rates, fees and rewards">{platform}</section>
    <section id="transfer-settings" hidden={section !== "transfers"} aria-label="Transfer service settings">
      <p className={styles.description}>Availability, payment accounts, notifications and timing for new transfers.</p>
      <RequestSettingsForm defaultExpanded />
    </section>
  </div>;
}
