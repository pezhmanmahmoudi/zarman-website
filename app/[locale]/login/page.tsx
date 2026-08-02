"use client";

import React, { useState } from "react";
import Image from "next/image"; 
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import styles from "@/styles/Register.module.css"; 
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import { supabase } from "@/lib/supabase"; 

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
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
      router.push(`/${locale}/dashboard`);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={`${styles.card} ${styles.authCardSmall}`}>
        
        <div className={styles.topNav}>
          <Link href={`/${locale}`} className={styles.backHome} aria-label="Back to Website">
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

        <div className={styles.header}>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Enter your email and password to securely log in.</p>
        </div>

        <div className={styles.formBody}>
          <div className={styles.stepContent}>
            {error && <div className={styles.globalErrorBox}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.formContainer}>
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

              <div className={styles.inputGroup}>
                <div className={styles.flexBetween}>
                  <label htmlFor="password" className={styles.labelNoMargin}>Password</label>
                  <Link href={`/${locale}/forgot-password`} className={styles.forgotLink}>
                    Forgot Password?
                  </Link>
                </div>
                <div className={styles.passwordWrapper}>
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

              <div className={`${styles.btnWrapperRight} ${styles.marginTopSm}`}>
                <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                  Log in
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className={styles.footerText}>
          Don't have an account? 
          <Link href={`/${locale}/register`} className={styles.footerLink}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}