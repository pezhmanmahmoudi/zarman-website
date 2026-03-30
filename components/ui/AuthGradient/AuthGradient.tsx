"use client";

import React, { useEffect } from "react";
import { Gradient } from "@/lib/Gradient"; // مسیر را با توجه به جایگاه فایل خود اصلاح کنید

export default function AuthGradient() {
  useEffect(() => {
    // مقداردهی اولیه گرادیانت
    const gradient = new Gradient();
    
    // تنظیم متغیرهای CSS روی body یا یک کانتینر برای تغذیه Gradient.js
    // رنگ‌ها از پالت پرمیوم زرمان (نیلی و بنفش) گرفته شده‌اند
    document.documentElement.style.setProperty("--gradient-color-1", "#2360ec"); // Midnight Void (Base)
    document.documentElement.style.setProperty("--gradient-color-2", "#ff00ff"); // Indigo
    document.documentElement.style.setProperty("--gradient-color-3", "#7C3AED"); // Ultraviolet
    document.documentElement.style.setProperty("--gradient-color-4", "#cf29f0"); // Deep Navy

    gradient.initGradient("#auth-gradient-canvas");

    return () => {
      // پاکسازی هنگام خروج از صفحه
      gradient.disconnect();
    };
  }, []);

  return (
    <canvas
      id="auth-gradient-canvas"
      data-js-darken-top
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}