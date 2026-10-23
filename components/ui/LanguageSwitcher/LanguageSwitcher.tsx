"use client";

import { useId } from "react";
import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { getAlternateLanguagePath, getSharedLanguageHash } from "./alternate-language-path";
import styles from "./LanguageSwitcher.module.css";

type Locale = "en" | "fa";

type Props = {
  /** Visual variant — "pill" for headers, "menu-item" for mobile drawers */
  variant?: "pill" | "menu-item";
  onNavigate?: () => void;
};

// Both languages are always shown in the same order, each named in its own
// language, so the control reads the same to every visitor on every page.
const LANGUAGES: ReadonlyArray<{ code: Locale; short: string; name: string }> = [
  { code: "en", short: "EN", name: "English" },
  { code: "fa", short: "فا", name: "فارسی" },
];

export function LanguageSwitcher({ variant = "pill", onNavigate }: Props) {
  const locale = useLocale();
  const pathname = usePathname();
  const labelId = useId();
  const isMenu = variant === "menu-item";
  const groupLabel = locale === "fa" ? "زبان" : "Language";

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, target: Locale) => {
    // Read the current fragment at navigation time: client-side anchor changes
    // can use history.pushState without emitting a hashchange event.
    event.currentTarget.href =
      getAlternateLanguagePath(pathname, target) + getSharedLanguageHash(pathname, window.location.hash);
    onNavigate?.();
  };

  const segmented = (
    <div
      className={styles.segmented}
      role="group"
      dir="ltr"
      {...(isMenu ? { "aria-labelledby": labelId } : { "aria-label": groupLabel })}
    >
      {!isMenu && <Globe className={styles.globe} size={14} strokeWidth={1.75} aria-hidden="true" />}

      {LANGUAGES.map((lang) => {
        const className = `${styles.option} ${lang.code === "fa" ? styles.optionFa : ""}`;
        const label = isMenu ? (
          lang.name
        ) : (
          <>
            <span aria-hidden="true">{lang.short}</span>
            <span className={styles.srOnly}>{lang.name}</span>
          </>
        );

        if (lang.code === locale) {
          return (
            <span key={lang.code} className={className} lang={lang.code} aria-current="true">
              {label}
            </span>
          );
        }

        return (
          <a
            key={lang.code}
            href={getAlternateLanguagePath(pathname, lang.code)}
            hrefLang={lang.code}
            lang={lang.code}
            className={className}
            onClick={(event) => handleClick(event, lang.code)}
            title={isMenu ? undefined : lang.name}
          >
            {label}
          </a>
        );
      })}
    </div>
  );

  if (!isMenu) return segmented;

  return (
    <div className={styles.menuRow}>
      <span className={styles.menuLabel} id={labelId}>
        <Globe size={18} strokeWidth={1.75} aria-hidden="true" />
        {groupLabel}
      </span>
      {segmented}
    </div>
  );
}
