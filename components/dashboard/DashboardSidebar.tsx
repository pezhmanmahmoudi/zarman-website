import React from "react";
import Image from "next/image"; // اضافه شدن ایمپورت عکس
import { Calculator, History, UserCircle2, Star, LogOut, Sun, Moon, X } from "lucide-react";
import styles from "@/styles/dashboard/DashboardSidebar.module.css";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function DashboardSidebar({ activeTab, setActiveTab, mobileMenuOpen, setMobileMenuOpen, theme, setTheme }: any) {
  const router = useRouter();
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/fa/login");
  };

  return (
    <>
      {mobileMenuOpen && <div className={styles.mobileBackdrop} onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoArea}>
            {/* اضافه شدن تصویر لوگو */}
            <Image 
              src="/images/Logo no text light.svg" 
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
          </div>
          <button className={styles.sidebarCloseBtn} onClick={() => setMobileMenuOpen(false)}><X size={20} /></button>
        </div>
        <nav className={styles.navMenu}>
          <button className={`${styles.navItem} ${activeTab === "hub" ? styles.navItemActive : ""}`} onClick={() => { setActiveTab("hub"); setMobileMenuOpen(false); }}><Calculator size={20} /> ثبت درخواست حواله</button>
          <button className={`${styles.navItem} ${activeTab === "history" ? styles.navItemActive : ""}`} onClick={() => { setActiveTab("history"); setMobileMenuOpen(false); }}><History size={20} /> سوابق تراکنش‌ها</button>
          <button className={`${styles.navItem} ${activeTab === "profile" ? styles.navItemActive : ""}`} onClick={() => { setActiveTab("profile"); setMobileMenuOpen(false); }}><UserCircle2 size={20} /> پروفایل و KYC</button>
          <button className={`${styles.navItem} ${activeTab === "feedback" ? styles.navItemActive : ""}`} onClick={() => { setActiveTab("feedback"); setMobileMenuOpen(false); }}><Star size={20} /> ثبت بازخورد</button>
        </nav>
        <div className={styles.sidebarFooter}>
          <button className={styles.navItem} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />} {theme === "light" ? "حالت شب" : "حالت روز"}
          </button>
          <button className={`${styles.navItem} ${styles.logoutBtn}`} onClick={handleLogout}><LogOut size={20} /> خروج امن از حساب</button>
        </div>
      </aside>
    </>
  );
}