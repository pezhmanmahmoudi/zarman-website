"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { Calculator, History, UserCircle2, Star, LogOut, Sun, Moon } from "lucide-react";
import styles from "@/styles/dashboard/DashboardSidebar.module.css";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 👇 تغییر اساسی در اینجا انجام شد. کلمات دقیقاً با page.tsx یکسان شدند
type DashboardSidebarProps = {
  activeTab: "hub" | "history" | "profile" | "feedback";
  // 👈 این خط باید دقیقاً اینطور باشد، نه (tab: string)
  setActiveTab: (tab: "hub" | "history" | "profile" | "feedback") => void; 
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
};

export function DashboardSidebar({
  activeTab,
  setActiveTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  theme,
  setTheme,
}: DashboardSidebarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/fa/login");
  };

  const handleCloseMenu = () => {
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;

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
        id="dashboard-mobile-sidebar"
        className={`${styles.sidebar} ${
          mobileMenuOpen ? styles.sidebarOpen : ""
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className={styles.sidebarScroll}>
          <div className={styles.sidebarHeader}>
            <Link
              href="/"
              className={styles.logoArea}
              style={{ textDecoration: "none", cursor: "pointer" }}
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
              <div>
                <h2 className={styles.logoTitle}>ZARMAN</h2>
                <p className={styles.logoSubtitle}>EXCHANGE PTY LTD</p>
              </div>
            </Link>
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
              <span>ثبت درخواست حواله</span>
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
              <span>سوابق تراکنش‌ها</span>
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
              <span>پروفایل و KYC</span>
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
              <span>ثبت بازخورد</span>
            </button>
          </nav>

          <div className={styles.divider} />

          <div className={styles.sidebarFooter}>
            <button
              type="button"
              className={styles.navItem}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
              <span>{theme === "light" ? "حالت شب" : "حالت روز"}</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${styles.logoutBtn}`}
              onClick={handleLogout}
            >
              <LogOut size={20} />
              <span>خروج امن از حساب</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}