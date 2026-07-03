"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Button from "@/components/ui/Button/Button";

import { publicNavItems } from "@/data/navigation";
import {
  WHATSAPP_NUMBER, // 👈 اضافه شد
  buildWhatsAppUrl,
  WHATSAPP_MESSAGE_SIGNUP_HELP,
} from "@/lib/constants/contact";
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
  signupHref = "/fa/register",
  loginHref = "/fa/login",
  navItems,
}: MobHeaderProps) {
  const items = useMemo(() => navItems ?? publicNavItems, [navItems]);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // ۱. مقدار اولیه امن برای رندر سرور (جلوگیری از Hydration Error)
  const serverSafeUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_SIGNUP_HELP)}`;
  const [whatsappUrl, setWhatsappUrl] = useState(serverSafeUrl);

  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // ۲. آپدیت شدن لینک پس از لود صفحه در مرورگر
    setWhatsappUrl(buildWhatsAppUrl(WHATSAPP_MESSAGE_SIGNUP_HELP));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, mounted]);

  // Header initial load animation
  useGSAP(
    () => {
      if (!isReady || !rootRef.current) return;
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
        tl.to(drawer, { x: "100%", duration: 0.4, ease: "power3.in" })
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
            <Image 
              src={logoSrc} 
              alt="Zarman Logo" 
              width={110} 
              height={32} 
              style={{ height: '45px', width: 'auto' }}
              className={styles.logoImg} 
              priority 
              unoptimized
            />
          </Link>

          {isAuthenticated ? (
            <Button href="/fa/dashboard" variant="secondary" size="sm" onClick={close}>
              پنل کاربری
            </Button>
          ) : (
            <Button href={signupHref} variant="primary" size="sm" onClick={close}>
              ثبت‌نام
            </Button>
          )}
        </div>
      </div>

      <div ref={overlayRef} className={styles.menuOverlay} onClick={close} aria-hidden="true" />

      <div ref={drawerRef} className={styles.menuDrawer} role="dialog" aria-modal="true">
        <div className={styles.menuInner}>
          <div className={styles.menuHeader}>
            <span className={styles.menuLabel}>فهرست دسترسی</span>
          </div>

          <nav className={styles.navLinks} aria-label="ناوبری موبایل">
            <div ref={linksRef}>
              {items.map((item) => (
                <Link key={item.href} href={item.href} className={styles.bigLink} onClick={close}>
                  <span className={styles.linkText}>{item.label}</span>
                  <span className={styles.linkArrow}>←</span>
                </Link>
              ))}
            </div>

            <div className={styles.divider} />

            <div className={styles.mobileActions}>
              {isAuthenticated ? (
                <>
                  <Button href="/fa/dashboard" variant="primary" fullWidth onClick={close}>
                    رفتن به داشبورد
                  </Button>
                  <Button href={whatsappUrl} target="_blank" variant="secondary" fullWidth onClick={close}>
                    تماس با پشتیبانی
                  </Button>
                </>
              ) : (
                <>
                  <Button href={loginHref} variant="primary" fullWidth onClick={close}>
                    ورود به حساب کاربری
                  </Button>
                  <Button href={whatsappUrl} target="_blank" variant="secondary" fullWidth onClick={close}>
                    پشتیبانی در واتس‌اپ
                  </Button>
                </>
              )}
            </div>

            <div className={styles.menuFooter}>
              <p>زرمان اکسچنج</p>
              <p className={styles.menuFooterSub}>تجربه‌ای هوشمند برای تبادل ارز</p>
            </div>
          </nav>
        </div>
      </div>
    </>,
    document.body
  );
}