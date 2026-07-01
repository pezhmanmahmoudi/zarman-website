import React from "react";
import { Settings } from "lucide-react";
import { FA } from "@/lib/treasury-utils";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import s from "@/styles/admin/Treasury.module.css";

export default function TreasurySettings() {
  return (
    <section>
      <details className={s.settingsDetails}>
        <summary className={s.settingsSummary}>
          <Settings size={16} className={s.settingsIcon} />
          <span className={s.settingsSummaryTitle}>
            <Tooltip text="پارامترهای پایه‌ای برای محاسبه هشدارها، تارگت‌ها و امتیاز سلامت سیستم">{FA.secSettings}</Tooltip>
          </span>
          <span className={s.settingsSummaryHint}>{FA.secSettingsDesc}</span>
        </summary>
        <div className={s.settingsBody}>
          <p className={s.settingsBodyPrimary}>{FA.settingsBody1}</p>
          <p className={s.settingsBodySecondary}>{FA.settingsBody2}</p>
        </div>
      </details>
    </section>
  );
}