"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "@/styles/Auth.module.css";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            زرمان
          </Link>
          <h1 className={styles.title}>ورود به پنل کاربری</h1>
          <p className={styles.subtitle}>خوش آمدید! وضعیت انتقال خود را پیگیری کنید.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="contact">ایمیل یا شماره موبایل</label>
            <input 
              id="contact" 
              type="text" 
              className={styles.input} 
              dir="ltr"
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
              <label className={styles.label} htmlFor="password" style={{ marginBottom: 0 }}>رمز عبور</label>
              <Link href="/fa/forgot-password" className={styles.footerLink} style={{ fontSize: "var(--text-caption)", marginRight: 0 }}>
                فراموش کرده‌اید؟
              </Link>
            </div>
            <input 
              id="password" 
              type="password" 
              className={styles.input} 
              dir="ltr"
              required 
            />
          </div>

          <div className={styles.actions}>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              ورود
            </Button>
          </div>
        </form>

        <div className={styles.footerText}>
          حساب کاربری ندارید؟ 
          <Link href="/fa/register" className={styles.footerLink}>
            ثبت‌نام کنید
          </Link>
        </div>
      </div>
    </div>
  );
}