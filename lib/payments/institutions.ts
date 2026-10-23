export const AMC_PROFILE = {
  legalName: "Australian Medical Council Limited",
  businessName: "Australian Medical Council",
  // amc.org.au publishes only its PO Box; AUSTRAC needs a street address.
  streetAddress: "Level 3, 11 Lancaster Place",
  city: "Canberra Airport",
  state: "ACT",
  postcode: "2609",
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
  legalName: "Cambridge Boxhill Language Assessment Pty Ltd ATF Cambridge Boxhill Language Assessment Unit Trust",
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

// EPIC credential verification for AMC applicants, paid through myintealth.app.
// Intealth is the private nonprofit that ECFMG and FAIMER operate under.
export const INTEALTH_PROFILE = {
  legalName: "Intealth",
  businessName: "EPIC (Electronic Portfolio of International Credentials)",
  streetAddress: "3624 Market Street",
  city: "Philadelphia",
  state: "PA",
  postcode: "19104",
  country: "United States of America",
  postalAddress: "",
  postalCity: "",
  postalState: "",
  postalPostcode: "",
  postalCountry: "",
  phone: "",
  email: "",
  principalActivity: "Primary-source verification of medical credentials",
  abn: "",
  businessStructure: "",
  accountInstitution: "",
};

export const RACGP_PROFILE = {
  legalName: "The Royal Australian College of General Practitioners Limited",
  businessName: "RACGP",
  streetAddress: "RACGP House, 100 Wellington Parade",
  city: "East Melbourne",
  state: "VIC",
  postcode: "3002",
  country: "Australia",
  postalAddress: "",
  postalCity: "",
  postalState: "",
  postalPostcode: "",
  postalCountry: "",
  phone: "1800 472 247",
  email: "racgp@racgp.org.au",
  principalActivity: "Professional college for general practitioners: training, assessment and fellowship",
  abn: "34 000 223 807",
  businessStructure: "",
  accountInstitution: "",
};

export const AHPRA_PROFILE = {
  legalName: "Australian Health Practitioner Regulation Agency",
  businessName: "Ahpra",
  streetAddress: "Level 9, 222 Lonsdale Street",
  city: "Melbourne",
  state: "VIC",
  postcode: "3000",
  country: "Australia",
  postalAddress: "GPO Box 9958",
  postalCity: "Melbourne",
  postalState: "VIC",
  postalPostcode: "3001",
  postalCountry: "Australia",
  phone: "1300 419 495",
  email: "",
  principalActivity: "National regulator of registered health practitioners",
  abn: "78 685 433 429",
  businessStructure: "",
  accountInstitution: "",
};

export const ADC_PROFILE = {
  legalName: "Australian Dental Council Limited",
  businessName: "Australian Dental Council",
  streetAddress: "Level 6, 469 La Trobe Street",
  city: "Melbourne",
  state: "VIC",
  postcode: "3000",
  country: "Australia",
  postalAddress: "PO Box 13278",
  postalCity: "Law Courts",
  postalState: "VIC",
  postalPostcode: "8010",
  postalCountry: "Australia",
  phone: "+61 3 9657 1777",
  email: "",
  principalActivity: "Accreditation and assessment of dental practitioners",
  abn: "70 072 269 900",
  businessStructure: "",
  accountInstitution: "",
};

export const HOME_AFFAIRS_PROFILE = {
  legalName: "Department of Home Affairs",
  businessName: "Home Affairs",
  // The department publishes only its PO Box; confirm this street address before relying on it.
  streetAddress: "6 Chan Street",
  city: "Belconnen",
  state: "ACT",
  postcode: "2617",
  country: "Australia",
  postalAddress: "PO Box 25",
  postalCity: "Belconnen",
  postalState: "ACT",
  postalPostcode: "2616",
  postalCountry: "Australia",
  phone: "(02) 6264 1111",
  email: "",
  principalActivity: "Australian Government department: visas, immigration and citizenship",
  abn: "33 380 054 835",
  businessStructure: "",
  accountInstitution: "",
};

// Thinkific course storefront; only the brand is published, so the remaining fields await review.
export const IMG4IMGS_PROFILE = {
  legalName: "IMG4IMGS",
  businessName: "IMG4IMGS",
  streetAddress: "",
  city: "",
  state: "",
  postcode: "",
  country: "",
  postalAddress: "",
  postalCity: "",
  postalState: "",
  postalPostcode: "",
  postalCountry: "",
  phone: "",
  email: "",
  principalActivity: "Online AMC exam preparation courses",
  abn: "",
  businessStructure: "",
  accountInstitution: "",
};

/**
 * Existing reporting beneficiaries; add new institutions here after review.
 * `linkPattern` identifies legacy transactions (no request record) from their lower-cased payment link.
 */
export const paymentInstitutions = [
  { id: "amc", name: "AMC", companyName: AMC_PROFILE.legalName, profile: AMC_PROFILE, linkPattern: /amc/ },
  // The AUSTRAC report keeps the full trustee name; customers see one name.
  { id: "oet", name: "OET", companyName: "Cambridge Boxhill Language Assessment Pty Ltd", profile: OET_PROFILE, linkPattern: /registration\.myoet\.com|booking\.oet-global\.com/ },
  { id: "intealth", name: "EPIC", companyName: INTEALTH_PROFILE.legalName, profile: INTEALTH_PROFILE, linkPattern: /myintealth\.app/ },
  { id: "racgp", name: "RACGP", companyName: RACGP_PROFILE.legalName, profile: RACGP_PROFILE, linkPattern: /racgp\.org\.au/ },
  { id: "ahpra", name: "Ahpra", companyName: AHPRA_PROFILE.legalName, profile: AHPRA_PROFILE, linkPattern: /ahpra\.gov\.au/ },
  { id: "adc", name: "ADC", companyName: ADC_PROFILE.legalName, profile: ADC_PROFILE, linkPattern: /adc\.org\.au/ },
  { id: "homeaffairs", name: "Home Affairs", companyName: HOME_AFFAIRS_PROFILE.legalName, profile: HOME_AFFAIRS_PROFILE, linkPattern: /immi\.gov\.au|immiaccount/ },
  { id: "img4imgs", name: "IMG4IMGS", companyName: IMG4IMGS_PROFILE.legalName, profile: IMG4IMGS_PROFILE, linkPattern: /img4img/ },
] as const;

export function paymentInstitution(id: string | null | undefined) {
  return paymentInstitutions.find(institution => institution.id === id);
}

/** Resolves a request's institution, including "Other" entries typed as a known name (e.g. "Epic"). */
export function findPaymentInstitution(id: string | null | undefined, name: string | null | undefined) {
  const key = name?.trim().toLowerCase();
  return paymentInstitution(id) ?? (key
    ? paymentInstitutions.find(institution => [institution.id, institution.name, institution.companyName].some(value => value.toLowerCase() === key))
    : undefined);
}

export function normalizeInstitutionPaymentLink(value: string): string {
  const link = value.trim();
  // Preserve explicit schemes so validation can reject non-HTTPS links.
  if (!link || /^[a-z][a-z\d+.-]*:/i.test(link)) return link;
  const candidate = link.startsWith("//") ? `https:${link}` : `https://${link}`;
  try {
    return new URL(candidate).hostname.includes(".") && isInstitutionPaymentLink(candidate) ? candidate : link;
  } catch { return link; }
}

export function isInstitutionPaymentLink(value: string): boolean {
  try {
    const url = new URL(value);
    const sensitiveKeys = [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()];
    return url.protocol === "https:" && !url.username && !url.password && url.href.length <= 2000
      && !sensitiveKeys.some(key => /^(password|passwd|pwd|pass|user_password|login_password)$/i.test(key));
  } catch { return false; }
}
