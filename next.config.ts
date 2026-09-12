// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config silences the "webpack config but no turbopack config" warning
  // so `next dev` (Turbopack) works alongside the webpack() config used by `next build`.
  turbopack: {},
  // Ensure serverless functions include local assets used by PDF generation.
  outputFileTracingIncludes: {
    "/*": [
      "./public/fonts/**/*.ttf",
      "./public/images/logo-no-text-light.svg",
    ],
  },
  // Exclude nested leftover folder from compilation
  webpack(config) {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/zarman-website/**"],
    };
    return config;
  },
  transpilePackages: [],
  async headers() {
    const noindexHeaders = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }];
    return [
      ...(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production'
        ? [{ source: '/:path*', headers: noindexHeaders }]
        : []),
      ...['/admin/:path*', '/api/:path*', ...['fa', 'en'].flatMap((locale) =>
        ['dashboard', 'login', 'forgot-password', 'reset-password', 'auth'].map((path) => `/${locale}/${path}/:path*`)
      )].map((source) => ({ source, headers: noindexHeaders })),
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
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
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; connect-src 'self' https://*.supabase.co; img-src 'self' data: https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
