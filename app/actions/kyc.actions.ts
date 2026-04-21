"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

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
}: {
  userId: string;
  key: string;
  file: File;
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

  const user = await getAuthenticatedUser();
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
}: {
  userId: string;
  storagePath: string;
  expiresIn?: number;
}) {
  if (!userId || !storagePath) {
    throw new Error("Missing signed URL inputs.");
  }

  if (!isUuid(userId)) {
    throw new Error("Invalid user identifier.");
  }

  const user = await getAuthenticatedUser();
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
