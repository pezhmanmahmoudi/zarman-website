"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, usePathname } from "next/navigation";

export default function SessionTimeout({ timeoutMinutes = 15 }: { timeoutMinutes?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  
  // ساخت کلاینت سوپابیس برای محیط مرورگر
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const logoutUser = async () => {
    try {
      // پاک کردن سشن از دیتابیس سوپابیس
      await supabase.auth.signOut();
      // هدایت کاربر به صفحه لاگین با یک پیام (از طریق URL)
      router.push("/fa/login?reason=timeout");
    } catch (error) {
      console.error("Error auto-logging out:", error);
    }
  };

  const resetTimer = () => {
    if (timeoutId.current) clearTimeout(timeoutId.current);
    // تنظیم مجدد تایمر برای ۱۵ دقیقه (یا هر عددی که ورودی دادیم)
    timeoutId.current = setTimeout(logoutUser, timeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    // فقط در مسیرهای داشبورد این نگهبان فعال باشد
    if (!pathname.includes("/dashboard")) return;

    // رویدادهایی که نشان‌دهنده بیداری و فعالیت کاربر هستند
    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    
    // متصل کردن رویدادها به مرورگر
    events.forEach((event) => window.addEventListener(event, resetTimer));
    
    // استارت اولیه تایمر
    resetTimer();

    // پاکسازی حافظه هنگام خروج از داشبورد
    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [pathname]); // وابستگی به تغییر مسیر

  // این کامپوننت هیچ چیزی در صفحه رندر نمی‌کند (نامرئی است)
  return null;
}