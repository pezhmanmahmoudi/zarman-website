import Link from "next/link";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher/LanguageSwitcher";
import styles from "./ContentNavigation.module.css";

type Props = {
  locale: string;
  currentPath: string;
};

export default function ContentNavigation({ locale, currentPath }: Props) {
  const isEn = locale === "en";
  const links = [
    { path: "", label: isEn ? "Home" : "خانه", compactLabel: isEn ? "Home" : "خانه" },
    { path: "/about", label: isEn ? "About Zarman" : "درباره زرمان", compactLabel: isEn ? "About" : "درباره" },
    { path: "/services", label: isEn ? "Services" : "خدمات حواله", compactLabel: isEn ? "Services" : "خدمات" },
    { path: "/blog", label: isEn ? "Guides" : "راهنما و مقالات", compactLabel: isEn ? "Guides" : "مقالات" },
  ];

  return (
    <nav className={styles.navigation} aria-label={isEn ? "Main navigation" : "دسترسی اصلی سایت"} dir={isEn ? "ltr" : "rtl"}>
      <div className={styles.links}>
        {links.map(({ path, label, compactLabel }) => {
          const isCurrent = path === ""
            ? currentPath === ""
            : currentPath === path || currentPath.startsWith(`${path}/`);

          return (
            <Link
              key={path}
              href={`/${locale}${path}`}
              className={styles.link}
              aria-label={label}
              aria-current={isCurrent ? "page" : undefined}
            >
              <span className={styles.fullLabel}>{label}</span>
              <span className={styles.compactLabel} aria-hidden="true">{compactLabel}</span>
            </Link>
          );
        })}
      </div>
      <LanguageSwitcher />
    </nav>
  );
}
