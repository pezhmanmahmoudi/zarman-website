"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import styles from "./LanguageSwitcher.module.css";

type Props = {
  /** Visual variant — "pill" for headers, "menu-item" for mobile drawers */
  variant?: "pill" | "menu-item";
};

export function LanguageSwitcher({ variant = "pill" }: Props) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const targetLocale = locale === "fa" ? "en" : "fa";

  const targetPath = pathname.replace(
    new RegExp(`^/(fa|en)(/|$)`),
    `/${targetLocale}$2`
  );

  const handleSwitch = () => {
    router.push(targetPath);
  };

  const targetCode = locale === "fa" ? "EN" : "FA";

  if (variant === "menu-item") {
    return (
      <button
        type="button"
        onClick={handleSwitch}
        className={styles.menuItem}
        aria-label={locale === "fa" ? "Switch to English" : "تغییر به فارسی"}
      >
        <span className={styles.menuCode}>{targetCode}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSwitch}
      className={styles.pill}
      aria-label={locale === "fa" ? "Switch to English" : "تغییر به فارسی"}
      title={locale === "fa" ? "Switch to English" : "تغییر به فارسی"}
    >
      <span className={styles.code}>{locale === "fa" ? "FA" : "EN"}</span>
      <span className={styles.sep} aria-hidden="true">/</span>
      <span className={styles.label}>
        {targetCode}
      </span>
    </button>
  );
}
