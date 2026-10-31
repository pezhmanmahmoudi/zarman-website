// lib/compliance/dfat-import.ts
// Parses the official "Australian Sanctions Consolidated List" workbook (.xlsx) published
// by DFAT into rows for public.sanctions_entries. Pure parsing: no database access.

import ExcelJS from "exceljs";

export type DfatRow = {
  reference: string;
  group_ref: string;
  name: string;
  entry_type: string | null;
  name_type: string | null;
  alias_strength: string | null;
  dob: string | null;
  place_of_birth: string | null;
  citizenship: string | null;
  address: string | null;
  additional_information: string | null;
  listing_information: string | null;
  committees: string | null;
  instrument: string | null;
  control_date: string | null;
  targeted_financial_sanction: boolean | null;
  /** Outside the Australia-Iran corridor: only reported on a strong match. */
  low_relevance: boolean;
};

export type DfatParseResult = {
  rows: DfatRow[];
  sheetName: string;
  latestControlDate: string | null;
};

const REQUIRED_HEADERS = ["reference", "name of individual or entity"];

function cellText(value: ExcelJS.CellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const rich = value as { richText?: Array<{ text: string }>; text?: string; result?: unknown };
    if (Array.isArray(rich.richText)) return rich.richText.map(part => part.text).join("").trim() || null;
    if (typeof rich.text === "string") return rich.text.trim() || null;
    if (rich.result !== undefined) return cellText(rich.result as ExcelJS.CellValue);
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function toBoolean(value: ExcelJS.CellValue | undefined): boolean | null {
  if (typeof value === "boolean") return value;
  const text = cellText(value)?.toLowerCase();
  if (text === "true" || text === "yes") return true;
  if (text === "false" || text === "no") return false;
  return null;
}

function toIsoDate(value: ExcelJS.CellValue | undefined): string | null {
  const text = cellText(value);
  if (!text) return null;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export async function parseDfatWorkbook(data: ArrayBuffer | Buffer): Promise<DfatParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook has no worksheet.");

  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const header = cellText(cell.value)?.toLowerCase();
    if (header) columns.set(header, column);
  });
  if (!REQUIRED_HEADERS.every(header => columns.has(header))) {
    throw new Error("This does not look like the DFAT Consolidated List: expected 'Reference' and 'Name of Individual or Entity' columns.");
  }
  const at = (row: ExcelJS.Row, header: string) => {
    const column = columns.get(header);
    return column ? row.getCell(column).value : undefined;
  };

  const rows: DfatRow[] = [];
  let latest: string | null = null;
  for (let index = 2; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    const reference = cellText(at(row, "reference"));
    const name = cellText(at(row, "name of individual or entity"));
    if (!reference || !name) continue;
    const controlDate = toIsoDate(at(row, "control date"));
    if (controlDate && (!latest || controlDate > latest)) latest = controlDate;
    rows.push({
      reference,
      group_ref: reference.replace(/[^0-9]/g, "") || reference,
      name,
      entry_type: cellText(at(row, "type")),
      name_type: cellText(at(row, "name type")),
      alias_strength: cellText(at(row, "alias strength")),
      dob: cellText(at(row, "date of birth")),
      place_of_birth: cellText(at(row, "place of birth")),
      citizenship: cellText(at(row, "citizenship")),
      address: cellText(at(row, "address")),
      additional_information: cellText(at(row, "additional information")),
      listing_information: cellText(at(row, "listing information")),
      committees: cellText(at(row, "committees")),
      instrument: cellText(at(row, "instrument of designation")),
      control_date: controlDate,
      targeted_financial_sanction: toBoolean(at(row, "targeted financial sanction")),
      low_relevance: false,
    });
  }
  if (!rows.length) throw new Error("No sanctions rows were found in the workbook.");
  return { rows, sheetName: sheet.name, latestControlDate: latest };
}

// ── Scope ──────────────────────────────────────────────────────────────────────

/**
 * Listings tied to these countries are NOT removed (DFAT sanctions apply to everyone), but they are
 * marked low-relevance: they only produce a hit on a strong match (score >= 95% with a matching date
 * of birth, or an identical name). That keeps common-name noise out without losing coverage. A listing
 * that mentions Iran anywhere stays at normal sensitivity. Set the list to [] to treat every row normally.
 */
export const DFAT_LOW_RELEVANCE_COUNTRIES = ["China", "Russia", "Pakistan"] as const;

const COUNTRY_PATTERNS: Record<(typeof DFAT_LOW_RELEVANCE_COUNTRIES)[number], RegExp> = {
  China: /\b(china|chinese|prc)\b/i,
  Russia: /\b(russia|russian|russian federation)\b/i,
  Pakistan: /\b(pakistan|pakistani)\b/i,
};
const IRAN_LINK = /\b(iran|iranian|irgc|tehran|isfahan|bandar abbas)\b/i;

export type ScopeResult = { rows: DfatRow[]; lowRelevanceGroups: number; lowRelevanceRows: number };

export function markLowRelevance(rows: DfatRow[], countries: readonly (keyof typeof COUNTRY_PATTERNS)[] = DFAT_LOW_RELEVANCE_COUNTRIES): ScopeResult {
  if (!countries.length) return { rows: rows.map(row => ({ ...row, low_relevance: false })), lowRelevanceGroups: 0, lowRelevanceRows: 0 };
  const groups = new Map<string, DfatRow[]>();
  for (const row of rows) groups.set(row.group_ref, [...(groups.get(row.group_ref) ?? []), row]);
  const low = new Set<string>();
  for (const [group, members] of groups) {
    // Nationality decides for people; entities have none, so their address decides.
    const nationality = members.map(row => row.citizenship).filter(Boolean).join(" ; ");
    const place = nationality || members.map(row => [row.address, row.place_of_birth].filter(Boolean).join(" ")).join(" ; ");
    if (!countries.some(country => COUNTRY_PATTERNS[country].test(place))) continue;
    const everything = members.map(row => [row.citizenship, row.address, row.place_of_birth, row.additional_information, row.listing_information, row.committees, row.instrument].filter(Boolean).join(" ")).join(" ");
    if (!IRAN_LINK.test(everything)) low.add(group);
  }
  const marked = rows.map(row => ({ ...row, low_relevance: low.has(row.group_ref) }));
  return { rows: marked, lowRelevanceGroups: low.size, lowRelevanceRows: marked.filter(row => row.low_relevance).length };
}
