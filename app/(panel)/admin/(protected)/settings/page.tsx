import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { getSystemSettings, getPromoCodes } from "@/app/actions/admin.actions";
import { SystemSettingsForm } from "@/components/admin/SystemSettingsForm";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles from "@/styles/admin/AdminCards.module.css";

export const metadata = { title: "System Settings | Zarman Admin" };

export default async function SettingsPage() {
  const [settings, promoCodes] = await Promise.all([
    getSystemSettings(),
    getPromoCodes(),
  ]);

  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>System Configuration</span>
      </div>

      <div className={`${shellStyles.pageContent} ${shellStyles.pageContentNarrow}`}>
        {/* Header Section */}
        <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderLg}`}>
          <div>
            <h1 className={`${cardStyles.sectionTitle} ${cardStyles.sectionTitleWithIcon}`}>
              <span className={cardStyles.sectionTitleIconAccent}>
                <SlidersHorizontal size={26} strokeWidth={2.5} />
              </span>
              Platform Settings
            </h1>
            <p className={cardStyles.sectionDesc}>
              Configure daily exchange rates, market availability, and customer-facing pause messages. 
              Changes made here are applied immediately across the platform.
            </p>
          </div>
        </div>

        {/* Form Component — includes Promo Code Management section */}
        <SystemSettingsForm initialSettings={settings} initialCodes={promoCodes ?? []} />
      </div>
    </>
  );
}