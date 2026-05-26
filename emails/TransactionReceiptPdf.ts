import { PDFDocument, rgb, PageSizes } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import type { TransactionReceiptProps } from "./TransactionReceiptEmail";

// --- Helpers ------------------------------------------------------------------

/** Strip Arabic/Persian characters -- pdf-lib standard fonts are Latin-only. */
function pdfSafe(str: string | null | undefined): string {
  return (str ?? "")
    .replace("تومان", "Toman")
    .replace(/[\u0600-\u06FF\u0750-\u077F]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function hex(h: string) {
  return rgb(
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255
  );
}

// --- Main ---------------------------------------------------------------------

export async function renderTransactionReceiptPdf(
  props: TransactionReceiptProps
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage(PageSizes.A4);
  const { width, height } = page.getSize(); // 595.28 x 841.89 pt

  // Embed Inter font (TTF) — clean, modern, professional
  const [interRegularBytes, interBoldBytes, interSemiBoldBytes] = await Promise.all([
    readFile(join(process.cwd(), "public", "fonts", "Inter-Regular.ttf")),
    readFile(join(process.cwd(), "public", "fonts", "Inter-Bold.ttf")),
    readFile(join(process.cwd(), "public", "fonts", "Inter-SemiBold.ttf")),
  ]);
  const regular   = await doc.embedFont(interRegularBytes, { subset: true });
  const semibold  = await doc.embedFont(interSemiBoldBytes, { subset: true });
  const bold      = await doc.embedFont(interBoldBytes, { subset: true });

  // Logo — rasterise the no-text SVG to PNG via sharp so it renders cleanly on the dark background
  const svgBytes = await readFile(
    join(process.cwd(), "public", "images", "logo-no-text-light.svg")
  );
  const logoPngBytes = await sharp(svgBytes)
    .resize(256, 256)
    .png()
    .toBuffer();
  const logoImg = await doc.embedPng(logoPngBytes);

  const M = 50;           // horizontal margin
  const CW = width - M * 2; // ~495 pt content width
  const CX = width / 2;     // ~297.6 pt center

  // --- Color palette (minimal & premium) ---
  const BG         = hex("#ffffff"); // crisp white
  const HEADER_BG  = hex("#0f1729"); // deep navy header strip
  const WHITE      = hex("#ffffff");
  const INK        = hex("#0f172a"); // primary text
  const GRAY       = hex("#64748b"); // secondary text
  const MUTED      = hex("#94a3b8"); // text on dark header
  const INDIGO     = hex("#3848f5"); // brand accent
  const GREEN      = hex("#059669"); // success green
  const RULE       = hex("#cbd5e1"); // crisp light dividers

  // --- Helpers (topY = distance from TOP of page) ---
  // pdf-lib: y=0 is bottom, so pdf-lib y = height - topY - rectHeight for rects

  function fillRect(
    x: number, topY: number, w: number, h: number,
    color: ReturnType<typeof hex>, opacity = 1
  ) {
    page.drawRectangle({ x, y: height - topY - h, width: w, height: h, color, opacity });
  }

  /** Draw text centred on CX. */
  function ctext(
    str: string, topY: number,
    opts: { font?: typeof bold; size?: number; color?: ReturnType<typeof hex> } = {}
  ) {
    const safe = pdfSafe(str);
    if (!safe) return;
    const f = opts.font ?? regular;
    const s = opts.size ?? 10;
    page.drawText(safe, {
      x: CX - f.widthOfTextAtSize(safe, s) / 2,
      y: height - topY,
      font: f, size: s, color: opts.color ?? WHITE,
    });
  }

  /** Draw left-aligned text. */
  function ltext(
    str: string, x: number, topY: number,
    opts: { font?: typeof bold; size?: number; color?: ReturnType<typeof hex>; maxWidth?: number } = {}
  ) {
    const safe = pdfSafe(str);
    if (!safe) return;
    page.drawText(safe, {
      x, y: height - topY,
      font: opts.font ?? regular, size: opts.size ?? 10,
      color: opts.color ?? WHITE, maxWidth: opts.maxWidth,
    });
  }

  function hline(topY: number, x1 = 0, x2 = width, color = RULE, thickness = 0.5) {
    page.drawLine({ start: { x: x1, y: height - topY }, end: { x: x2, y: height - topY }, thickness, color });
  }

  function checkmark(startX: number, topY: number, size: number) {
    const baselineY = height - topY;
    const yCenter = baselineY + size * 0.35;
    const lX = startX,               lY = yCenter;
    const bX = startX + size * 0.38, bY = yCenter - size * 0.35;
    const rX = startX + size * 0.95, rY = yCenter + size * 0.45;

    page.drawLine({ start: { x: lX, y: lY }, end: { x: bX, y: bY }, thickness: 2.5, color: GREEN });
    page.drawLine({ start: { x: bX, y: bY }, end: { x: rX, y: rY }, thickness: 2.5, color: GREEN });
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================

  // 0. Page background + branded header strip
  fillRect(0, 0, width, height, BG);
  fillRect(0, 0, width, 175, HEADER_BG); // deep navy header

  // 1. Logo (centred)
  const LOGO = 82;
  page.drawImage(logoImg, { x: CX - LOGO / 2, y: height - 42 - LOGO, width: LOGO, height: LOGO });

  // 2. Company name + legal line
  ctext("ZARMAN EXCHANGE", 138, { font: bold, size: 15, color: WHITE });
  ctext("ABN: 70892742957  |  ACN: 692742957  |  AUSTRAC: ND100907570", 157, { font: semibold, size: 7.5, color: MUTED });

  // 3. Separator — full-width brand accent line between header and body
  hline(175, 0, width, INDIGO, 1.5);

  // 4. Success Status (Minimalist, correct proportions)
  const PT = 215;
  const TX = "Transaction Successful";
  const TS = 20; // larger, standard heading size
  const CKS = 18; // tick sized proportional to text
  const ROW_W = CKS + 12 + bold.widthOfTextAtSize(TX, TS);
  const ROW_X = CX - ROW_W / 2;
  
  checkmark(ROW_X, PT, CKS);
  page.drawText(TX, { x: ROW_X + CKS + 12, y: height - PT, font: bold, size: TS, color: GREEN });

  // 5. Date / Reference
  const dateStr = new Date(props.transactionDate).toLocaleString("en-AU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  ctext(`Receipt for transaction on ${dateStr}`, PT + 30, { font: regular, size: 11, color: GRAY });
  ctext(`Reference: #${props.referenceId}`, PT + 52, { font: semibold, size: 12, color: INK });

  // 6. Brand tagline
  ctext("From Uluru to Damavand", PT + 95, { font: bold, size: 15, color: INDIGO });
  ctext("Just in a few hours", PT + 115, { font: regular, size: 11, color: GRAY });

  // 7. Grid Layout Details (Spacious and readable)
  const BX = M + 20;
  const BW = CW - 40;
  const SPLIT = BX + BW * 0.55; 
  const SENDER_TOP = PT + 165;

  // SENDER
  hline(SENDER_TOP, M, M + CW, RULE, 1);

  ltext("SENDER", BX, SENDER_TOP + 28, { font: semibold, size: 10, color: GRAY });
  ltext(props.senderFullName || "—", BX, SENDER_TOP + 50, { font: bold, size: 14, color: INK, maxWidth: SPLIT - BX - 20 });
  let sy = SENDER_TOP + 72;
  if (props.senderPhone) { ltext(props.senderPhone, BX, sy, { font: regular, size: 11, color: GRAY }); sy += 18; }
  if (props.senderAddress) { ltext(props.senderAddress, BX, sy, { font: regular, size: 11, color: GRAY }); }

  ltext("AMOUNT SENT", SPLIT, SENDER_TOP + 28, { font: semibold, size: 10, color: GRAY });
  ltext(pdfSafe(props.amountSent), SPLIT, SENDER_TOP + 56, { font: bold, size: 20, color: INK });

  // RECEIVER
  const RECV_TOP = SENDER_TOP + 125;
  hline(RECV_TOP, M, M + CW, RULE, 1);

  ltext("RECEIVER", BX, RECV_TOP + 28, { font: semibold, size: 10, color: GRAY });
  ltext(props.receiverFullName || "—", BX, RECV_TOP + 50, { font: bold, size: 14, color: INK, maxWidth: SPLIT - BX - 20 });
  let ry = RECV_TOP + 72;
  if (props.receiverPhone) { ltext(props.receiverPhone, BX, ry, { font: regular, size: 11, color: GRAY }); ry += 18; }
  if (props.receiverAddress) { ltext(props.receiverAddress, BX, ry, { font: regular, size: 11, color: GRAY }); }

  ltext("AMOUNT RECEIVED", SPLIT, RECV_TOP + 28, { font: semibold, size: 10, color: GREEN });
  ltext(pdfSafe(props.amountReceived), SPLIT, RECV_TOP + 56, { font: bold, size: 20, color: GREEN });

  // Footer — pinned to the very bottom of A4 (height ≈ 841.89pt)
  const FOOTER_Y = height - 62; // 62pt from the bottom of the page
  hline(FOOTER_Y, M, M + CW, RULE, 1);
  const footerLine = "www.zarman.com.au     |     +61 497 851 631";
  ctext(footerLine, FOOTER_Y + 28, { font: regular, size: 10, color: GRAY });

  return await doc.save();
}