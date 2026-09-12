import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      // Auth forms stay crawlable so crawlers can read their noindex directive.
      // Authentication controls access; robots.txt does not secure private data.
      disallow: ["/fa/dashboard", "/en/dashboard", "/admin", "/api/", "/fa/auth/callback", "/en/auth/callback"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
