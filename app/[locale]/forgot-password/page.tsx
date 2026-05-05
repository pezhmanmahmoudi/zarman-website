"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image"; 
import styles from "@/styles/Register.module.css";
import { ArrowLeft, MailCheck } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/fa/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("A password reset link has been sent to your email.");
    }
    setLoading(false);
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      {/* 🚀 استفاده از کلاس confirmCard برای ابعاد استاندارد فین‌تک */}
      <div className={`${styles.card} ${styles.confirmCard}`}>
        
        <div className={styles.topNav}>
          <Link href="/fa/login" className={styles.backHome} aria-label="Back to Login">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Link>
        </div>

        <div className={styles.logoContainer}>
          <Image 
            src="/images/logo-no-text-light.svg" 
            alt="Zarman Logo" 
            width={80}
            height={80}
            priority
            className={styles.logoImage} 
          />
        </div>

        {message ? (
          <div className={styles.verifyBox}>
            <div className={styles.successIconBox}>
              <div className={styles.successIconCircle}>
                <MailCheck size={56} color="var(--success, #10b981)" />
              </div>
            </div>
            <h2 className={styles.confirmTitle}>Check Your Email</h2>
            <p className={styles.confirmSubtitle}>{message}</p>
            <div className={styles.btnContainer}>
              <Button href="/fa/login" variant="ghost" fullWidth>
                Return to Login
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <h1 className={styles.title}>Reset Password</h1>
              <p className={styles.subtitle}>Enter your email address and we'll send you a link to reset your password.</p>
            </div>

            <div className={styles.formBody}>
              <div className={styles.stepContent}>
                {error && <div className={styles.errorText} style={{ textAlign: 'center', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px', border: '1px solid #fca5a5' }}>{error}</div>}

                <form onSubmit={handleResetPassword} className={styles.btnContainer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="email">Email Address</label>
                    <input 
                      id="email" 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="آدرس ایمیل"
                      className={styles.enInput}
                      required 
                    />
                  </div>

                  <div className={styles.btnWrapperRight}>
                    <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                      Send Reset Link
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}