// Builds a clearly labelled design sample only. This script never sends mail.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { completion, delivery, templates } from "./fixtures/request-email-template.mjs";

const require = createRequire(import.meta.url);
const source = await readFile(resolve("lib/requests/receipt.ts"), "utf8");
const compiled = { exports: {} };
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: "lib/requests/receipt.ts" })(require, compiled, compiled.exports);

const code = "SAMPLE-ZE123456";
const receipt = { ...completion, reference_code: code, completed_at: "2026-10-09T01:00:00Z",
  sender_name: "Pezhman (sample)", recipient_name: "Sample Recipient" };
const pdf = await PDFDocument.load(await compiled.exports.renderRequestReceiptPdf(receipt));
const font = await pdf.embedFont(StandardFonts.HelveticaBold);
pdf.setTitle(`SAMPLE ONLY - Zarman receipt ${code}`);
pdf.setSubject("Design sample only. No funds have been transferred.");
for (const page of pdf.getPages()) {
  page.drawRectangle({ x: 42, y: 630, width: page.getWidth() - 84, height: 22, color: rgb(1, .95, .88) });
  page.drawText("SAMPLE ONLY - NOT PROOF OF TRANSFER", { x: 50, y: 638, size: 10, font, color: rgb(.55, .22, .03) });
  page.drawRectangle({ x: 36, y: 53, width: page.getWidth() - 72, height: 19, color: rgb(1, 1, 1) });
  page.drawText("Illustrative data only. No payment or settlement has taken place.", { x: 42, y: 60, size: 9, font, color: rgb(.55, .22, .03) });
}
const pdfOutput = resolve("output/pdf/zarman-sample-receipt-en.pdf");
await mkdir(resolve("output/pdf"), { recursive: true });
const pdfBytes = await pdf.save();
await writeFile(pdfOutput, pdfBytes);

const siteUrl = process.env.SAMPLE_SITE_URL || "https://www.zarman.com.au";
const snapshot = delivery({ reference: code, created_at: receipt.completed_at,
  recipient_email: "preview@example.test", payload_snapshot: { receipt } });
const email = templates.renderRequestNotification(snapshot, { from: "Zarman <preview@example.test>", siteUrl });
email.subject = `[SAMPLE] ${email.subject}`;
const notice = "DESIGN SAMPLE ONLY - No funds have been transferred. This email and its attached receipt contain illustrative data.";
email.html = email.html.replace(/(<h1\b)/, `<p style="margin:0 0 24px;padding:12px 16px;background:#fff4e6;border-radius:8px;color:#713d11;font-size:13px;line-height:1.6"><strong>${notice}</strong></p>$1`);
const requestUrl = `${siteUrl}/en/dashboard/requests/${snapshot.request_id}`;
email.html = email.html.replaceAll(requestUrl, `${siteUrl}/en/dashboard`).replaceAll("View request", "View dashboard");
const sampleReceiptNote = "The sample PDF receipt is attached. No transaction has been created.";
email.html = email.html.replace("Your final PDF receipt is attached and is also available from the request page.", sampleReceiptNote);
email.text = `${notice}\n\n${email.text.replaceAll(requestUrl, `${siteUrl}/en/dashboard`).replaceAll("View request", "View dashboard").replace("Your final PDF receipt is attached and is also available from the request page.", sampleReceiptNote)}`;
email.attachments = [{ filename: "zarman-SAMPLE-receipt-en.pdf", content: Buffer.from(pdfBytes).toString("base64"), contentType: "application/pdf" }];
const output = resolve("artifacts/request-email-previews");
await mkdir(output, { recursive: true });
await writeFile(resolve(output, "sample-en.html"), email.html, "utf8");
await writeFile(resolve(output, "sample-en.txt"), `${email.subject}\n\n${email.text}`, "utf8");
await mkdir(resolve("tmp/request-email-sample"), { recursive: true });
await writeFile(resolve("tmp/request-email-sample/payload.json"), JSON.stringify(email, null, 2), "utf8");
console.log(JSON.stringify({ sample: true, transactionCode: code, receipt: pdfOutput, email: resolve(output, "sample-en.html"), pdfBytes: pdfBytes.length }));
