import React from "react";
import { Settings } from "lucide-react";
import { FA } from "@/lib/treasury-utils";
import type { TreasurySettingsRow } from "@/app/actions/treasury.actions";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import TreasurySettingsForm from "@/components/admin/treasury/TreasurySettingsForm";
import s from "@/styles/admin/Treasury.module.css";

export default function TreasurySettings({ settings }: { settings: TreasurySettingsRow }) {
  return (
    <section>
      <details className={s.settingsDetails} open>
        <summary className={s.settingsSummary}>
          <Settings size={16} className={s.settingsIcon} />
          <span className={s.settingsSummaryTitle}>
            <Tooltip text="پارامترهای پایه‌ای برای محاسبه هشدارها، تارگت‌ها و امتیاز سلامت سیستم">{FA.secSettings}</Tooltip>
          </span>
          <span className={s.settingsSummaryHint}>{FA.secSettingsDesc}</span>
        </summary>
        <div className={s.settingsBody}>
          <p className={s.settingsBodyPrimary}>{FA.settingsBody1}</p>
          <TreasurySettingsForm settings={settings} />
        </div>
      </details>
    </section>
  );
}
