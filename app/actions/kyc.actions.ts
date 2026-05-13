"use server";

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase-server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_SIGNED_URL_EXPIRY_SECONDS = 60;
const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 300;
const MAX_SIGNED_URL_EXPIRY_SECONDS = 900;
const ALLOWED_DOCUMENT_KEYS = new Set(["doc-front", "doc-back", "proof-of-address"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPrivilegedRole(role: string | undefined) {
  return role === "admin" || role === "supabase_admin" || role === "service_role";
}

async function getAuthenticatedUser(accessToken?: string) {
  if (accessToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (!error && data.user) {
      return data.user;
    }
  }

  const supabaseServer = await createSupabaseServerActionClient();

  const { data, error } = await supabaseServer.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unauthorized request.");
  }

  return data.user;
}

export async function uploadKycDocumentSecurely({
  userId,
  key,
  file,
  accessToken,
}: {
  userId: string;
  key: string;
  file: File;
  accessToken?: string;
}) {
  if (!userId || !key || !file) {
    throw new Error("Missing upload inputs.");
  }

  if (!isUuid(userId)) {
    throw new Error("Invalid user identifier.");
  }

  if (!ALLOWED_DOCUMENT_KEYS.has(key)) {
    throw new Error("Invalid document key.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File is larger than 5MB.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Unsupported file type.");
  }

  const user = await getAuthenticatedUser(accessToken);
  const isOwner = user.id === userId;
  const role = user.app_metadata?.role as string | undefined;
  const isPrivileged = isPrivilegedRole(role);

  if (!isOwner && !isPrivileged) {
    throw new Error("Forbidden upload target.");
  }

  const safeName = sanitizeFileName(file.name || "document");
  const storagePath = `${userId}/${key}-${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("kyc-documents")
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new Error(`Failed to upload ${key}: ${uploadError.message}`);
  }

  return { storagePath };
}

export async function createKycDocumentSignedUrl({
  userId,
  storagePath,
  expiresIn = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
  accessToken,
}: {
  userId: string;
  storagePath: string;
  expiresIn?: number;
  accessToken?: string;
}) {
  if (!userId || !storagePath) {
    throw new Error("Missing signed URL inputs.");
  }

  if (!isUuid(userId)) {
    throw new Error("Invalid user identifier.");
  }

  const user = await getAuthenticatedUser(accessToken);
  const role = user.app_metadata?.role as string | undefined;
  const isPrivileged = isPrivilegedRole(role);
  const isOwner = user.id === userId;
  const firstSlashIndex = storagePath.indexOf("/");
  const pathUserId = firstSlashIndex > 0 ? storagePath.slice(0, firstSlashIndex) : "";
  const isOwnedPath = pathUserId === userId;
  const safeExpirySeconds = Math.min(
    Math.max(Math.floor(expiresIn), MIN_SIGNED_URL_EXPIRY_SECONDS),
    MAX_SIGNED_URL_EXPIRY_SECONDS
  );

  if ((!isOwner || !isOwnedPath) && !isPrivileged) {
    throw new Error("Forbidden signed URL request.");
  }

  const { data, error } = await supabaseAdmin.storage
    .from("kyc-documents")
    .createSignedUrl(storagePath, safeExpirySeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Failed to create signed URL.");
  }

  return { signedUrl: data.signedUrl, expiresIn: safeExpirySeconds };
}

// ---------------------------------------------------------------------------
// sendTelegramKycNotification — fires an admin alert via the Telegram Bot API.
// Credentials are read from server-only env vars (never exposed to the client).
// ---------------------------------------------------------------------------
async function sendTelegramKycNotification({
  firstName,
  lastName,
  email,
}: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    // Credentials not configured — skip silently.
    return;
  }

  const fullName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Unknown";
  const displayEmail = email || "N/A";

  const text =
    `🔔 A user has completed their profile in the Dashboard and is waiting for KYC verification.\n\n` +
    `👤 Name: ${fullName}\n` +
    `📧 Email: ${displayEmail}`;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// submitKycData — AUSTRAC-compliant identity submission (no document images).
// Must run server-side: uses service role to bypass RLS so that kyc_status
// is set atomically and can never be forged from the browser.
// ---------------------------------------------------------------------------
const ALLOWED_DOC_TYPES = new Set(["driver_license", "passport"]);

function isUuidLocal(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function submitKycData(payload: {
  dob: string;
  country: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  document_type: string;
  license_number?: string | null;
  card_number?: string | null;
  passport_number?: string | null;
  consent_notice: boolean;
  consent_dvs: boolean;
}) {
  // 1. Authenticate — get the user from the server-side session.
  const supabaseServer = await createSupabaseServerActionClient();
  const { data: authData, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Unauthorized: no active session." };
  }
  const userId = authData.user.id;
  if (!isUuidLocal(userId)) {
    return { error: "Invalid session identifier." };
  }

  // 2. Server-side validation.
  if (
    !payload.dob ||
    !payload.address ||
    !payload.city ||
    !payload.state ||
    !payload.postcode
  ) {
    return { error: "Missing required address or date-of-birth fields." };
  }
  if (!ALLOWED_DOC_TYPES.has(payload.document_type)) {
    return { error: "Invalid document type." };
  }
  if (payload.document_type === "driver_license") {
    if (!payload.license_number || !payload.card_number) {
      return { error: "Licence number and card number are required." };
    }
  }
  if (payload.document_type === "passport" && !payload.passport_number) {
    return { error: "Passport number is required." };
  }
  if (!payload.consent_notice || !payload.consent_dvs) {
    return { error: "DVS consent is required before submission." };
  }

  // 3. Immutability guard — approved profiles cannot be re-submitted.
  const { data: current, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select("kyc_status, first_name, last_name")
    .eq("id", userId)
    .single();
  if (fetchError) {
    return { error: "Could not verify account status." };
  }
  if (current?.kyc_status === "approved") {
    return { error: "Your identity has already been approved and cannot be modified." };
  }

  // 4. Persist identity data. Service role bypasses RLS so kyc_status cannot
  //    be escalated by the user directly — only this action sets it to "pending".
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      dob: payload.dob,
      country: payload.country,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      postcode: payload.postcode,
      document_type: payload.document_type,
      license_number:
        payload.document_type === "driver_license" ? (payload.license_number ?? null) : null,
      card_number:
        payload.document_type === "driver_license" ? (payload.card_number ?? null) : null,
      passport_number:
        payload.document_type === "passport" ? (payload.passport_number ?? null) : null,
      kyc_status: "pending",
    })
    .eq("id", userId);

  if (updateError) {
    return { error: `Failed to save identity data: ${updateError.message}` };
  }

  // 5. Send Telegram admin notification — non-fatal if it fails.
  try {
    await sendTelegramKycNotification({
      firstName: current?.first_name ?? null,
      lastName: current?.last_name ?? null,
      email: authData.user.email ?? null,
    });
  } catch {
    // Notification failure must never block the user response.
  }

  // 6. Audit-log the DVS consent — non-fatal if it fails.
  try {
    await supabaseAdmin.from("audit_logs").insert([
      {
        actor_id: userId,
        actor_email: authData.user.email ?? "",
        action: "KYC_DVS_CONSENT_GRANTED",
        target_type: "profile",
        target_id: userId,
        new_value: {
          document_type: payload.document_type,
          consent_notice: payload.consent_notice,
          consent_dvs: payload.consent_dvs,
          submitted_at: new Date().toISOString(),
        },
      },
    ]);
  } catch {
    // Consent is saved on the profile row; audit log failure is non-fatal.
  }

  return { success: true };
}
