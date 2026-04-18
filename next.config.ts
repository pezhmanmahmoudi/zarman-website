import type { NextConfig } from "next";

// 🛡️ سایر هدرهای امنیتی (CSP به فایل middleware منتقل شد)
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY', // جلوگیری از باز شدن سایت در iframe
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff', 
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin', 
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()', 
  },
];

const nextConfig: NextConfig = {
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