"use client";

import { useEffect, ReactNode } from "react";
import Lenis from "lenis"; // 👈 استفاده از هسته خالص، نه نسخه ری‌اکت
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

// ثبت پلاگین فقط در محیط مرورگر
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // ۱. ساخت نمونه خام و اصلی لنیس با فرمول زمان‌بندی دقیق (بدون lerp)
    const lenis = new Lenis({
      duration: 1.2, // 👈 زمان ثابت اسکرول (جلوگیری از سنگینی و کش‌آمدن)
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // 👈 فرمول ریاضی کلاسیک برای توقفِ نرم و بدون سکته
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    // ۲. هماهنگی مستقیم با انیمیشن‌های اسکرولی
    lenis.on('scroll', ScrollTrigger.update);

    // ۳. همگام‌سازی فریم‌ریت با GSAP
    function update(time: number) {
      lenis.raf(time * 1000);
    }

    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    // ۴. پاکسازی حافظه هنگام خروج
    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, []);

  // 🚀 هیچ تگ HTML اضافه‌ای دور محتوای سایت پیچیده نمی‌شود!
  return <>{children}</>;
}