"use client";

import Link from "next/link";
import Image from "next/image";
import Button from "@/components/common/Button";

export default function HeaderPublic({ className = "" }: { className?: string }) {
  return (
    <header className={`h-header ${className}`} role="banner">
      <a className="h-skip" href="#main-content">
        پرش به محتوای اصلی
      </a>

      <div className="h-inner">
        <div className="h-logo-wrap">
          <Link href="/fa" aria-label="Zarman Exchange — صفحه اصلی">
            <Image
              src="/images/Logo.png"
              alt="Zarman Exchange"
              className="h-logo-img"
              width={140}
              height={40}
              priority
            />
          </Link>
        </div>

        <nav className="h-nav" aria-label="ناوبری اصلی">
          <Link href="/fa" className="h-link">خانه</Link>
          <Link href="/fa/about" className="h-link">درباره زرمان</Link>
          <Link href="/fa/services" className="h-link">خدمات زرمان</Link>
          <Link href="/fa/how-it-works" className="h-link">نحوه انتقال</Link>
          <Link href="/fa/reviews" className="h-link">نظرات</Link>
        </nav>

        <div className="h-auth" aria-label="ورود و ثبت‌نام">
          <Button
            href="/fa/register"
            variant="primary"
            size="sm"
            className="hBtnTight"
          >
            ثبت‌نام
          </Button>
          <Button
            href="/fa/login"
            variant="secondary"
            size="sm"
            className="hBtnTight"
          >
            ورود
          </Button>
        </div>
      </div>
    </header>
  );
}
