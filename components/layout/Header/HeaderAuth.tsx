"use client";

import Link from "next/link";
import Button from "@/components/ui/Button/Button";
import { useLocale } from "@/context/LocaleContext";
import { useT } from "@/hooks/useT";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher/LanguageSwitcher";
import { useSignOut } from "@/hooks/useSignOut";


export default function HeaderAuth({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  const { signOut, signingOut, signOutError } = useSignOut();

  return (
    <header className={`h-header ${className}`} role="banner">
      <a className="h-skip" href="#main-content">
        {t.nav.skipToContent}
      </a>

      <div className="h-inner">
        <div className="h-logo-wrap" aria-label="Zarman Dashboard">
          <div className="h-authTitle">
            {t.header.dashboard}
          </div>
        </div>

        <nav className="h-nav" aria-label={t.header.dashboardNav}>
          <Link href={`/${locale}/dashboard`} className="h-link">
            {t.header.account}
          </Link>
        </nav>

        <div className="h-auth" aria-label={t.auth.logout}>
          <LanguageSwitcher variant="pill" />
          {signOutError && <span role="alert">{locale === "fa" ? "خروج تأیید نشد؛ ارتباط را بررسی و دوباره تلاش کنید." : "Sign out was not confirmed. Check your connection and retry."}</span>}
          <Button variant="secondary" size="sm" className="hBtnTight" onClick={signOut} disabled={signingOut} aria-busy={signingOut}>
            {t.auth.logout}
          </Button>
        </div>
      </div>
    </header>
  );
}