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

  if (!/^[a-z0-9-]+$/i.test(key)) {
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
  const storagePath = `${userId}/${key}-${Date.now()}-${safeName}`;

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
  expiresIn = 300,
}: {
  userId: string;
  storagePath: string;
  expiresIn?: number;
}) {
  if (!userId || !storagePath) {
    throw new Error("Missing signed URL inputs.");
  }

  const user = await getAuthenticatedUser();
  const role = user.app_metadata?.role as string | undefined;
  const isPrivileged = isPrivilegedRole(role);
  const isOwner = user.id === userId;
  const isOwnedPath = storagePath.startsWith(`${userId}/`);

  if ((!isOwner || !isOwnedPath) && !isPrivileged) {
    throw new Error("Forbidden signed URL request.");
  }

  const { data, error } = await supabaseAdmin.storage
    .from("kyc-documents")
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Failed to create signed URL.");
  }

  return { signedUrl: data.signedUrl, expiresIn };
}
