"use client";

import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";

type PageWrapperProps = {
  children: ReactNode;
};

export default function PageWrapper({ children }: PageWrapperProps) {
  return <ReactLenis root>{children}</ReactLenis>;
}