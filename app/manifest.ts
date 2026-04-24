import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "صرافی زرمان | راه حل هوشمند برای تبادل ارز",
    short_name: "Zarmanex", 
    // 🚀 همگام‌سازی کامل دیسکریپشن با شعار اصلی برند
    description: "پلتفرمی نوین برای تبادل دلار استرالیا (AUD) و تومان (IRT) با نرخ‌های پویا، تسویه فوری و پایبندی کامل به استانداردهای قانونی در استرالیا.",
    
    // ⚡ تغییر استراتژیک: اجرای مستقیم مسیر اصلی برای افزایش سرعت PWA
    start_url: "/fa", 
    
    display: "standalone",
    background_color: "#080B12", 
    theme_color: "#080B12",
    lang: "fa", 
    dir: "rtl", 
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/images/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
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
        purpose: "any",
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