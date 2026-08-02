"use client";

import Link from "next/link";
import Button from "@/components/ui/Button/Button";
import { useLocale } from "@/context/LocaleContext";
import { useT } from "@/hooks/useT";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher/LanguageSwitcher";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function HeaderAuth({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

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
          <Button variant="secondary" size="sm" className="hBtnTight" onClick={handleLogout}>
            {t.auth.logout}
          </Button>
        </div>
      </div>
    </header>
  );
}