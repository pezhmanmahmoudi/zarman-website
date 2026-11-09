import { PDFDocument, PDFName, PDFOperator, PDFOperatorNames, PageSizes, appendBezierCurve, clip, closePath, degrees, endPath, lineTo, moveTo, popGraphicsState, pushGraphicsState, rectangle, rgb, setCharacterSpacing, type Color, type PDFFont, type PDFRef } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Amounts as the manager approved them at settlement, replaced if the manager
 * later amends the transfer. No banking credentials or identity documents. */
export type RequestCompletionReceiptSnapshot = {
  version: 1;
  request_id: string;
  transaction_id: string;
  reference_code: string;
  completed_at: string;
  sender_name: string;
  recipient_name: string;
  funding_currency: "AUD" | "IRT";
  funding_total: number | string;
  recipient_currency: "AUD" | "IRT";
  recipient_amount: number | string;
  base_fee_aud: number | string;
  priority_fee_aud: number | string;
  priority_fee_amount: number | string;
  priority_fee_status: string;
  applied_rate: number | string;
  service_tier: "standard" | "priority";
  corrected_at?: string;
  revision?: number;
};

export function validateRequestReceipt(value: RequestCompletionReceiptSnapshot): void {
  if (!value || value.version !== 1 || !/^[0-9a-f-]{36}$/i.test(value.request_id)
    || !/^[0-9a-f-]{36}$/i.test(value.transaction_id)
    || !Number.isFinite(Date.parse(value.completed_at))
    || !["standard", "priority"].includes(value.service_tier)
    || !["AUD", "IRT"].includes(value.funding_currency) || !["AUD", "IRT"].includes(value.recipient_currency)) {
    throw new Error("invalid_completion_receipt");
  }
  for (const key of ["reference_code", "sender_name", "recipient_name"] as const) {
    if (typeof value[key] !== "string" || !value[key].trim() || value[key].length > 500 || /[\u0000-\u001f]/.test(value[key])) {
      throw new Error("invalid_completion_receipt");
    }
  }
  for (const key of ["funding_total", "recipient_amount", "base_fee_aud", "priority_fee_aud", "priority_fee_amount", "applied_rate"] as const) {
    if (!["string", "number"].includes(typeof value[key]) || String(value[key]).trim() === "" || !Number.isFinite(Number(value[key])) || Number(value[key]) < 0) {
      throw new Error("invalid_completion_receipt");
    }
  }
  if (Number(value.funding_total) <= 0 || Number(value.recipient_amount) <= 0 || Number(value.applied_rate) <= 0) throw new Error("invalid_completion_receipt");
  if (value.corrected_at !== undefined && (!Number.isFinite(Date.parse(value.corrected_at)) || !Number.isInteger(value.revision) || Number(value.revision) < 1)) throw new Error("invalid_completion_receipt");
}

export function receiptAmount(amount: number | string, currency: "AUD" | "IRT"): string {
  return `${currency === "IRT" ? "Toman (IRT)" : "AUD"} ${Number(amount).toLocaleString("en-AU", { minimumFractionDigits: currency === "AUD" ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export type ReceiptCurrency = "AUD" | "IRT";
export type ReceiptMoney = { currency: ReceiptCurrency; amount: number };
export type ReceiptParty = { name: string; lines: string[] };

/** The one receipt customers get, however the transfer was recorded.
 * Every figure is the amount the manager approved. */
export type TransferReceipt = {
  reference: string;
  /** Also pins the PDF dates so re-rendering the same receipt is byte-identical. */
  approvedAt: string;
  sender: ReceiptParty;
  recipient: ReceiptParty;
  sent: ReceiptMoney;
  received: ReceiptMoney;
  rate?: number | null;
  feeAud?: number | null;
  expressFee?: ReceiptMoney | null;
  reasonForTransfer?: string | null;
  promoCode?: string | null;
};

type ContactProfile = { mobile_number?: string | null; address?: string | null; city?: string | null; state?: string | null; postcode?: string | null };
export type ReceiptBankSource = {
  direction?: string | null; bank_type?: string | null; bank_name?: string | null; bsb?: string | null; account_number?: string | null;
  irt_account_number?: string | null; card_number?: string | null; shaba_number?: string | null;
};
type ContactRecipient = ReceiptBankSource & {
  recipient_phone?: string | null; residential_address?: string | null; residential_city?: string | null;
  residential_state?: string | null; residential_postcode?: string | null; residential_country?: string | null;
  irt_phone?: string | null; irt_address?: string | null; irt_city?: string | null; irt_state?: string | null;
  irt_postcode?: string | null; irt_country?: string | null;
};
export type ReceiptContactSource = {
  reason_for_transfer?: string | null;
  promo_code?: string | null;
  profiles?: ContactProfile | ContactProfile[] | null;
  recipients?: ContactRecipient | ContactRecipient[] | null;
};
export type ReceiptContacts = { senderLines: string[]; recipientLines: string[]; reasonForTransfer: string | null; promoCode: string | null };

const joinAddress = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ");

export function receiptBankDetail(recipient: ReceiptBankSource): string {
  if (!recipient.direction) return "";
  if (recipient.direction === "aud") {
    return [recipient.bank_name, recipient.bsb && `BSB ${recipient.bsb}`, recipient.account_number && `Acc ${recipient.account_number}`].filter(Boolean).join(" / ");
  }
  if (recipient.bank_type === "bank_melli") {
    const card = recipient.card_number?.replace(/\D/g, "").slice(-4);
    return ["Bank Melli", recipient.irt_account_number && `Acc ${recipient.irt_account_number}`, card && `Card ending ${card}`].filter(Boolean).join(" / ");
  }
  if (recipient.shaba_number) return `Shaba ${recipient.shaba_number}`;
  return recipient.bank_name ?? "";
}

export function receiptContacts(row: ReceiptContactSource): ReceiptContacts {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const recipient = Array.isArray(row.recipients) ? row.recipients[0] : row.recipients;
  const toAustralia = recipient?.direction === "aud";
  return {
    senderLines: profile ? [profile.mobile_number ?? "", joinAddress(profile.address, profile.city, profile.state, profile.postcode)] : [],
    recipientLines: recipient ? [
      (toAustralia ? recipient.recipient_phone : recipient.irt_phone) ?? "",
      toAustralia
        ? joinAddress(recipient.residential_address, recipient.residential_city, recipient.residential_state, recipient.residential_postcode, recipient.residential_country)
        : joinAddress(recipient.irt_address, recipient.irt_city, recipient.irt_state, recipient.irt_postcode, recipient.irt_country),
      receiptBankDetail(recipient),
    ] : [],
    reasonForTransfer: (row.reason_for_transfer ?? "").replace(/لینک پرداخت:\s*\S+/, "").trim() || null,
    promoCode: row.promo_code ?? null,
  };
}

const CONTACT_COLUMNS = `reason_for_transfer, promo_code,
  profiles(mobile_number, address, city, state, postcode),
  recipients(direction, bank_type, bank_name, bsb, account_number, recipient_phone,
    residential_address, residential_city, residential_state, residential_postcode, residential_country,
    irt_phone, irt_address, irt_city, irt_state, irt_postcode, irt_country, irt_account_number, card_number, shaba_number)`;

/** Contact details never hold back a receipt: on any failure it prints names only. */
export async function loadReceiptContacts(db: object, transactionId: string): Promise<ReceiptContacts | null> {
  try {
    const { data, error } = await (db as SupabaseClient).from("transactions").select(CONTACT_COLUMNS).eq("id", transactionId).maybeSingle();
    return error || !data ? null : receiptContacts(data as unknown as ReceiptContactSource);
  } catch { return null; }
}

// ── English-only output ───────────────────────────────────────────────────

const PERSIAN_SCRIPT = /[؀-ۿﭐ-﷿ﹰ-﻿]/;
const LATIN_LETTERS: Record<string, string> = {
  "ا": "a", "آ": "a", "أ": "a", "إ": "e", "ئ": "y", "ؤ": "o", "ء": "", "ب": "b", "پ": "p", "ت": "t", "ث": "s", "ج": "j", "چ": "ch",
  "ح": "h", "خ": "kh", "د": "d", "ذ": "z", "ر": "r", "ز": "z", "ژ": "zh", "س": "s", "ش": "sh", "ص": "s", "ض": "z", "ط": "t", "ظ": "z",
  "ع": "a", "غ": "gh", "ف": "f", "ق": "gh", "ک": "k", "ك": "k", "گ": "g", "ل": "l", "م": "m", "ن": "n",
};

const westernDigits = (value: string) => value
  .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06F0))
  .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660));

/** Optional text with no English form is left off: the receipt prints no Persian. */
export function englishLine(value: string): string {
  const line = westernDigits(value).trim();
  return PERSIAN_SCRIPT.test(line) ? "" : line;
}

/** A name stored only in Persian still has to name someone, so it is spelled out
 * phonetically. Short vowels are not written in Persian, so this is approximate. */
export function englishName(value: string): string {
  const name = westernDigits(value).trim();
  if (!PERSIAN_SCRIPT.test(name)) return name;
  return name.split(/\s+/).filter(Boolean).map(word => {
    const letters = [...word.replace(/‌/g, "")];
    const spelled = letters.map((letter, index) => {
      if (letter === "و") return index === 0 ? "v" : "o";
      if (letter === "ی" || letter === "ي" || letter === "ى") return index === 0 ? "y" : "i";
      if (letter === "ه" || letter === "ة") return index === letters.length - 1 && index > 0 ? "eh" : "h";
      return LATIN_LETTERS[letter] ?? (PERSIAN_SCRIPT.test(letter) ? "" : letter);
    }).join("");
    return spelled.charAt(0).toUpperCase() + spelled.slice(1);
  }).join(" ");
}

// ── Drawing constants ─────────────────────────────────────────────────────

const hex = (value: string) => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
const NAVY = hex("#26287A"), NAVY_LINE = hex("#373BA0"), NAVY_FACET = hex("#2F3290"), INDIGO = hex("#4A4BC2");
const LAVENDER = hex("#D9DDEC"), WHITE = hex("#FFFFFF"), INK = hex("#141833"), MUTED = hex("#5A6280"), RULE = hex("#E2E5F1"), RULE_STRONG = hex("#BCC4E5");
const GREEN = hex("#0B7A58"), GREEN_TINT = hex("#DDF3EA");
const OCHRE = hex("#C4683F"), OCHRE_SHADE = hex("#A5502F"), OCHRE_FLUTE = hex("#94472A"), OCHRE_LIGHT = hex("#E3A077"), SUN = hex("#F4AE66");
const SLATE = hex("#6676B0"), SLATE_SHADE = hex("#4C5A95"), SNOW_SHADE = hex("#D3DEF3");

type Shade = [number, number, number];
const SKY_WARM: Shade = [251, 228, 207], SKY_COOL: Shade = [214, 226, 246], SKY_TOP: Shade = [255, 255, 255];
const LAND_WARM: Shade = [232, 196, 160], LAND_COOL: Shade = [190, 203, 232];

const MARGIN = 44;
const BAND_HEIGHT = 128;
const FOOTER_HEIGHT = 46;
const LEGAL_IDENTITY = "ABN 70 692 742 957 · ACN 692 742 957";
const LEGAL_REGISTRATION = "AUSTRAC registration IND100907570";

// Tone-on-tone facets echoing the crystal "Z" in the logo.
const FACETS = ["M430 0L514 0L472 64Z", "M514 0L472 64L556 64Z", "M598 0L556 64L640 64Z", "M472 64L430 128L514 128Z", "M556 64L514 128L598 128Z"];
const ULURU = {
  width: 210, height: 62, peakX: 105,
  body: "M0 62C6 58 10 46 15 36C20 25 28 16 40 12C58 6 82 4 108 3C138 2 165 4 180 11C191 16 197 28 201 40C204 48 207 57 210 62Z",
  shade: "M0 62C6 58 10 46 15 36C40 45 70 49 105 49C140 49 175 45 201 40C204 48 207 57 210 62Z",
  flutes: "M30 20C27 34 28 48 31 62M48 13C44 30 46 48 49 62M70 8C66 26 68 46 71 62M92 6C89 26 90 46 93 62M116 5C113 24 115 46 117 62M140 5C137 24 139 46 141 62M162 8C160 26 161 46 163 62M182 15C180 30 181 48 184 62",
  light: "M24 20C36 11 62 7 108 5C140 4 168 6 182 13",
};
const DAMAVAND = {
  width: 176, height: 92, peakX: 89,
  body: "M0 92C26 86 46 72 62 52C72 39 80 20 86 6C87 3 90 3 92 6C98 20 106 39 116 52C132 72 150 86 176 92Z",
  shade: "M90 5C98 20 106 39 116 52C132 72 150 86 176 92L98 92C100 70 93 40 90 5Z",
  snow: "M71 36C77 23 83 12 86 6C87 3 90 3 92 6C96 13 102 25 108 38L102 34L98 44L92 33L87 46L81 34L77 41Z",
  snowShade: "M90 5C96 13 102 25 108 38L102 34L98 44L92 33Z",
  streaks: "M64 52L60 60M72 50L69 62M104 50L108 62M114 54L120 64",
};

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
    if (line) lines.push(line);
    line = word;
    while (font.widthOfTextAtSize(line, size) > maxWidth) { // An unbroken value such as an account number.
      let cut = line.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitSize(text: string, font: PDFFont, size: number, maxWidth: number, minimum = 7): number {
  let fitted = size;
  while (fitted > minimum && font.widthOfTextAtSize(text, fitted) > maxWidth) fitted -= 0.5;
  return fitted;
}

const amountText = (money: ReceiptMoney) =>
  money.amount.toLocaleString("en-AU", { minimumFractionDigits: money.currency === "AUD" ? 2 : 0, maximumFractionDigits: 2 });

const blend = (from: Shade, to: Shade, amount: number): Shade =>
  [0, 1, 2].map(channel => from[channel] + (to[channel] - from[channel]) * amount) as Shade;

/** A smooth two-dimensional colour field as a PDF mesh, a few hundred bytes
 * where drawn strips would add hundreds of kilobytes and show seams. */
function colourField(doc: PDFDocument, area: { x: number; y: number; width: number; height: number }, shadeAt: (across: number, down: number) => Shade): PDFRef {
  const columns = 13, rows = 7, bytes = new Uint8Array(columns * rows * 7);
  let offset = 0;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const across = column / (columns - 1), down = row / (rows - 1);
      const x = Math.round(across * 65535), y = Math.round((1 - down) * 65535);
      bytes.set([x >> 8, x & 255, y >> 8, y & 255, ...shadeAt(across, down).map(Math.round)], offset);
      offset += 7;
    }
  }
  return doc.context.register(doc.context.stream(bytes, {
    ShadingType: 5, ColorSpace: "DeviceRGB", BitsPerCoordinate: 16, BitsPerComponent: 8, VerticesPerRow: columns,
    Decode: [area.x, area.x + area.width, area.y, area.y + area.height, 0, 1, 0, 1, 0, 1],
  }));
}

export async function renderTransferReceipt(receipt: TransferReceipt): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Zarman receipt ${receipt.reference}`);
  doc.setAuthor("Zarman Exchange");
  doc.setCreator("Zarman Exchange");
  doc.setProducer("Zarman Exchange");
  doc.setCreationDate(new Date(receipt.approvedAt));
  doc.setModificationDate(new Date(receipt.approvedAt));
  const [interRegular, interSemiBold, interBold, sourceSerif, logoBytes] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/Inter-Regular.ttf")),
    readFile(join(process.cwd(), "public/fonts/Inter-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/fonts/Inter-Bold.ttf")),
    readFile(join(process.cwd(), "public/fonts/SourceSerif4-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/images/logo-email.png")),
  ]);
  const embedFigures = (bytes: Uint8Array) => doc.embedFont(bytes, { subset: true, features: { tnum: true } });
  const regular = await embedFigures(interRegular), semibold = await embedFigures(interSemiBold), bold = await embedFigures(interBold);
  const display = await doc.embedFont(sourceSerif, { subset: true, features: { lnum: true } });
  const logo = await doc.embedPng(logoBytes);

  const reference = westernDigits(receipt.reference).trim();
  const sender = { name: englishName(receipt.sender.name), lines: receipt.sender.lines.map(englishLine) };
  const recipient = { name: englishName(receipt.recipient.name), lines: receipt.recipient.lines.map(englishLine) };
  const reasonForTransfer = englishLine(receipt.reasonForTransfer ?? "");
  const promoCode = englishLine(receipt.promoCode ?? "");

  let page = doc.addPage(PageSizes.A4);
  const pageWidth = page.getWidth(), pageHeight = page.getHeight();
  const contentWidth = pageWidth - MARGIN * 2, contentRight = pageWidth - MARGIN;
  const contentBottom = pageHeight - FOOTER_HEIGHT - 10;

  const text = (value: string, x: number, top: number, options: { font?: PDFFont; size?: number; color?: Color; align?: "left" | "right" | "center" } = {}) => {
    const { font = regular, size = 9, color = INK, align = "left" } = options;
    const width = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: align === "left" ? x : align === "right" ? x - width : x - width / 2, y: pageHeight - top, font, size, color });
  };
  /** A small tracked caps label. */
  const label = (value: string, x: number, top: number, options: { align?: "left" | "right" | "center"; color?: Color } = {}) => {
    const { align = "left", color = MUTED } = options;
    const tracking = 0.7, size = 7.5;
    const width = semibold.widthOfTextAtSize(value, size) + tracking * (value.length - 1);
    page.pushOperators(setCharacterSpacing(tracking));
    page.drawText(value, { x: align === "left" ? x : align === "right" ? x - width : x - width / 2, y: pageHeight - top, font: semibold, size, color });
    page.pushOperators(setCharacterSpacing(0));
  };
  const box = (x: number, top: number, width: number, height: number, radius: number, style: { fill?: Color; border?: Color; opacity?: number }) => page.drawSvgPath(
    `M${radius} 0H${width - radius}Q${width} 0 ${width} ${radius}V${height - radius}Q${width} ${height} ${width - radius} ${height}H${radius}Q0 ${height} 0 ${height - radius}V${radius}Q0 0 ${radius} 0Z`,
    { x, y: pageHeight - top, color: style.fill, borderColor: style.border, borderWidth: style.border ? 0.7 : 0, opacity: style.opacity },
  );
  const rule = (top: number, color = RULE, thickness = 0.6) => page.drawLine({ start: { x: MARGIN, y: pageHeight - top }, end: { x: contentRight, y: pageHeight - top }, thickness, color });

  const drawMasthead = () => {
    const watermark = logo.scaleToFit(320, 350);
    page.drawImage(logo, { x: (pageWidth - watermark.width) / 2, y: 118, ...watermark, opacity: 0.03 });
    page.drawRectangle({ x: 0, y: pageHeight - BAND_HEIGHT, width: pageWidth, height: BAND_HEIGHT, color: NAVY });
    for (const facet of FACETS) page.drawSvgPath(facet, { x: 0, y: pageHeight, color: NAVY_FACET });
    for (let line = 0; line < 9; line++) {
      let wave = "";
      for (let step = 0; step <= 70; step++) {
        const x = (step / 70) * pageWidth;
        const y = 24 + line * 11 + Math.sin(step / 7 + line * 0.5) * (5 + line * 0.6);
        wave += `${step ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      page.drawSvgPath(wave, { x: 0, y: pageHeight, borderColor: NAVY_LINE, borderWidth: 0.35 });
    }
    const segment = pageWidth / 90;
    for (let index = 0; index < 90; index++) {
      const mix = index / 89;
      page.drawRectangle({ x: index * segment, y: pageHeight - 4, width: segment + 0.5, height: 4, color: rgb(0.29 - 0.08 * mix, 0.29 + 0.42 * mix, 0.76 + 0.13 * mix) });
    }
    box(MARGIN, 22, 62, 62, 13, { fill: WHITE });
    const markHeight = 57, markWidth = (markHeight * logo.width) / logo.height;
    page.pushOperators(pushGraphicsState(), rectangle(MARGIN, pageHeight - 22 - 56, 62, 56), clip(), endPath());
    page.drawImage(logo, { x: MARGIN + (62 - markWidth) / 2, y: pageHeight - 22 - 6 - markHeight, width: markWidth, height: markHeight });
    page.pushOperators(popGraphicsState());
    const brandX = MARGIN + 76;
    text("Zarman Exchange", brandX, 42, { font: display, size: 17, color: WHITE });
    text("Zarman Exchange Pty Ltd", brandX, 57, { size: 8.2, color: LAVENDER });
    text(LEGAL_IDENTITY, brandX, 69, { size: 8.2, color: LAVENDER });
    text(LEGAL_REGISTRATION, brandX, 81, { size: 8.2, color: LAVENDER });
    text("Official Remittance Receipt", contentRight, 54, { font: display, size: 18, color: WHITE, align: "right" });
  };
  drawMasthead();

  // ── Summary card: what happened, then where the money travelled ─────────
  const cardTop = 102, cardHeight = 262, inset = 22, cardBottom = cardTop + cardHeight;
  for (const [drop, opacity] of [[3, 0.03], [2, 0.04], [1, 0.05]] as const) box(MARGIN, cardTop + drop, contentWidth, cardHeight, 14, { fill: NAVY, opacity });
  box(MARGIN, cardTop, contentWidth, cardHeight, 14, { fill: WHITE });
  const innerLeft = MARGIN + inset, innerRight = contentRight - inset;

  const statusY = pageHeight - (cardTop + 34);
  page.drawCircle({ x: innerLeft + 13, y: statusY, size: 13, color: GREEN_TINT });
  page.drawSvgPath("M-5.5 0L-1.8 3.8L5.5 -4", { x: innerLeft + 13, y: statusY, borderColor: GREEN, borderWidth: 2 });
  text("Transfer completed", innerLeft + 36, cardTop + 31, { font: display, size: 16 });
  const dateText = new Date(receipt.approvedAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });
  text(`${dateText} · Sydney time`, innerLeft + 36, cardTop + 45, { size: 9, color: MUTED });
  label("TRANSACTION CODE", innerRight, cardTop + 26, { align: "right" });
  text(reference, innerRight, cardTop + 44, { font: bold, size: fitSize(reference, bold, 13, 210), color: NAVY, align: "right" });
  page.drawLine({ start: { x: innerLeft, y: pageHeight - (cardTop + 60) }, end: { x: innerRight, y: pageHeight - (cardTop + 60) }, thickness: 0.6, color: RULE });

  const drawAmount = (side: "left" | "right", name: string, money: ReceiptMoney, color: Color) => {
    const x = side === "left" ? innerLeft : innerRight;
    label(name, x, cardTop + 82, { align: side });
    const number = amountText(money), unit = money.currency === "AUD" ? "AUD" : "Toman";
    const size = fitSize(number, display, 29, 186, 14);
    const numberWidth = display.widthOfTextAtSize(number, size), unitWidth = semibold.widthOfTextAtSize(unit, 11.5) + 6;
    const start = side === "left" ? x : x - numberWidth - unitWidth;
    text(number, start, cardTop + 114, { font: display, size, color });
    text(unit, start + numberWidth + 6, cardTop + 114, { font: semibold, size: 11.5, color });
  };
  drawAmount("left", "AMOUNT SENT", receipt.sent, NAVY);
  drawAmount("right", "AMOUNT DELIVERED", receipt.received, GREEN);

  // The landscape reads left to right: the sender's mountain, then the recipient's.
  const fromAustralia = receipt.sent.currency === "AUD";
  const sceneTop = cardTop + 128, sceneHeight = cardBottom - sceneTop;
  const groundLine = sceneTop + sceneHeight - 32, mountainBase = groundLine + 8;
  const warmth = (across: number) => (fromAustralia ? across : 1 - across);
  const sceneArea = { x: MARGIN, y: pageHeight - cardBottom, width: contentWidth, height: sceneHeight };
  const sky = colourField(doc, sceneArea, (across, down) => blend(SKY_TOP, blend(SKY_WARM, SKY_COOL, warmth(across)), Math.min(1, down * 1.15) ** 1.4));
  const land = colourField(doc, sceneArea, across => blend(LAND_WARM, LAND_COOL, warmth(across)));
  page.node.normalizedEntries().Resources.set(PDFName.of("Shading"), doc.context.obj({ Sky: sky, Land: land }));
  const paint = (name: string) => PDFOperator.of(PDFOperatorNames.ShadingFill, [PDFName.of(name)]);

  const corner = 14, handle = (corner * 2) / 3;
  const sceneRight = MARGIN + contentWidth, sceneBottom = pageHeight - cardBottom, sceneRoof = pageHeight - sceneTop;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(MARGIN, sceneRoof), lineTo(sceneRight, sceneRoof), lineTo(sceneRight, sceneBottom + corner),
    appendBezierCurve(sceneRight, sceneBottom + corner - handle, sceneRight - corner + handle, sceneBottom, sceneRight - corner, sceneBottom),
    lineTo(MARGIN + corner, sceneBottom),
    appendBezierCurve(MARGIN + corner - handle, sceneBottom, MARGIN, sceneBottom + corner - handle, MARGIN, sceneBottom + corner),
    closePath(), clip(), endPath(), paint("Sky"),
  );

  const sideOf = (shapeWidth: number, side: "left" | "right") => (side === "left" ? MARGIN + 28 : sceneRight - 28 - shapeWidth);
  const uluruSide = fromAustralia ? "left" : "right", damavandSide = fromAustralia ? "right" : "left";
  const uluruX = sideOf(ULURU.width * 0.92, uluruSide), damavandX = sideOf(DAMAVAND.width, damavandSide);

  // The sun sits on the outer side of Uluru, clear of the exchange rate.
  const sunX = uluruX + (ULURU.width * 0.92) * (fromAustralia ? 0.2 : 0.8), sunY = pageHeight - (mountainBase - 62);
  for (let ring = 0; ring < 15; ring++) page.drawCircle({ x: sunX, y: sunY, size: 13 + ring * 2.5, color: SUN, opacity: 0.05 });
  page.drawCircle({ x: sunX, y: sunY, size: 12, color: SUN, opacity: 0.9 });

  page.drawSvgPath(`M0 30C60 12 120 26 190 18C260 9 330 24 400 15C450 9 480 18 ${contentWidth} 12V60H0Z`, { x: MARGIN, y: pageHeight - (groundLine - 30), color: NAVY, opacity: 0.05 });

  const uluruAnchor = { x: uluruX, y: pageHeight - (mountainBase - ULURU.height * 0.92), scale: 0.92 };
  page.drawSvgPath(ULURU.body, { ...uluruAnchor, color: OCHRE });
  page.drawSvgPath(ULURU.shade, { ...uluruAnchor, color: OCHRE_SHADE, opacity: 0.38 });
  page.drawSvgPath(ULURU.flutes, { ...uluruAnchor, borderColor: OCHRE_FLUTE, borderWidth: 1, borderOpacity: 0.55 });
  page.drawSvgPath(ULURU.light, { ...uluruAnchor, borderColor: OCHRE_LIGHT, borderWidth: 1.3 });

  const damavandAnchor = { x: damavandX, y: pageHeight - (mountainBase - DAMAVAND.height) };
  page.drawSvgPath(DAMAVAND.body, { ...damavandAnchor, color: SLATE });
  page.drawSvgPath(DAMAVAND.shade, { ...damavandAnchor, color: SLATE_SHADE });
  page.drawSvgPath(DAMAVAND.snow, { ...damavandAnchor, color: WHITE });
  page.drawSvgPath(DAMAVAND.snowShade, { ...damavandAnchor, color: SNOW_SHADE });
  page.drawSvgPath(DAMAVAND.streaks, { ...damavandAnchor, borderColor: WHITE, borderWidth: 1.1 });

  const groundY = (x: number) => groundLine + 3 + 3.2 * Math.sin(x * 0.013) + 1.8 * Math.sin(x * 0.034 + 1);
  page.pushOperators(pushGraphicsState(), moveTo(MARGIN, sceneBottom));
  for (let step = 0; step <= 60; step++) {
    const x = (step / 60) * contentWidth;
    page.pushOperators(lineTo(MARGIN + x, pageHeight - groundY(x)));
  }
  page.pushOperators(lineTo(sceneRight, sceneBottom), closePath(), clip(), endPath(), paint("Land"), popGraphicsState());

  // A stream rising near the sender's mountain and broadening towards the
  // recipient's carries the eye across the land.
  const flowLength = contentWidth - 150, upper: string[] = [], lower: string[] = [];
  for (let step = 0; step <= 60; step++) {
    const along = step / 60;
    const x = fromAustralia ? 75 + along * flowLength : contentWidth - 75 - along * flowLength;
    const y = groundLine + 11 + 3.4 * Math.sin(along * 9.5 + 0.6);
    const halfWidth = 2.2 * Math.sin(Math.PI * along ** 1.7);
    upper.push(`${x.toFixed(2)} ${(y - halfWidth).toFixed(2)}`);
    lower.unshift(`${x.toFixed(2)} ${(y + halfWidth).toFixed(2)}`);
  }
  page.drawSvgPath(`M${[...upper, ...lower].join("L")}Z`, { x: MARGIN, y: pageHeight, color: WHITE, opacity: 0.62 });
  page.pushOperators(popGraphicsState());

  label(`FROM ${fromAustralia ? "AUSTRALIA" : "IRAN"}`, MARGIN + 28 + (fromAustralia ? ULURU.width * 0.46 : DAMAVAND.width / 2), groundLine + 27, { align: "center", color: NAVY });
  label(`TO ${fromAustralia ? "IRAN" : "AUSTRALIA"}`, sceneRight - 28 - (fromAustralia ? DAMAVAND.width / 2 : ULURU.width * 0.46), groundLine + 27, { align: "center", color: NAVY });
  if (receipt.rate && receipt.rate > 0) {
    label("EXCHANGE RATE", pageWidth / 2, sceneTop + 20, { align: "center" });
    text(`1 AUD = ${receipt.rate.toLocaleString("en-AU")} Toman`, pageWidth / 2, sceneTop + 37, { font: display, size: 12.5, color: NAVY, align: "center" });
  }
  box(MARGIN, cardTop, contentWidth, cardHeight, 14, { border: RULE });

  let top = cardBottom + 24;
  const makeRoom = (height: number) => {
    if (top + height <= contentBottom) return;
    page = doc.addPage(PageSizes.A4);
    drawMasthead();
    top = BAND_HEIGHT + 24;
  };

  // ── Parties ─────────────────────────────────────────────────────────────
  const columnGap = 32, columnWidth = (contentWidth - columnGap) / 2;
  const parties = [sender, recipient].map(party => ({
    name: wrapText(party.name, bold, 12.5, columnWidth),
    lines: party.lines.filter(Boolean).flatMap(line => wrapText(line, regular, 9.5, columnWidth)),
  }));
  const partiesHeight = Math.max(...parties.map(party => 34 + party.name.length * 16 + party.lines.length * 14));
  makeRoom(partiesHeight);
  parties.forEach((party, index) => {
    const x = MARGIN + index * (columnWidth + columnGap);
    label(index ? "RECIPIENT" : "SENDER", x, top + 8);
    let y = top + 29;
    for (const line of party.name) { text(line, x, y, { font: bold, size: 12.5 }); y += 16; }
    for (const line of party.lines) { text(line, x, y, { size: 9.5, color: MUTED }); y += 14; }
  });
  page.drawLine({ start: { x: pageWidth / 2, y: pageHeight - top + 2 }, end: { x: pageWidth / 2, y: pageHeight - top - partiesHeight + 12 }, thickness: 0.6, color: RULE });
  top += partiesHeight + 10;

  // ── Payment summary: the figures the manager approved ───────────────────
  const rows: [string, string][] = [["Amount sent", receiptAmount(receipt.sent.amount, receipt.sent.currency)]];
  if (receipt.rate && receipt.rate > 0) rows.push(["Exchange rate", `${receipt.rate.toLocaleString("en-AU")} Toman per AUD`]);
  if (receipt.feeAud != null) rows.push(["Service fee", receiptAmount(receipt.feeAud, "AUD")]);
  if (receipt.expressFee && receipt.expressFee.amount > 0) rows.push(["Express processing fee", receiptAmount(receipt.expressFee.amount, receipt.expressFee.currency)]);
  if (reasonForTransfer) rows.push(["Reason for transfer", reasonForTransfer]);
  if (promoCode) rows.push(["Promo code", promoCode]);

  makeRoom(52);
  label("PAYMENT SUMMARY", MARGIN, top + 8);
  top += 16;
  rule(top, RULE_STRONG, 0.8);
  rows.forEach(([name, value], index) => {
    const values = wrapText(value, regular, 10, contentWidth - 190);
    const height = Math.max(25, values.length * 14 + 11);
    makeRoom(height);
    text(name, MARGIN, top + 16.5, { size: 10, color: MUTED });
    values.forEach((line, row) => text(line, contentRight, top + 16.5 + row * 14, { size: 10, align: "right" }));
    top += height;
    if (index < rows.length - 1) rule(top);
  });
  makeRoom(38);
  rule(top, NAVY, 1);
  text("Amount delivered", MARGIN, top + 23, { font: display, size: 13, color: NAVY });
  text(receiptAmount(receipt.received.amount, receipt.received.currency), contentRight, top + 23, { font: display, size: 14.5, color: GREEN, align: "right" });
  top += 34;

  // ── Notices and company seal, anchored just above the footer ────────────
  const noticesHeight = 100;
  makeRoom(noticesHeight + 8);
  top = Math.max(top + 8, contentBottom - noticesHeight);
  const notices = [
    "Issued after this transfer was verified and settled. Please keep this receipt for your records.",
    `This transaction is reported to AUSTRAC under transaction code ${reference}.`,
    "AUSTRAC registration does not constitute an endorsement or a guarantee of a provider's services.",
    "Generated electronically. Terms: www.zarman.com.au/en/legal/terms",
  ];
  let noticeY = top + 22;
  for (const notice of notices) {
    for (const line of wrapText(notice, regular, 8, contentWidth - 128)) { text(line, MARGIN, noticeY, { size: 8, color: MUTED }); noticeY += 12; }
    noticeY += 4;
  }
  const sealX = contentRight - 48, sealTop = top + 50, sealY = pageHeight - sealTop;
  for (const [size, borderWidth] of [[47, 1.4], [44, 0.4], [30, 0.7]] as const) page.drawCircle({ x: sealX, y: sealY, size, borderColor: INDIGO, borderWidth });
  const tilt = -0.18;
  const ring = "ZARMAN EXCHANGE PTY LTD  •  FROM ULURU TO DAMAVAND  •  ";
  const ringSize = 6, ringRadius = 34.5, ringLength = semibold.widthOfTextAtSize(ring, ringSize);
  let advance = 0;
  for (const char of ring) {
    const width = semibold.widthOfTextAtSize(char, ringSize);
    const angle = ((advance + width / 2) / ringLength) * Math.PI * 2 + tilt;
    page.drawText(char, {
      x: sealX + ringRadius * Math.sin(angle) - (width / 2) * Math.cos(angle),
      y: sealY + ringRadius * Math.cos(angle) + (width / 2) * Math.sin(angle),
      font: semibold, size: ringSize, color: INDIGO, rotate: degrees((-angle * 180) / Math.PI),
    });
    advance += width;
  }
  const stampLine = (value: string, offset: number, font: PDFFont, size: number) => {
    const half = font.widthOfTextAtSize(value, size) / 2;
    page.drawText(value, {
      x: sealX - half * Math.cos(tilt) - offset * Math.sin(tilt),
      y: sealY + half * Math.sin(tilt) - offset * Math.cos(tilt),
      font, size, color: INDIGO, rotate: degrees((-tilt * 180) / Math.PI),
    });
  };
  page.drawSvgPath("M-6 0L-2 4L6 -5", {
    x: sealX + 12 * Math.sin(tilt), y: sealY + 12 * Math.cos(tilt),
    borderColor: INDIGO, borderWidth: 1.8, rotate: degrees((-tilt * 180) / Math.PI),
  });
  stampLine("SETTLED", 3, bold, 9);
  stampLine(new Date(receipt.approvedAt).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "2-digit", month: "short", year: "numeric" }).toUpperCase(), 13, semibold, 5.8);

  // ── Footer on every page ────────────────────────────────────────────────
  const pages = doc.getPages();
  pages.forEach((current, index) => {
    page = current;
    text("ZARMAN EXCHANGE PTY LTD   ".repeat(11), pageWidth / 2, pageHeight - FOOTER_HEIGHT + 8, { size: 3.4, color: LAVENDER, align: "center" });
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 32, color: NAVY });
    text("www.zarman.com.au  ·  info@zarman.com.au  ·  +61 497 851 631", MARGIN, pageHeight - 13, { size: 8.5, color: WHITE });
    text(pages.length > 1 ? `Page ${index + 1} of ${pages.length}` : "From Uluru to Damavand", contentRight, pageHeight - 13, { font: semibold, size: 8.5, color: LAVENDER, align: "right" });
  });
  return doc.save();
}

/** The outbox stores the generated bytes before sending, so provider retries
 * stay byte-identical even though contact lines are read at render time. */
export async function renderRequestReceiptPdf(receipt: RequestCompletionReceiptSnapshot, contacts?: ReceiptContacts | null): Promise<Uint8Array> {
  validateRequestReceipt(receipt);
  return renderTransferReceipt({
    reference: receipt.reference_code,
    approvedAt: receipt.completed_at,
    sender: { name: receipt.sender_name, lines: contacts?.senderLines ?? [] },
    recipient: { name: receipt.recipient_name, lines: contacts?.recipientLines ?? [] },
    sent: { currency: receipt.funding_currency, amount: Number(receipt.funding_total) },
    received: { currency: receipt.recipient_currency, amount: Number(receipt.recipient_amount) },
    rate: Number(receipt.applied_rate),
    feeAud: Number(receipt.base_fee_aud),
    expressFee: receipt.service_tier === "priority" ? { currency: receipt.funding_currency, amount: Number(receipt.priority_fee_amount) } : null,
    reasonForTransfer: contacts?.reasonForTransfer,
    promoCode: contacts?.promoCode,
  });
}
