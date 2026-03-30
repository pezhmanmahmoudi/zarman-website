"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import HeaderPublic from "./HeaderPublic";
import HeaderAuth from "./HeaderAuth";
import MobHeader from "./MobHeader";
import "./Header.css";

type HeaderProps = {
  isAuthenticated?: boolean;
  isReady?: boolean;
};

export default function Header({
  isAuthenticated = false,
  isReady = true,
}: HeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const checkMobile = () => {
      // تغییر استراتژیک: 1024px باعث می‌شود در آیپد (عمودی) منوی موبایل لود شود
      // و مشکل رفتن لوگو داخل منو برای همیشه حل شود.
      setIsMobile(window.innerWidth <= 1024);
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [mounted]);

  if (!mounted) return null;

  // رندر هدر موبایل/تبلت
  if (isMobile) {
    return <MobHeader isAuthenticated={isAuthenticated} isReady={isReady} />;
  }

  // رندر هدر دسکتاپ
  const headerNode = isAuthenticated ? (
    <HeaderAuth className="h-header" />
  ) : (
    <HeaderPublic className="h-header" />
  );

  return createPortal(headerNode, document.body);
}