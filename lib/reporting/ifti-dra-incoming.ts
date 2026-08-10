import ExcelJS from "exceljs";

export const IFTI_DRA_IN_SHEET_NAME = "IFTI-DRA IN";

const TEMPLATE_COLUMN_COUNT = 115;
const HEADER_GROUP_ROW = new Array<string>(TEMPLATE_COLUMN_COUNT).fill("");
const HEADER_GROUPS: Array<[number, string]> = [
  [0, "Transaction details"],
  [7, "Ordering customer"],
  [10, "Ordering customer contact details"],
  [22, "Ordering customer business details"],
  [27, "Beneficiary customer"],
  [30, "Beneficiary customer contact details"],
  [42, "Beneficiary customer business details"],
  [45, "Beneficiary customer account details"],
  [49, "Person/organisation accepting the transfer instruction from the ordering customer"],
  [68, "Person/organisation accepting the money or property from the ordering customer (if different)"],
  [74, "Person/organisation sending the transfer instruction (if different)"],
  [92, "Person/organisation receiving the transfer instruction"],
  [99, "Person/organisation distributing money or property (if different)"],
  [104, "Retail outlet/business location where money or property is being distributed (if different)"],
  [110, "Reason"],
  [111, "Person completing this report"],
];

HEADER_GROUPS.forEach(([index, label]) => {
  HEADER_GROUP_ROW[index] = label;
});

const HEADER_ROW: string[] = [
  "Date money/property received from the ordering customer",
  "Date money/property made available to the beneficiary customer",
  "Currency code",
  "Total amount/value",
  "Type of transfer",
  "Description of property",
  "Transaction reference number",
  "Full name",
  "If known by any other name",
  "Date of birth (if an individual)",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Postal address",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Phone",
  "Email",
  "Occupation, business or principal activity",
  "ABN, ACN or ARBN",
  "Customer number (allocated by remitter)",
  "Account number",
  "Business structure (if not an individual)",
  "Full name",
  "Date of birth (if an individual)",
  "Any business name under which the beneficiary customer is operating",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Postal address",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Phone",
  "Email",
  "Occupation, business or principal activity",
  "ABN, ACN or ARBN",
  "Business structure (if not an individual)",
  "Account number",
  "Name of institution (where account is held)",
  "City",
  "Country",
  "Full name",
  "If known by any other name",
  "Date of birth (if an individual)",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Postal address",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Phone",
  "Email",
  "Occupation, business or principal activity",
  "Business structure (if not an individual)",
  "Is this person/organisation accepting the money or property?",
  "Is this person/organisation sending the transfer instruction?",
  "Full name",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Full name",
  "If known by any other name",
  "Date of birth (if an individual)",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Postal address",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Phone",
  "Email",
  "Occupation, business or principal activity",
  "ABN, ACN or ARBN",
  "Business structure (if not an individual)",
  "Full name",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Is this person/organisation distributing money or property?",
  "Is there a separate retail outlet/business location at which the money or property is being distributed?",
  "Full name",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Identification number of the retail outlet/business location",
  "Full name",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Reason for the transfer",
  "Full name",
  "Job title",
  "Phone",
  "Email",
];

if (HEADER_ROW.length !== TEMPLATE_COLUMN_COUNT) {
  throw new Error(`IFTI-DRA field header schema must contain exactly ${TEMPLATE_COLUMN_COUNT} columns.`);
}

export type IftiSourceRecord = {
  id: string;
  type: "buy_aud" | "sell_aud" | string;
  amount_aud: number | string | null;
  status: string | null;
  created_at: string;
  approved_at?: string | null;
  payment_link?: string | null;
  reference_code?: string | null;
  reason_for_transfer?: string | null;
  source_of_funds?: string | null;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    customer_code?: string | null;
    mobile_number?: string | null;
    dob?: string | null;
    country?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postcode?: string | null;
    document_type?: string | null;
    license_number?: string | null;
    card_number?: string | null;
    state_of_issue?: string | null;
    passport_number?: string | null;
    compliance_dvs_method?: string | null;
  } | null;
  recipients?: {
    direction?: string | null;
    label?: string | null;
    full_name?: string | null;
    account_name?: string | null;
    residential_address?: string | null;
    residential_city?: string | null;
    residential_state?: string | null;
    residential_postcode?: string | null;
    residential_country?: string | null;
    irt_address?: string | null;
    irt_city?: string | null;
    irt_state?: string | null;
    irt_postcode?: string | null;
    irt_country?: string | null;
    recipient_phone?: string | null;
    recipient_email?: string | null;
    irt_phone?: string | null;
    account_number?: string | null;
    card_number?: string | null;
    shaba_number?: string | null;
    irt_account_number?: string | null;
    bank_name?: string | null;
  } | null;
};

function normalizeDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTemplateDate(value?: string | null): string {
  const d = normalizeDate(value);
  if (!d) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function formatDob(value?: string | null): string {
  if (!value) return "";
  const raw = value.trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [, m, d] = raw.split("-");
    // AUSTRAC DOB format: mm/dd/yyyy
    return `${m}/${d}/${raw.slice(0, 4)}`;
  }
  const parsed = normalizeDate(raw);
  if (!parsed) return raw;
  return `${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}/${parsed.getFullYear()}`;
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function splitBeneficiaryAddress(rawAddress: string): {
  street: string;
  city: string;
  state: string;
  postcode: string;
} {
  const normalized = rawAddress.replace(/\s+/g, " ").trim();
  if (!normalized) return { street: "", city: "", state: "", postcode: "" };

  const postcodeMatch = normalized.match(/\b(\d{4})\b(?!.*\b\d{4}\b)/);
  const postcode = postcodeMatch?.[1] ?? "";

  const stateMatch = normalized.match(/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i);
  const state = stateMatch?.[1]?.toUpperCase() ?? "";

  let working = normalized;
  if (postcode) working = working.replace(new RegExp(`\\b${postcode}\\b`), "").trim();
  if (state) working = working.replace(new RegExp(`\\b${state}\\b`, "i"), "").trim();
  working = working.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").replace(/^,|,$/g, "").trim();

  let city = "";
  let street = "";
  if (working.includes(",")) {
    const parts = working.split(",").map((p) => p.trim()).filter(Boolean);
    city = parts.length > 0 ? parts[parts.length - 1] : "";
    street = parts.length > 1 ? parts.slice(0, -1).join(", ") : "";
  } else {
    const words = working.split(" ").filter(Boolean);
    if (words.length >= 3) {
      city = words.slice(-2).join(" ");
      street = words.slice(0, -2).join(" ");
    } else {
      street = working;
    }
  }

  return { street: street.trim(), city: city.trim(), state, postcode };
}

function inferAustralianStateFromPostcode(postcode: string): string {
  if (!/^\d{4}$/.test(postcode)) return "";
  const pc = Number(postcode);

  if ((pc >= 200 && pc <= 299) || (pc >= 2600 && pc <= 2618) || (pc >= 2900 && pc <= 2920)) return "ACT";
  if (pc >= 800 && pc <= 999) return "NT";
  if ((pc >= 1000 && pc <= 2599) || (pc >= 2619 && pc <= 2899) || (pc >= 2921 && pc <= 2999)) return "NSW";
  if ((pc >= 3000 && pc <= 3999) || (pc >= 8000 && pc <= 8999)) return "VIC";
  if ((pc >= 4000 && pc <= 4999) || (pc >= 9000 && pc <= 9999)) return "QLD";
  if ((pc >= 5000 && pc <= 5799) || (pc >= 5800 && pc <= 5999)) return "SA";
  if ((pc >= 6000 && pc <= 6797) || (pc >= 6800 && pc <= 6999)) return "WA";
  if ((pc >= 7000 && pc <= 7799) || (pc >= 7800 && pc <= 7999)) return "TAS";

  return "";
}

function fullName(first?: string | null, last?: string | null): string {
  return [first, last].map((v) => asString(v)).filter(Boolean).join(" ");
}

const AMC_PROFILE = {
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
};

function createDataRow(record: IftiSourceRecord): Array<string | number> {
  const profile = record.profiles ?? null;
  const recipient = record.recipients ?? null;
  const paymentLink = asString(record.payment_link).toLowerCase();
  const isInternationalPaymentReceiver = !recipient && !!paymentLink;
  const looksLikeAmcPayment = isInternationalPaymentReceiver && paymentLink.includes("amc");
  const orderingName = fullName(profile?.first_name, profile?.last_name);
  const beneficiaryName =
    asString(recipient?.full_name) ||
    asString(recipient?.account_name) ||
    asString(recipient?.label) ||
    (looksLikeAmcPayment ? AMC_PROFILE.legalName : "");
  const orderingCountry = asString(profile?.country) || "Australia";
  const beneficiaryAddress = asString(recipient?.residential_address) || asString(recipient?.irt_address);
  const parsedAddress = splitBeneficiaryAddress(beneficiaryAddress);
  const beneficiaryCity = asString(recipient?.residential_city) || asString(recipient?.irt_city) || parsedAddress.city;
  const beneficiaryPostcode = asString(recipient?.residential_postcode) || asString(recipient?.irt_postcode) || parsedAddress.postcode;
  const inferredState = inferAustralianStateFromPostcode(beneficiaryPostcode);
  const beneficiaryState = asString(recipient?.residential_state) || asString(recipient?.irt_state) || parsedAddress.state || inferredState;
  const beneficiaryCountryValue = asString(recipient?.residential_country) || asString(recipient?.irt_country);
  const beneficiaryCountry = beneficiaryCountryValue || (looksLikeAmcPayment ? "Australia" : "");

  const row: Array<string | number> = new Array(TEMPLATE_COLUMN_COUNT).fill("");

  // Use approval date for AUSTRAC report; fall back to created_at only if not yet stamped
  const reportDate = record.approved_at || record.created_at;
  row[0] = formatTemplateDate(reportDate);
  row[1] = formatTemplateDate(reportDate);
  row[2] = "AUD";
  row[3] = Number(record.amount_aud ?? 0) || 0;
  row[4] = "Money";
  row[5] = "";
  row[6] = asString(record.reference_code) || asString(record.id);
  row[7] = orderingName;
  row[9] = formatDob(profile?.dob ?? null);
  row[10] = asString(profile?.address);
  row[11] = asString(profile?.city);
  row[12] = asString(profile?.state);
  row[13] = asString(profile?.postcode);
  row[14] = orderingCountry;
  row[20] = asString(profile?.mobile_number);
  row[21] = asString(profile?.email);
  row[24] = asString(profile?.customer_code);
  row[25] = "";
  row[26] = "Individual";

  row[27] = looksLikeAmcPayment ? AMC_PROFILE.legalName : beneficiaryName;
  row[29] = looksLikeAmcPayment ? AMC_PROFILE.businessName : "";
  row[30] = looksLikeAmcPayment ? AMC_PROFILE.streetAddress : (parsedAddress.street || beneficiaryAddress);
  row[31] = looksLikeAmcPayment ? AMC_PROFILE.city : beneficiaryCity;
  row[32] = looksLikeAmcPayment ? AMC_PROFILE.state : beneficiaryState;
  row[33] = looksLikeAmcPayment ? AMC_PROFILE.postcode : beneficiaryPostcode;
  row[34] = looksLikeAmcPayment ? AMC_PROFILE.country : beneficiaryCountry;
  row[35] = looksLikeAmcPayment ? AMC_PROFILE.postalAddress : "";
  row[36] = looksLikeAmcPayment ? AMC_PROFILE.postalCity : "";
  row[37] = looksLikeAmcPayment ? AMC_PROFILE.postalState : "";
  row[38] = looksLikeAmcPayment ? AMC_PROFILE.postalPostcode : "";
  row[39] = looksLikeAmcPayment ? AMC_PROFILE.postalCountry : "";
  row[40] = looksLikeAmcPayment
    ? AMC_PROFILE.phone
    : (asString(recipient?.recipient_phone) || asString(recipient?.irt_phone));
  row[41] = looksLikeAmcPayment ? AMC_PROFILE.email : asString(recipient?.recipient_email);
  row[42] = "";
  row[43] = looksLikeAmcPayment ? AMC_PROFILE.abn : "";
  row[44] = "";
  row[45] = asString(recipient?.account_number) || asString(recipient?.irt_account_number) || asString(recipient?.card_number) || asString(recipient?.shaba_number);
  row[46] = looksLikeAmcPayment ? AMC_PROFILE.legalName : asString(recipient?.bank_name);
  row[47] = looksLikeAmcPayment ? AMC_PROFILE.city : beneficiaryCity;
  row[48] = looksLikeAmcPayment ? AMC_PROFILE.country : beneficiaryCountry;

  // Person/organisation accepting the transfer instruction from the ordering customer — Zarman's Iranian agent
  row[49] = "ZARMAN EXCHANGE PTY LTD (AGENT) - Nahid BabaeiLakeh";
  row[52] = "Unit 4, Manzariye Street";
  row[53] = "Rasht";
  row[54] = "Gilan";
  row[56] = "IRAN, ISLAMIC REPUBLICOF";
  row[62] = "";
  row[63] = "";
  row[64] = "";
  row[65] = "";
  row[66] = "Yes";
  row[67] = "Yes";

  // Person/organisation receiving the transfer instruction — Zarman Exchange in Australia
  row[92] = "ZARMAN EXCHANGE PTY LTD";
  row[93] = "Unit W2608 108 Donnison St";
  row[94] = "GOSFORD";
  row[95] = "NSW";
  row[96] = "2250";
  row[97] = "Yes";
  row[98] = "No";

  row[110] = asString(record.reason_for_transfer) || asString(record.source_of_funds);
  // Person completing this report — always Zarman's compliance officer
  row[111] = "PEZHMAN MAHMOUDI";
  row[112] = "AML/CTF Compliance Officer";
  row[113] = "0426464296";
  row[114] = "info@zarman.com.au";

  return row;
}

export async function generateIftiDraIncomingWorkbook(records: IftiSourceRecord[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zarman Admin";
  workbook.created = new Date();

  const ws = workbook.addWorksheet(IFTI_DRA_IN_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  ws.addRow(HEADER_GROUP_ROW);
  ws.addRow(HEADER_ROW);

  for (const record of records) {
    ws.addRow(createDataRow(record));
  }

  HEADER_ROW.forEach((header, index) => {
    const lowerHeader = header.toLowerCase();
    const column = ws.getColumn(index + 1);
    if (index === 3) column.width = 15;
    else if (lowerHeader.includes("date")) column.width = 16;
    else if (lowerHeader.includes("email")) column.width = 28;
    else if (lowerHeader.includes("address")) column.width = 34;
    else if (lowerHeader.includes("phone")) column.width = 18;
    else if (lowerHeader.includes("name")) column.width = 24;
    else column.width = 20;
  });

  ws.getRow(1).font = { bold: true };
  ws.getRow(2).font = { bold: true };
  ws.getRow(1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  ws.getRow(2).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

  for (let rowIndex = 3; rowIndex <= ws.rowCount; rowIndex++) {
    const amountCell = ws.getCell(rowIndex, 4);
    amountCell.numFmt = "#,##0.00";
  }

  workbook.addWorksheet("Instructions");
  workbook.addWorksheet("Data Validations");

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
