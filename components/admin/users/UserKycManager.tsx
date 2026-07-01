"use client";

import React, { useEffect, useState, useTransition } from "react";
import { ShieldCheck, Pencil, Save, X } from "lucide-react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import formStyles from "@/styles/admin/AdminForms.module.css";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { KycActionButtons } from "@/components/admin/KycActionButtons";
import { EditableCustomerCode } from "@/components/admin/EditableCustomerCode";
import { updateUserIdentityKycProfile } from "@/app/actions/admin.actions";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
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
  ["State of Issue",  (p) => (p as Record<string, unknown>).state_of_issue as string | null],
  ["Licence Number",  (p) => (p as Record<string, unknown>).license_number  as string | null],
  ["Card Number",     (p) => (p as Record<string, unknown>).card_number      as string | null],
  ["Passport Number", (p) => (p as Record<string, unknown>).passport_number  as string | null],
  ["Expiry Date",     (p) => (p as Record<string, unknown>).expiry_date      as string | null],
];

export function UserKycManager({ profile, onProfileUpdated }: UserKycManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    mobile_number: "",
    dob: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    country: "",
    document_type: "",
    state_of_issue: "",
    license_number: "",
    card_number: "",
    passport_number: "",
    expiry_date: "",
    kyc_status: "pending",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      email: profile.email ?? "",
      mobile_number: profile.mobile_number ?? "",
      dob: (profile as Record<string, unknown>).dob as string ?? "",
      address: (profile as Record<string, unknown>).address as string ?? "",
      city: (profile as Record<string, unknown>).city as string ?? "",
      state: (profile as Record<string, unknown>).state as string ?? "",
      postcode: (profile as Record<string, unknown>).postcode as string ?? "",
      country: (profile as Record<string, unknown>).country as string ?? "",
      document_type: (profile as Record<string, unknown>).document_type as string ?? "",
      state_of_issue: (profile as Record<string, unknown>).state_of_issue as string ?? "",
      license_number: (profile as Record<string, unknown>).license_number as string ?? "",
      card_number: (profile as Record<string, unknown>).card_number as string ?? "",
      passport_number: (profile as Record<string, unknown>).passport_number as string ?? "",
      expiry_date: (profile as Record<string, unknown>).expiry_date as string ?? "",
      kyc_status: (profile as Record<string, unknown>).kyc_status as string ?? "pending",
    });
  }, [profile]);

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
              </div>
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
              <div className={formStyles.fieldGroup}>
                <label className={formStyles.label}>Country</label>
                <input className={formStyles.input} value={form.country} onChange={(e) => setField("country", e.target.value)} />
              </div>
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
                <label className={formStyles.label}>State of Issue</label>
                <input className={formStyles.input} value={form.state_of_issue} onChange={(e) => setField("state_of_issue", e.target.value)} />
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
          <div>
            {profile && <KycActionButtons userId={profile.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
