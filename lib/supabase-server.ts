import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type SupabaseCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function createSupabaseSsrClient(cookieHandlers: {
  getAll: () => { name: string; value: string }[];
  setAll: (cookiesToSet: SupabaseCookie[]) => void;
}) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: cookieHandlers,
  });
}

export async function createSupabaseServerActionClient() {
  const cookieStore = await cookies();

  return createSupabaseSsrClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });
}

export function createSupabaseProxyClient(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pendingCookies = new Map<string, SupabaseCookie>();

  const supabase = createSupabaseSsrClient({
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        pendingCookies.set(name, { name, value, options });
        request.cookies.set(name, value);
        response.cookies.set(name, value, options);
      });
    },
  });

  function applyPendingCookies(targetResponse: NextResponse) {
    pendingCookies.forEach(({ name, value, options }) => {
      targetResponse.cookies.set(name, value, options);
    });
    return targetResponse;
  }

  return {
    supabase,
    getResponse() {
      return response;
    },
    applyPendingCookies,
  };
}
