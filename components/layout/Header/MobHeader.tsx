"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Button from "@/components/ui/Button/Button";

import { publicNavItems } from "@/data/navigation";
import styles from "./MobHeader.module.css";

type NavItem = {
  label: string;
  href: string;
};

type MobHeaderProps = {
  isReady?: boolean;
  isAuthenticated?: boolean;
  logoSrc?: string;
  brandAriaLabel?: string;
  signupHref?: string;
  loginHref?: string;
  navItems?: NavItem[];
};

export default function MobHeader({
  isReady = true,
  isAuthenticated = false,
  logoSrc = "/images/logo-horizontal-dark.svg",
  brandAriaLabel = "Zarman Exchange",
  signupHref = "/fa/register",
  loginHref = "/fa/login",
  navItems,
}: MobHeaderProps) {
  const items = useMemo(() => navItems ?? publicNavItems, [navItems]);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // تنظیمات لینک واتس‌اپ
  const whatsappNumber = "61412345678";
  const whatsappMessage = encodeURIComponent("سلام، من از طریق وب‌سایت زرمان پیام می‌دهم و نیاز به راهنمایی دارم.");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !open) return;
    
    const originalStyle = window.getComputedStyle(document.body).overflow;  
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = originalStyle; };
  }, [open, mounted]);

  useGSAP(
    () => {
      if (!isReady || !rootRef.current) return;
      gsap.fromTo(
        rootRef.current,
        { y: -80, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out" }
      );
    },
    { dependencies: [isReady, mounted] }
  );

  useGSAP(
    () => {
      if (!menuContainerRef.current) return;

      const menu = menuContainerRef.current;
      const animatedItems = linksRef.current
        ? Array.from(linksRef.current.children)
        : [];

      const tl = gsap.timeline();

      if (open) {
        gsap.set(menu, { display: "flex", pointerEvents: "auto" });
        tl.to(menu, { opacity: 1, duration: 0.3, ease: "power2.out" })
          .fromTo(
            animatedItems,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.05, duration: 0.4, ease: "power3.out" },
            "-=0.1"
          );
      } else {
        tl.to(animatedItems, { y: 10, opacity: 0, stagger: 0.02, duration: 0.2, ease: "power2.in" })
          .to(
            menu,
            { opacity: 0, duration: 0.2, ease: "power2.in", onComplete: () => {
                gsap.set(menu, { display: "none", pointerEvents: "none" });
              }
            },
            "-=0.1"
          );
      }
    },
    { dependencies: [open] }
  );

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

  if (!mounted || !isReady) return null;

  return createPortal(
    <>
      <div ref={rootRef} className={`${styles.headerPill} ${open ? styles.headerPillActive : ""}`}>
        <div className={styles.headerContent}>
          <button
            type="button"
            className={`${styles.burger} ${open ? styles.burgerActive : ""}`}
            onClick={toggle}
            aria-label={open ? "بستن منو" : "باز کردن منو"}
          >
            <span className={styles.burgerLine}></span>
            <span className={styles.burgerLine}></span>
          </button>

          <Link href="/fa" className={styles.logoContainer} onClick={close} aria-label={brandAriaLabel}>
            <Image src={logoSrc} alt="Zarman Logo" width={110} height={32} className={styles.logoImg} priority />
          </Link>

          {/* مشکل واریانت دکمه در اینجا حل شد و روی secondary تنظیم شد */}
          {isAuthenticated ? (
            <Button href="/dashboard" variant="secondary" size="sm" onClick={close}>
              پنل
            </Button>
          ) : (
            <Button href={signupHref} variant="primary" size="sm" onClick={close}>
              ثبت‌نام
            </Button>
          )}
        </div>
      </div>

      <div ref={menuContainerRef} id="mobile-menu-overlay" className={styles.menuOverlay} role="dialog" aria-modal="true">
        <div className={styles.menuInner}>
          <div className={styles.menuHeader}>
            <span className={styles.menuLabel}>فهرست دسترسی</span>
          </div>

          <nav ref={linksRef} className={styles.navLinks} aria-label="ناوبری موبایل">
            {items.map((item) => (
              <Link key={item.href} href={item.href} className={styles.bigLink} onClick={close}>
                <span className={styles.linkText}>{item.label}</span>
                <span className={styles.linkArrow}>←</span>
              </Link>
            ))}

            <div className={styles.divider} />

            <div className={styles.mobileActions}>
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" className={styles.actionRow} onClick={close}>
                    رفتن به داشبورد
                  </Link>
                  <a href={whatsappUrl} className={styles.actionRow} target="_blank" rel="noopener noreferrer" onClick={close}>
                    تماس با پشتیبانی
                  </a>
                </>
              ) : (
                <>
                  <Link href={loginHref} className={styles.actionRow} onClick={close}>
                    ورود به حساب کاربری
                  </Link>
                  <a href={whatsappUrl} className={styles.actionRow} target="_blank" rel="noopener noreferrer" onClick={close}>
                    پشتیبانی در واتس‌اپ
                  </a>
                </>
              )}
            </div>

            <div className={styles.menuFooter}>
              <p>زرمان اکسچنج</p>
              <p className={styles.menuFooterSub}>تجربه‌ای روشن‌تر برای کاربران ایران–استرالیا</p>
            </div>
          </nav>
        </div>
      </div>
    </>,
    document.body
  );
}