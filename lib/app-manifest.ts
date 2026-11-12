import type { MetadataRoute } from "next";

/**
 * Installed-app manifest per language. Both share one app `id`, so installing
 * from either language is the same app; it opens on the home page (live rates)
 * in the language it was installed from.
 */
export function appManifest(locale: "fa" | "en"): MetadataRoute.Manifest {
  const fa = locale === "fa";
  const icon = (src: string, size: number, purpose: "any" | "maskable") => ({ src, sizes: `${size}x${size}`, type: "image/png", purpose });
  return {
    id: "/",
    // Shown under the desktop/home-screen icon and in the install dialog: the brand only.
    name: "ZarmanEx",
    short_name: "ZarmanEx",
    description: fa
      ? "نرخ لحظه‌ای دلار استرالیا به تومان، ثبت و پیگیری حواله استرالیا به ایران و اعلان وضعیت انتقال‌ها در ZarmanEx."
      : "Live AUD to toman rates, Australia to Iran transfers and instant updates on your transfers with ZarmanEx.",
    start_url: `/${locale}`,
    scope: "/",
    display: "standalone",
    background_color: "#080B12",
    theme_color: "#080B12",
    lang: fa ? "fa" : "en-AU",
    dir: fa ? "rtl" : "ltr",
    categories: ["finance", "business"],
    prefer_related_applications: false,
    icons: [
      icon("/images/icon-192.png", 192, "any"),
      icon("/images/icon-512.png", 512, "any"),
      icon("/images/icon-maskable-192.png", 192, "maskable"),
      icon("/images/icon-maskable-512.png", 512, "maskable"),
    ],
    shortcuts: [
      {
        name: fa ? "داشبورد من" : "My dashboard",
        short_name: fa ? "داشبورد" : "Dashboard",
        description: fa ? "وضعیت انتقال‌ها و پیام‌های ZarmanEx" : "Your transfers and messages from ZarmanEx",
        url: `/${locale}/dashboard`,
        icons: [{ src: "/images/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: fa ? "انتقال تازه" : "New transfer",
        short_name: fa ? "انتقال تازه" : "New transfer",
        description: fa ? "ثبت درخواست حواله تازه" : "Start a new transfer request",
        url: `/${locale}/dashboard?tab=transfer`,
        icons: [{ src: "/images/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
