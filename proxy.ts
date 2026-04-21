
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseProxyClient } from '@/lib/supabase-server'

function getLocaleFromPath(pathname: string): 'fa' | 'en' {
  if (pathname.startsWith('/en')) return 'en'
  return 'fa'
}

function isDashboardRoute(pathname: string) {
  return (
    pathname.startsWith('/fa/dashboard') ||
    pathname.startsWith('/en/dashboard') ||
    pathname.startsWith('/dashboard')
  )
}


export async function proxy(request: NextRequest) {
  if (!isDashboardRoute(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const { supabase, getResponse, applyPendingCookies } = createSupabaseProxyClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()


  if (!user && isDashboardRoute(request.nextUrl.pathname)) {
    const locale = getLocaleFromPath(request.nextUrl.pathname)
    const redirectResponse = NextResponse.redirect(new URL(`/${locale}/login`, request.url))
    return applyPendingCookies(redirectResponse)
  }

  return getResponse()
}

export const config = {
  matcher: [
    '/fa/dashboard/:path*',
    '/en/dashboard/:path*',
    '/dashboard/:path*',
  ],
}
