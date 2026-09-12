import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "صرافی زرمان | راه حل هوشمند برای تبادل ارز",
    short_name: "زرمان",
    description: "خدمات حواله بین ایران و استرالیا، نرخ دلار استرالیا به تومان و پشتیبانی فارسی و انگلیسی در صرافی زرمان.",
    start_url: "/fa",
    scope: "/",
    display: "standalone",
    background_color: "#080B12",
    theme_color: "#080B12",
    lang: "fa",
    dir: "rtl",
    categories: ["finance", "business"],
    prefer_related_applications: false,
    icons: [
      // Standard sizes — "any" purpose for browser tabs / favicons
      {
        src: "/images/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable variants — Android adaptive icons (safe-zone cropped)
      {
        src: "/images/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/images/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "ثبت‌نام | Register",
        short_name: "Register",
        description: "ثبت‌نام و دریافت نرخ شخصی",
        url: "/fa/register",
        icons: [
          { src: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      },
      {
        name: "ورود | Login",
        short_name: "Login",
        description: "ورود به پنل کاربری",
        url: "/fa/login",
        icons: [
          { src: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      },
    ],
  };
}
