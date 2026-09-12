"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Button from "@/components/ui/Button/Button";

import { getCrawlablePublicNavItems } from "./public-navigation";
import { useHydrated } from "./useHydrated";
import {
  buildWhatsAppUrl,
  WHATSAPP_MESSAGE_SIGNUP_HELP,
} from "@/lib/constants/contact";
import { useLocale } from "@/context/LocaleContext";
import { useT } from "@/hooks/useT";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher/LanguageSwitcher";
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
  logoSrc = "/images/logo-no-text-light.svg",
  brandAriaLabel = "Zarman Exchange",
  navItems,
}: MobHeaderProps) {
  const locale = useLocale();
  const isEn = locale === "en";
  const t = useT();
  const defaultNavItems = getCrawlablePublicNavItems(locale);
  const items = useMemo(() => navItems ?? defaultNavItems, [navItems, defaultNavItems]);

  const mounted = useHydrated();
  const [open, setOpen] = useState(false);

  const whatsappUrl = buildWhatsAppUrl(isEn
    ? "Hello, I found Zarman's website and need help with registration and a money transfer."
    : WHATSAPP_MESSAGE_SIGNUP_HELP);

  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mounted || !open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = drawerRef.current;
    const toggleButton = toggleRef.current;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]') ?? []);
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1025px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", handleKeyDown);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      desktop.removeEventListener("change", closeOnDesktop);
      toggleButton?.focus();
    };
  }, [open, mounted]);

  // Header initial load animation
  useGSAP(
    () => {
      if (!isReady || !mounted || !rootRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        rootRef.current,
        { y: -100, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.8, ease: "expo.out" }
      );
    },
    { dependencies: [isReady, mounted] }
  );

  // Drawer open/close animations
  useGSAP(
    () => {
      if (!overlayRef.current || !drawerRef.current) return;

      const overlay = overlayRef.current;
      const drawer = drawerRef.current;
      const animatedItems = linksRef.current ? Array.from(linksRef.current.children) : [];
      const tl = gsap.timeline();
      const hiddenX = isEn ? "-100%" : "100%";

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(overlay, { display: open ? "block" : "none", opacity: open ? 1 : 0 });
        gsap.set(drawer, { x: open ? "0%" : hiddenX });
        return;
      }

      if (open) {
        gsap.set(overlay, { display: "block" });
        tl.to(overlay, { opacity: 1, duration: 0.4, ease: "power2.out" })
          .to(drawer, { x: "0%", duration: 0.6, ease: "expo.out" }, "-=0.4")
          .fromTo(
            animatedItems,
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.06, duration: 0.5, ease: "back.out(1.2)" },
            "-=0.4"
          );
      } else {
        tl.to(drawer, { x: hiddenX, duration: 0.4, ease: "power3.in" })
          .to(overlay, { 
            opacity: 0, 
            duration: 0.3, 
            ease: "power2.in", 
            onComplete: () => {
              gsap.set(overlay, { display: "none" });
            }
          }, "-=0.2");
      }
    },
    { dependencies: [open, isEn] }
  );

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

  const header = (
    <>
      <div ref={rootRef} className={`${styles.headerPill} ${open ? styles.headerPillActive : ""}`}>
        <a className="h-skip" href="#main-content">{t.nav.skipToContent}</a>
        <div className={`${styles.headerContent} ${isEn ? styles.headerContentLtr : styles.headerContentRtl}`}>
          <button
            ref={toggleRef}
            type="button"
            className={`${styles.burger} ${open ? styles.burgerActive : ""}`}
            onClick={toggle}
            aria-label={open ? t.header.closeMenu : t.header.openMenu}
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            <span className={styles.burgerLine}></span>
            <span className={styles.burgerLine}></span>
          </button>

          <Link href={`/${locale}`} className={styles.logoContainer} onClick={close} aria-label={brandAriaLabel}>
            <Image 
              src={logoSrc} 
              alt={isEn ? "Zarman Exchange" : "صرافی زرمان"}
              width={110} 
              height={32} 
              style={{ height: '45px', width: 'auto' }}
              className={styles.logoImg} 
              priority 
              unoptimized
            />
          </Link>

          {isAuthenticated ? (
            <Button href={`/${locale}/dashboard`} variant="secondary" size="sm" onClick={close}>
              {t.dashboard.tabs.hub}
            </Button>
          ) : (
            <Button href={`/${locale}/login`} variant="primary" size="sm" onClick={close}>
              {t.auth.login}
            </Button>
          )}
        </div>
      </div>

      <div ref={overlayRef} className={styles.menuOverlay} onClick={close} aria-hidden="true" />

      <div id="mobile-navigation" ref={drawerRef} className={`${styles.menuDrawer} ${isEn ? styles.menuDrawerLtr : styles.menuDrawerRtl}`} role="dialog" aria-modal={open ? true : undefined} aria-label={t.header.mainNav} aria-hidden={!open} inert={!open} dir={isEn ? "ltr" : "rtl"}>
        <div className={styles.menuInner}>
          <div className={styles.menuHeader}>
            <span className={styles.menuLabel}>{locale === "fa" ? "فهرست دسترسی" : "Navigation"}</span>
            <button type="button" className={styles.closeButton} onClick={close} aria-label={t.header.closeMenu}>×</button>
          </div>

          <nav className={styles.navLinks} aria-label={t.header.mainNav}>
            <div ref={linksRef}>
              {items.map((item) => (
                <Link key={item.href} href={item.href} className={styles.bigLink} onClick={close}>
                  <span className={styles.linkText}>{item.label}</span>
                  <span className={styles.linkArrow} aria-hidden="true">{locale === "fa" ? "←" : "→"}</span>
                </Link>
              ))}
            </div>

            <div className={styles.divider} />

            <div className={styles.mobileActions}>
              {isAuthenticated ? (
                <>
                  <Button href={`/${locale}/dashboard`} variant="primary" fullWidth onClick={close}>
                    {locale === "fa" ? "رفتن به داشبورد" : "Go to Dashboard"}
                  </Button>
                  <Button href={whatsappUrl} target="_blank" variant="secondary" fullWidth onClick={close}>
                    {locale === "fa" ? "تماس با پشتیبانی" : "Contact Support"}
                  </Button>
                </>
              ) : (
                <>
                  <Button href={`/${locale}/register`} variant="primary" fullWidth onClick={close}>
                    {t.auth.register}
                  </Button>
                  <Button href={whatsappUrl} target="_blank" variant="secondary" fullWidth onClick={close}>
                    {locale === "fa" ? "پشتیبانی در واتس‌اپ" : "WhatsApp Support"}
                  </Button>
                </>
              )}
            </div>

            <div className={styles.divider} />

            <div className={styles.mobileActions}>
              <LanguageSwitcher variant="menu-item" onNavigate={close} />
            </div>

            <div className={styles.menuFooter}>
              <p>Zarman Exchange</p>
              <p className={styles.menuFooterSub}>
                {locale === "fa" ? "تجربه‌ای هوشمند برای تبادل ارز" : "Smart currency exchange experience"}
              </p>
            </div>
          </nav>
        </div>
      </div>
    </>
  );

  return mounted ? createPortal(header, document.body) : header;
}
