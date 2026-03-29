"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Button from "@/components/common/Button";
import { publicNavItems } from "@/data/navigation";

type HeaderPublicProps = {
  className?: string;
};

export default function HeaderPublic({
  className = "h-header",
}: HeaderPublicProps) {
  const pathname = usePathname();
  const isHome = pathname === "/fa" || pathname === "/";

  return (
    <header className={className} role="banner">
      <a className="h-skip" href="#main-content">
        پرش به محتوای اصلی
      </a>

      <div className="h-inner">
        <div className="h-logo-wrap">
          <Link href="/fa" aria-label="Zarman Exchange — صفحه اصلی">
            <Image
              src="/images/logo-horizontal-dark.svg"
              alt="Zarman Exchange"
              className="h-logo-img" /* در موبایل: styles.logoImg */
              width={600}  /* تناسب جدید */
              height={160}  /* تناسب جدید */
              priority
            />
          </Link>
        </div>

        <nav className="h-nav" aria-label="ناوبری اصلی">
          {publicNavItems.map((item) => {
            const isCurrentHome = item.href === "/fa" && isHome;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="h-link"
                aria-current={isCurrentHome ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="h-auth" aria-label="ورود و ثبت‌نام">
          <Button
            href="/fa/register"
            variant="primary"
            size="sm"
          >
            ثبت‌نام
          </Button>

          <Button
            href="/fa/login"
            variant="secondary"
            size="sm"
          >
            ورود
          </Button>
        </div>
      </div>
    </header>
  );
}