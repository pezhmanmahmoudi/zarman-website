"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "@/styles/Auth.module.css";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // شبیه‌سازی درخواست به سرور
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
  };

  return (
    <div className={styles.pageWrapper}>
      {/* بک‌گراند گرادیانت مورب */}
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            زرمان
          </Link>
          <h1 className={styles.title}>ایجاد حساب کاربری</h1>
          <p className={styles.subtitle}>برای شروع انتقال، اطلاعات خود را وارد کنید.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="fullname">نام و نام خانوادگی</label>
            <input 
              id="fullname" 
              type="text" 
              className={styles.input} 
              placeholder="مثال: علی احمدی" 
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="contact">شماره موبایل یا ایمیل</label>
            <input 
              id="contact" 
              type="text" 
              className={styles.input} 
              placeholder="0912... یا email@example.com" 
              dir="ltr"
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="password">رمز عبور</label>
            <input 
              id="password" 
              type="password" 
              className={styles.input} 
              placeholder="حداقل ۸ کاراکتر" 
              dir="ltr"
              required 
            />
          </div>

          <div className={styles.actions}>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              ثبت‌نام در زرمان
            </Button>
          </div>
        </form>

        <div className={styles.footerText}>
          قبلاً ثبت‌نام کرده‌اید؟ 
          <Link href="/fa/login" className={styles.footerLink}>
            وارد شوید
          </Link>
        </div>
      </div>
    </div>
  );
}