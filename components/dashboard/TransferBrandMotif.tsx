"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { RequestLocale } from "@/lib/requests/types";

export type TransferBrandMotifProps = {
  stage?: number;
  from?: string;
  to?: string;
  locale: RequestLocale;
  motionEnabled?: boolean;
  quiet?: boolean;
};

/** A single finite brand flourish. The ribbon does not represent transfer speed. */
export default function TransferBrandMotif({ stage = 0, from = "AUD", to = "IRT", locale, motionEnabled = true, quiet = false }: TransferBrandMotifProps) {
  const reducedMotion = useReducedMotion();
  const animate = motionEnabled && reducedMotion === false && !quiet;
  const country = (currency: string) => currency === "AUD" ? locale === "fa" ? "استرالیا" : "Australia"
    : ["IRT", "TOMAN"].includes(currency.toUpperCase()) ? locale === "fa" ? "ایران" : "Iran" : currency;
  const route = "M 45 65 H 312 Q 341 65 316 81 L 110 151 Q 85 166 116 166 H 375";
  return <div aria-hidden="true" dir="ltr" className="pointer-events-none relative h-44 w-full min-w-0 select-none overflow-hidden rounded-2xl bg-[#f5f4ff]">
    <span lang={locale} className="absolute left-5 top-5 text-xs font-medium text-[#626a76]">{country(from)}</span>
    <Image src="/images/logo-no-text-light.svg" alt="" width={36} height={36} draggable={false} className="absolute right-5 top-4 size-9 object-contain opacity-75" />
    <svg className="absolute inset-0 size-full" viewBox="0 0 420 230" preserveAspectRatio="none" fill="none">
      <path d={route} stroke="#e8e5fb" strokeWidth="14" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <motion.path key={`${stage}-${animate}`} d={route} stroke={quiet ? "#b7bcc7" : "#9088e8"} strokeWidth="1.75" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        initial={animate ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: animate ? 1.1 : 0, ease: [0.22, 1, 0.36, 1] }} />
      <circle cx="45" cy="65" r="3.5" fill={quiet ? "#b7bcc7" : "#938be0"} />
      <circle cx="375" cy="166" r="3.5" fill={quiet ? "#b7bcc7" : "#938be0"} />
    </svg>
    <span lang={locale} className="absolute bottom-4 right-5 text-xs font-medium text-[#626a76]">{country(to)}</span>
  </div>;
}
