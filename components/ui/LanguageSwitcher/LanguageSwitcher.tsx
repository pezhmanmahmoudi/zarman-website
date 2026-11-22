"use client";

import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Globe } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { getAlternateLanguagePath, getSharedLanguageHash } from "./alternate-language-path";
import styles from "./LanguageSwitcher.module.css";

type Locale = "en" | "fa";

type Props = {
  /** Visual variant — "pill" for headers, "menu-item" for mobile drawers */
  variant?: "pill" | "menu-item";
  /** Surface the control sits on — "light" for the frosted-white public header */
  tone?: "dark" | "light";
  onNavigate?: () => void;
};

const LANGUAGES: Record<Locale, { short: string; name: string; hint: string }> = {
  en: { short: "EN", name: "English", hint: "Switch to English" },
  fa: { short: "فا", name: "فارسی", hint: "تغییر زبان به فارسی" },
};

/**
 * The "language coin": one round control showing the language you can switch
 * to. It leans on hover and flips over (to the brand-gradient face with an
 * exchange arrow) when clicked, while the other-language page loads — a nod to
 * Zarman being an exchange. It is a real link with hreflang, so the alternate
 * page stays crawlable and works without JavaScript.
 */
export function LanguageSwitcher({ variant = "pill", tone = "dark", onNavigate }: Props) {
  const locale: Locale = useLocale() === "en" ? "en" : "fa";
  const pathname = usePathname();
  const target: Locale = locale === "fa" ? "en" : "fa";
  const lang = LANGUAGES[target];
  const isMenu = variant === "menu-item";

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const link = event.currentTarget;
    // Read the current fragment at navigation time: client-side anchor changes
    // can use history.pushState without emitting a hashchange event.
    link.href = getAlternateLanguagePath(pathname, target) + getSharedLanguageHash(pathname, window.location.hash);
    // Flip the coin while the page loads. DOM attribute rather than React state,
    // so a page restored from the back/forward cache simply shows it face-up.
    link.setAttribute?.("data-flipped", "");
    onNavigate?.();
  };

  const coin = (
    <span className={styles.coin} aria-hidden="true">
      <span className={styles.coinInner}>
        <span className={`${styles.face} ${styles.front} ${target === "fa" ? styles.faceFa : ""}`}>{lang.short}</span>
        <span className={`${styles.face} ${styles.back}`}>
          <ArrowLeftRight size={isMenu ? 18 : 16} strokeWidth={2.25} />
        </span>
      </span>
    </span>
  );

  if (isMenu) {
    return (
      <a
        href={getAlternateLanguagePath(pathname, target)}
        hrefLang={target}
        lang={target}
        className={`${styles.menuLink} ${tone === "light" ? styles.light : ""}`}
        onClick={handleClick}
      >
        <span className={styles.menuText}>
          <Globe size={18} strokeWidth={1.75} aria-hidden="true" className={styles.menuGlobe} />
          <span className={styles.menuName}>{lang.name}</span>
        </span>
        {coin}
      </a>
    );
  }

  return (
    <a
      href={getAlternateLanguagePath(pathname, target)}
      hrefLang={target}
      lang={target}
      className={`${styles.pill} ${tone === "light" ? styles.light : ""}`}
      title={lang.hint}
      onClick={handleClick}
    >
      {coin}
      <span className={styles.srOnly}>{lang.hint}</span>
    </a>
  );
}
