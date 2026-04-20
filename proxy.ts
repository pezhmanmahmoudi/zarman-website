
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function getLocaleFromPath(pathname: string): 'fa' | 'en' {
  if (pathname.startsWith('/en')) return 'en'
  return 'fa'
}

function isDashboardRoute(pathname: string) {
  return pathname.startsWith('/fa/dashboard') || pathname.startsWith('/en/dashboard')
}


export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()


  if (!user && isDashboardRoute(request.nextUrl.pathname)) {
    const locale = getLocaleFromPath(request.nextUrl.pathname)
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
  }

  return response
}

export const config = {
  matcher: [
        '/((?!api|_next/static|_next/image|assets|favicon.ico|sw.js).*)',
  ],
}