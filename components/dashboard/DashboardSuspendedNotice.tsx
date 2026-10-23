"use client";

import Image from "next/image";
import { ShieldAlert, Mail, LogOut } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { DashboardTabLink as Link } from "./DashboardTabLink";
import { useLocale } from "@/context/LocaleContext";
import { useSignOut } from "@/hooks/useSignOut";
import type { Profile } from "@/app/[locale]/dashboard/dashboard.types";
import controls from "@/styles/dashboard/DashboardIdentity.module.css";
import styles from "@/styles/dashboard/DashboardSuspendedNotice.module.css";

export function DashboardSuspendedNotice({ profile }: { profile?: Profile | null }) {
  void profile;
  const locale = useLocale();
  const fa = locale === "fa";
  const pathname = usePathname();
  const query = useSearchParams();
  const { signOut, signingOut, signOutError } = useSignOut();

  const targetLocale = fa ? "en" : "fa";
  const switchPath =
    pathname.replace(/^\/(en|fa)(?=\/|$)/, `/${targetLocale}`) +
    (query.toString() ? `?${query}` : "");

  return (
    <div className={styles.wrapper}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.brand}>
            <Image
              src="/images/logo-no-text-light.svg"
              alt="Zarman"
              width={30}
              height={30}
            />
            <span className={styles.brandTitle}>
              {fa ? "صرافی زرمان — وضعیت حساب کاربری" : "Zarman Exchange — Account Status"}
            </span>
          </div>
          <div className={styles.topActions}>
            <Link
              className={`${controls.control} ${controls.language}`}
              href={switchPath}
              aria-label={targetLocale === "fa" ? "فارسی" : "English"}
              lang={targetLocale}
              dir={targetLocale === "fa" ? "rtl" : "ltr"}
            >
              {targetLocale === "fa" ? "فارسی" : "English"}
            </Link>
          </div>
        </div>
        {signOutError && (
          <p role="alert" className={styles.errorBanner}>
            {fa ? "خروج ناموفق بود. دوباره تلاش کنید." : "Sign out failed. Please retry."}
          </p>
        )}
      </header>

      <main id="dashboard-content" tabIndex={-1} className={styles.main}>
        <section
          role="alert"
          aria-live="polite"
          data-suspended-notice="true"
          className={styles.card}
        >
          <div className={styles.header}>
            <span className={styles.iconBadge}>
              <ShieldAlert size={30} aria-hidden="true" />
            </span>
            <span className={styles.eyebrow}>
              {fa ? "اطلاعیه رسمی حساب کاربری" : "Official Account Notice"}
            </span>
            <h1 className={styles.title}>
              {fa
                ? "حساب کاربری شما به حالت تعلیق درآمده است"
                : "Your Account Has Been Suspended"}
            </h1>
          </div>

          <div className={styles.messageBox}>
            <p className={styles.paragraph}>
              {fa
                ? "به اطلاع می‌رسانیم بر اساس بررسی‌های بخش تطبیق قوانین و امنیت (Compliance & Security) صرافی زرمان، حساب کاربری شما به حالت تعلیق (Suspend) درآمده و دسترسی شما به تمامی بخش‌ها و خدمات داشبورد مسدود شده است."
                : "Please be advised that following a review by Zarman Exchange’s Compliance and Security team, your account has been suspended and access to all dashboard sections and services has been restricted."}
            </p>
            <p className={styles.paragraph}>
              {fa
                ? "در این وضعیت امکان ثبت حواله جدید، مشاهده یا ویرایش اطلاعات هویتی، مدیریت گیرندگان و دسترسی به سایر امکانات پنل کاربری وجود ندارد. چنانچه تصور می‌کنید این محدودیت به اشتباه اعمال شده یا نیازمند بررسی مجدد وضعیت حساب خود هستید، لطفاً از طریق ایمیل رسمی پشتیبانی با واحد تطبیق قوانین زرمان مکاتبه فرمایید."
                : "While your account is suspended, you cannot submit transfer requests, view or modify identity details, manage recipients, or access any other panel features. If you believe this restriction was applied in error or wish to request a compliance review, please contact our Compliance & Support team via our official email address."}
            </p>
          </div>

          <div className={styles.actions}>
            <a
              href="mailto:info@zarman.com.au?subject=Account%20Suspension%20Review"
              className={styles.primaryAction}
            >
              <Mail size={18} aria-hidden="true" />
              <span>
                {fa
                  ? "تماس با پشتیبانی (info@zarman.com.au)"
                  : "Contact Support (info@zarman.com.au)"}
              </span>
            </a>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-busy={signingOut}
              className={styles.secondaryAction}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>
                {signingOut
                  ? fa
                    ? "در حال خروج…"
                    : "Signing out…"
                  : fa
                    ? "خروج از حساب کاربری"
                    : "Sign out of account"}
              </span>
            </button>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        {fa
          ? "صرافی زرمان (Zarman Exchange) — واحد تطبیق قوانین و امنیت حساب‌ها"
          : "Zarman Exchange — Compliance & Account Security"}
      </footer>
    </div>
  );
}
