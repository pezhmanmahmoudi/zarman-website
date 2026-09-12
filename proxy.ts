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

  // getUser() validates the JWT server-side — safer than getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ------------------------------------------------------------------
  // Admin routes (/admin/*)
  // ------------------------------------------------------------------
  if (isAdminPath) {
    const isAdminLoginPage = pathname === '/admin/login'
    const isAdmin = !!user && user.app_metadata?.role === 'admin'

    if (isAdminLoginPage) {
      // Redirect already-authenticated admins away from the login page.
      if (isAdmin) {
        return applyPendingCookies(
          NextResponse.redirect(new URL('/admin/dashboard', request.url))
        )
      }
      return getResponse()
    }

    // All other /admin/* routes require admin role.
    if (!isAdmin) {
      return applyPendingCookies(
        NextResponse.redirect(new URL('/admin/login', request.url))
      )
    }

    return getResponse()
  }

  // ------------------------------------------------------------------
  // Protect /[locale]/dashboard — require authenticated session.
  // ------------------------------------------------------------------
  const locale = pathname.startsWith('/en') ? 'en' : 'fa'

  if (!user) {
    return applyPendingCookies(
      NextResponse.redirect(new URL(`/${locale}/login`, request.url))
    )
  }

  return getResponse()
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
