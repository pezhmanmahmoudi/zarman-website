"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "@/styles/Register.module.css";
import {
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  ShieldCheck,
  Eye,
  EyeOff,
  MailCheck,
  CheckCircle,
} from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import { supabase } from "@/lib/supabase";

// 🛡️ ثابت‌های امنیتی برای آپلود مدارک
const MAX_FILE_SIZE = 5 * 1024 * 1024; // حداکثر 5 مگابایت
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

const generateSecureRandomString = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const countryCodes = [
  { code: "+61", label: "AU (+61)" },
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+98", label: "IR (+98)" },
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [files, setFiles] = useState<Record<string, File | null>>({
    docFront: null,
    docBack: null,
    proofOfAddress: null,
  });

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phoneCode: "+61",
    mobile: "",
    password: "",
    confirmPassword: "",
    dob: "",
    address: "",
    country: "Australia",
    state: "",
    city: "",
    postalCode: "",
    docType: "",
    termsAccepted: false,
    privacyAccepted: false,
    dvsAccepted: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;

    let finalValue = value;
    if (name === "mobile") {
      finalValue = value.replace(/\D/g, "");
    }

    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : finalValue }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // 🛡️ بررسی امنیت فایل‌ها در لحظه انتخاب
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        alert(`فرمت فایل ${file.name} غیرمجاز است. فقط عکس (JPG/PNG) و PDF مجاز است.`);
        e.target.value = ""; // ریست کردن ورودی
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        alert(`حجم فایل ${file.name} بیش از ۵ مگابایت است.`);
        e.target.value = "";
        return;
      }

      setFiles((prev) => ({ ...prev, [key]: file }));
    }
  };

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(pass);
  };

  const handleStep1Submit = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName) newErrors.firstName = "First name is required";
    if (!formData.lastName) newErrors.lastName = "Last name is required";
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Valid email is required";

    if (!formData.mobile) {
      newErrors.mobile = "Mobile number is required";
    } else if (formData.mobile.length < 8 || formData.mobile.length > 15) {
      newErrors.mobile = "Enter a valid mobile number (8-15 digits)";
    }

    if (!validatePassword(formData.password)) newErrors.password = "Password does not meet the requirements";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setStep(2);
  };

  const handleFinalSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.dob) newErrors.dob = "Date of birth is required";
    if (!formData.address) newErrors.address = "Address is required";
    if (!formData.state) newErrors.state = "State is required";
    if (!formData.city) newErrors.city = "City is required";
    if (!formData.postalCode) newErrors.postalCode = "Postal code is required";
    if (!formData.docType) newErrors.docType = "Please select a document type";
    if (!formData.privacyAccepted || !formData.termsAccepted || !formData.dvsAccepted) {
      newErrors.policies = "You must accept all terms, policies, and consents to proceed.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const fullPhoneNumber = `${formData.phoneCode}${formData.mobile}`;

      const { data: checkData, error: checkError } = await supabase.rpc("check_user_exists", {
        p_email: formData.email,
        p_phone: fullPhoneNumber,
      });

      if (checkError) {
        alert("Security Check Failed: " + checkError.message);
        setLoading(false);
        return;
      }

      if (checkData?.email_exists || checkData?.phone_exists) {
        const duplicateErrors: Record<string, string> = {};
        if (checkData.email_exists) duplicateErrors.email = "This email is already registered.";
        if (checkData.phone_exists) duplicateErrors.mobile = "This mobile number is already registered.";

        setErrors(duplicateErrors);
        setStep(1);
        setLoading(false);
        return;
      }

      // ۱. ساخت اکانت کاربر
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            middle_name: formData.middleName,
            last_name: formData.lastName,
            mobile_number: fullPhoneNumber,
            dob: formData.dob,
            address: formData.address,
            state: formData.state,
            city: formData.city,
            postal_code: formData.postalCode,
            document_type: formData.docType,
          },
          emailRedirectTo: `${window.location.origin}/fa/auth/confirm`,
        },
      });

      if (error) {
        alert("Error during registration: " + error.message);
        return;
      }

      // 🛡️ ۲. آپلود امن مدارک هویتی در استوریج سوپابیس (اضافه شده)
      if (data?.user?.id) {
        const userId = data.user.id;
        const uploadPromises: Promise<void>[] = [];

        for (const [key, file] of Object.entries(files)) {
          if (file) {
            const safeExt = EXTENSION_MAP[file.type] || "bin";
            const secureFileName = `${Date.now()}_${generateSecureRandomString()}_${key}.${safeExt}`;
            const filePath = `${userId}/${secureFileName}`;

            const uploadTask = supabase.storage
              .from("kyc-documents")
              .upload(filePath, file, { cacheControl: "3600", upsert: false })
              .then(({ error: uploadError }) => {
                if (uploadError) {
                  console.error(`Failed to upload ${key}:`, uploadError);
                  // اگر آپلود با خطا مواجه شد، ثبت نام متوقف نمی‌شود اما لاگ می‌اندازیم
                  // کاربر می‌تواند بعداً از طریق داشبورد مدارک را تکمیل کند
                }
              });

            uploadPromises.push(uploadTask);
          }
        }

        // منتظر می‌مانیم تا تمام فایل‌ها آپلود شوند
        await Promise.all(uploadPromises);
      }

      // ۳. هدایت به صفحه تایید ایمیل
      setStep(3);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString()
    .split("T")[0];

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={styles.card}>
        <div className={styles.topNav}>
          <Link href="/" className={styles.backHome} aria-label="Back to Website">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Link>
        </div>

        <div className={styles.logoContainer}>
          <img src="/images/Logo%20no%20text%20light.svg" alt="Zarman Logo" className={styles.logoImage} />
        </div>

        {step < 3 && (
          <div className={styles.header}>
            <h1 className={styles.title}>Create your Account</h1>
            <p className={styles.subtitle}>Join Zarman to start transferring money securely.</p>

            <div className={styles.progressContainer}>
              <div className={`${styles.progressStep} ${step >= 1 ? styles.active : ""}`}>
                <div className={styles.stepCircle}>1</div>
                <span className={styles.stepLabel}>Account</span>
              </div>
              <div className={`${styles.progressLine} ${step >= 2 ? styles.activeLine : ""}`}></div>
              <div className={`${styles.progressStep} ${step >= 2 ? styles.active : ""}`}>
                <div className={styles.stepCircle}>2</div>
                <span className={styles.stepLabel}>KYC & Docs</span>
              </div>
            </div>
          </div>
        )}

        <div className={styles.formBody}>
          {/* ================= STEP 1: Account Creation ================= */}
          {step === 1 && (
            <div className={styles.stepContent}>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>
                    First Name <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="نام"
                    className={errors.firstName ? styles.errorBorder : ""}
                  />
                  {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <label>Middle Name</label>
                  <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} placeholder="نام میانی" />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>
                    Last Name <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="نام خانوادگی"
                    className={errors.lastName ? styles.errorBorder : ""}
                  />
                  {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <label>
                    Email Address <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="آدرس ایمیل"
                    className={errors.email ? styles.errorBorder : ""}
                  />
                  {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>
                  Mobile Number <span className={styles.req}>*</span>
                </label>
                <div className={styles.mobileInputWrapper}>
                  <select name="phoneCode" value={formData.phoneCode} onChange={handleChange} className={styles.countryCode}>
                    {countryCodes.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="شماره موبایل"
                    className={errors.mobile ? styles.errorBorder : ""}
                  />
                </div>
                {errors.mobile && <span className={styles.errorText}>{errors.mobile}</span>}
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>
                    Password <span className={styles.req}>*</span>
                  </label>
                  <div className={styles.passwordWrapper}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="رمز عبور"
                      className={errors.password ? styles.errorBorder : ""}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.eyeBtn}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className={styles.hintText}>Min. 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character.</p>
                  {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <label>
                    Confirm Password <span className={styles.req}>*</span>
                  </label>
                  <div className={styles.passwordWrapper}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="تایید رمز عبور"
                      className={errors.confirmPassword ? styles.errorBorder : ""}
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={styles.eyeBtn}>
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword}</span>}
                </div>
              </div>

              <div className={styles.btnWrapperRight}>
                <Button type="button" onClick={handleStep1Submit} variant="primary" rightIcon={<ArrowRight />}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: KYC & Docs ================= */}
          {step === 2 && (
            <div className={styles.stepContent}>
              <div className={styles.sectionTitle}>Personal Details</div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>
                    Date of Birth <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="date"
                    name="dob"
                    max={maxDate}
                    value={formData.dob}
                    onChange={handleChange}
                    className={errors.dob ? styles.errorBorder : ""}
                  />
                  {errors.dob && <span className={styles.errorText}>{errors.dob}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <label>
                    Residential Address <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="آدرس دقیق محل سکونت"
                    className={errors.address ? styles.errorBorder : ""}
                  />
                  {errors.address && <span className={styles.errorText}>{errors.address}</span>}
                </div>
              </div>

              <div className={styles.row3}>
                <div className={styles.inputGroup}>
                  <label>
                    Country <span className={styles.req}>*</span>
                  </label>
                  <input type="text" name="country" value={formData.country} readOnly className={styles.readOnlyInput} />
                </div>

                <div className={styles.inputGroup}>
                  <label>
                    State <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="ایالت"
                    className={errors.state ? styles.errorBorder : ""}
                  />
                  {errors.state && <span className={styles.errorText}>{errors.state}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <label>
                    City <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="شهر"
                    className={errors.city ? styles.errorBorder : ""}
                  />
                  {errors.city && <span className={styles.errorText}>{errors.city}</span>}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>
                  Postal Code <span className={styles.req}>*</span>
                </label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="کد پستی"
                  className={errors.postalCode ? styles.errorBorder : ""}
                />
                {errors.postalCode && <span className={styles.errorText}>{errors.postalCode}</span>}
              </div>

              <div className={styles.sectionTitle}>Identity Verification</div>
              <div className={styles.inputGroup}>
                <label>
                  Document Type <span className={styles.req}>*</span>
                </label>
                <select name="docType" value={formData.docType} onChange={handleChange} className={errors.docType ? styles.errorBorder : ""}>
                  <option value="" disabled>
                    Select Document...
                  </option>
                  <option value="driver_license">Australian Driver&apos;s License</option>
                  <option value="passport">Passport</option>
                  <option value="later">I will attach later</option>
                </select>
                {errors.docType && <span className={styles.errorText}>{errors.docType}</span>}
              </div>

              {formData.docType === "driver_license" && (
                <div className={styles.row}>
                  <div className={styles.uploadBox}>
                    {files.docFront ? (
                      <div className={styles.fileDone}>
                        <CheckCircle size={20} color="#10b981" /> <span>{files.docFront.name}</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={24} className={styles.uploadIcon} />
                        <span>Upload License (Front)</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg, image/png, application/pdf"
                      className={styles.fileInput}
                      onChange={(e) => handleFileChange(e, "docFront")}
                    />
                  </div>

                  <div className={styles.uploadBox}>
                    {files.docBack ? (
                      <div className={styles.fileDone}>
                        <CheckCircle size={20} color="#10b981" /> <span>{files.docBack.name}</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={24} className={styles.uploadIcon} />
                        <span>Upload License (Back)</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg, image/png, application/pdf"
                      className={styles.fileInput}
                      onChange={(e) => handleFileChange(e, "docBack")}
                    />
                  </div>
                </div>
              )}

              {formData.docType === "passport" && (
                <div className={styles.row}>
                  <div className={styles.uploadBox}>
                    {files.docFront ? (
                      <div className={styles.fileDone}>
                        <CheckCircle size={20} color="#10b981" /> <span>{files.docFront.name}</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={24} className={styles.uploadIcon} />
                        <span>Upload Passport Page</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg, image/png, application/pdf"
                      className={styles.fileInput}
                      onChange={(e) => handleFileChange(e, "docFront")}
                    />
                  </div>

                  <div className={styles.uploadBox}>
                    {files.proofOfAddress ? (
                      <div className={styles.fileDone}>
                        <CheckCircle size={20} color="#10b981" /> <span>{files.proofOfAddress.name}</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={24} className={styles.uploadIcon} />
                        <span>Proof of Address</span>
                        <p className={styles.uploadHelper}>Upload a recent utility bill.</p>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg, image/png, application/pdf"
                      className={styles.fileInput}
                      onChange={(e) => handleFileChange(e, "proofOfAddress")}
                    />
                  </div>
                </div>
              )}

              <div className={styles.policies}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" name="privacyAccepted" checked={formData.privacyAccepted} onChange={handleChange} />
                  <span>
                    I have read and agree to the{" "}
                    <Link href="/en/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>{" "}
                    &{" "}
                    <Link href="/en/legal/dvs-notice" target="_blank" rel="noopener noreferrer">
                      Verification Notice
                    </Link>
                    . <span className={styles.req}>*</span>
                  </span>
                </label>

                <label className={styles.checkboxLabel}>
                  <input type="checkbox" name="termsAccepted" checked={formData.termsAccepted} onChange={handleChange} />
                  <span>
                    I agree to the{" "}
                    <Link href="/en/legal/terms" target="_blank" rel="noopener noreferrer">
                      Terms & Conditions
                    </Link>
                    . <span className={styles.req}>*</span>
                  </span>
                </label>

                <label className={styles.checkboxLabel} style={{ alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    name="dvsAccepted"
                    checked={formData.dvsAccepted}
                    onChange={handleChange}
                    style={{ marginTop: "4px" }}
                  />
                  <span style={{ fontSize: "0.75rem", lineHeight: "1.5" }}>
                    I consent to Zarman Exchange verifying my personal details and ID documents via official records (DVS) as per the{" "}
                    <Link href="/en/legal/dvs-consent" target="_blank" rel="noopener noreferrer">
                      Identity Verification Consent
                    </Link>
                    . <span className={styles.req}>*</span>
                  </span>
                </label>

                {errors.policies && (
                  <span className={styles.errorText} style={{ marginTop: "8px" }}>
                    {errors.policies}
                  </span>
                )}
              </div>

              <div className={styles.btnWrapperSpace}>
                <Button type="button" onClick={() => setStep(1)} variant="ghost" leftIcon={<ArrowLeft />}>
                  Back
                </Button>
                <Button type="button" onClick={handleFinalSubmit} variant="primary" rightIcon={<ShieldCheck />} loading={loading}>
                  Submit & Verify
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: Email Notice ================= */}
          {step === 3 && (
            <div className={styles.verifyBox}>
              <MailCheck size={64} className={styles.verifyIcon} style={{ marginBottom: "20px" }} />
              <h2 className={styles.title}>Verification Required</h2>
              <p className={styles.subtitle} style={{ lineHeight: 1.6 }}>
                We&apos;ve received your details! To complete your registration, please <strong>open your email</strong> and click the
                verification link we just sent to <strong style={{ color: "#0f172a" }}>{formData.email}</strong>.
              </p>
              <div
                style={{
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  padding: "16px",
                  borderRadius: "12px",
                  marginTop: "24px",
                  width: "100%",
                }}
              >
                <p style={{ color: "#059669", margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>
                  Your account will be activated immediately after clicking the link.
                </p>
              </div>
            </div>
          )}
        </div>

        {step < 3 && (
          <div className={styles.footerText}>
            Already have an account?{" "}
            <Link href="/fa/login" className={styles.footerLink}>
              Log in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}