import type { MetadataRoute } from "next";

// آدرس تولیدی صرافی زرمان
const productionUrl = "https://zarman.com.au";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/fa/dashboard/", // جلوگیری از ایندکس شدن پنل کاربری
          "/api/",          // بستن تمام مسیرهای ای‌پی‌آی برای امنیت بیشتر
          "/_next/",        // جلوگیری از خزش فایل‌های داخلی نکست
        ],
      },
    ],
    // استفاده از روش امن گزینه ۲ برای ساخت آدرس نقشه سایت
    sitemap: new URL("/sitemap.xml", productionUrl).toString(),
    host: productionUrl,
  };
}