import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseProxyClient } from '@/lib/supabase-server'

const locales = ['fa', 'en'] as const
const defaultLocale = 'fa'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Fast path — static assets, API routes, and files with extensions.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel/') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Determine whether this path actually requires an auth check.
  // Public routes (landing page, login, register, etc.) skip the
  // Supabase getUser() network call entirely, eliminating ~200-400ms
  // of latency for the vast majority of visitors.
  const isDashboardPath = locales.some((l) =>
    pathname === `/${l}/dashboard` || pathname.startsWith(`/${l}/dashboard/`)
  )
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
  const needsAuthCheck = isDashboardPath || isAdminPath

  // ------------------------------------------------------------------
  // Public routes — locale redirect only, no auth call.
  // ------------------------------------------------------------------
  if (!needsAuthCheck) {
    const pathnameHasLocale = locales.some(
      (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    )

    if (!pathnameHasLocale) {
      const destination = request.nextUrl.clone()
      destination.pathname = pathname === '/' ? `/${defaultLocale}` : `/${defaultLocale}${pathname}`
      // Locale-less URLs have one permanent destination; preserve campaign queries.
      return NextResponse.redirect(destination, 308)
    }

    return NextResponse.next()
  }

  // ------------------------------------------------------------------
  // Auth-protected routes — validate session via Supabase.
  // ------------------------------------------------------------------
  const { supabase, getResponse, applyPendingCookies } = createSupabaseProxyClient(request)
  const privateResponse = (response: NextResponse) => {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0')
    return response
  }

  // getClaims() refreshes an expired session and verifies the JWT signature
  // locally against the cached JWKS (ES256), avoiding an Auth round trip per request.
  // Server actions that mutate data still re-validate with getUser().
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims ?? null

  // ------------------------------------------------------------------
  // Admin routes (/admin/*)
  // ------------------------------------------------------------------
  if (isAdminPath) {
    const isAdminLoginPage = pathname === '/admin/login'
    const isAdmin = !!claims && claims.app_metadata?.role === 'admin'

    if (isAdminLoginPage) {
      // Redirect already-authenticated admins away from the login page.
      if (isAdmin) {
        return privateResponse(applyPendingCookies(
          NextResponse.redirect(new URL('/admin/dashboard', request.url))
        ))
      }
      return privateResponse(getResponse())
    }

    // All other /admin/* routes require admin role.
    if (!isAdmin) {
      return privateResponse(applyPendingCookies(
        NextResponse.redirect(new URL('/admin/login', request.url))
      ))
    }

    return privateResponse(getResponse())
  }

  // ------------------------------------------------------------------
  // Protect /[locale]/dashboard — require authenticated session.
  // ------------------------------------------------------------------
  const locale = pathname.startsWith('/en') ? 'en' : 'fa'

  if (!claims) {
    const loginUrl = new URL(`/${locale}/login`, request.url)
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    return privateResponse(applyPendingCookies(
      NextResponse.redirect(loginUrl)
    ))
  }

  return privateResponse(getResponse())
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, Earth, manifest... (static public)
     */
    '/((?!api|_vercel/|_next/static|_next/image|favicon.ico|images|fonts|Earth|manifest.*|.*\\.css$).*)',
  ],
}
