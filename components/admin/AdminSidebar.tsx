"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  ArrowLeftRight,
  MessageSquare,
  Settings,
  ClipboardList,
  Users,
  LogOut,
  ShieldAlert,
  Menu,
  X,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import styles from "@/styles/admin/AdminShell.module.css";
import { supabase } from "@/lib/supabase";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

type AdminSidebarProps = {
  adminEmail: string;
  pendingKyc: number;
  pendingTx: number;
  pendingFeedback: number;
};

export function AdminSidebar({
  adminEmail,
  pendingKyc,
  pendingTx,
  pendingFeedback,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/admin/kyc", label: "KYC Queue", icon: <ShieldCheck size={18} />, badge: pendingKyc },
    { href: "/admin/transactions", label: "Transactions", icon: <ArrowLeftRight size={18} />, badge: pendingTx },
    { href: "/admin/feedback", label: "Feedback", icon: <MessageSquare size={18} />, badge: pendingFeedback },
  ];

  const manageItems: NavItem[] = [
    { href: "/admin/users", label: "Users", icon: <Users size={18} /> },
    { href: "/admin/settings", label: "System Settings", icon: <Settings size={18} /> },
    { href: "/admin/audit", label: "Audit Logs", icon: <ClipboardList size={18} /> },
    { href: "/admin/ledger", label: "Ledger", icon: <BookOpen size={18} /> },
    { href: "/admin/treasury", label: "Treasury", icon: <TrendingUp size={18} /> },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const renderNavItems = (items: NavItem[]) => {
    return items.map((item) => {
      const isActive = pathname === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
          onClick={() => setMobileOpen(false)}
        >
          <span className={styles.navIconWrapper}>{item.icon}</span>
          <span className={styles.navLabel}>{item.label}</span>
          {!!item.badge && item.badge > 0 && (
            <span className={`${styles.navBadge} ${item.href === "/admin/transactions" ? styles.navBadgeWarning : ""}`}>
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </Link>
      );
    });
  };

  const SidebarContent = () => (
    <>
      <div className={styles.sidebarHeader}>
        <Link href="/admin/dashboard" className={styles.sidebarBrand} onClick={() => setMobileOpen(false)}>
          <div className={styles.brandIconWrapper}>
            <Image 
              src="/images/logo-no-text-light.svg" 
              alt="Zarman Logo" 
              width={42} 
              height={42} 
              priority
            />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Zarman Admin</span>
            <span className={styles.brandSub}>Control Panel</span>
          </div>
        </Link>
        
        {/* دکمه بستن فقط در موبایل داخل سایدبار نمایش داده می‌شود */}
        <button 
          className={styles.closeSidebarBtn} 
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <div className={styles.sidebarScrollArea}>
        <span className={styles.navSection}>Main Menu</span>
        {renderNavItems(navItems)}

        <span className={`${styles.navSection} ${styles.navSectionSpaced}`}>Management</span>
        {renderNavItems(manageItems)}
      </div>

      <div className={styles.sidebarFooter}>
        <div className={styles.adminProfileCard}>
          <div className={styles.adminProfileHeader}>
            <div className={styles.adminAvatar}>
              <ShieldAlert size={16} className={styles.adminAvatarIcon} />
            </div>
            <div className={styles.adminInfo}>
              <span className={styles.adminRole}>Administrator</span>
              <span className={styles.adminEmail} title={adminEmail}>{adminEmail}</span>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={16} />
            Secure Sign Out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <nav className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`} aria-label="Admin navigation">
        <SidebarContent />
      </nav>

      {mobileOpen && (
        <div className={styles.mobileBackdrop} onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* دکمه همبرگری بیرون سایدبار برای باز کردن */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className={styles.mobileMenuBtn}
          aria-label="Open admin menu"
        >
          <Menu size={20} />
        </button>
      )}
    </>
  );
}