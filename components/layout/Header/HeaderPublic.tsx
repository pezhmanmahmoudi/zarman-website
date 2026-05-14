"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Button from "@/components/ui/Button/Button";
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
        <div className="h-logo-wrap" aria-label="Zarman Exchange — صفحه اصلی">
          {/* 👈 تگ Link حذف شد تا لوگو کاملا ایستا و غیرقابل کلیک باشد */}
            <Image
              src="/images/logo-no-text-light.svg"
              alt="Zarman Exchange"
              className="h-logo-img"
              width={200}  
              height={60}  
              priority
              unoptimized // 👈 این خط باید اضافه شود
            />
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
          <Button href="/fa/login" variant="secondary" size="sm">
            ورود
          </Button>
          <Button href="/fa/register" variant="primary" size="sm">
            ثبت‌نام
          </Button>
        </div>
      </div>
    </header>
  );
}