"use client";

import { createPortal } from "react-dom";
import { useHydrated } from "./useHydrated";

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
  const mounted = useHydrated();

  // Keep navigation in the initial HTML; CSS selects the viewport layout.
  // Portals preserve the existing stacking behavior after hydration.
  const headerNode = isAuthenticated ? (
    <HeaderAuth className="h-desktop" />
  ) : (
    <HeaderPublic className="h-header h-desktop" />
  );

  return (
    <>
      {mounted ? createPortal(headerNode, document.body) : headerNode}
      <MobHeader isAuthenticated={isAuthenticated} isReady={isReady} />
    </>
  );
}
