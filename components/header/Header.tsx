"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import HeaderPublic from "./HeaderPublic";
import HeaderAuth from "./HeaderAuth";
import MobHeader from "./MobHeader";
import "./Header.css";

export default function Header({
  isAuthenticated = false,
  isReady = false,
}: {
  isAuthenticated?: boolean;
  isReady?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Hydration guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // Mobile detection
  useEffect(() => {
    if (!mounted) return;

    const check = () => setIsMobile(window.innerWidth <= 768);
    check();

    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, [mounted]);

  // ⛔️ قبل از اتمام لودینگ، هیچ هدی ساخته نشود
  if (!mounted || !isReady) return null;

  // ✅ Mobile
  if (isMobile) {
    return <MobHeader isAuthenticated={isAuthenticated} isReady />;
  }

  // ✅ Desktop (always visible, fixed)
  const headerNode = isAuthenticated ? (
    <HeaderAuth className="" />
  ) : (
    <HeaderPublic className="" />
  );

  return createPortal(headerNode, document.body);
}
