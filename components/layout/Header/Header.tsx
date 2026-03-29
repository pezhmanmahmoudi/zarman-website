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
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [mounted]);

  if (!mounted) return null;

  if (isMobile) {
    return <MobHeader isAuthenticated={isAuthenticated} isReady={isReady} />;
  }

  const headerNode = isAuthenticated ? (
    <HeaderAuth className="h-header" />
  ) : (
    <HeaderPublic className="h-header" />
  );

  return createPortal(headerNode, document.body);
}