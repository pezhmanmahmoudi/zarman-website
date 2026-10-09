import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

/** End only the cookie-backed session supplied by this browser. */
export async function POST(request: NextRequest) {
  // Logout is a mutation: never accept a link/prefetch or a cross-origin form.
  if (request.headers.get("origin") !== request.nextUrl.origin
    || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403, headers: NO_STORE });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pendingCookies = new Map<string, string>();
  try {
    const client = createServerClient(url, key, {
      global: { fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }) },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: cookies => { cookies.forEach(cookie => pendingCookies.set(cookie.name, cookie.value)); },
      },
    });
    const { error } = await Promise.race([
      client.auth.signOut({ scope: "local" }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("signout_timeout")); }, 5_000);
      }),
    ]);
    if (error) throw error;

    const response = NextResponse.json({ signedOut: true }, { headers: NO_STORE });
    const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    const names = new Set([...request.cookies.getAll().map(cookie => cookie.name), ...pendingCookies.keys()]);
    // Include every SSR chunk, the separate user cookie and the PKCE verifier;
    // leave preferences and unrelated projects' cookies alone.
    for (const name of names) {
      if ([storageKey, `${storageKey}-user`, `${storageKey}-code-verifier`].some(base =>
        name === base || (name.startsWith(`${base}.`) && /^\d+$/.test(name.slice(base.length + 1))))) {
        response.cookies.set(name, "", { path: "/", maxAge: 0, expires: new Date(0), sameSite: "lax", secure: request.nextUrl.protocol === "https:" });
      }
    }
    return response;
  } catch {
    // Keep the session available for an explicit retry if revocation failed.
    // Never report success or expose tokens/provider error bodies in that case.
    return NextResponse.json({ error: "Sign out could not be confirmed. Please retry." }, { status: 503, headers: NO_STORE });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
