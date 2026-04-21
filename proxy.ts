
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseProxyClient } from '@/lib/supabase-server'

function getLocaleFromPath(pathname: string): 'fa' | 'en' {
  if (pathname.startsWith('/en')) return 'en'
  return 'fa'
}

export async function proxy(request: NextRequest) {
  const { supabase, getResponse, applyPendingCookies } = createSupabaseProxyClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()


  if (!user) {
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
