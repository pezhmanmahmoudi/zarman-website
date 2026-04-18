"use client";

import { ReactNode } from "react";

interface EnglishPageWrapperProps {
  children: ReactNode;
}

export default function EnglishPageWrapper({
  children,
}: EnglishPageWrapperProps) {
  // Dynamically change the html element's lang and dir attributes
  // This runs client-side when the page loads
  if (typeof document !== "undefined") {
    const html = document.documentElement;
    html.setAttribute("lang", "en");
    html.setAttribute("dir", "ltr");
  }

  return <>{children}</>;
}