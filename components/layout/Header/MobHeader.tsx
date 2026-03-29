"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

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
  contactHref?: string;
  navItems?: NavItem[];
};

export default function MobHeader({
  isReady = false,
  isAuthenticated = false,
  logoSrc = "/images/logo-horizontal-dark.svg",
  brandAriaLabel = "Zarman Exchange",
  signupHref = "/fa/register",
  loginHref = "/fa/login",
  contactHref = "/fa#contact",
  navItems,
}: MobHeaderProps) {
  const items = useMemo(() => navItems ?? publicNavItems, [navItems]);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;

    if (open) {
      const scrollY = window.scrollY;
      document.body.dataset.scrollY = String(scrollY);
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";

      return () => {
        const savedScrollY = Number(document.body.dataset.scrollY || "0");
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        delete document.body.dataset.scrollY;
        window.scrollTo(0, savedScrollY);
      };
    }
  }, [open, mounted]);

  useGSAP(
    () => {
      if (!isReady || !rootRef.current) return;

      gsap.fromTo(
        rootRef.current,
        { y: -36, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.7,
          ease: "power4.out",
          delay: 0.15,
        }
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

        tl.to(menu, {
          opacity: 1,
          duration: 0.28,
          ease: "power2.out",
        }).fromTo(
          animatedItems,
          { y: 22, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.05,
            duration: 0.42,
            ease: "power3.out",
          },
          "-=0.1"
        );
      } else {
        tl.to(animatedItems, {
          y: 14,
          opacity: 0,
          stagger: 0.03,
          duration: 0.18,
          ease: "power2.in",
        }).to(
          menu,
          {
            opacity: 0,
            duration: 0.22,
            ease: "power2.in",
            onComplete: () => {
              gsap.set(menu, { display: "none", pointerEvents: "none" });
            },
          },
          "-=0.05"
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
      <div
        ref={rootRef}
        className={`${styles.headerPill} ${open ? styles.headerPillActive : ""}`}
        dir="rtl"
      >
        <div className={styles.headerContent}>
          <button
            type="button"
            className={`${styles.burger} ${open ? styles.burgerActive : ""}`}
            onClick={toggle}
            aria-label={open ? "بستن منو" : "باز کردن منو"}
            aria-expanded={open}
            aria-controls="mobile-menu-overlay"
          >
            <span className={styles.burgerLine}></span>
            <span className={styles.burgerLine}></span>
          </button>

          <Link
            href="/fa"
            className={styles.logoContainer}
            onClick={close}
            aria-label={brandAriaLabel}
          >
            <Image
              src={logoSrc}
              alt="Zarman Logo"
              width={100}
              height={30}
              className={styles.logoImg}
              priority
            />
          </Link>

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

      <div
        ref={menuContainerRef}
        id="mobile-menu-overlay"
        className={styles.menuOverlay}
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="منوی موبایل"
      >
    
            <div className={styles.menuInner}>
          <div className={styles.menuHeader}>
            <span className={styles.menuLabel}>فهرست دسترسی</span>
          </div>

          <nav ref={linksRef} className={styles.navLinks} aria-label="ناوبری موبایل">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={styles.bigLink}
                onClick={close}
              >
                <span className={styles.linkText}>{item.label}</span>
                <span className={styles.linkArrow}>←</span>
              </Link>
            ))}

            <div className={styles.divider} />

            <div className={styles.mobileActions}>
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" className={styles.actionRow} onClick={close}>
                    داشبورد
                  </Link>
                  <Link href={contactHref} className={styles.actionRow} onClick={close}>
                    تماس با پشتیبانی
                  </Link>
                </>
              ) : (
                <>
                  <Link href={loginHref} className={styles.actionRow} onClick={close}>
                    ورود به حساب کاربری
                  </Link>
                  <Link href={contactHref} className={styles.actionRow} onClick={close}>
                    تماس با ما
                  </Link>
                </>
              )}
            </div>

            <div className={styles.menuFooter}>
              <p>زرمان اکسچنج</p>
              <p className={styles.menuFooterSub}>
                تجربه‌ای روشن‌تر برای کاربران ایران–استرالیا
              </p>
            </div>
          </nav>
        </div>
      </div>
    </>,
    document.body
  );
}