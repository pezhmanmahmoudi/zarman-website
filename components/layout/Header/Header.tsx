"use client";

import { useSyncExternalStore, useEffect, useState } from "react";
import HeaderPublic from "./HeaderPublic";
import HeaderAuth from "./HeaderAuth";
import MobHeader from "./MobHeader";

// 👈 ایمپورت به صورت گلوبال و معمولی انجام شد
import "./Header.css";

type HeaderProps = {
  isAuthenticated?: boolean;
  isReady?: boolean;
};

export default function Header({
  isAuthenticated = false,
  isReady = true,
}: HeaderProps) {
  
  // برای جلوگیری از ارور Hydration، مطمئن میشویم که تغییرات موبایل فقط بعد از لود اولیه اعمال شود
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isMobile = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => undefined;
      window.addEventListener("resize", onStoreChange);
      return () => window.removeEventListener("resize", onStoreChange);
    },
    () => typeof window !== "undefined" ? window.innerWidth <= 1024 : false,
    () => false // سرور همیشه فرض میکند دسکتاپ است تا HTML مطابقت داشته باشد
  );

  // تا زمانی که جاوااسکریپت در مرورگر لود نشده، هدر دسکتاپ (پیش‌فرض سرور) را رندر میکنیم
  if (!isMounted) {
    return isAuthenticated ? (
      <HeaderAuth className="h-header" />
    ) : (
      <HeaderPublic className="h-header" />
    );
  }

  // رندر هدر موبایل/تبلت
  if (isMobile) {
    return <MobHeader isAuthenticated={isAuthenticated} isReady={isReady} />;
  }

  // رندر هدر دسکتاپ (بدون استفاده از پورتال)
  return isAuthenticated ? (
    <HeaderAuth className="h-header" />
  ) : (
    <HeaderPublic className="h-header" />
  );
}