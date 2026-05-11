"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldAlert, Lock } from "lucide-react";
import styles from "@/styles/admin/AdminLogin.module.css";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
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

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError("Invalid credentials.");
      setLoading(false);
      return;
    }

    // Verify admin role client-side as a UX guard.
    // Real enforcement happens server-side in middleware + every action.
    const role = data.user.app_metadata?.role;
    if (role !== "admin") {
      await supabase.auth.signOut();
      setError("Access denied. This portal is for administrators only.");
      setLoading(false);
      return;
    }

    router.push("/admin/dashboard");
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.card}>
        <div className={styles.logo}>
  <div style={{ width: "40px", height: "40px", flexShrink: 0 }}>
    <Image 
      src="/images/logo-no-text-light.svg" 
      alt="Zarman Logo" 
      width={40} 
      height={40} 
      priority 
    />
  </div>
  <div className={styles.logoText}>
    
            <span className={styles.logoName}>Zarman Exchange</span>
            <span className={styles.logoSub}>Admin Portal</span>
          </div>
        </div>

        <h1 className={styles.heading}>Administrator Sign In</h1>
        <p className={styles.subheading}>
          Restricted access. Credentials are monitored and audited.
        </p>

        {error && (
          <div className={styles.errorBox}>
            <ShieldAlert size={14} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <div>
              <label className={styles.label} htmlFor="admin-email">
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                className={styles.input}
                placeholder="admin@zarman.com.au"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className={styles.label} htmlFor="admin-password">
                Password
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className={styles.input}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            <Lock size={16} />
            {loading ? "Authenticating..." : "Sign In to Admin Panel"}
          </button>
        </form>

        <div className={styles.securityNote}>
          <ShieldAlert size={14} />
          All admin actions are logged for compliance and audit purposes.
        </div>
      </div>
    </div>
  );
}
