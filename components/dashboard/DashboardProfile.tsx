"use client";

import React, { useState, useEffect } from "react";
import { UserCircle2, ShieldCheck, AlertCircle, MessageCircle, Star } from "lucide-react";
import { submitKycData, savePersonalData } from "@/app/actions/kyc.actions";
import styles from "@/styles/dashboard/DashboardProfile.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { formatToman } from "@/app/[locale]/dashboard/dashboard.utils";

export function DashboardProfile({ profile }: { profile: any }) {
  const hasSubmittedData = Boolean(profile?.document_type && profile?.document_type !== "later" && profile?.document_type !== "");
  const isKycSubmitted = hasSubmittedData && ["pending", "under_review", "approved"].includes(profile?.kyc_status);
  const isApproved = profile?.kyc_status === "approved";

  const [formData, setFormData] = useState({
    dob: "", country: "Australia", address: "", city: "", state: "", postalCode: "",
    docType: "", licenseNumber: "", cardNumber: "", passportNumber: "", expiryDate: "", stateOfIssue: "",
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
        expiryDate: profile.expiry_date || "",
        stateOfIssue: profile.state_of_issue || "",
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

    if (formData.country === "Australia") {
      if (!formData.docType) newErrors.docType = "Identity Document is required.";

      if (formData.docType === "driver_license") {
        if (!formData.licenseNumber) newErrors.licenseNumber = "Licence Number is required.";
        if (!formData.cardNumber) newErrors.cardNumber = "Card Number is required.";
        if (!formData.stateOfIssue) newErrors.stateOfIssue = "State of Issue is required.";
        if (!formData.expiryDate) newErrors.expiryDate = "Expiry Date is required.";
      }

      if (formData.docType === "passport") {
        if (!formData.passportNumber) newErrors.passportNumber = "Document Number is required.";
        if (!formData.expiryDate) newErrors.expiryDate = "Expiry Date is required.";
      }

      if (formData.docType && formData.docType !== "none") {
        if (!formData.consentNotice || !formData.consentDVS) {
          newErrors.consents = "لطفاً جهت انجام استعلام هویتی، هر دو مورد حقوقی را تایید کنید.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitStatus({ type: "", msg: "" });

    const isNonAustralian = formData.country !== "Australia";
    const result = await submitKycData({
      dob: formData.dob,
      country: formData.country,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      postcode: formData.postalCode,
      document_type: isNonAustralian ? "none" : formData.docType,
      license_number: formData.licenseNumber || null,
      card_number: formData.cardNumber || null,
      state_of_issue: formData.stateOfIssue || null,
      passport_number: formData.passportNumber || null,
      expiry_date: formData.expiryDate || null,
      consent_notice: isNonAustralian ? true : formData.consentNotice,
      consent_dvs: isNonAustralian ? true : formData.consentDVS,
    });

    if (result.error) {
      setSubmitStatus({ type: "error", msg: result.error });
    } else {
      setSubmitStatus({ type: "success", msg: "اطلاعات هویتی شما با موفقیت ثبت شد." });
      setTimeout(() => window.location.reload(), 1500);
    }

    setIsSubmitting(false);
  };

  const handleWhatsAppSubmit = async () => {
    if (!validateForm()) return;

    // Open blank window immediately (avoids popup blocker before async gap)
    const win = window.open("", "_blank");

    setIsSubmitting(true);
    setSubmitStatus({ type: "", msg: "" });

    const result = await savePersonalData({
      dob: formData.dob,
      country: formData.country,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      postcode: formData.postalCode,
    });

    if (result.error) {
      win?.close();
      setSubmitStatus({ type: "error", msg: result.error });
    } else {
      if (win) win.location.href = whatsappLink;
      setSubmitStatus({ type: "success", msg: "اطلاعات ذخیره شد. در حال انتقال به واتس‌اپ..." });
      setTimeout(() => window.location.reload(), 2500);
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

      {Number(profile?.loyalty_discount_toman ?? 0) > 0 && (
        <div className={styles.loyaltySavings}>
          <Star size={16} />
          <span>مجموع صرفه‌جویی وفاداری: <strong>{formatToman(Number(profile.loyalty_discount_toman))}</strong></span>
        </div>
      )}
      
      <div className={styles.mainContentWrapper}>
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
                  <input 
                    type="date" 
                    name="dob" 
                    value={formData.dob} 
                    onChange={handleChange} 
                    data-placeholder="dd/mm/yyyy"
                    className={`${!formData.dob ? styles.emptyDate : ""} ${errors.dob ? styles.errorBorder : ""}`} 
                  />
                  {errors.dob && <span className={styles.errorText}>{errors.dob}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label>Country <span className={styles.req}>*</span></label>
                  <SelectBox
                    value={formData.country}
                    onChange={(val) => setFormData((prev) => ({ ...prev, country: val }))}
                    placeholder="Select country..."
                    groups={[
                      {
                        label: "Common",
                        options: [
                          "Australia", "Iran", "United Arab Emirates", "Canada",
                          "Turkey", "United Kingdom", "United States",
                          "Germany", "Sweden", "New Zealand",
                        ],
                      },
                      {
                        label: "All Countries",
                        options: [
                          "Afghanistan","Albania","Algeria","Argentina","Armenia",
                          "Austria","Azerbaijan","Bahrain","Bangladesh","Belgium",
                          "Brazil","Bulgaria","China","Croatia","Cyprus",
                          "Czech Republic","Denmark","Egypt","Estonia","Finland",
                          "France","Georgia","Greece","Hong Kong","Hungary",
                          "India","Indonesia","Iraq","Ireland","Italy",
                          "Japan","Jordan","Kazakhstan","Kuwait","Kyrgyzstan",
                          "Latvia","Lebanon","Libya","Lithuania","Malaysia",
                          "Mexico","Netherlands","Nigeria","Norway","Oman",
                          "Pakistan","Philippines","Poland","Portugal","Qatar",
                          "Romania","Russia","Saudi Arabia","Serbia","Singapore",
                          "Slovakia","Slovenia","South Africa","South Korea","Spain",
                          "Sri Lanka","Switzerland","Syria","Tajikistan","Thailand",
                          "Tunisia","Turkmenistan","Ukraine","Uzbekistan",
                          "Vietnam","Yemen",
                        ],
                      },
                    ]}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Residential Address (Street) <span className={styles.req}>*</span></label>
                <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="آدرس دقیق محل سکونت (خیابان، واحد)" className={errors.address ? styles.errorBorder : ""} />
                {errors.address && <span className={styles.errorText}>{errors.address}</span>}
              </div>

              <div className={styles.row3}>
                <div className={styles.inputGroup}>
                  <label>City / Suburb <span className={styles.req}>*</span></label>
                  <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="شهر" className={errors.city ? styles.errorBorder : ""} />
                  {errors.city && <span className={styles.errorText}>{errors.city}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label>State <span className={styles.req}>*</span></label>
                  <input type="text" name="state" value={formData.state} onChange={handleChange} placeholder="ایالت" className={errors.state ? styles.errorBorder : ""} />
                  {errors.state && <span className={styles.errorText}>{errors.state}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label>Postal Code <span className={styles.req}>*</span></label>
                  <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="کد پستی" className={errors.postalCode ? styles.errorBorder : ""} />
                  {errors.postalCode && <span className={styles.errorText}>{errors.postalCode}</span>}
                </div>
              </div>

              {formData.country === "Australia" && (
                <>
                  <div className={styles.inputGroup}>
                    <label>Identity Document <span className={styles.req}>*</span></label>
                    <SelectBox
                      value={formData.docType}
                      onChange={(val) => {
                        setFormData((prev) => ({ ...prev, docType: val, stateOfIssue: "" }));
                        if (errors.docType) setErrors((prev) => ({ ...prev, docType: "" }));
                      }}
                      placeholder="Select Identity Document..."
                      labeledOptions={[
                        { value: "driver_license", label: "Australian Driver's Licence" },
                        { value: "passport",       label: "Australian Passport" },
                        { value: "none",           label: "None of the above" },
                      ]}
                      disabled={isSubmitting}
                    />
                    {errors.docType && <span className={styles.errorText}>{errors.docType}</span>}
                  </div>

                  {formData.docType === "driver_license" && (
                    <>
                      <div className={styles.inputGroup}>
                        <label>State of Issue <span className={styles.req}>*</span></label>
                        <SelectBox
                          value={formData.stateOfIssue}
                          onChange={(val) => {
                            setFormData((prev) => ({ ...prev, stateOfIssue: val }));
                            if (errors.stateOfIssue) setErrors((prev) => ({ ...prev, stateOfIssue: "" }));
                          }}
                          placeholder="Select state..."
                          labeledOptions={[
                            { value: "ACT", label: "ACT (Australian Capital Territory)" },
                            { value: "NSW", label: "NSW (New South Wales)" },
                            { value: "NT",  label: "NT (Northern Territory)" },
                            { value: "QLD", label: "QLD (Queensland)" },
                            { value: "SA",  label: "SA (South Australia)" },
                            { value: "TAS", label: "TAS (Tasmania)" },
                            { value: "VIC", label: "VIC (Victoria)" },
                            { value: "WA",  label: "WA (Western Australia)" },
                          ]}
                          disabled={isSubmitting}
                        />
                        {errors.stateOfIssue && <span className={styles.errorText}>{errors.stateOfIssue}</span>}
                      </div>
                      <div className={styles.row3}>
                        <div className={styles.inputGroup}>
                          <label>Licence Number <span className={styles.req}>*</span></label>
                          <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} placeholder="Licence number" className={errors.licenseNumber ? styles.errorBorder : ""} />
                          {errors.licenseNumber && <span className={styles.errorText}>{errors.licenseNumber}</span>}
                        </div>
                        <div className={styles.inputGroup}>
                          <label>Card Number <span className={styles.req}>*</span></label>
                          <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleChange} placeholder="Card number (front or back)" className={errors.cardNumber ? styles.errorBorder : ""} />
                          {errors.cardNumber && <span className={styles.errorText}>{errors.cardNumber}</span>}
                        </div>
                        <div className={styles.inputGroup}>
                          <label>Expiry Date <span className={styles.req}>*</span></label>
                          <input 
                            type="date" 
                            name="expiryDate" 
                            value={formData.expiryDate} 
                            onChange={handleChange} 
                            data-placeholder="dd/mm/yyyy"
                            className={`${!formData.expiryDate ? styles.emptyDate : ""} ${errors.expiryDate ? styles.errorBorder : ""}`} 
                          />
                          {errors.expiryDate && <span className={styles.errorText}>{errors.expiryDate}</span>}
                        </div>
                      </div>
                    </>
                  )}

                  {formData.docType === "passport" && (
                    <div className={styles.row}>
                      <div className={styles.inputGroup}>
                        <label>Document Number <span className={styles.req}>*</span></label>
                        <input type="text" name="passportNumber" value={formData.passportNumber} onChange={handleChange} placeholder="شماره پاسپورت" className={errors.passportNumber ? styles.errorBorder : ""} />
                        {errors.passportNumber && <span className={styles.errorText}>{errors.passportNumber}</span>}
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Expiry Date <span className={styles.req}>*</span></label>
                        <input 
                          type="date" 
                          name="expiryDate" 
                          value={formData.expiryDate} 
                          onChange={handleChange} 
                          data-placeholder="dd/mm/yyyy"
                          className={`${!formData.expiryDate ? styles.emptyDate : ""} ${errors.expiryDate ? styles.errorBorder : ""}`} 
                        />
                        {errors.expiryDate && <span className={styles.errorText}>{errors.expiryDate}</span>}
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
                      <button type="button" onClick={handleWhatsAppSubmit} disabled={isSubmitting} className={styles.whatsappBtn} style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                        <MessageCircle size={18} /> {isSubmitting ? "در حال ارسال..." : "تماس با پشتیبانی در واتس‌اپ"}
                      </button>
                    </div>
                  )}

                  {formData.docType && formData.docType !== "none" && (
                    <div className={styles.actionSection}>
                      <div className={`${styles.legalCheckboxes} ${errors.consents ? styles.errorBorder : ""}`}>
                        <label className={styles.finePrintLabel}>
                          <input type="checkbox" name="consentNotice" checked={formData.consentNotice} onChange={handleChange} />
                          <span>
                            I have read and agree to the <a href="/en/legal/privacy-policy" target="_blank">Privacy Policy</a> & <a href="/en/legal/dvs-notice" target="_blank">Verification Notice</a>. <span className={styles.req}></span>
                          </span>
                        </label>

                        <label className={styles.finePrintLabel}>
                          <input type="checkbox" name="consentDVS" checked={formData.consentDVS} onChange={handleChange} />
                          <span>
                            I consent to Zarman Exchange verifying my personal details and ID documents via official records (DVS) as per the <a href="/en/legal/dvs-consent" target="_blank">Identity Verification Consent</a>. <span className={styles.req}></span>
                          </span>
                        </label>

                        {errors.consents && <span className={styles.errorTextFa} style={{ marginTop: '8px' }}>{errors.consents}</span>}
                      </div>

                      <div className={styles.btnWrapperRight}>
                        <button type="button" onClick={handleSubmit} disabled={isSubmitting} className={cardStyles.primaryButton} style={{ padding: '14px 36px', fontSize: '14px' }}>
                          {isSubmitting ? "Submitting..." : "Submit Verification"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {formData.country !== "Australia" && (
                <div className={styles.actionSection}>
                  <div className={styles.btnWrapperRight}>
                    <button type="button" onClick={handleSubmit} disabled={isSubmitting} className={cardStyles.primaryButton} style={{ padding: '14px 36px', fontSize: '14px' }}>
                      {isSubmitting ? "Submitting..." : "Submit Verification"}
                    </button>
                  </div>
                </div>
              )}

              {submitStatus.msg && (
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