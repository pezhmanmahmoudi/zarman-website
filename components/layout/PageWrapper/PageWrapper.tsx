"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ReactNode } from "react";
import { registerGsapPlugins } from "@/lib/gsap";

// Ensure ScrollTrigger is registered before any useLenis sync call
registerGsapPlugins();

type PageWrapperProps = {
  children: ReactNode;
};

// Keeps GSAP ScrollTrigger scroll-position in sync with Lenis smooth-scroll.
// Lenis drives the window via window.scrollTo(), but ScrollTrigger needs an
// explicit nudge on each Lenis frame to recalculate trigger positions.
function LenisScrollTriggerSync() {
  useLenis(() => {
    ScrollTrigger.update();
  });
  return null;
}

export default function PageWrapper({ children }: PageWrapperProps) {
  return (
    <ReactLenis root>
      <LenisScrollTriggerSync />
      {children}
    </ReactLenis>
  );
}