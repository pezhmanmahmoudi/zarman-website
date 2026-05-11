import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseProxyClient } from '@/lib/supabase-server'

const locales = ['fa', 'en'] as const
const defaultLocale = 'fa'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Fast path — static assets, API routes, and files with extensions.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Refresh Supabase session cookies on every handled request.
  const { supabase, getResponse, applyPendingCookies } = createSupabaseProxyClient(request)

  // getUser() validates the JWT server-side — safer than getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ------------------------------------------------------------------
  // Admin routes (/admin/*)
  // ------------------------------------------------------------------
  if (pathname.startsWith('/admin')) {
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
  // Customer routes — enforce locale prefix.
  // ------------------------------------------------------------------
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (!pathnameHasLocale) {
    if (pathname === '/') {
      return applyPendingCookies(
        NextResponse.redirect(new URL(`/${defaultLocale}`, request.url))
      )
    }
    return applyPendingCookies(
      NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, request.url))
    )
  }

  // ------------------------------------------------------------------
  // Protect /[locale]/dashboard — require authenticated session.
  // ------------------------------------------------------------------
  const locale = pathname.startsWith('/en') ? 'en' : 'fa'
  const isDashboard = pathname.startsWith(`/${locale}/dashboard`)

  if (isDashboard && !user) {
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
    '/((?!api|_next/static|_next/image|favicon.ico|images|fonts|Earth|manifest.*|.*\\.css$).*)',
  ],
}
