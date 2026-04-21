
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseProxyClient } from '@/lib/supabase-server'

function getLocaleFromPath(pathname: string): 'fa' | 'en' {
  if (pathname.startsWith('/en')) return 'en'
  return 'fa'
}

function isDashboardRoute(pathname: string) {
  return pathname.startsWith('/fa/dashboard') || pathname.startsWith('/en/dashboard')
}


export async function proxy(request: NextRequest) {
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
        '/((?!api|_next/static|_next/image|assets|favicon.ico|sw.js).*)',
  ],
}
