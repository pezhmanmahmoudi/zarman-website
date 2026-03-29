"use client";

import Link from "next/link";
import Button from "@/components/common/Button";

export default function HeaderAuth({ className = "" }: { className?: string }) {
  return (
    <header className={`h-header ${className}`} role="banner">
      <a className="h-skip" href="#main-content">
        پرش به محتوای اصلی
      </a>

      <div className="h-inner">
        <div className="h-logo-wrap">
          <Link href="/dashboard" aria-label="رفتن به داشبورد">
            <span className="h-authTitle">ZARMAN DASHBOARD</span>
          </Link>
        </div>

        <nav className="h-nav" aria-label="ناوبری داشبورد">
          <Link href="/profile" className="h-link">
            حساب کاربری
          </Link>
        </nav>

        <div className="h-auth" aria-label="خروج">
          <Button variant="secondary" size="sm" className="hBtnTight">
            خروج
          </Button>
        </div>
      </div>
    </header>
  );
}
