"use client";

import React, { useState, useEffect } from "react";
import { UserCircle2, ShieldCheck, AlertCircle, MessageCircle, Pencil, Check, X } from "lucide-react";
import { submitKycData, savePersonalData, updatePersonalIdentityData } from "@/app/actions/kyc.actions";
import styles from "@/styles/dashboard/DashboardProfile.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";

// ایمپورت کردن دیتابیس‌های استان و شهر
import provincesData from "@/lib/provinces.json";
import citiesData from "@/lib/cities_sorted.json";

// تبدیل آبجکت‌ها به آرایه برای استفاده راحت‌تر در حلقه‌ها
const provincesArray = Object.values(provincesData) as any[];
const citiesArray = Object.values(citiesData) as any[];

export function DashboardProfile({ profile }: { profile: any }) {
  const hasSubmittedData = Boolean(profile?.document_type && profile?.document_type !== "later" && profile?.document_type !== "");
  const isApproved = profile?.kyc_status === "approved";

  const [personalData, setPersonalData] = useState({
    firstName: "",
    lastName: "",
    mobileNumber: "",
  });
  const [personalDraft, setPersonalDraft] = useState({
    firstName: "",
    lastName: "",
    mobileNumber: "",
  });
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalStatus, setPersonalStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

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
      setPersonalData({
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        mobileNumber: profile.mobile_number || profile.phone_number || "",
      });
      setPersonalDraft({
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        mobileNumber: profile.mobile_number || profile.phone_number || "",
      });

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

  const handlePersonalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPersonalDraft((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validatePersonalFields = (values: { firstName: string; lastName: string; mobileNumber: string }) => {
    const newErrors: Record<string, string> = {};

    if (!values.firstName.trim()) newErrors.firstName = "First Name is required.";
    if (!values.lastName.trim()) newErrors.lastName = "Last Name is required.";
    if (!values.mobileNumber.trim()) newErrors.mobileNumber = "Mobile Number is required.";

    setErrors((prev) => ({
      ...prev,
      firstName: newErrors.firstName || "",
      lastName: newErrors.lastName || "",
      mobileNumber: newErrors.mobileNumber || "",
    }));

    return Object.keys(newErrors).length === 0;
  };

  const startPersonalEdit = () => {
    setPersonalStatus(null);
    setPersonalDraft(personalData);
    setIsEditingPersonal(true);
  };

  const cancelPersonalEdit = () => {
    setPersonalStatus(null);
    setPersonalDraft(personalData);
    setErrors((prev) => ({ ...prev, firstName: "", lastName: "", mobileNumber: "" }));
    setIsEditingPersonal(false);
  };

  const savePersonalEdit = async () => {
    if (!validatePersonalFields(personalDraft)) return;

    setIsSavingPersonal(true);
    setPersonalStatus(null);

    const res = await updatePersonalIdentityData({
      first_name: personalDraft.firstName,
      last_name: personalDraft.lastName,
      mobile_number: personalDraft.mobileNumber,
    });

    if (res.error) {
      setPersonalStatus({ type: "error", msg: res.error });
      setIsSavingPersonal(false);
      return;
    }

    setPersonalData(personalDraft);
    setIsEditingPersonal(false);
    setPersonalStatus({ type: "success", msg: "اطلاعات شخصی شما ذخیره شد." });
    setIsSavingPersonal(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const identitySource = isEditingPersonal ? personalDraft : personalData;
    if (!identitySource.firstName.trim()) newErrors.firstName = "First Name is required.";
    if (!identitySource.lastName.trim()) newErrors.lastName = "Last Name is required.";
    if (!identitySource.mobileNumber.trim()) newErrors.mobileNumber = "Mobile Number is required.";

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
    if (isEditingPersonal) {
      setSubmitStatus({ type: "error", msg: "ابتدا تغییرات اطلاعات شخصی را ذخیره یا لغو کنید." });
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitStatus({ type: "", msg: "" });

    const isNonAustralian = formData.country !== "Australia";
    const result = await submitKycData({
      first_name: personalData.firstName,
      last_name: personalData.lastName,
      mobile_number: personalData.mobileNumber,
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
      setSubmitStatus({ type: "success", msg: "اطلاعات شما با موفقیت ثبت شد. بررسی معمولاً کمتر از ۱۰ دقیقه زمان می برد. لطفاً چند دقیقه دیگر صفحه را تازه سازی کنید." });
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
      first_name: personalData.firstName,
      last_name: personalData.lastName,
      mobile_number: personalData.mobileNumber,
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
    }

    setIsSubmitting(false);
  };

  const whatsappLink = `https://wa.me/61497851631?text=${encodeURIComponent("سلام. من گواهینامه و پاسپورت استرالیا ندارم، برای احراز هویت به من کمک کنید.")}`;
  const showSubmitSuccessOnly = submitStatus.type === "success";
  const kycStatus = String(profile?.kyc_status ?? "").toLowerCase();
  const isPendingReview = hasSubmittedData && ["pending", "under_review"].includes(kycStatus);
  const isWaitingStage = !isApproved && (showSubmitSuccessOnly || isPendingReview);
  const isVerifiedStage = isApproved;
  const isEntryStage = !isWaitingStage && !isVerifiedStage;

  // ایجاد لیست استان‌های ایران (استفاده از نام انگلیسی هم برای دیتابیس و هم برای نمایش)
  const iranProvinces = provincesArray.map((p) => ({
    value: p.en_name || p.name,
    label: p.en_name || p.name,
    id: p.id,
  }));

  // پیدا کردن استان انتخاب‌شده برای استخراج لیست شهرهای آن
  // پیدا کردن استان انتخاب‌شده برای استخراج لیست شهرهای آن
  const selectedProvince = iranProvinces.find((p) => p.value === formData.state);

  // استخراج تمام نام‌های انگلیسی (با در نظر گرفتن دیکشنری)
  const rawCities = selectedProvince
    ? citiesArray
        .filter((c) => c.province_id === selectedProvince.id)
        .map((c) => c.en_name || c.name)
    : [];

  // استفاده از Set برای حذف خودکار نام‌های تکراری (مثل دو بار Eslamabad-e Gharb)
  const iranCities = Array.from(new Set(rawCities)).map((cityName) => ({
    value: cityName,
    label: cityName,
  }));

  return (
    <article className={`${cardStyles.panelCard} ${styles.allowOverflow}`}>
      <div className={styles.profileHeader}>
        <h2 className={`${cardStyles.panelTitle} ${styles.persianTitle}`}>
          <UserCircle2 size={24} /> اطلاعات هویتی و امنیتی
        </h2>
      </div>
      
      <div className={styles.mainContentWrapper}>
        <div className={styles.formCompact}>
          <div className={styles.personalEditBar}>
            
            <div className={styles.personalEditActions}>
              {!isEditingPersonal ? (
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={startPersonalEdit}
                  disabled={isSubmitting || isSavingPersonal}
                >
                  <Pencil size={14} />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.saveBtn}
                    onClick={savePersonalEdit}
                    disabled={isSavingPersonal || isSubmitting}
                  >
                    <Check size={14} />
                    {isSavingPersonal ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={cancelPersonalEdit}
                    disabled={isSavingPersonal || isSubmitting}
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label>First Name {profile?.middle_name && "(Middle Name)"}</label>
              <input
                type="text"
                name="firstName"
                value={isEditingPersonal ? personalDraft.firstName : personalData.firstName}
                onChange={handlePersonalChange}
                readOnly={!isEditingPersonal}
                className={`${!isEditingPersonal ? styles.readOnlyInput : ""} ${errors.firstName ? styles.errorBorder : ""}`}
              />
              {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
            </div>
            <div className={styles.inputGroup}>
              <label>Last Name</label>
              <input
                type="text"
                name="lastName"
                value={isEditingPersonal ? personalDraft.lastName : personalData.lastName}
                onChange={handlePersonalChange}
                readOnly={!isEditingPersonal}
                className={`${!isEditingPersonal ? styles.readOnlyInput : ""} ${errors.lastName ? styles.errorBorder : ""}`}
              />
              {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <input type="email" value={profile?.email || "—"} readOnly className={styles.readOnlyInput} />
            </div>
            <div className={styles.inputGroup}>
              <label>Mobile Number</label>
              <input
                type="text"
                name="mobileNumber"
                value={isEditingPersonal ? personalDraft.mobileNumber : personalData.mobileNumber}
                onChange={handlePersonalChange}
                readOnly={!isEditingPersonal}
                className={`${!isEditingPersonal ? styles.readOnlyInput : ""} ${errors.mobileNumber ? styles.errorBorder : ""}`}
              />
              {errors.mobileNumber && <span className={styles.errorText}>{errors.mobileNumber}</span>}
            </div>
          </div>

          {personalStatus && (
            <div className={personalStatus.type === "success" ? styles.successMessage : styles.errorTextFa}>
              <p style={{ textAlign: "center", width: "100%", margin: 0 }}>{personalStatus.msg}</p>
            </div>
          )}
        </div>

        <div className={styles.divider}></div>

        <div className={styles.kycSection}>
          {isEntryStage && <h3 className={styles.persianSectionTitle}>تکمیل اطلاعات</h3>}

          {isEntryStage && (
            <div className={`${styles.stageBanner} ${styles.stageBannerEntry}`}>
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <p>
                  اطلاعات را کاملاً دقیق ثبت کنید. <strong>تمام فیلدها باید فقط با حروف انگلیسی (English) تکمیل شوند.</strong>
                </p>
                <p className={styles.stageBannerSubtext}>
                  پس از ثبت اطلاعات، بررسی هویت معمولاً کمتر از ۱۰ دقیقه زمان می‌برد و پس از تأیید، پنل درخواست‌ها فعال می‌شود.
                </p>
              </div>
            </div>
          )}

          {isWaitingStage && (
            <div className={`${styles.stageBanner} ${styles.stageBannerWaiting}`}>
              <ShieldCheck size={18} aria-hidden="true" />
              <p>درخواست احراز هویت شما ثبت شد. بررسی معمولاً کمتر از ۱۰ دقیقه زمان می‌برد. لطفاً چند دقیقه دیگر صفحه را تازه‌سازی کنید.</p>
            </div>
          )}

          {isVerifiedStage && (
            <div className={`${styles.stageBanner} ${styles.stageBannerVerified}`}>
              <ShieldCheck size={18} aria-hidden="true" />
              <p>احراز هویت شما با موفقیت تأیید شد. اکنون می‌توانید از پنل درخواست‌ها استفاده کنید.</p>
            </div>
          )}

          {isEntryStage && (
            <div className={styles.formCompact}>
              
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Date of Birth <span className={styles.req}>*</span></label>
                  <CustomDatePicker
                    value={formData.dob}
                    onChange={(val: string) => {
                      setFormData((prev) => ({ ...prev, dob: val }));
                      if (errors.dob) setErrors((prev) => ({ ...prev, dob: "" }));
                    }}
                    placeholder="dd/mm/yyyy"
                    disabled={isSubmitting}
                    className={errors.dob ? styles.errorBorder : ""}
                  />
                  {errors.dob && <span className={styles.errorText}>{errors.dob}</span>}
                </div>
                <div className={styles.inputGroup}>
                  <label>Residential Country <span className={styles.req}>*</span></label>
                  <SelectBox
                    value={formData.country}
                    onChange={(val) => {
                      // در زمان تغییر کشور، فیلدهای آدرس را بازنشانی می‌کنیم
                      setFormData((prev) => ({ ...prev, country: val, state: "", city: "", postalCode: "" }));
                    }}
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
                <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Unit, Street Address" className={errors.address ? styles.errorBorder : ""} />
                {errors.address && <span className={styles.errorText}>{errors.address}</span>}
              </div>

              <div className={styles.row3}>
                <div className={styles.inputGroup}>
                  <label>State/Province <span className={styles.req}>*</span></label>
                  {formData.country === "Iran" ? (
                    <SelectBox
                      value={formData.state}
                      onChange={(val) => {
                        setFormData((prev) => ({ 
                          ...prev, 
                          state: val, 
                          city: "" // پاک کردن شهر با تغییر استان
                        }));
                        if (errors.state) setErrors((prev) => ({ ...prev, state: "" }));
                        if (errors.city) setErrors((prev) => ({ ...prev, city: "" }));
                      }}
                      placeholder="Select Province..."
                      labeledOptions={iranProvinces}
                      disabled={isSubmitting}
                    />
                  ) : (
                    <input type="text" name="state" value={formData.state} onChange={handleChange} placeholder="State" className={errors.state ? styles.errorBorder : ""} disabled={isSubmitting} />
                  )}
                  {errors.state && <span className={styles.errorText}>{errors.state}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <label>City / Suburb <span className={styles.req}>*</span></label>
                  {formData.country === "Iran" ? (
                    <SelectBox
                      value={formData.city}
                      onChange={(val) => {
                        setFormData((prev) => ({ ...prev, city: val }));
                        if (errors.city) setErrors((prev) => ({ ...prev, city: "" }));
                      }}
                      placeholder="Select City..."
                      labeledOptions={iranCities}
                      disabled={!formData.state || isSubmitting} // تا استان انتخاب نشود غیرفعال است
                    />
                  ) : (
                    <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="City / Suburb" className={errors.city ? styles.errorBorder : ""} disabled={isSubmitting} />
                  )}
                  {errors.city && <span className={styles.errorText}>{errors.city}</span>}
                </div>
                
                <div className={styles.inputGroup}>
                  <label>Postal Code <span className={styles.req}>*</span></label>
                  <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="Postal code" className={errors.postalCode ? styles.errorBorder : ""} disabled={isSubmitting} />
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
                          <CustomDatePicker
                            value={formData.expiryDate}
                            onChange={(val: string) => {
                              setFormData((prev) => ({ ...prev, expiryDate: val }));
                              if (errors.expiryDate) setErrors((prev) => ({ ...prev, expiryDate: "" }));
                            }}
                            placeholder="dd/mm/yyyy"
                            disabled={isSubmitting}
                            className={errors.expiryDate ? styles.errorBorder : ""}
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
                        <input type="text" name="passportNumber" value={formData.passportNumber} onChange={handleChange} placeholder="Passport Number" className={errors.passportNumber ? styles.errorBorder : ""} />
                        {errors.passportNumber && <span className={styles.errorText}>{errors.passportNumber}</span>}
                      </div>
                      <div className={styles.inputGroup}>
                        <label>Expiry Date <span className={styles.req}>*</span></label>
                        <CustomDatePicker
                          value={formData.expiryDate}
                          onChange={(val: string) => {
                            setFormData((prev) => ({ ...prev, expiryDate: val }));
                            if (errors.expiryDate) setErrors((prev) => ({ ...prev, expiryDate: "" }));
                          }}
                          placeholder="dd/mm/yyyy"
                          disabled={isSubmitting}
                          className={errors.expiryDate ? styles.errorBorder : ""}
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
                          {isSubmitting ? <><span className={cardStyles.spinner} aria-hidden="true" /> Submitting...</> : "Submit Verification"}
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
                      {isSubmitting ? <><span className={cardStyles.spinner} aria-hidden="true" /> Submitting...</> : "Submit Verification"}
                    </button>
                  </div>
                </div>
              )}

              {submitStatus.type === "error" && submitStatus.msg && (
                <div className={styles.errorTextFa} style={{ marginTop: 12, padding: '0 24px' }}>
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