import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type PaymentAccountAccess = { username: string; password: string };

export function validatePaymentAccountAccess(value: unknown): PaymentAccountAccess | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object") throw new Error("Invalid payment account details.");
  const { username, password } = value as Record<string, unknown>;
  if (typeof username !== "string" || typeof password !== "string") throw new Error("Invalid payment account details.");
  if (!username.trim() && !password) return undefined;
  if (!username.trim() || username.length > 254 || !password || password.length > 1024) {
    throw new Error("Enter both the payment account username and password.");
  }
  return { username: username.trim(), password };
}

function encryptionKey() {
  const encoded = process.env.PAYMENT_ACCESS_ENCRYPTION_KEY;
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error("Payment account storage is not configured. Please contact support.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("Payment account storage is not configured. Please contact support.");
  return key;
}

export function encryptPaymentAccountAccess(value: PaymentAccountAccess, ownerId: string, quoteId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`payment-account:v1:${ownerId}:${quoteId}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptPaymentAccountAccess(envelope: string, ownerId: string, quoteId: string): PaymentAccountAccess {
  try {
    const [version, iv, tag, ciphertext, extra] = envelope.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    decipher.setAAD(Buffer.from(`payment-account:v1:${ownerId}:${quoteId}`));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]);
    const value = validatePaymentAccountAccess(JSON.parse(plaintext.toString("utf8")));
    if (!value) throw new Error();
    return value;
  } catch { throw new Error("Payment account details could not be opened. Please contact your administrator."); }
}
