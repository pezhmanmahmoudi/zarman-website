"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "@/styles/Register.module.css";
import { Home, ArrowLeft, MailCheck } from "lucide-react";
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

    // ارسال درخواست به سوپابیس برای ارسال ایمیل ریست پسورد
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // این همان صفحه‌ای است که کاربر بعد از کلیک روی لینک ایمیل به آن هدایت می‌شود
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

      <div className={styles.card} style={{ maxWidth: "480px" }}>
        <div className={styles.topNav}>
          <Link href="/fa/login" className={styles.backHome}>
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </div>

        {message ? (
          <div className={styles.verifyBox} style={{ marginTop: '40px' }}>
            <MailCheck size={64} className={styles.verifyIcon} style={{ marginBottom: "20px" }} />
            <h2 className={styles.title}>Check Your Email</h2>
            <p className={styles.subtitle} style={{ lineHeight: 1.6 }}>{message}</p>
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

                <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="email">Email Address</label>
                    <input 
                      id="email" 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      placeholder="name@example.com"
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