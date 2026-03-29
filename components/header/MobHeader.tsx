"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import styles from "./MobHeader.module.css";

type NavItem = { label: string; href: string };

export default function MobHeader({
  isReady = false,
  isAuthenticated = false,
  logoSrc = "/images/Logo.png",
  brandAriaLabel = "Zarman Exchange",
  signupHref = "/fa/register",
  loginHref = "/fa/login",
  contactHref = "/fa/contact",
  navItems,
}: {
  isReady?: boolean;
  isAuthenticated?: boolean;
  logoSrc?: string;
  brandAriaLabel?: string;
  signupHref?: string;
  loginHref?: string;
  contactHref?: string;
  navItems?: NavItem[];
}) {
  // Default Navigation Items
  const items: NavItem[] = useMemo(
    () =>
      navItems ?? [
        { label: "خانه", href: "/fa" },
        { label: "درباره ما", href: "/fa/about" },
        { label: "خدمات", href: "/fa/services" },
        { label: "نحوه انتقال", href: "/fa/how-it-works" },
        { label: "نظرات", href: "/fa/reviews" },
      ],
    [navItems]
  );

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // Refs for Animation
  const rootRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  // 1. Handle Mounting (SSR Safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Lock Body Scroll when Menu is Open
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [open, mounted]);

  // 3. Initial Entrance Animation (Floating Pill)
  useGSAP(
    () => {
      if (!isReady || !rootRef.current) return;
      
      // Animate Pill Down from Top
      gsap.fromTo(
        rootRef.current,
        { y: -40, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.8, ease: "power4.out", delay: 0.2 }
      );
    },
    { dependencies: [isReady, mounted] }
  );

  // 4. Open/Close Menu Sequence
  useGSAP(
    () => {
      if (!menuContainerRef.current) return;
      
      const tl = gsap.timeline();
      const links = linksRef.current?.children;

      if (open) {
        // --- OPEN ANIMATION ---
        gsap.set(menuContainerRef.current, { display: "flex" });
        
        // Fade in Overlay
        tl.to(menuContainerRef.current, {
          opacity: 1,
          duration: 0.4,
          ease: "power2.out",
        })
        // Stagger Links Upwards
        .fromTo(
          links || [],
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.06, duration: 0.5, ease: "back.out(1.2)" },
          "-=0.2"
        );
      } else {
        // --- CLOSE ANIMATION ---
        tl.to(menuContainerRef.current, {
          opacity: 0,
          duration: 0.3,
          ease: "power2.in",
          onComplete: () => {
            gsap.set(menuContainerRef.current, { display: "none" });
          },
        });
      }
    },
    { dependencies: [open] }
  );

  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* =========================================
          1. FLOATING HEADER PILL (Always Visible)
         ========================================= */}
      <div 
        ref={rootRef} 
        className={`${styles.headerPill} ${open ? styles.headerPillActive : ""}`} 
        dir="rtl"
      >
        <div className={styles.headerContent}>
          
          {/* A. Burger Button (Right in RTL) */}
          <button 
            className={`${styles.burger} ${open ? styles.burgerActive : ""}`} 
            onClick={toggle}
            aria-label="Toggle Menu"
          >
            <span className={styles.burgerLine}></span>
            <span className={styles.burgerLine}></span>
          </button>

          {/* B. Logo (Center) */}
          <Link href="/fa" className={styles.logoContainer} onClick={close}>
            <Image 
              src={logoSrc} 
              alt="Zarman Logo" 
              width={100} 
              height={30} 
              className={styles.logoImg}
            />
          </Link>

          {/* C. CTA Button (Left in RTL) */}
          {isAuthenticated ? (
            <Link href="/dashboard" className={styles.ctaButton} onClick={close}>
              داشبورد
            </Link>
          ) : (
            <Link href={signupHref} className={styles.ctaButton} onClick={close}>
              ثبت‌نام
            </Link>
          )}

        </div>
      </div>

      {/* =========================================
          2. FULL SCREEN GLASS MENU OVERLAY
         ========================================= */}
      <div ref={menuContainerRef} className={styles.menuOverlay} dir="rtl">
        
        {/* Background Ambient Glows */}
        <div className={styles.glowOrbTop} />
        <div className={styles.glowOrbBottom} />

        <div className={styles.menuInner}>
          <div className={styles.menuHeader}>
            <span className={styles.menuLabel}>فهرست دسترسی</span>
          </div>

          <nav ref={linksRef} className={styles.navLinks}>
            {items.map((item) => (
              <Link key={item.href} href={item.href} className={styles.bigLink} onClick={close}>
                <span className={styles.linkText}>{item.label}</span>
                <span className={styles.linkArrow}>←</span>
              </Link>
            ))}
            
            <div className={styles.divider} />

            {/* Footer Action Links */}
            <div className={styles.mobileActions}>
              {isAuthenticated ? (
                 <Link href="/profile" className={styles.actionRow} onClick={close}>
                   <span>تنظیمات حساب کاربری</span>
                 </Link>
              ) : (
                <>
                  <Link href={loginHref} className={styles.actionRow} onClick={close}>
                    <span>ورود به حساب کاربری</span>
                  </Link>
                  <Link href={contactHref} className={styles.actionRow} onClick={close}>
                    <span>تماس با پشتیبانی</span>
                  </Link>
                </>
              )}
            </div>
          </nav>

          <div className={styles.menuFooter}>
            <p>Premium Money Transfer Services</p>
            <p style={{ opacity: 0.5, marginTop: '4px' }}>Zarman Exchange © 2024</p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}