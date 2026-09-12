"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Button from "@/components/ui/Button/Button";
import { getCrawlablePublicNavItems } from "./public-navigation";
import { useLocale } from "@/context/LocaleContext";
import { useT } from "@/hooks/useT";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher/LanguageSwitcher";

type HeaderPublicProps = {
  className?: string;
};

export default function HeaderPublic({
  className = "h-header",
}: HeaderPublicProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  const navItems = getCrawlablePublicNavItems(locale);

  return (
    <header className={className} role="banner">
      <a className="h-skip" href="#main-content">
        {t.nav.skipToContent}
      </a>

      <div className="h-inner">
        <Link href={`/${locale}`} className="h-logo-wrap" aria-label={locale === "fa" ? "صفحه اصلی صرافی زرمان" : "Zarman Exchange home"}>
          <Image
            src="/images/logo-no-text-light.svg"
            alt={locale === "fa" ? "صرافی زرمان" : "Zarman Exchange"}
            className="h-logo-img"
            width={200}
            height={60}
            style={{ height: '60px', width: 'auto' }}
            priority
            unoptimized
          />
        </Link>

        <nav className="h-nav" aria-label={t.header.mainNav}>
          {navItems.map((item) => {
            const isCurrentPage = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="h-link"
                aria-current={isCurrentPage ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="h-auth" aria-label={t.header.loginRegister}>
          <LanguageSwitcher variant="pill" />
          <Button href={`/${locale}/login`} variant="secondary" size="sm">
            {t.auth.login}
          </Button>
          <Button href={`/${locale}/register`} variant="primary" size="sm">
            {t.auth.register}
          </Button>
        </div>
      </div>
    </header>
  );
}
