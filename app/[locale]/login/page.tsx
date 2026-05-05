"use client";

import React, { useState } from "react";
import Image from "next/image"; 
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/styles/Register.module.css"; 
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import { supabase } from "@/lib/supabase"; 

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setError("Email or password is incorrect.");
      setLoading(false);
    } else {
      router.push("/fa/dashboard");
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={styles.card} style={{ maxWidth: "480px" }}>
        
        {/* دکمه دایره‌ای بازگشت */}
        <div className={styles.topNav}>
          <Link href="/" className={styles.backHome} aria-label="Back to Website">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Link>
        </div>

        {/* لوگو */}
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

        <div className={styles.header}>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Enter your email and password to securely log in.</p>
        </div>

        <div className={styles.formBody}>
          <div className={styles.stepContent}>
            {error && <div className={styles.errorText} style={{ textAlign: 'center', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px', border: '1px solid #fca5a5', marginTop: '10px' }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className={styles.inputGroup}>
                <label htmlFor="email">Email Address</label>
                {/* 🚀 کلاس enInput اعمال شد */}
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

              <div className={styles.inputGroup}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                  {/* 🚀 استایل‌دهی حرفه‌ای به Forgot Password */}
                  <Link href="/fa/forgot-password" className={styles.forgotLink}>
                    Forgot Password?
                  </Link>
                </div>
                <div className={styles.passwordWrapper}>
                  {/* 🚀 کلاس enInput اعمال شد */}
                  <input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.enInput}
                    placeholder="رمز عبور"
                    required 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeBtn}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className={styles.btnWrapperRight} style={{ marginTop: '8px' }}>
                <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                  Log in
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className={styles.footerText}>
          Don't have an account? 
          <Link href="/fa/register" className={styles.footerLink}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}