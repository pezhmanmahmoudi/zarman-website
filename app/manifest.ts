import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "صرافی زرمان",
    short_name: "Zarman", // 👈 نام مینیمال و امن برای آیکون موبایل
    description:
      "پلتفرمی امن و سریع برای تبادل دلار استرالیا (AUD) و تومان (IRT) با تسویه فوری.", // 👈 توضیحات فارسی و یکپارچه با سایت
    start_url: "/",
    display: "standalone",
    background_color: "#080B12", // 👈 رنگ Cosmic Navy
    theme_color: "#080B12",
    lang: "fa", // 👈 تعریف زبان پایه
    dir: "rtl", // 👈 تعریف جهت چیدمان برای اپلیکیشن موبایل
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      // 🚀 این دو آیکون برای نصب اپلیکیشن روی موبایل ضروری هستند
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
  };
}