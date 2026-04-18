import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
const fallbackSupabaseUrl = "http://127.0.0.1:54321";
const fallbackSupabaseAnonKey = "invalid-anon-key-env-missing";
const noopFetch: typeof fetch = async () =>
  new Response(
    JSON.stringify({ message: "Supabase environment variables are not configured." }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }
  );

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase env vars are missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Falling back to no-op client."
  );
}

export const supabase = createClient(
  supabaseUrl ?? fallbackSupabaseUrl,
  supabaseKey ?? fallbackSupabaseAnonKey,
  isSupabaseConfigured
    ? undefined
    : {
        global: { fetch: noopFetch },
        auth: { autoRefreshToken: false, persistSession: false },
      }
);
