import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseProxyClient } from '@/lib/supabase-server'

const locales = ['fa', 'en']
const defaultLocale = 'fa'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Exclude static assets, APIs, and next internals.
  // Although the config.matcher should handle this, it's good defensive programming
  // if some requests slip through.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // To properly refresh and manage Supabase session cookies for SSR,
  // we initialize the proxy client on every handled route.
  const { supabase, getResponse, applyPendingCookies } = createSupabaseProxyClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check locale prefix
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  // Redirect if no locale prefix is present
  if (!pathnameHasLocale) {
    // If it's pure root, direct to defaultLocale
    if (pathname === '/') {
      const redirectResponse = NextResponse.redirect(new URL(`/${defaultLocale}`, request.url))
      return applyPendingCookies(redirectResponse)
    }
    // Prefix with defaultLocale
    const redirectResponse = NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, request.url))
    return applyPendingCookies(redirectResponse)
  }

  // Detect current locale
  const locale = pathname.startsWith('/en') ? 'en' : 'fa'
  
  // Protect dashboard routes
  const isDashboard = pathname.startsWith(`/${locale}/dashboard`)
  
  if (isDashboard) {
    if (!user) {
      const redirectResponse = NextResponse.redirect(new URL(`/${locale}/login`, request.url))
      return applyPendingCookies(redirectResponse)
    }
  }

  // For all other cases, return the proxy response that forwards headers and applies set cookies 
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
