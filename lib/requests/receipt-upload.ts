// Leave room for multipart metadata below the hosting provider's 4.5 MB cap.
export const MAX_REQUEST_RECEIPT_BYTES = 4 * 1024 * 1024;
export const REQUEST_RECEIPTS_BUCKET = "exchange-request-receipts";

/** Inspect the bytes as well as the browser's content type. Never serve uploaded
 * HTML/SVG or executable content as an inline receipt. */
export function inspectReceiptUpload(bytes: Uint8Array, name: string, declaredType: string): { contentType: string; extension: string; filename: string } {
  if (!bytes.length || bytes.length > MAX_REQUEST_RECEIPT_BYTES) throw new Error("Upload a receipt of up to 4 MB.");
  let contentType: string;
  let extension: string;
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
    contentType = "image/png"; extension = "png";
  } else if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    contentType = "image/jpeg"; extension = "jpg";
  } else if (bytes.length >= 8 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") {
    contentType = "application/pdf"; extension = "pdf";
  } else throw new Error("Choose a PDF, JPG or PNG bank transfer receipt.");
  if (declaredType && declaredType !== contentType && !(contentType === "image/jpeg" && declaredType === "image/jpg")) throw new Error("The file contents do not match its file type.");
  const base = name.replace(/\.[^.]*$/, "").replace(/[\u0000-\u001f\u007f/\\<>:"|?*]/g, "_").trim().slice(0, 100) || "bank-receipt";
  return { contentType, extension, filename: `${base}.${extension}` };
}
