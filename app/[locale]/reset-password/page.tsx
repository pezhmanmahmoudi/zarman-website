"use client";

import React, { useState } from "react";
import Image from "next/image"; 
import { useRouter } from "next/navigation";
import styles from "@/styles/Register.module.css";
import { Eye, EyeOff, ShieldCheck, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(pass);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validatePassword(password)) {
      setError("Password does not meet the security requirements.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push("/fa/dashboard");
      }, 3000);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={`${styles.card} ${styles.confirmCard}`}>
        
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
        
        {success ? (
          <div className={styles.verifyBox}>
            <div className={styles.successIconBox}>
              <div className={styles.successIconCircle}>
                <CheckCircle size={56} color="var(--success, #10b981)" />
              </div>
            </div>
            <h2 className={styles.confirmTitle}>Password Updated</h2>
            <p className={styles.confirmSubtitle}>
              Your password has been changed successfully. Redirecting you to the dashboard...
            </p>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <h1 className={styles.title}>Create New Password</h1>
              <p className={styles.subtitle}>Please enter your new strong password below.</p>
            </div>

            <div className={styles.formBody}>
              <div className={styles.stepContent}>
                {error && <div className={styles.errorText} style={{ textAlign: 'center', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px', border: '1px solid #fca5a5' }}>{error}</div>}

                <form onSubmit={handleUpdatePassword} className={styles.btnContainer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  <div className={styles.inputGroup}>
                    <label>New Password <span className={styles.req}>*</span></label>
                    <div className={styles.passwordWrapper}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        className={styles.enInput}
                        placeholder="رمز عبور جدید"
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeBtn}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className={styles.hintText}>Min. 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character.</p>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Confirm New Password <span className={styles.req}>*</span></label>
                    <div className={styles.passwordWrapper}>
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        className={styles.enInput}
                        placeholder="تایید رمز عبور جدید"
                        required
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={styles.eyeBtn}>
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.btnWrapperRight}>
                    <Button type="submit" variant="primary" size="lg" fullWidth rightIcon={<ShieldCheck />} loading={loading}>
                      Secure & Update Password
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