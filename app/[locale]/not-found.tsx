"use client";

import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";

export default function NotFound() {
  const locale = useLocale();
  const isEn = locale === "en";
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm text-slate-400">404</p>
      <h1 className="text-3xl font-bold">{isEn ? "Page not found" : "صفحه پیدا نشد"}</h1>
      <p className="text-slate-300">{isEn ? "This address is unavailable. Visit the homepage or browse our services." : "این نشانی در دسترس نیست. به صفحه اصلی بروید یا خدمات زرمان را ببینید."}</p>
      <div className="flex flex-wrap justify-center gap-6 text-teal-300 underline underline-offset-4">
        <Link href={`/${locale}`}>{isEn ? "Home" : "صفحه اصلی"}</Link>
        <Link href={`/${locale}/services`}>{isEn ? "Services" : "خدمات زرمان"}</Link>
      </div>
    </div>
  );
}
