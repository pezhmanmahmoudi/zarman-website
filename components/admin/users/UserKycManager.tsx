"use client";

import React, { useState, useTransition } from "react";
import { ShieldCheck, Pencil, Save, X } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import formStyles from "@/styles/admin/AdminForms.module.css";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { KycActionButtons } from "@/components/admin/KycActionButtons";
import { EditableCustomerCode } from "@/components/admin/EditableCustomerCode";
import { updateUserIdentityKycProfile } from "@/app/actions/admin.actions";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { ComplianceCheckButtons } from "@/components/admin/ComplianceCheckButtons";
import { AustralianLocationFields } from "@/components/dashboard/AustralianLocationFields";
import { AU_DRIVER_LICENCE_ISSUER_OPTIONS, formatAustralianDriverLicenceIssuer, normalizeAustralianState } from "@/lib/australian-driver-licence";
import type { getUserFinancialProfile } from "@/app/actions/admin.actions";

type Profile = Awaited<ReturnType<typeof getUserFinancialProfile>>["profile"];

interface UserKycManagerProps {
  profile: Profile;
  onProfileUpdated?: () => void;
}

const ROWS: [string, (p: NonNullable<Profile>) => string | null | undefined][] = [
  ["Full Name",       (p) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || null],
  ["Email",           (p) => p.email],
  ["Phone",           (p) => p.mobile_number],
  ["Date of Birth",   (p) => p.dob],
  ["Address",         (p) => [p.address, p.city, p.state, (p as Record<string, unknown>).postcode as string | null, p.country].filter(Boolean).join(", ") || null],
  ["Document Type",   (p) => p.document_type],
  ["Issuing Authority",  (p) => formatAustralianDriverLicenceIssuer((p as Record<string, unknown>).state_of_issue as string | null) || null],
  ["Licence Number",  (p) => (p as Record<string, unknown>).license_number  as string | null],
  ["Card Number",     (p) => (p as Record<string, unknown>).card_number      as string | null],
  ["Passport Number", (p) => (p as Record<string, unknown>).passport_number  as string | null],
  ["Expiry Date",     (p) => (p as Record<string, unknown>).expiry_date      as string | null],
];

export function UserKycManager({ profile, onProfileUpdated }: UserKycManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Lazy initialiser — no useEffect needed. Parent re-mounts this component
  // with a key prop when the profile changes, so the form is always fresh.
  const p = profile as Record<string, unknown> | null;
  const [form, setForm] = useState(() => ({
    first_name:     profile?.first_name     ?? "",
    last_name:      profile?.last_name      ?? "",
    email:          profile?.email          ?? "",
    mobile_number:  profile?.mobile_number  ?? "",
    dob:            p?.dob            as string ?? "",
    address:        p?.address        as string ?? "",
    city:           p?.city           as string ?? "",
    state:          (p?.country as string ?? "") === "Australia" ? normalizeAustralianState(p?.state as string ?? "") : p?.state as string ?? "",
    postcode:       p?.postcode       as string ?? "",
    country:        p?.country        as string ?? "",
    document_type:  p?.document_type  as string ?? "",
    state_of_issue: p?.state_of_issue as string ?? "",
    license_number: p?.license_number as string ?? "",
    card_number:    p?.card_number    as string ?? "",
    passport_number: p?.passport_number as string ?? "",
    expiry_date:    p?.expiry_date    as string ?? "",
    kyc_status:     p?.kyc_status     as string ?? "pending",
  }));

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveProfile = () => {
    if (!profile?.id) return;

    setStatus(null);
    startTransition(async () => {
      const res = await updateUserIdentityKycProfile({
        userId: profile.id,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        mobile_number: form.mobile_number,
        dob: form.dob,
        address: form.address,
        city: form.city,
        state: form.state,
        postcode: form.postcode,
        country: form.country,
        document_type: form.document_type as "driver_license" | "passport" | "none" | "",
        state_of_issue: form.state_of_issue,
        license_number: form.license_number,
        card_number: form.card_number,
        passport_number: form.passport_number,
        expiry_date: form.expiry_date,
        kyc_status: form.kyc_status as "pending" | "under_review" | "approved" | "rejected" | "archived",
      });

      if ("error" in res && res.error) {
        setStatus({ type: "error", text: res.error });
        return;
      }

      setStatus({ type: "success", text: "Identity and KYC details updated." });
      setIsEditing(false);
      onProfileUpdated?.();
    });
  };

  return (
    <div className={cardStyles.panel}>
      <div className={`${cardStyles.panelHeader} ${cardStyles.panelHeaderComfort}`}>
        <h2 className={`${cardStyles.panelTitle} ${cardStyles.panelTitleAccent}`}>
          <ShieldCheck size={18} />
          Identity &amp; KYC Management
        </h2>
        {!isEditing && (
          <button type="button" className={formStyles.btnSecondary} onClick={() => setIsEditing(true)}>
            <Pencil size={14} />
            Edit Details
          </button>
        )}
      </div>

      <div className={cardStyles.panelBody}>
        {status && (
          <p className={`${formStyles.saveStatus} ${formStyles.saveStatusBlock} ${status.type === "success" ? formStyles.saveStatusSuccess : formStyles.saveStatusError}`}>
            {status.text}
          </p>
        )}

        {isEditing ? (
          <>
            <div className={formStyles.fieldRow}>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>First Name</label>
                <input className={formStyles.input} value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Last Name</label>
                <input className={formStyles.input} value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Email</label>
                <input className={formStyles.input} value={form.email} onChange={(e) => setField("email", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Phone</label>
                <input className={formStyles.input} value={form.mobile_number} onChange={(e) => setField("mobile_number", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Date of Birth</label>
                <CustomDatePicker
                  value={form.dob}
                  onChange={(val) => setField("dob", val)}
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Street Address</label>
                <input className={formStyles.input} value={form.address} onChange={(e) => setField("address", e.target.value)} />
                <span className={formStyles.hintText}>
                  Use the customer&apos;s residential address exactly as shown on their bank statement or identity document.
                </span>
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Country</label>
                <SelectBox
                  className={formStyles.input}
                  groups={[
                    {
                      label: "Common",
                      options: [
                        "Australia", "Iran", "United Arab Emirates", "Canada",
                        "Turkey", "United Kingdom", "United States",
                      ],
                    },
                    {
                      label: "All Countries",
                      options: [
                        "Afghanistan","Albania","Algeria","Argentina","Armenia",
                        "Austria","Azerbaijan","Bahrain","Bangladesh","Belgium",
                        "Brazil","Bulgaria","China","Croatia","Cyprus",
                        "Czech Republic","Denmark","Egypt","Estonia","Finland",
                        "France","Georgia","Germany","Greece","Hong Kong",
                        "Hungary","India","Indonesia","Iraq","Ireland","Italy",
                        "Japan","Jordan","Kazakhstan","Kuwait","Kyrgyzstan",
                        "Latvia","Lebanon","Libya","Lithuania","Malaysia",
                        "Mexico","Netherlands","Nigeria","Norway","Oman",
                        "Pakistan","Philippines","Poland","Portugal","Qatar",
                        "Romania","Russia","Saudi Arabia","Serbia","Singapore",
                        "Slovakia","Slovenia","South Africa","South Korea","Spain",
                        "Sri Lanka","Sweden","Switzerland","Syria","Tajikistan",
                        "Thailand","Tunisia","Turkmenistan","Ukraine","Uzbekistan",
                        "Vietnam","Yemen",
                      ],
                    },
                  ]}
                  value={form.country}
                  onChange={(val) => setForm((prev) => ({ ...prev, country: val, state: "", city: "", postcode: "" }))}
                />
              </div>
              {form.country === "Australia" ? (
                <AustralianLocationFields
                  key={normalizeAustralianState(form.state) || "AU-admin-kyc"}
                  state={normalizeAustralianState(form.state)}
                  city={form.city}
                  postalCode={form.postcode}
                  disabled={isPending}
                  ui={{
                    fieldGroupClassName: formStyles.fieldGroup,
                    labelClassName: formStyles.label,
                    inputClassName: formStyles.input,
                    errorTextClassName: formStyles.errorText,
                    hintTextClassName: formStyles.hintText,
                  }}
                  onStateChange={(value) => setForm((prev) => ({ ...prev, state: value, city: "", postcode: "" }))}
                  onCityChange={(value) => setField("city", value)}
                  onPostalCodeChange={(value) => setField("postcode", value)}
                />
              ) : (
                <>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>City</label>
                    <input className={formStyles.input} value={form.city} onChange={(e) => setField("city", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>State</label>
                    <input className={formStyles.input} value={form.state} onChange={(e) => setField("state", e.target.value)} />
                  </div>
                  <div className={formStyles.fieldGroup}>
                    <label className={formStyles.label}>Postcode</label>
                    <input className={formStyles.input} value={form.postcode} onChange={(e) => setField("postcode", e.target.value)} />
                  </div>
                </>
              )}
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Document Type</label>
                <SelectBox
                  className={formStyles.input}
                  labeledOptions={[
                    { value: "", label: "None" },
                    { value: "driver_license", label: "Driver Licence" },
                    { value: "passport", label: "Passport" },
                    { value: "none", label: "None" },
                  ]}
                  value={form.document_type}
                  onChange={(val) => setField("document_type", val)}
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Issuing Authority</label>
                <SelectBox
                  className={formStyles.input}
                  labeledOptions={[{ value: "", label: "— Select issuer —" }, ...AU_DRIVER_LICENCE_ISSUER_OPTIONS]}
                  value={form.state_of_issue}
                  onChange={(val) => setField("state_of_issue", val)}
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Licence Number</label>
                <input className={formStyles.input} value={form.license_number} onChange={(e) => setField("license_number", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Card Number</label>
                <input className={formStyles.input} value={form.card_number} onChange={(e) => setField("card_number", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Passport Number</label>
                <input className={formStyles.input} value={form.passport_number} onChange={(e) => setField("passport_number", e.target.value)} />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Expiry Date</label>
                <CustomDatePicker
                  value={form.expiry_date}
                  onChange={(val) => setField("expiry_date", val)}
                />
              </div>
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>KYC Status</label>
                <SelectBox
                  className={formStyles.input}
                  labeledOptions={[
                    { value: "pending", label: "Pending" },
                    { value: "under_review", label: "Under Review" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                    { value: "archived", label: "Archived" },
                  ]}
                  value={form.kyc_status}
                  onChange={(val) => setField("kyc_status", val)}
                />
              </div>
            </div>

            <div className={formStyles.formActionsSpaced}>
              <button
                type="button"
                className={`${formStyles.btnPrimary} ${formStyles.btnLg}`}
                onClick={saveProfile}
                disabled={isPending}
              >
                <Save size={14} />
                {isPending ? "Saving..." : "Save Identity/KYC"}
              </button>
              <button
                type="button"
                className={`${formStyles.btnSecondary} ${formStyles.btnLg}`}
                onClick={() => setIsEditing(false)}
                disabled={isPending}
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          </>
        ) : (
        <dl className={cardStyles.kycDetailList}>            {/* Customer Code — editable */}
            <div className={cardStyles.kycDetailRow}>
              <dt className={cardStyles.kycDetailRowLabel}>Customer Code</dt>
              <dd className={cardStyles.kycDetailRowValue}>
                {profile ? (
                  <EditableCustomerCode
                    userId={profile.id}
                    currentCode={(profile as Record<string, unknown>).customer_code as string | null}
                  />
                ) : "—"}
              </dd>
            </div>          {ROWS.map(([label, getValue]) => {
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
        )}

        <div className={cardStyles.kycStatusFooter}>
          <div className={cardStyles.kycStatusLeft}>
            Current Status
            <StatusBadge status={profile?.kyc_status ?? null} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
            {profile && (
              <ComplianceCheckButtons
                userId={profile.id}
                country={(profile as Record<string, unknown>).country as string | null}
                documentType={(profile as Record<string, unknown>).document_type as string | null}
                initialDvsStatus={(profile as Record<string, unknown>).compliance_dvs_status as string | null}
                initialDvsMethod={(profile as Record<string, unknown>).compliance_dvs_method as string | null}
                initialDvsCheckedAt={(profile as Record<string, unknown>).compliance_dvs_checked_at as string | null}
                initialDvsOutcome={(profile as Record<string, unknown>).compliance_dvs_outcome as string | null}
                initialAmlStatus={(profile as Record<string, unknown>).compliance_aml_status as string | null}
                initialAmlMethod={(profile as Record<string, unknown>).compliance_aml_method as string | null}
                initialAmlCheckedAt={(profile as Record<string, unknown>).compliance_aml_checked_at as string | null}
                initialAmlOutcome={(profile as Record<string, unknown>).compliance_aml_outcome as string | null}
                initialAmlFlag={(profile as Record<string, unknown>).compliance_aml_flag as "none" | "clear" | "review_required" | "failed" | null}
                initialCustomerFlagged={(profile as Record<string, unknown>).compliance_customer_flagged as boolean | null}
                initialCustomerFlagReason={(profile as Record<string, unknown>).compliance_customer_flag_reason as string | null}
                initialCustomerNote={(profile as Record<string, unknown>).compliance_admin_note as string | null}
                onSaved={onProfileUpdated}
              />
            )}
            {profile && <KycActionButtons userId={profile.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
