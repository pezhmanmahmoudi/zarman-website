// proxy.ts (Next.js 16 convention)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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

  // چک کردن سشن کاربر بصورت امن
  const { data: { user } } = await supabase.auth.getUser()

  // 🛡️ منطق محافظت از داشبورد
  // اگر کاربر قصد ورود به صفحات داشبورد را دارد اما لاگین نیست
  if (!user && request.nextUrl.pathname.startsWith('/fa/dashboard')) {
    return NextResponse.redirect(new URL('/fa/login', request.url))
  }

  return response
}

// این قسمت مشخص می‌کند که پروکسی روی کدام مسیرها اجرا شود
export const config = {
  matcher: [
    /*
     * روی تمام مسیرها بجز موارد زیر اجرا شود:
     * - api routes
     * - static files (images, fonts, etc.)
     * - favicon
     */
    '/((?!api|_next/static|_next/image|assets|favicon.ico|sw.js).*)',
  ],
}