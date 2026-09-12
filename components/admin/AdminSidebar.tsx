"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShieldCheck, ArrowLeftRight, MessageSquare, Settings,
  ClipboardList, Users, LogOut, Menu, X, BookOpen, TrendingUp,
  ChartNoAxesCombined, ExternalLink, LockKeyhole, type LucideIcon,
} from "lucide-react";
import { AdminDialog } from "@/components/admin/ui/AdminDialog";
import styles from "@/styles/admin/AdminShell.module.css";
import { supabase } from "@/lib/supabase";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };
type AdminSidebarProps = {
  adminEmail: string;
  pendingKyc: number;
  pendingTx: number;
  pendingFeedback: number;
};

export function AdminSidebar({ adminEmail, pendingKyc, pendingTx, pendingFeedback }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)");
    const onResize = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", onResize);
    return () => desktop.removeEventListener("change", onResize);
  }, []);

  const groups: { label: string; items: NavItem[] }[] = [
    { label: "Workspace", items: [
      { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/requests", label: "Request queue", icon: ClipboardList },
      { href: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight, badge: pendingTx },
      { href: "/admin/kyc", label: "Identity verification", icon: ShieldCheck, badge: pendingKyc },
      { href: "/admin/users", label: "Customers", icon: Users },
      { href: "/admin/feedback", label: "Feedback", icon: MessageSquare, badge: pendingFeedback },
    ] },
    { label: "Finance", items: [
      { href: "/admin/ledger", label: "Ledger", icon: BookOpen },
      { href: "/admin/treasury", label: "Treasury", icon: TrendingUp },
      { href: "/admin/reports", label: "Reports", icon: ChartNoAxesCombined },
    ] },
    { label: "Administration", items: [
      { href: "/admin/audit", label: "Audit log", icon: ClipboardList },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ] },
  ];

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setLogoutError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  function sidebarContent(mobile = false) {
    return <>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarBrand}>
          <Link href="/admin/dashboard" className={styles.sidebarBrand} onClick={() => setMobileOpen(false)} aria-label="Zarman admin overview">
            <span className={styles.brandIconWrapper}>
              <Image src="/images/logo-no-text-light.svg" alt="" width={28} height={28} />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>Zarman</span>
              <span className={styles.brandSub}>Exchange administration</span>
            </span>
          </Link>
          {mobile && <button ref={closeRef} className={styles.closeSidebarBtn} onClick={() => setMobileOpen(false)} aria-label="Close navigation" type="button"><X size={18} /></button>}
        </div>
        <div className={styles.workspaceLabel}><LockKeyhole size={14} /> Administrator workspace</div>
      </div>
      <nav className={styles.sidebarScrollArea} aria-label={mobile ? "Mobile admin navigation" : "Admin navigation"}>
        {groups.map(group => <div key={group.label} className={styles.navGroup}>
          <span className={styles.navSection}>{group.label}</span>
          {group.items.map(({ icon: Icon, ...item }) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return <Link key={item.href} href={item.href}
              aria-current={active ? "page" : undefined}
              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              onClick={() => setMobileOpen(false)}>
              <span className={styles.navIconWrapper}><Icon size={17} strokeWidth={1.8} /></span>
              <span className={styles.navLabel}>{item.label}</span>
              {!!item.badge && item.badge > 0 && <span className={styles.navBadge} aria-label={`${item.badge} pending`}>{item.badge > 99 ? "99+" : item.badge}</span>}
            </Link>;
          })}
        </div>)}
      </nav>
      <div className={styles.sidebarFooter}>
        <Link href="/en" className={styles.siteLink} target="_blank" rel="noreferrer"><ExternalLink size={14} /> View public website</Link>
        <div className={styles.adminProfileHeader}>
          <span className={styles.adminAvatar}><ShieldCheck size={17} /></span>
          <div className={styles.adminInfo}>
            <span className={styles.adminRole}>Administrator</span>
            <span className={styles.adminEmail} title={adminEmail}>{adminEmail}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} type="button" disabled={signingOut} aria-label={signingOut ? "Signing out" : "Sign out"} title="Sign out"><LogOut size={16} /></button>
        </div>
        {logoutError && <p role="alert" className={styles.logoutError}>{logoutError}</p>}
      </div>
    </>;
  }

  return <>
    <aside className={styles.sidebar}>{sidebarContent()}</aside>
    <button type="button" onClick={() => setMobileOpen(true)} className={styles.mobileMenuBtn} aria-label="Open admin navigation" aria-expanded={mobileOpen} aria-haspopup="dialog"><Menu size={20} /></button>
    <AdminDialog open={mobileOpen} onClose={() => setMobileOpen(false)} aria-label="Admin navigation" variant="drawer-left" initialFocusRef={closeRef} className={styles.mobileSidebar}>
      {sidebarContent(true)}
    </AdminDialog>
  </>;
}
