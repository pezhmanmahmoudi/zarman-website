"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Button from "@/components/ui/Button/Button";
import { X } from "lucide-react"; // 👈 اضافه شدن آیکون ضربدر

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
  logoSrc = "/images/Logo no text light.svg",
  brandAriaLabel = "Zarman Exchange",
  signupHref = "/fa/register",
  loginHref = "/fa/login",
  navItems,
}: MobHeaderProps) {
  const items = useMemo(() => navItems ?? publicNavItems, [navItems]);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const whatsappNumber = "61497851631";
  const whatsappMessage = encodeURIComponent("سلام. وقت بخیر. من برای ثبت‌نام و انجام تراکنش در صرافی زرمان نیاز به راهنمایی دارم.");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
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
      if (!overlayRef.current || !drawerRef.current) return;

      const overlay = overlayRef.current;
      const drawer = drawerRef.current;
      const animatedItems = linksRef.current ? Array.from(linksRef.current.children) : [];
      const tl = gsap.timeline();

      if (open) {
        gsap.set(overlay, { display: "block" });
        tl.to(overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
          .to(drawer, { x: "0%", duration: 0.4, ease: "power3.out" }, "-=0.3")
          .fromTo(
            animatedItems,
            { x: 20, opacity: 0 },
            { x: 0, opacity: 1, stagger: 0.05, duration: 0.3, ease: "power3.out" },
            "-=0.2"
          );
      } else {
        tl.to(drawer, { x: "100%", duration: 0.3, ease: "power3.inOut" })
          .to(overlay, { opacity: 0, duration: 0.3, ease: "power2.in", 
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
            <Image src={logoSrc} alt="Zarman Logo" width={110} height={32} className={styles.logoImg} priority />
          </Link>

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

      <div ref={overlayRef} className={styles.menuOverlay} onClick={close} aria-hidden="true" />

      <div ref={drawerRef} className={styles.menuDrawer} role="dialog" aria-modal="true">
        <div className={styles.menuInner}>
          <div className={styles.menuHeader}>
            {/* 👈 اضافه شدن دکمه ضربدر در هدر منو */}
            <button type="button" className={styles.drawerCloseBtn} onClick={close} aria-label="بستن منو">
              <X size={24} />
            </button>
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
                  <Button href="/dashboard" variant="primary" fullWidth onClick={close}>
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
              <p className={styles.menuFooterSub}>تجربه‌ای روشن‌تر برای کاربران ایران–استرالیا</p>
            </div>
          </nav>
        </div>
      </div>
    </>,
    document.body
  );
}