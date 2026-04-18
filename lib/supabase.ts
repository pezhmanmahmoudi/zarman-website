import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
const noopFetch: typeof fetch = async () =>
  new Response(
    JSON.stringify({ message: "Supabase environment variables are not configured." }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }
  );

export const supabase = createClient(
  supabaseUrl ?? "https://missing-project.supabase.co",
  supabaseKey ?? "missing-anon-key",
  isSupabaseConfigured
    ? undefined
    : {
        global: { fetch: noopFetch },
        auth: { autoRefreshToken: false, persistSession: false },
      }
);
