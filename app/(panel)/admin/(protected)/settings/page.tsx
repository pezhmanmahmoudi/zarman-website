import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { getSystemSettings, getPromoCodes } from "@/app/actions/admin.actions";
import { SystemSettingsForm } from "@/components/admin/SystemSettingsForm";
import { SettingsWorkspace } from "@/components/admin/SettingsWorkspace";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";

export const metadata = { title: "System Settings | Zarman Admin" };

export default async function SettingsPage() {
  const [settings, promoCodes] = await Promise.all([
    getSystemSettings(),
    getPromoCodes().catch(() => []),
  ]);

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Settings</span>
      </div>

      <div className={`${shellStyles.pageContent} ${shellStyles.pageContentNarrow}`}>
        {/* Header Section */}
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderLg}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <SlidersHorizontal size={26} strokeWidth={2.5} />
              </span>
              Settings
            </h1>
            <p className={cardStyles.sectionDesc}>
              Manage rates, rewards and the transfer service in one place. Save each section when ready.
            </p>
          </div>
        </div>

        {/* Form Component — includes Promo Code Management section */}
        <SettingsWorkspace platform={<SystemSettingsForm initialSettings={settings} initialCodes={promoCodes ?? []} />} />
      </div>
    </>
  );
}
