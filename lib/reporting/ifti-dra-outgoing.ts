import ExcelJS from "exceljs";

export const IFTI_DRA_OUT_SHEET_NAME = "IFTI-DRA OUT";

const TEMPLATE_COLUMN_COUNT = 112;
const HEADER_GROUP_ROW = new Array<string>(TEMPLATE_COLUMN_COUNT).fill("");
const HEADER_GROUPS: Array<[number, string]> = [
  [0, "Transaction details"],
  [7, "Ordering customer"],
  [10, "Ordering customer contact details"],
  [22, "Ordering customer business details"],
  [27, "Ordering customer identification details"],
  [36, "Beneficiary customer"],
  [39, "Beneficiary customer contact details"],
  [51, "Beneficiary customer business details"],
  [54, "Beneficiary customer account details"],
  [58, "Person/organisation accepting the transfer instruction from the ordering customer"],
  [66, "Person/organisation accepting the money or property from the ordering customer (if different)"],
  [71, "Person/organisation sending the transfer instruction (if different)"],
  [87, "Person/organisation receiving the transfer instruction"],
  [95, "Person/organisation distributing money or property (if different)"],
  [101, "Retail outlet/business location where money or property is being distributed (if different)"],
  [107, "Reason"],
  [108, "Person completing this report"],
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
  "Account number (held by remitter)",
  "Business structure (if not an individual)",
  "ID type (1)",
  "ID type (if 'Other')",
  "Number",
  "Issuer",
  "ID type (2)",
  "ID type (if 'Other')",
  "Number",
  "Issuer",
  "Electronic data source",
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
  "Identification number of the retail outlet/business location",
  "Full name",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Is this person/organisation accepting the money or property?",
  "Is this person/organisation sending the transfer instruction?",
  "Full name",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Full name",
  "If known by any other name",
  "Date of birth (if an individual)",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Postal address",
  "City/town/suburb",
  "State",
  "Postcode",
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
  "Country",
  "Is this person/organisation distributing money or property?",
  "Is there a separate retail outlet/business location at which the money or property is being distributed?",
  "Full name",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
  "Full name",
  "Business/residential address (not a post box address)",
  "City/town/suburb",
  "State",
  "Postcode",
  "Country",
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
    irt_address?: string | null;
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

function fullName(first?: string | null, last?: string | null): string {
  return [first, last].map((v) => asString(v)).filter(Boolean).join(" ");
}

function resolveIdType(documentType?: string | null): string {
  if (documentType === "driver_license") return "Driver's Licence";
  if (documentType === "passport") return "Passport";
  return "";
}

function createDataRow(record: IftiSourceRecord): Array<string | number> {
  const profile = record.profiles ?? null;
  const recipient = record.recipients ?? null;
  const orderingName = fullName(profile?.first_name, profile?.last_name);
  const beneficiaryName = asString(recipient?.full_name) || asString(recipient?.account_name) || asString(recipient?.label);
  const orderingCountry = asString(profile?.country) || "Australia";
  const beneficiaryCountry = recipient?.direction === "aud" ? "Australia" : "Iran";

  const row: Array<string | number> = new Array(112).fill("");

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
  row[27] = resolveIdType(profile?.document_type);
  row[29] = asString(profile?.document_type === "driver_license" ? profile?.license_number : profile?.passport_number);
  row[30] = asString(profile?.document_type === "driver_license" ? profile?.state_of_issue : "");
  row[35] = asString(profile?.compliance_dvs_method);

  row[36] = beneficiaryName;
  row[39] = asString(recipient?.residential_address) || asString(recipient?.irt_address);
  row[43] = beneficiaryCountry;
  row[49] = asString(recipient?.recipient_phone) || asString(recipient?.irt_phone);
  row[50] = asString(recipient?.recipient_email);
  row[54] = asString(recipient?.account_number) || asString(recipient?.irt_account_number) || asString(recipient?.card_number) || asString(recipient?.shaba_number);
  row[55] = asString(recipient?.bank_name);
  row[57] = beneficiaryCountry;

  // Person/organisation accepting the transfer instruction from the ordering customer — Zarman Exchange
  row[59] = "ZARMAN EXCHANGE PTY LTD";
  row[60] = "Unit W2608 108 Donnison St";
  row[61] = "GOSFORD";
  row[62] = "NSW";
  row[63] = "2250";
  row[64] = "Yes"; // accepting money or property
  row[65] = "Yes"; // sending the transfer instruction

  // Person/organisation receiving the transfer instruction — Zarman's Iranian agent
  row[87] = "ZARMAN EXCHANGE PTY LTD (AGENT) - Nahid BabaeiLakeh";
  row[88] = "Unit 4, Manzariye Street";
  row[89] = "Rasht";
  row[90] = "Gilan";
  row[92] = "IRAN, ISLAMIC REPUBLICOF";
  row[93] = "Yes"; // distributing money or property
  row[94] = "No";  // no separate retail outlet

  row[107] = asString(record.reason_for_transfer) || asString(record.source_of_funds);
  // Person completing this report — always Zarman's compliance officer
  row[108] = "PEZHMAN MAHMOUDI";
  row[109] = "AML/CTF Compliance Officer";
  row[110] = "0426464296";
  row[111] = "info@zarman.com.au";

  return row;
}

export async function generateIftiDraOutgoingWorkbook(records: IftiSourceRecord[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zarman Admin";
  workbook.created = new Date();

  const ws = workbook.addWorksheet(IFTI_DRA_OUT_SHEET_NAME, {
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
