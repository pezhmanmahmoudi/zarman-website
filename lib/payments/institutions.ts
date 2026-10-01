export const AMC_PROFILE = {
  legalName: "Australian Medical Council Limited",
  businessName: "Australian Medical Council",
  streetAddress: "Kingston ACT 2604",
  city: "Kingston",
  state: "ACT",
  postcode: "2604",
  country: "Australia",
  postalAddress: "PO Box 4810",
  postalCity: "Kingston",
  postalState: "ACT",
  postalPostcode: "2604",
  postalCountry: "Australia",
  phone: "+61 2 6270 9777",
  email: "communications@amc.org.au",
  principalActivity: "",
  abn: "97 131 796 980",
  businessStructure: "",
  accountInstitution: "Australian Medical Council Limited",
};

export const OET_PROFILE = {
  legalName: "Cambridge Boxhill Language Assessment Pty Ltd ATF",
  businessName: "OET",
  streetAddress: "Level 17, 452 Flinders Street",
  city: "Melbourne",
  state: "VIC",
  postcode: "3000",
  country: "Australia",
  postalAddress: "",
  postalCity: "",
  postalState: "",
  postalPostcode: "",
  postalCountry: "",
  phone: "",
  email: "",
  principalActivity: "English language testing for healthcare professionals",
  abn: "51 988 559 414",
  businessStructure: "Unit Trust",
  // A booking URL identifies the merchant, not the merchant's bank account.
  accountInstitution: "",
};

/** Existing reporting beneficiaries; add new institutions here after review. */
export const paymentInstitutions = [
  { id: "amc", name: "AMC", companyName: AMC_PROFILE.legalName },
  { id: "oet", name: "OET", companyName: OET_PROFILE.legalName },
] as const;

export function paymentInstitution(id: string | null | undefined) {
  return paymentInstitutions.find(institution => institution.id === id);
}

export function isInstitutionPaymentLink(value: string): boolean {
  try {
    const url = new URL(value);
    const sensitiveKeys = [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()];
    return url.protocol === "https:" && !url.username && !url.password && url.href.length <= 2000
      && !sensitiveKeys.some(key => /^(password|passwd|pwd|pass|user_password|login_password)$/i.test(key));
  } catch { return false; }
}
