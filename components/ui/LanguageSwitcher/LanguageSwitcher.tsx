"use client";

import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { getAlternateLanguagePath, getSharedLanguageHash } from "./alternate-language-path";
import styles from "./LanguageSwitcher.module.css";

type Props = {
  /** Visual variant — "pill" for headers, "menu-item" for mobile drawers */
  variant?: "pill" | "menu-item";
  onNavigate?: () => void;
};

export function LanguageSwitcher({ variant = "pill", onNavigate }: Props) {
  const locale = useLocale();
  const pathname = usePathname();

  const targetLocale = locale === "fa" ? "en" : "fa";

  const targetPath = getAlternateLanguagePath(pathname, targetLocale);
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Read the current fragment at navigation time: client-side anchor changes
    // can use history.pushState without emitting a hashchange event.
    event.currentTarget.href = targetPath + getSharedLanguageHash(pathname, window.location.hash);
    onNavigate?.();
  };

  const targetCode = locale === "fa" ? "EN" : "FA";

  if (variant === "menu-item") {
    return (
      <a
        href={targetPath}
        hrefLang={targetLocale}
        lang={targetLocale}
        dir={targetLocale === "fa" ? "rtl" : "ltr"}
        onClick={handleClick}
        className={styles.menuItem}
        aria-label={locale === "fa" ? "Switch to English" : "تغییر به فارسی"}
      >
        <span className={styles.menuCode}>{targetLocale === "fa" ? "فارسی" : "English"}</span>
      </a>
    );
  }

  return (
    <a
      href={targetPath}
      hrefLang={targetLocale}
      lang={targetLocale}
      dir="ltr"
      onClick={handleClick}
      className={styles.pill}
      aria-label={locale === "fa" ? "Switch to English" : "تغییر به فارسی"}
      title={locale === "fa" ? "Switch to English" : "تغییر به فارسی"}
    >
      <span className={styles.code}>{locale === "fa" ? "FA" : "EN"}</span>
      <span className={styles.sep} aria-hidden="true">/</span>
      <span className={styles.label}>
        {targetCode}
      </span>
    </a>
  );
}
