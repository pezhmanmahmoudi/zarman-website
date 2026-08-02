"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { Calculator, History, UserCircle2, Star, LogOut, Languages } from "lucide-react";
import styles from "@/styles/dashboard/DashboardSidebar.module.css";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";
import { useT } from "@/hooks/useT";

type DashboardSidebarProps = {
  activeTab: "hub" | "history" | "profile" | "feedback";
  setActiveTab: (tab: "hub" | "history" | "profile" | "feedback") => void; 
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
};

export function DashboardSidebar({
  activeTab,
  setActiveTab,
  mobileMenuOpen,
  setMobileMenuOpen,
}: DashboardSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  const sidebarRef = useRef<HTMLElement>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  const handleCloseMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleLocaleSwitch = () => {
    const targetLocale = locale === "fa" ? "en" : "fa";
    const targetPath = pathname.replace(new RegExp(`^/(fa|en)(/|$)`), `/${targetLocale}$2`);
    router.push(targetPath);
    handleCloseMenu();
  };

  useEffect(() => {
    if (!mobileMenuOpen) {
      // Move focus out of the sidebar before aria-hidden is applied
      const active = document.activeElement as HTMLElement | null;
      if (active && sidebarRef.current?.contains(active)) {
        active.blur();
      }
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEsc);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEsc);
    };
  }, [mobileMenuOpen, setMobileMenuOpen]);

  return (
    <>
      <div
        className={`${styles.mobileBackdrop} ${
          mobileMenuOpen ? styles.mobileBackdropVisible : ""
        }`}
        onClick={handleCloseMenu}
        aria-hidden={!mobileMenuOpen}
      />

      <aside
        ref={sidebarRef}
        id="dashboard-mobile-sidebar"
        className={`${styles.sidebar} ${
          mobileMenuOpen ? styles.sidebarOpen : ""
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className={styles.sidebarScroll}>
          <div className={styles.sidebarHeader}>
            <div className={styles.logoContainer}>
              <Link
                href="/"
                className={styles.logoLink}
                onClick={handleCloseMenu}
              >
                <Image
                  src="/images/logo-no-text-light.svg"
                  alt="Zarman Logo"
                  width={115}
                  height={115}
                  className={styles.logoImage}
                  priority
                />
              </Link>
              <div className={styles.logoTextWrapper}>
                <h2 className={styles.logoTitle}>ZARMAN</h2>
                <p className={styles.logoSubtitle}>EXCHANGE PTY LTD</p>
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          <nav className={styles.navMenu}>
            <button
              type="button"
              className={`${styles.navItem} ${
                activeTab === "hub" ? styles.navItemActive : ""
              }`}
              onClick={() => {
                setActiveTab("hub");
                handleCloseMenu();
              }}
            >
              <Calculator size={20} />
              <span>{t.dashboard.tabs.hub}</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${
                activeTab === "history" ? styles.navItemActive : ""
              }`}
              onClick={() => {
                setActiveTab("history");
                handleCloseMenu();
              }}
            >
              <History size={20} />
              <span>{t.dashboard.tabs.history}</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${
                activeTab === "profile" ? styles.navItemActive : ""
              }`}
              onClick={() => {
                setActiveTab("profile");
                handleCloseMenu();
              }}
            >
              <UserCircle2 size={20} />
              <span>{t.dashboard.tabs.profile}</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${
                activeTab === "feedback" ? styles.navItemActive : ""
              }`}
              onClick={() => {
                setActiveTab("feedback");
                handleCloseMenu();
              }}
            >
              <Star size={20} />
              <span>{t.dashboard.tabs.feedback}</span>
            </button>
          </nav>

          <div className={styles.divider} />

          <div className={styles.sidebarFooter}>
            <button
              type="button"
              className={styles.navItem}
              onClick={handleLocaleSwitch}
            >
              <Languages size={20} />
              <span>{locale === "fa" ? "English" : "فارسی"}</span>
            </button>
            <button
              type="button"
              className={`${styles.navItem} ${styles.logoutBtn}`}
              onClick={handleLogout}
            >
              <LogOut size={20} />
              <span>{t.auth.logout}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}