// lib/compliance/pdf.ts
// In-memory PDF generation for compliance reports.
// Uses pdf-lib (already a project dependency) — no file system writes.
// Returns a Uint8Array that can be streamed directly to the HTTP response.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ManualDvsOutcome, ManualAmlOutcome } from "./manual";

// ── Public types ──────────────────────────────────────────────────────────────

export type DvsPdfData = {
  subject: {
    fullName: string;
    dateOfBirth: string;
    country: string;
    address: string;
    documentType: string;
    documentNumber: string;
    stateOfIssue?: string;
    expiryDate?: string;
  };
  check: {
    checkType: string;
    performedAt: string;
    referenceId: string | null;
    resultCode: string | null;
  };
  outcome: ManualDvsOutcome;
  rawResponse: unknown;
  performedByEmail: string;
};

export type AmlPdfData = {
  subject: {
    fullName: string;
    dateOfBirth: string;
    country: string;
    address: string;
  };
  check: {
    listsScreened: string[];
    performedAt: string;
    referenceId: string | null;
    matchCount: number;
    possibleMatchCount: number;
  };
  outcome: ManualAmlOutcome;
  rawResponse: unknown;
  performedByEmail: string;
};

// ── Layout constants ──────────────────────────────────────────────────────────

const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const MARGIN  = 40;
const COL_GAP = 20;
const CONT_W  = PAGE_W - MARGIN * 2;
const COL_W   = (CONT_W - COL_GAP) / 2;

// ── Brand colors (matching the admin light theme) ─────────────────────────────

const C_BRAND     = rgb(0.239, 0.267, 0.89);    // #3D44E3 indigo
const C_BRAND_LT  = rgb(0.925, 0.935, 0.988);   // #ECEFFC indigo-light bg
const C_TEXT      = rgb(0.071, 0.082, 0.157);    // #121328
const C_SOFT      = rgb(0.42,  0.47,  0.57);     // #6B7891
const C_DIM       = rgb(0.63,  0.67,  0.74);     // #A1ABB8
const C_WHITE     = rgb(1, 1, 1);
const C_BORDER    = rgb(0.878, 0.906, 0.945);    // #E0E7F1
const C_BG_SOFT   = rgb(0.97,  0.975, 0.99);     // #F8FAFE
const C_SUCCESS   = rgb(0.055, 0.714, 0.506);    // #0EB581
const C_WARNING   = rgb(0.957, 0.62,  0.043);    // #F49E0B
const C_DANGER    = rgb(0.937, 0.267, 0.267);    // #EF4444
const C_MUTED     = rgb(0.60,  0.64,  0.72);     // #99A3B8
const C_BG_OK     = rgb(0.906, 0.976, 0.957);    // #E7FAF4
const C_BG_WARN   = rgb(1.0,   0.973, 0.882);    // #FFF9E1
const C_BG_FAIL   = rgb(0.996, 0.898, 0.898);    // #FEE5E5
const C_BG_SKIP   = rgb(0.95,  0.955, 0.97);     // #F2F3F8

// ── Internal helpers ──────────────────────────────────────────────────────────

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = String(text ?? "").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    try {
      if (font.widthOfTextAtSize(candidate, size) > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    } catch {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Draw an uppercase label + wrapped value; returns new y cursor (decremented). */
function drawKv(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  label: string,
  value: string,
  x: number,
  y: number,
  maxW: number
): number {
  page.drawText(label.toUpperCase(), { x, y, size: 6.5, font: fonts.bold, color: C_DIM });
  y -= 10;
  const lines = wrapText(value || "—", fonts.regular, 8.5, maxW);
  for (const ln of lines) {
    page.drawText(ln, { x, y, size: 8.5, font: fonts.regular, color: C_TEXT });
    y -= 11;
  }
  return y - 6;
}

/** Draw section header bar; returns y cursor below the bar. */
function drawSection(page: PDFPage, font: PDFFont, title: string, y: number): number {
  const H = 20;
  page.drawRectangle({ x: MARGIN, y: y - H, width: CONT_W, height: H, color: C_BRAND_LT });
  page.drawText(title, { x: MARGIN + 8, y: y - H + 6, size: 7.5, font, color: C_BRAND });
  return y - H;
}

/** Horizontal rule */
function drawRule(page: PDFPage, y: number) {
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: C_BORDER });
}

// ── Shared outer PDF frame ─────────────────────────────────────────────────────

async function bootstrapPdf(title: string) {
  const doc  = await PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor("Zarman Exchange");
  doc.setCreationDate(new Date());

  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const mono    = await doc.embedFont(StandardFonts.Courier);
  const page    = doc.addPage([PAGE_W, PAGE_H]);

  return { doc, page, fonts: { bold, regular, mono } };
}

function drawHeader(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  reportType: string,
  performedAt: string,
  performedByEmail: string
): number {
  const H = 80;
  const y = PAGE_H;
  page.drawRectangle({ x: 0, y: y - H, width: PAGE_W, height: H, color: C_BRAND });

  page.drawText("ZARMAN EXCHANGE", { x: MARGIN, y: y - 27, size: 17, font: fonts.bold, color: C_WHITE });
  page.drawText(reportType, { x: MARGIN, y: y - 45, size: 9.5, font: fonts.bold,    color: rgb(0.76, 0.79, 0.97) });
  page.drawText("CONFIDENTIAL — FOR INTERNAL COMPLIANCE USE ONLY", {
    x: MARGIN, y: y - 62, size: 7.5, font: fonts.regular, color: rgb(0.68, 0.71, 0.90),
  });

  const genLine = `Generated: ${performedAt}`;
  const genW = fonts.regular.widthOfTextAtSize(genLine, 7.5);
  page.drawText(genLine,           { x: PAGE_W - MARGIN - genW, y: y - 34, size: 7.5, font: fonts.regular, color: rgb(0.78, 0.80, 0.96) });
  page.drawText(`By: ${performedByEmail}`, { x: PAGE_W - MARGIN - 140, y: y - 48, size: 7,   font: fonts.regular, color: rgb(0.70, 0.72, 0.90) });

  return y - H - 18; // y cursor after header gap
}

function drawFooter(page: PDFPage, fonts: { bold: PDFFont; regular: PDFFont }) {
  const FY = 28;
  drawRule(page, FY + 18);
  page.drawText("Zarman Exchange Pty Ltd — AUSTRAC-registered Independent Remittance Dealer", {
    x: MARGIN, y: FY + 8, size: 7.5, font: fonts.bold, color: C_SOFT,
  });
  page.drawText("This document is auto-generated for AML/CTF compliance purposes and is strictly confidential.", {
    x: MARGIN, y: FY - 4, size: 7, font: fonts.regular, color: C_DIM,
  });
}

function drawRawJson(page: PDFPage, fonts: { bold: PDFFont; mono: PDFFont }, rawResponse: unknown, y: number): void {
  y = drawSection(page, fonts.bold, "VENDOR RESPONSE (RAW JSON — AUDIT TRAIL)", y);
  y -= 10;

  const json  = JSON.stringify(rawResponse, null, 2);
  const lines = json.split("\n");
  const MONO  = 6.5;
  const LH    = 9;
  const maxLines = Math.max(1, Math.floor((y - 68) / LH));

  const blockH = Math.min(lines.length, maxLines) * LH + 16;
  page.drawRectangle({ x: MARGIN, y: y - blockH, width: CONT_W, height: blockH, color: C_BG_SOFT });

  let jy = y - 8;
  let drawn = 0;
  for (const ln of lines) {
    if (drawn >= maxLines) {
      page.drawText("... [truncated — full payload stored in audit logs]", {
        x: MARGIN + 8, y: jy, size: MONO, font: fonts.mono, color: C_DIM,
      });
      break;
    }
    if (ln.trim()) {
      try {
        const safe = ln.replace(/[^\x20-\x7E]/g, "?").slice(0, 100);
        page.drawText(safe, { x: MARGIN + 8, y: jy, size: MONO, font: fonts.mono, color: C_SOFT });
      } catch { /* skip un-renderable */ }
    }
    jy -= LH;
    drawn++;
  }
}

function drawOutcomeBox(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  outcome: string,
  noteText: string,
  y: number
): number {
  const outcomeColorMap: Record<string, ReturnType<typeof rgb>> = {
    VERIFIED:          C_SUCCESS,
    CLEAR:             C_SUCCESS,
    "REVIEW REQUIRED": C_WARNING,
    FAILED:            C_DANGER,
    SKIPPED:           C_MUTED,
  };
  const outcomeBgMap: Record<string, ReturnType<typeof rgb>> = {
    VERIFIED:          C_BG_OK,
    CLEAR:             C_BG_OK,
    "REVIEW REQUIRED": C_BG_WARN,
    FAILED:            C_BG_FAIL,
    SKIPPED:           C_BG_SKIP,
  };

  const accentColor = outcomeColorMap[outcome] ?? C_MUTED;
  const bgColor     = outcomeBgMap[outcome]     ?? C_BG_SKIP;

  const BOX_H = 58;
  page.drawRectangle({
    x: MARGIN, y: y - BOX_H, width: CONT_W, height: BOX_H,
    color: bgColor, borderColor: accentColor, borderWidth: 1.5, borderOpacity: 0.45,
  });

  page.drawText(outcome, {
    x: MARGIN + 16, y: y - BOX_H / 2 - 7,
    size: 22, font: fonts.bold, color: accentColor,
  });

  const noteLines = wrapText(noteText, fonts.regular, 7.5, COL_W - 10);
  const noteX = MARGIN + 210;
  const noteTopY = y - 14;
  noteLines.forEach((ln, i) => {
    page.drawText(ln, { x: noteX, y: noteTopY - i * 10.5, size: 7.5, font: fonts.regular, color: C_SOFT });
  });

  return y - BOX_H - 18;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function generateDvsPdf(data: DvsPdfData): Promise<Uint8Array> {
  const { doc, page, fonts } = await bootstrapPdf(`Zarman DVS Report — ${data.subject.fullName}`);

  let y = drawHeader(page, fonts, "DVS — IDENTITY VERIFICATION REPORT", data.check.performedAt, data.performedByEmail);

  // ── Subject ──────────────────────────────────────────────────────────────
  y = drawSection(page, fonts.bold, "SUBJECT INFORMATION", y);
  y -= 10;

  const lX = MARGIN;
  const rX = MARGIN + COL_W + COL_GAP;

  let lY = y;
  lY = drawKv(page, fonts, "Full Name",    data.subject.fullName    || "—", lX, lY, COL_W);
  lY = drawKv(page, fonts, "Date of Birth", data.subject.dateOfBirth || "—", lX, lY, COL_W);
  lY = drawKv(page, fonts, "Country",       data.subject.country     || "—", lX, lY, COL_W);
  lY = drawKv(page, fonts, "Address",       data.subject.address     || "—", lX, lY, COL_W);

  let rY = y;
  rY = drawKv(page, fonts, "Document Type",   data.subject.documentType   || "—", rX, rY, COL_W);
  rY = drawKv(page, fonts, "Document Number", data.subject.documentNumber  || "—", rX, rY, COL_W);
  if (data.subject.stateOfIssue) rY = drawKv(page, fonts, "State of Issue", data.subject.stateOfIssue, rX, rY, COL_W);
  if (data.subject.expiryDate)   rY = drawKv(page, fonts, "Expiry Date",    data.subject.expiryDate,   rX, rY, COL_W);

  y = Math.min(lY, rY) - 12;
  drawRule(page, y); y -= 18;

  // ── Check details ─────────────────────────────────────────────────────────
  y = drawSection(page, fonts.bold, "CHECK DETAILS", y);
  y -= 10;

  let lcY = y;
  lcY = drawKv(page, fonts, "Provider",    "RapidID DVS",          lX, lcY, COL_W);
  lcY = drawKv(page, fonts, "Check Type",  data.check.checkType,   lX, lcY, COL_W);
  lcY = drawKv(page, fonts, "Performed At", data.check.performedAt, lX, lcY, COL_W);

  let rcY = y;
  rcY = drawKv(page, fonts, "Reference ID", data.check.referenceId  ?? "N/A", rX, rcY, COL_W);
  rcY = drawKv(page, fonts, "Result Code",  data.check.resultCode   ?? "N/A", rX, rcY, COL_W);
  rcY = drawKv(page, fonts, "Performed By", data.performedByEmail,             rX, rcY, COL_W);

  y = Math.min(lcY, rcY) - 12;
  drawRule(page, y); y -= 18;

  // ── Outcome ───────────────────────────────────────────────────────────────
  y = drawSection(page, fonts.bold, "OUTCOME", y);
  y -= 10;

  const outcomeNotes: Record<string, string> = {
    VERIFIED:          "Identity document matched the DVS registry. Customer is verified.",
    "REVIEW REQUIRED": "Document could not be matched. Manual review is required before approving KYC.",
    FAILED:            "Verification failed. Check RapidID credentials or document data and retry.",
    SKIPPED:           "DVS check was not applicable (non-AU customer or unsupported document type).",
  };
  y = drawOutcomeBox(page, fonts, data.outcome, outcomeNotes[data.outcome] ?? "", y);

  drawRule(page, y); y -= 18;

  // ── Raw response ──────────────────────────────────────────────────────────
  drawRawJson(page, { bold: fonts.bold, mono: fonts.mono }, data.rawResponse, y);

  drawFooter(page, fonts);

  return doc.save();
}

export async function generateAmlPdf(data: AmlPdfData): Promise<Uint8Array> {
  const { doc, page, fonts } = await bootstrapPdf(`Zarman AML Report — ${data.subject.fullName}`);

  let y = drawHeader(page, fonts, "AML/CTF — PEP & SANCTIONS SCREENING REPORT", data.check.performedAt, data.performedByEmail);

  // ── Subject ───────────────────────────────────────────────────────────────
  y = drawSection(page, fonts.bold, "SUBJECT INFORMATION", y);
  y -= 10;

  const lX = MARGIN;
  const rX = MARGIN + COL_W + COL_GAP;

  let lY = y;
  lY = drawKv(page, fonts, "Full Name",     data.subject.fullName    || "—", lX, lY, COL_W);
  lY = drawKv(page, fonts, "Date of Birth", data.subject.dateOfBirth || "—", lX, lY, COL_W);

  let rY = y;
  rY = drawKv(page, fonts, "Country", data.subject.country || "—", rX, rY, COL_W);
  rY = drawKv(page, fonts, "Address", data.subject.address || "—", rX, rY, COL_W);

  y = Math.min(lY, rY) - 12;
  drawRule(page, y); y -= 18;

  // ── Check details ─────────────────────────────────────────────────────────
  y = drawSection(page, fonts.bold, "SCREENING DETAILS", y);
  y -= 10;

  let lcY = y;
  lcY = drawKv(page, fonts, "Provider",       "NameScan",                                  lX, lcY, COL_W);
  lcY = drawKv(page, fonts, "Lists Screened",  data.check.listsScreened.join(", ") || "—", lX, lcY, COL_W);
  lcY = drawKv(page, fonts, "Performed At",    data.check.performedAt,                      lX, lcY, COL_W);

  let rcY = y;
  rcY = drawKv(page, fonts, "Reference ID",       data.check.referenceId ?? "N/A",                           rX, rcY, COL_W);
  rcY = drawKv(page, fonts, "Direct Matches",      String(data.check.matchCount),                             rX, rcY, COL_W);
  rcY = drawKv(page, fonts, "Possible Matches",    String(data.check.possibleMatchCount),                     rX, rcY, COL_W);
  rcY = drawKv(page, fonts, "Performed By",        data.performedByEmail,                                     rX, rcY, COL_W);

  y = Math.min(lcY, rcY) - 12;
  drawRule(page, y); y -= 18;

  // ── Outcome ───────────────────────────────────────────────────────────────
  y = drawSection(page, fonts.bold, "OUTCOME", y);
  y -= 10;

  const amlNotes: Record<string, string> = {
    CLEAR:             "No matches found against OFAC, DFAT, UN, EU or PEP lists. Subject is clear to proceed.",
    "REVIEW REQUIRED": "One or more potential matches detected. KYC must be manually reviewed before approval.",
    FAILED:            "Screening failed. Verify NameScan credentials and subject data, then retry.",
  };
  y = drawOutcomeBox(page, fonts, data.outcome, amlNotes[data.outcome] ?? "", y);

  drawRule(page, y); y -= 18;

  // ── Raw response ──────────────────────────────────────────────────────────
  drawRawJson(page, { bold: fonts.bold, mono: fonts.mono }, data.rawResponse, y);

  drawFooter(page, fonts);

  return doc.save();
}
