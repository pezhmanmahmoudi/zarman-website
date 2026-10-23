export const ACCOUNT_SUSPENDED_FLAG_REASON = "[ACCOUNT_SUSPENDED]";

export function isProfileSuspended(
  profile: { kyc_status?: string | null; compliance_customer_flag_reason?: unknown } | null | undefined,
): boolean {
  if (!profile || typeof profile !== "object") return false;
  return (
    profile.kyc_status === "suspended" ||
    profile.compliance_customer_flag_reason === ACCOUNT_SUSPENDED_FLAG_REASON
  );
}

export function normalizeProfileKycStatus<
  T extends { kyc_status?: string | null; compliance_customer_flag_reason?: unknown } | null | undefined,
>(profile: T): T {
  if (!profile || typeof profile !== "object") return profile;
  if (isProfileSuspended(profile) && profile.kyc_status !== "suspended") {
    return { ...profile, kyc_status: "suspended" };
  }
  return profile;
}

