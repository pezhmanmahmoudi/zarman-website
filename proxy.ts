import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // ۱. تولید یک کلید تصادفی و امن (Nonce) برای هر بازدیدکننده
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // ۲. بررسی محیط: آیا در حال برنامه‌نویسی هستیم یا سایت روی سرور اصلی است؟
  const isDev = process.env.NODE_ENV === 'development';
  
  // ۳. بستن درهای پشتی: unsafe-eval فقط در زمان کدنویسی مجاز است
  const scriptSrc = isDev 
    ? `'self' 'unsafe-inline' 'unsafe-eval'` 
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  // ۴. ساخت دیوار آتش پویا
  const cspHeader = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' data: https://fonts.gstatic.com;
    img-src 'self' blob: data: https:;
    connect-src 'self' https://*.supabase.co;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `.replace(/\n/g, '').replace(/\s+/g, ' ').trim();

  // ۵. تزریق رمز (Nonce) و دیوار آتش به هدرهای درخواست
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // ۶. اعمال قانون روی خروجی نهایی
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

// ۷. این قانون روی عکس‌ها و فایل‌های استاتیک اعمال نمی‌شود تا سرعت سایت کم نشود
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
};