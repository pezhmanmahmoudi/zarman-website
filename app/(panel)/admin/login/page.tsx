"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ShieldAlert, Lock } from "lucide-react";
import styles from "@/styles/admin/AdminLogin.module.css";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { OtpInput } from "@/components/admin/security/OtpInput";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // After the password: "mfa" asks for the authenticator code, "enroll" sends an admin without a second factor to set one up.
  const [step, setStep] = useState<"password" | "mfa" | "enroll">("password");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");

  /** If the session still owes a second factor, move to the right step; otherwise return false. */
  async function continueWithSecondFactor(): Promise<boolean> {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") return false;
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.[0];
    if (totp) { setFactorId(totp.id); setStep("mfa"); return true; }
    return false;
  }

  // Redirected here by the proxy with ?mfa=1: the user is signed in with a password but not yet verified.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mfa") !== "1") return;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || data.user.app_metadata?.role !== "admin") return;
      if (!(await continueWithSecondFactor())) setStep("enroll");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on arrival
  }, []);

  const verifyCode = async (value: string) => {
    if (loading || value.length !== 6) return;
    setLoading(true); setError("");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) { setError("Could not start verification. Please try again."); setLoading(false); return; }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: value });
    if (verifyError) { setError("That code did not work. Codes change every 30 seconds, so wait for the next one and try again."); setCode(""); setLoading(false); return; }
    router.push("/admin/dashboard");
  };

  const useDifferentAccount = async () => {
    await supabase.auth.signOut();
    setStep("password"); setCode(""); setError(""); setPassword("");
  };

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

    // With two-factor on, an enrolled admin must enter the code before reaching the panel.
    if (await continueWithSecondFactor()) { setLoading(false); return; }
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

        {step === "mfa" && (
          <form onSubmit={(e) => { e.preventDefault(); void verifyCode(code); }}>
            <p className={styles.subheading} style={{ marginBottom: "1.25rem" }}>
              Open your authenticator app and enter the 6-digit code shown for Zarman.
            </p>
            <OtpInput value={code} onChange={(value) => { setCode(value); setError(""); }} onComplete={(value) => void verifyCode(value)} disabled={loading} autoFocus invalid={Boolean(error)} />
            <button type="submit" className={styles.submitBtn} style={{ marginTop: "1.25rem" }} disabled={loading || code.length !== 6}>
              <Lock size={16} />{loading ? "Verifying..." : "Verify and continue"}
            </button>
            <button type="button" onClick={() => void useDifferentAccount()} disabled={loading}
              style={{ display: "block", margin: "1rem auto 0", background: "none", border: 0, color: "inherit", opacity: 0.7, fontSize: ".8125rem", textDecoration: "underline", cursor: "pointer" }}>
              Use a different account
            </button>
          </form>
        )}

        {step === "enroll" && (
          <div>
            <p className={styles.subheading}>Two-factor authentication is required for administrators. Set it up once with an authenticator app.</p>
            <Link href="/admin/security" className={styles.submitBtn} style={{ textDecoration: "none", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: ".5rem" }}>
              <Lock size={16} />Set up two-factor
            </Link>
          </div>
        )}

        {step === "password" && (
        <form onSubmit={handleSubmit} suppressHydrationWarning>
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
        )}

        <div className={styles.securityNote}>
          <ShieldAlert size={14} />
          All admin actions are logged for compliance and audit purposes.
        </div>
      </div>
    </div>
  );
}
