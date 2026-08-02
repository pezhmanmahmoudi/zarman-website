"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import styles from "@/styles/Register.module.css";
import { ArrowLeft, KeyRound, ShieldCheck, CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import { supabase } from "@/lib/supabase";

const OTP_LENGTH = 6;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null));

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // ── Step 1: request OTP ────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (!profile) {
      setError("No account found with this email address.");
      setLoading(false);
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setResendCooldown(60);
    setStep(2);
    setLoading(false);
  };

  // ── OTP digit handlers ─────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setOtpError("");
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const newDigits = [...otpDigits];
      newDigits[index - 1] = "";
      setOtpDigits(newDigits);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { newDigits[i] = ch; });
    setOtpDigits(newDigits);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  // ── Step 2: verify OTP ─────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otpDigits.join("");
    if (code.length < OTP_LENGTH) {
      setOtpError("Please enter all 6 digits.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "recovery",
    });

    if (error) {
      setOtpError("Invalid or expired code. Please try again.");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
      setOtpLoading(false);
      return;
    }

    setOtpSuccess(true);
    setTimeout(() => router.push(`/${locale}/reset-password`), 1500);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtpError("");
    setOtpDigits(Array(OTP_LENGTH).fill(""));

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setOtpError("Failed to resend code. Please try again.");
      return;
    }
    setResendCooldown(60);
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={`${styles.card} ${step === 2 ? styles.confirmCard : styles.authCardSmall}`}>

        <div className={styles.topNav}>
          <Link href={`/${locale}/login`} className={styles.backHome} aria-label="Back to Login">
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

        {/* ── Step 1: email form ─────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className={styles.header}>
              <h1 className={styles.title}>Reset Password</h1>
              <p className={styles.subtitle}>Enter your email and we&apos;ll send you a 6-digit code to reset your password.</p>
            </div>

            <div className={styles.formBody}>
              <div className={styles.stepContent}>
                {error && <div className={styles.globalErrorBox}>{error}</div>}

                <form onSubmit={handleSendOtp} className={styles.formContainer}>
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

                  <div className={`${styles.btnWrapperRight} ${styles.marginTopSm}`}>
                    <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                      Send Code
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: OTP ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className={styles.cleanVerifyBox}>

            {otpSuccess ? (
              <>
                <div className={styles.inlineHeader}>
                  <div className={`${styles.iconBadge} ${styles.iconBadgeSuccess}`}>
                    <CheckCircle2 size={28} color="#10b981" strokeWidth={2.5} />
                  </div>
                  <h2 className={styles.inlineTitle}>Code Verified!</h2>
                </div>

                <div className={styles.emailInfoWrapper}>
                  <p className={styles.cleanSubtitle}>
                    Identity confirmed. Setting up your new password…
                  </p>
                </div>

                <div className={styles.verificationNote}>
                  <p className={styles.verificationNoteText}>
                    <CheckCircle2 size={20} color="#10b981" strokeWidth={2.5} className={styles.flexShrinkZero} />
                    <span>Redirecting you to the password reset form…</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className={styles.inlineHeader}>
                  <div className={styles.iconBadge}>
                    <KeyRound size={24} color="#3848f5" strokeWidth={2.5} />
                  </div>
                  <h2 className={styles.inlineTitle}>Check Your Email</h2>
                </div>

                <div className={styles.emailInfoWrapper}>
                  <p className={styles.cleanSubtitle}>
                    Enter the 6-digit code we sent to:
                  </p>
                  <div className={styles.emailBadge}>{email}</div>
                </div>

                <div className={styles.otpContainer}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      data-otp="true"
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      className={`${styles.otpInput} ${otpError ? styles.otpInputError : ""}`}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                {otpError && (
                  <div className={styles.globalErrorBox}>{otpError}</div>
                )}

                <div className={styles.btnContainer}>
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    variant="primary"
                    size="lg"
                    fullWidth
                    rightIcon={<ShieldCheck />}
                    loading={otpLoading}
                  >
                    Verify Code
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {step === 2 && !otpSuccess && (
        <div className={styles.footerText}>
          Didn&apos;t receive the code?{" "}
          {resendCooldown > 0 ? (
            <span className={styles.resendCooldown}>Resend in {resendCooldown}s</span>
          ) : (
            <button type="button" onClick={handleResend} className={styles.footerLink} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Resend Code
            </button>
          )}
        </div>
      )}

    </div>
  );
}
