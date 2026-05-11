"use client";

import React, { useState, useEffect } from "react";
import { UserCircle2, ShieldCheck, AlertCircle, MessageCircle } from "lucide-react";
import { submitKycData } from "@/app/actions/kyc.actions";
import styles from "@/styles/dashboard/DashboardProfile.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";

export function DashboardProfile({ profile }: { profile: any }) {
  const hasSubmittedData = Boolean(profile?.document_type && profile?.document_type !== "later" && profile?.document_type !== "");
  const isKycSubmitted = hasSubmittedData && ["pending", "under_review", "approved"].includes(profile?.kyc_status);
  const isApproved = profile?.kyc_status === "approved";

  const [formData, setFormData] = useState({
    dob: "", country: "Australia", address: "", city: "", state: "", postalCode: "",
    docType: "", licenseNumber: "", cardNumber: "", passportNumber: "", 
    consentNotice: false, 
    consentDVS: false,    
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: "success" | "error" | ""; msg: string }>({ type: "", msg: "" });

  useEffect(() => {
    if (profile) {
      setFormData({
        dob: profile.dob || profile.date_of_birth || "",
        country: profile.country || "Australia",
        address: profile.address || "",
        city: profile.city || "",
        state: profile.state || "",
        postalCode: profile.postcode || profile.post_code || "",
        docType: profile.document_type || "",
        licenseNumber: profile.license_number || "",
        cardNumber: profile.card_number || "",
        passportNumber: profile.passport_number || "",
        consentNotice: false,
        consentDVS: false,
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (errors.consents && (name === "consentNotice" || name === "consentDVS")) {
      setErrors((prev) => ({ ...prev, consents: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.dob) newErrors.dob = "Date of Birth is required.";
    if (!formData.address) newErrors.address = "Residential Address is required.";
    if (!formData.city) newErrors.city = "City is required.";
    if (!formData.state) newErrors.state = "State is required.";
    if (!formData.postalCode) newErrors.postalCode = "Postal Code is required.";
    if (!formData.docType) newErrors.docType = "Identity Document is required.";
    
    if (formData.docType === "driver_license") {
      if (!formData.licenseNumber) newErrors.licenseNumber = "Licence Number is required.";
      if (!formData.cardNumber) newErrors.cardNumber = "Card Number is required.";
    }
    
    if (formData.docType === "passport") {
      if (!formData.passportNumber) newErrors.passportNumber = "Document Number is required.";
    }

    if (formData.docType !== "none") {
      if (!formData.consentNotice || !formData.consentDVS) {
        newErrors.consents = "لطفاً جهت انجام استعلام هویتی، هر دو مورد حقوقی را تایید کنید.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (formData.docType === "none" || !validateForm()) return;

    setIsSubmitting(true);
    setSubmitStatus({ type: "", msg: "" });

    const result = await submitKycData({
      dob: formData.dob,
      country: formData.country,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      postcode: formData.postalCode,
      document_type: formData.docType,
      license_number: formData.licenseNumber || null,
      card_number: formData.cardNumber || null,
      passport_number: formData.passportNumber || null,
      consent_notice: formData.consentNotice,
      consent_dvs: formData.consentDVS,
    });

    if (result.error) {
      setSubmitStatus({ type: "error", msg: result.error });
    } else {
      setSubmitStatus({ type: "success", msg: "اطلاعات هویتی شما با موفقیت ثبت شد." });
      setTimeout(() => window.location.reload(), 1500);
    }

    setIsSubmitting(false);
  };

  const whatsappLink = `https://wa.me/61497851631?text=${encodeURIComponent("سلام. من گواهینامه و پاسپورت استرالیا ندارم، برای احراز هویت به من کمک کنید.")}`;
  const displayFirstName = profile?.middle_name ? `${profile.first_name} (${profile.middle_name})` : (profile?.first_name || "—");

  return (
    <article className={cardStyles.panelCard}>
      <div className={styles.profileHeader}>
        <h2 className={`${cardStyles.panelTitle} ${styles.persianTitle}`}>
          <UserCircle2 size={24} /> اطلاعات هویتی و امنیتی
        </h2>
      </div>
      
      <div className={styles.mainContentWrapper}>
        {/* 🟢 اطلاعات اولیه قفل شده */}
        <div className={styles.formCompact}>
          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label>First Name {profile?.middle_name && "(Middle Name)"}</label>
              <input type="text" value={displayFirstName} readOnly className={styles.readOnlyInput} />
            </div>
            <div className={styles.inputGroup}>
              <label>Last Name</label>
              <input type="text" value={profile?.last_name || "—"} readOnly className={styles.readOnlyInput} />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <input type="email" value={profile?.email || "—"} readOnly className={styles.readOnlyInput} />
            </div>
            <div className={styles.inputGroup}>
              <label>Mobile Number</label>
              <input type="text" value={profile?.mobile_number || profile?.phone_number || "—"} readOnly className={styles.readOnlyInput} />
            </div>
          </div>
        </div>

        <div className={styles.divider}></div>

        {/* 🟢 بخش تکمیل اطلاعات (AUSTRAC) */}
        <div className={styles.kycSection}>
          <h3 className={styles.persianSectionTitle}>تکمیل اطلاعات</h3>
          <p className={styles.persianSectionSubtitle}> لطفاً فقط اطلاعات خواسته شده را با دقت وارد نمایید.</p>

          {isKycSubmitted && submitStatus.type !== "success" ? (
            <div className={styles.successMessage}>
              <ShieldCheck size={20} />
              <p>وضعیت حساب شما: <strong style={{color: isApproved ? "#10b981" : "#f59e0b", textTransform: 'capitalize'}}>{profile?.kyc_status}</strong></p>
            </div>
          ) : (
            <div className={styles.formCompact}>
              
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Date of Birth <span className={styles.req}>*</span></label>
                  <input type="date" name="dob" value={formData.dob} onChange={handleChange} className={errors.dob ? styles.errorBorder : ""} />
                  {errors.dob && <span className={styles.errorText}>{errors.dob}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label>Country <span className={styles.req}>*</span></label>
                  <input type="text" name="country" value={formData.country} readOnly className={styles.readOnlyInput} />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Residential Address (Street) <span className={styles.req}>*</span></label>
                <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="آدرس دقیق محل سکونت (خیابان، پلاک، واحد)" className={errors.address ? styles.errorBorder : ""} />
                {errors.address && <span className={styles.errorText}>{errors.address}</span>}
              </div>

              <div className={styles.row3}>
                <div className={styles.inputGroup}>
                  <label>City / Suburb <span className={styles.req}>*</span></label>
                  <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="شهر / حومه" className={errors.city ? styles.errorBorder : ""} />
                  {errors.city && <span className={styles.errorText}>{errors.city}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label>State <span className={styles.req}>*</span></label>
                  <input type="text" name="state" value={formData.state} onChange={handleChange} placeholder="ایالت (مثلاً NSW)" className={errors.state ? styles.errorBorder : ""} />
                  {errors.state && <span className={styles.errorText}>{errors.state}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label>Postal Code <span className={styles.req}>*</span></label>
                  <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="کد پستی" className={errors.postalCode ? styles.errorBorder : ""} />
                  {errors.postalCode && <span className={styles.errorText}>{errors.postalCode}</span>}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Identity Document <span className={styles.req}>*</span></label>
                <select name="docType" value={formData.docType} onChange={handleChange} className={errors.docType ? styles.errorBorder : ""}>
                  <option value="" disabled>Select Identity Document...</option>
                  <option value="driver_license">Australian Driver's Licence</option>
                  <option value="passport">Australian Passport</option>
                  <option value="none">None of the above</option>
                </select>
                {errors.docType && <span className={styles.errorText}>{errors.docType}</span>}
              </div>

              {formData.docType === "driver_license" && (
                <div className={styles.row}>
                  <div className={styles.inputGroup}>
                    <label>Licence Number <span className={styles.req}>*</span></label>
                    <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} placeholder="شماره گواهینامه" className={errors.licenseNumber ? styles.errorBorder : ""} />
                    {errors.licenseNumber && <span className={styles.errorText}>{errors.licenseNumber}</span>}
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Card Number <span className={styles.req}>*</span></label>
                    <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleChange} placeholder="شماره کارت (روی یا پشت گواهینامه)" className={errors.cardNumber ? styles.errorBorder : ""} />
                    {errors.cardNumber && <span className={styles.errorText}>{errors.cardNumber}</span>}
                  </div>
                </div>
              )}

              {formData.docType === "passport" && (
                <div className={styles.row}>
                  <div className={styles.inputGroup}>
                    <label>Document Number <span className={styles.req}>*</span></label>
                    <input type="text" name="passportNumber" value={formData.passportNumber} onChange={handleChange} placeholder="شماره پاسپورت" className={errors.passportNumber ? styles.errorBorder : ""} />
                    {errors.passportNumber && <span className={styles.errorText}>{errors.passportNumber}</span>}
                  </div>
                </div>
              )}

              {formData.docType === "none" && (
                <div className={styles.whatsappBox}>
                  <AlertCircle size={28} color="#25d366" style={{ marginBottom: "4px" }} />
                  <h4 className={styles.persianSectionTitle} style={{ fontSize: '15px', color: '#25d366' }}>نیاز به راهنمایی دارید؟</h4>
                  <p className={styles.persianSectionSubtitle} style={{ marginBottom: '12px', textAlign: 'center' }}>
                    در صورتی که گواهینامه یا پاسپورت استرالیا ندارید، جهت بررسی مدارک جایگزین در واتس‌اپ پیام دهید.
                  </p>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className={styles.whatsappBtn}>
                    <MessageCircle size={18} /> تماس با پشتیبانی در واتس‌اپ
                  </a>
                </div>
              )}

              {/* اکشن بار */}
              {formData.docType && formData.docType !== "none" && (
                <div className={styles.actionSection}>
                  <div className={`${styles.legalCheckboxes} ${errors.consents ? styles.errorBorder : ""}`}>
                    <label className={styles.finePrintLabel}>
                      <input type="checkbox" name="consentNotice" checked={formData.consentNotice} onChange={handleChange} />
                      <span>
                        I have read and agree to the <a href="/en/legal/privacy-policy" target="_blank">Privacy Policy</a> & <a href="/en/legal/dvs-notice" target="_blank">Verification Notice</a>. <span className={styles.req}>*</span>
                      </span>
                    </label>
                    
                    <label className={styles.finePrintLabel}>
                      <input type="checkbox" name="consentDVS" checked={formData.consentDVS} onChange={handleChange} />
                      <span>
                        I consent to Zarman Exchange verifying my personal details and ID documents via official records (DVS) as per the <a href="/en/legal/dvs-consent" target="_blank">Identity Verification Consent</a>. <span className={styles.req}>*</span>
                      </span>
                    </label>
                    
                    {/* 🚀 ارور فارسی با کلاس اختصاصی errorTextFa 🚀 */}
                    {errors.consents && <span className={styles.errorTextFa} style={{ marginTop: '8px' }}>{errors.consents}</span>}
                  </div>

                  <div className={styles.btnWrapperRight}>
                    <button type="button" onClick={handleSubmit} disabled={isSubmitting} className={cardStyles.primaryButton} style={{ padding: '14px 36px', fontSize: '14px' }}>
                      {isSubmitting ? "Submitting..." : "Submit Verification"}
                    </button>
                  </div>
                </div>
              )}
              
              {submitStatus.msg && (
                /* 🚀 استفاده از errorTextFa برای خطای سرور 🚀 */
                <div className={submitStatus.type === "success" ? styles.successMessage : styles.errorTextFa} style={{ marginTop: submitStatus.type === "error" ? 12 : -12, padding: '0 24px' }}>
                  <p style={{textAlign: 'center', width: '100%', margin: 0}}>{submitStatus.msg}</p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </article>
  );
}