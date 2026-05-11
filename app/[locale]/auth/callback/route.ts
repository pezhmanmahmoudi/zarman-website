import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'signup' | 'recovery' | 'email' | null
  // Only allow relative paths to prevent open redirect attacks
  const rawNext = searchParams.get('next') ?? '/fa'
  const next = rawNext.startsWith('/') ? rawNext : '/fa'

  // Build the redirect response first so we can attach session cookies to it
  const redirectResponse = NextResponse.redirect(new URL(next, origin))
  const errorResponse = NextResponse.redirect(new URL('/fa/login?error=auth_callback_failed', origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // Write session cookies directly onto the redirect response
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectResponse
    }
    return errorResponse
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return redirectResponse
    }
    return errorResponse
  }

  return errorResponse
}
