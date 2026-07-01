"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/styles/Register.module.css";
import { 
  ArrowLeft, Eye, EyeOff, ShieldCheck, KeyRound, CheckCircle2, AlertTriangle
} from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { supabase } from "@/lib/supabase";

const countryCodes = [
  { code: "+61", label: "AU (+61)" },
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+98", label: "IR (+98)" }
];

const OTP_LENGTH = 6;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    firstName: "", middleName: "", lastName: "",
    email: "", phoneCode: "+61", mobile: "",
    password: "", confirmPassword: "",
    termsAccepted: false, privacyAccepted: false,
  });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    let finalValue = value;
    if (name === "mobile") finalValue = value.replace(/\D/g, ""); 
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : finalValue }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(pass);
  };

  const handleRegister = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName) newErrors.firstName = "First name is required";
    if (!formData.lastName) newErrors.lastName = "Last name is required";
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Valid email is required";
    if (!formData.mobile) { newErrors.mobile = "Mobile number is required"; } 
    else if (formData.mobile.length < 8 || formData.mobile.length > 15) { newErrors.mobile = "Enter a valid mobile number (8-15 digits)"; }
    if (!validatePassword(formData.password)) newErrors.password = "Password does not meet the requirements";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    
    if (!formData.privacyAccepted || !formData.termsAccepted) {
      newErrors.policies = "You must accept all terms and policies to proceed.";
    }

    if (Object.keys(newErrors).length > 0) { 
      setErrors(newErrors); 
      return; 
    }

    setLoading(true); 
    setErrors({});
    
    try {
      const fullPhoneNumber = `${formData.phoneCode}${formData.mobile}`;
      
      const { data: checkData, error: checkError } = await supabase.rpc('check_user_exists', { p_email: formData.email, p_phone: fullPhoneNumber });
      if (checkError) { alert("Security Check Failed: " + checkError.message); setLoading(false); return; }

      const isEmailTaken = checkData?.email_exists;
      const isPhoneTaken = checkData?.phone_exists;

      if (isEmailTaken || isPhoneTaken) {
        const duplicateErrors: Record<string, string> = {};
        if (isEmailTaken) duplicateErrors.email = "This email is already registered.";
        if (isPhoneTaken) duplicateErrors.mobile = "This mobile number is already registered.";
        setErrors(duplicateErrors); setLoading(false); return;
      }

      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName, 
            middle_name: formData.middleName, 
            last_name: formData.lastName,
            mobile_number: fullPhoneNumber,
          },
        }
      });

      if (error) { setErrors({ general: error.message }); return; }

      setResendCooldown(60);
      setStep(2); 

    } catch (error) { 
      console.error(error); 
    } finally { 
      setLoading(false); 
    }
  };

  // OTP digit change — digits only, auto-advance focus
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

  const handleVerifyOtp = async () => {
    const code = otpDigits.join("");
    if (code.length < OTP_LENGTH) {
      setOtpError("Please enter all 6 digits.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");

    const { error } = await supabase.auth.verifyOtp({
      email: formData.email,
      token: code,
      type: "signup",
    });

    if (error) {
      setOtpError("Invalid or expired code. Please try again.");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
      setOtpLoading(false);
      return;
    }

    setOtpSuccess(true);
    setTimeout(() => router.push("/fa/dashboard"), 1500);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtpError("");
    setOtpDigits(Array(OTP_LENGTH).fill(""));

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: formData.email,
    });

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

      <div className={`${styles.card} ${step === 2 ? styles.confirmCard : ''}`}>
        
        <div className={styles.topNav}>
          <Link href="/" className={styles.backHome} aria-label="Back to Website"><ArrowLeft size={18} strokeWidth={2.5} /></Link>
        </div>

        <div className={styles.logoContainer}>
          <Image src="/images/logo-no-text-light.svg" alt="Zarman Logo" width={80} height={80} priority className={styles.logoImage} />
        </div>

        {step === 1 && (
          <div className={styles.header}>
            <h1 className={styles.title}>Create your Account</h1>
            <p className={styles.subtitle}>Join Zarman to start transferring money securely.</p>
          </div>
        )}

        <div className={styles.formBody}>
          {step === 1 && (
            <div className={styles.stepContent}>
              {errors.general && <div className={styles.globalErrorBox}>{errors.general}</div>}
              <div className={styles.formHint} role="note" aria-label="Registration notice">
                <AlertTriangle size={16} aria-hidden="true" className={styles.formHintIcon} />
                <span>Notice: Please enter all form details in English.</span>
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>First Name <span className={styles.req}>*</span></label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="نام" className={errors.firstName ? styles.errorBorder : ""} />
                  {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label>Middle Name</label>
                  <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} placeholder="نام میانی" />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Last Name <span className={styles.req}>*</span></label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="نام خانوادگی" className={errors.lastName ? styles.errorBorder : ""} />
                  {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label>Email Address <span className={styles.req}>*</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="آدرس ایمیل" className={errors.email ? styles.errorBorder : ""} />
                  {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Mobile Number <span className={styles.req}>*</span></label>
                <div className={styles.mobileInputWrapper}>
                  <div
                    className={styles.countryCodeWrapper}
                    style={{
                      "--bg-card":     "rgba(255,255,255,0.7)",
                      "--bg-dropdown": "#ffffff",
                      "--border-med":  "rgba(203,213,225,0.8)",
                      "--accent":      "#3848f5",
                      "--text-main":   "#0f172a",
                      "--text-dim":    "#94a3b8",
                      "--bg-soft":     "rgba(56,72,245,0.08)",
                    } as React.CSSProperties}
                  >
                    <SelectBox
                      value={formData.phoneCode}
                      onChange={(val) => setFormData((prev) => ({ ...prev, phoneCode: val }))}
                      labeledOptions={countryCodes.map((c) => ({ value: c.code, label: c.label }))}
                      dir="ltr"
                    />
                  </div>
                  <input type="text" inputMode="numeric" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="شماره موبایل" className={errors.mobile ? styles.errorBorder : ""} />
                </div>
                {errors.mobile && <span className={styles.errorText}>{errors.mobile}</span>}
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Password <span className={styles.req}>*</span></label>
                  <div className={styles.passwordWrapper}>
                    <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} placeholder="رمز عبور" className={errors.password ? styles.errorBorder : ""} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeBtn}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className={styles.hintText}>Min. 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character.</p>
                  {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <label>Confirm Password <span className={styles.req}>*</span></label>
                  <div className={styles.passwordWrapper}>
                    <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="تایید رمز عبور" className={errors.confirmPassword ? styles.errorBorder : ""} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={styles.eyeBtn}>
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword}</span>}
                </div>
              </div>

              <div className={styles.policies}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" name="privacyAccepted" checked={formData.privacyAccepted} onChange={handleChange} />
                  <span>I have read and agree to the <Link href="/en/legal/privacy-policy" target="_blank">Privacy Policy</Link>. <span className={styles.req}></span></span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" name="termsAccepted" checked={formData.termsAccepted} onChange={handleChange} />
                  <span>I agree to the <Link href="/en/legal/terms" target="_blank">Terms & Conditions</Link>. <span className={styles.req}></span></span>
                </label>
                {errors.policies && <span className={`${styles.errorText} ${styles.marginTopXs}`}>{errors.policies}</span>}
              </div>

              <div className={styles.btnWrapperRight}>
                <Button type="button" onClick={handleRegister} variant="primary" rightIcon={<ShieldCheck />} loading={loading} fullWidth>
                  Create Account
                </Button>
              </div>
            </div>
          )}

        {step === 2 && (
          <div className={styles.cleanVerifyBox}>

            {otpSuccess ? (
              // ── Success state ──────────────────────────────────────────
              <>
                <div className={styles.inlineHeader}>
                  <div className={`${styles.iconBadge} ${styles.iconBadgeSuccess}`}>
                    <CheckCircle2 size={28} color="#10b981" strokeWidth={2.5} />
                  </div>
                  <h2 className={styles.inlineTitle}>Account Verified!</h2>
                </div>

                <div className={styles.emailInfoWrapper}>
                  <p className={styles.cleanSubtitle}>
                    Your account has been successfully verified.
                  </p>
                </div>

                <div className={styles.verificationNote}>
                  <p className={styles.verificationNoteText}>
                    <CheckCircle2 size={20} color="#10b981" strokeWidth={2.5} className={styles.flexShrinkZero} />
                    <span>Redirecting you to your dashboard…</span>
                  </p>
                </div>
              </>
            ) : (
              // ── OTP input state ────────────────────────────────────────
              <>
                <div className={styles.inlineHeader}>
                  <div className={styles.iconBadge}>
                    <KeyRound size={24} color="#3848f5" strokeWidth={2.5} />
                  </div>
                  <h2 className={styles.inlineTitle}>Verify Your Email</h2>
                </div>

                <div className={styles.emailInfoWrapper}>
                  <p className={styles.cleanSubtitle}>
                    Enter the 6-digit code we sent to:
                  </p>
                  <div className={styles.emailBadge}>{formData.email}</div>
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
                    Verify &amp; Activate Account
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        </div>

        {step === 1 && (
          <div className={styles.footerText}>
            Already have an account? <Link href="/fa/login" className={styles.footerLink}>Log in</Link>
          </div>
        )}

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
    </div>
  );
}