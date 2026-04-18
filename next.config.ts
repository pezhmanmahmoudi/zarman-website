import type { NextConfig } from "next";

// 🛡️ تنظیمات سخت‌گیرانه امنیتی (Content Security Policy)
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  img-src 'self' blob: data: https:;
  connect-src 'self' https://*.supabase.co;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\n/g, '').replace(/\s+/g, ' ').trim();

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY', // جلوگیری از باز شدن سایت در iframe (ضد کلیک‌دزدی)
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff', // جلوگیری از تغییر نوع فایل‌ها توسط هکرها
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin', // حفظ حریم خصوصی در لینک‌های خروجی
  },
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy, // دیوار آتش اصلی
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()', // مسدود کردن سخت‌افزارها
  },
];

const nextConfig: NextConfig = {
  // این تابع هدرهای امنیتی را به تمام صفحات سایت تزریق می‌کند
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;