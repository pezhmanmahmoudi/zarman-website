import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/fa/dashboard",
          "/fa/dashboard/*",
          "/fa/auth",
          "/fa/auth/*",
          "/fa/login",
          "/fa/register",
          "/fa/forgot-password",
          "/fa/reset-password",
        ],
      },
    ],
    sitemap: "https://zarman.com.au/sitemap.xml",
    host: "https://zarman.com.au",
  };
}