"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "@/styles/Register.module.css";
import { 
  ArrowLeft, Eye, EyeOff, MailCheck, ShieldCheck
} from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import { supabase } from "@/lib/supabase";

const countryCodes = [
  { code: "+61", label: "AU (+61)" },
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+98", label: "IR (+98)" }
];

export default function RegisterPage() {
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
      
      // 1. Check if user already exists
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

      // 2. Sign up the user (Without address and DOB since those move to dashboard)
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName, 
            middle_name: formData.middleName, 
            last_name: formData.lastName,
            mobile_number: fullPhoneNumber,
          },
          emailRedirectTo: `${window.location.origin}/fa/auth/confirm`, 
        }
      });

      if (error) { alert("Error during registration: " + error.message); return; }
      
      // 3. Move to Verification Step
      setStep(2); 

    } catch (error) { 
      console.error(error); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={styles.card}>
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
              <div className={styles.formHint}>جهت یکپارچگی و تایید سریع‌تر حساب، لطفاً تمامی اطلاعات فرم را به زبان انگلیسی وارد کنید.</div>

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
                  <select name="phoneCode" value={formData.phoneCode} onChange={handleChange} className={styles.countryCode}>
                    {countryCodes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
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
                  <span>I have read and agree to the <Link href="/en/legal/privacy-policy" target="_blank">Privacy Policy</Link>. <span className={styles.req}>*</span></span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" name="termsAccepted" checked={formData.termsAccepted} onChange={handleChange} />
                  <span>I agree to the <Link href="/en/legal/terms" target="_blank">Terms & Conditions</Link>. <span className={styles.req}>*</span></span>
                </label>
                {errors.policies && <span className={styles.errorText} style={{ marginTop: '4px' }}>{errors.policies}</span>}
              </div>

              <div className={styles.btnWrapperRight}>
                <Button type="button" onClick={handleRegister} variant="primary" rightIcon={<ShieldCheck />} loading={loading} style={{ width: '100%' }}>
                  Create Account
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className={styles.verifyBox}>
              <MailCheck size={64} className={styles.verifyIcon} style={{ marginBottom: "20px" }} />
              <h2 className={styles.title}>Verification Required</h2>
              <p className={styles.subtitle} style={{ lineHeight: 1.6 }}>
                We've received your details! To complete your registration, please <strong>open your email</strong> and click the verification link we just sent to <strong style={{color: '#0f172a'}}>{formData.email}</strong>.
              </p>
              <div style={{ backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", padding: "16px", borderRadius: "12px", marginTop: "24px", width: "100%" }}>
                <p style={{ color: "#059669", margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>
                  Your account will be activated immediately after clicking the link.
                </p>
              </div>
            </div>
          )}
        </div>

        {step === 1 && (
          <div className={styles.footerText}>
            Already have an account? <Link href="/fa/login" className={styles.footerLink}>Log in</Link>
          </div>
        )}
      </div>
    </div>
  );
}