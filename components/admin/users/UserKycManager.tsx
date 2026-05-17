"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { KycActionButtons } from "@/components/admin/KycActionButtons";
import type { getUserFinancialProfile } from "@/app/actions/admin.actions";

type Profile = Awaited<ReturnType<typeof getUserFinancialProfile>>["profile"];

interface UserKycManagerProps {
  profile: Profile;
}

const ROWS: [string, (p: NonNullable<Profile>) => string | null | undefined][] = [
  ["Full Name",       (p) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || null],
  ["Email",           (p) => p.email],
  ["Phone",           (p) => p.mobile_number],
  ["Date of Birth",   (p) => p.dob],
  ["Address",         (p) => [p.address, p.city, p.state].filter(Boolean).join(", ") || null],
  ["Country",         (p) => p.country],
  ["Document Type",   (p) => p.document_type],
  ["Licence Number",  (p) => (p as Record<string, unknown>).license_number  as string | null],
  ["Card Number",     (p) => (p as Record<string, unknown>).card_number      as string | null],
  ["Passport Number", (p) => (p as Record<string, unknown>).passport_number  as string | null],
  ["Expiry Date",     (p) => (p as Record<string, unknown>).expiry_date      as string | null],
];

export function UserKycManager({ profile }: UserKycManagerProps) {
  return (
    <div className={cardStyles.panel}>
      <div className={`${cardStyles.panelHeader} ${cardStyles.panelHeaderComfort}`}>
        <h2 className={`${cardStyles.panelTitle} ${cardStyles.panelTitleAccent}`}>
          <ShieldCheck size={18} />
          Identity &amp; KYC Management
        </h2>
      </div>

      <div className={cardStyles.panelBody}>
        <dl className={cardStyles.kycDetailList}>
          {ROWS.map(([label, getValue]) => {
            const value = profile ? getValue(profile) : null;
            return (
              <div key={label} className={cardStyles.kycDetailRow}>
                <dt className={cardStyles.kycDetailRowLabel}>{label}</dt>
                <dd className={value ? cardStyles.kycDetailRowValue : `${cardStyles.kycDetailRowValue} ${cardStyles.kycDetailRowValueDim}`}>
                  {value || "—"}
                </dd>
              </div>
            );
          })}
        </dl>

        <div className={cardStyles.kycStatusFooter}>
          <div className={cardStyles.kycStatusLeft}>
            Current Status
            <StatusBadge status={profile?.kyc_status ?? null} />
          </div>
          <div>
            {profile && <KycActionButtons userId={profile.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
