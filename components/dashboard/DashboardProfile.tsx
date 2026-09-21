"use client";

import React, { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import Stepper, { Step } from "@/components/Stepper";
import { DashboardCard, DashboardButton, DashboardPageHeader, DashboardReveal, StatusBadge, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { DashboardMotionIcon } from "@/components/dashboard/DashboardMotionIcon";
import { dashboardHref } from "@/lib/dashboard/navigation";
import { dashboardPalette } from "@/lib/dashboard/palette";
import { cn } from "@/lib/utils";
import { submitKycData, savePersonalData, updatePersonalIdentityData } from "@/app/actions/kyc.actions";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { AustralianLocationFields } from "@/components/dashboard/AustralianLocationFields";
import type { Profile as BaseProfile } from "@/app/[locale]/dashboard/dashboard.types";
import { normalizeAustralianState } from "@/lib/australian-driver-licence";
import { useLocale } from "@/context/LocaleContext";

// ایمپورت کردن دیتابیس‌های استان و شهر
import provincesData from "@/lib/provinces.json";
import citiesData from "@/lib/cities_sorted.json";

const formStepColors = [dashboardPalette.violet, dashboardPalette.sky, dashboardPalette.teal];

// تبدیل آبجکت‌ها به آرایه برای استفاده راحت‌تر در حلقه‌ها
type ProvinceRecord = {
  id: number;
  name: string;
  en_name?: string;
};

type CityRecord = {
  id: number;
  province_id: number;
  name: string;
  en_name?: string;
};

type DashboardProfileData = BaseProfile & {
  middle_name?: string | null;
  document_type?: string | null;
  license_number?: string | null;
  card_number?: string | null;
  expiry_date?: string | null;
  state_of_issue?: string | null;
  updated_at?: string | null;
};

type PersonalDataState = {
  firstName: string;
  lastName: string;
  mobileNumber: string;
};

type FormDataState = {
  dob: string;
  country: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  docType: string;
  licenseNumber: string;
  cardNumber: string;
  passportNumber: string;
  expiryDate: string;
  stateOfIssue: string;
  consentNotice: boolean;
  consentDVS: boolean;
};

const provincesArray = Object.values(provincesData) as ProvinceRecord[];
const citiesArray = Object.values(citiesData) as CityRecord[];

function buildPersonalData(profile: DashboardProfileData | null | undefined): PersonalDataState {
  return {
    firstName: profile?.first_name || "",
    lastName: profile?.last_name || "",
    mobileNumber: profile?.mobile_number || profile?.phone_number || "",
  };
}

function buildFormData(profile: DashboardProfileData | null | undefined): FormDataState {
  return {
    dob: profile?.dob || profile?.date_of_birth || "",
    country: profile?.country || "Australia",
    address: profile?.address || "",
    city: profile?.city || "",
    state: profile?.country === "Australia" ? normalizeAustralianState(profile?.state || "") : profile?.state || "",
    postalCode: profile?.postcode || profile?.post_code || "",
    docType: profile?.document_type || "",
    licenseNumber: profile?.license_number || "",
    cardNumber: profile?.card_number || "",
    passportNumber: profile?.passport_number || "",
    expiryDate: profile?.expiry_date || "",
    stateOfIssue: profile?.state_of_issue || "",
    consentNotice: false,
    consentDVS: false,
  };
}

export function DashboardProfile({ profile, motionEnabled = true }: { profile: DashboardProfileData | null; motionEnabled?: boolean }) {
  const locale = useLocale();
  const isEn = locale === "en";
  const [verificationStep, setVerificationStep] = useState(0);
  const stepTitle = React.useRef<HTMLHeadingElement>(null);
  const hasSubmittedData = Boolean(profile?.document_type && profile?.document_type !== "later" && profile?.document_type !== "");
  const isApproved = profile?.kyc_status === "approved";
  const initialPersonalData = buildPersonalData(profile);

  const [personalData, setPersonalData] = useState<PersonalDataState>(() => initialPersonalData);
  const [personalDraft, setPersonalDraft] = useState<PersonalDataState>(() => initialPersonalData);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalStatus, setPersonalStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [formData, setFormData] = useState<FormDataState>(() => buildFormData(profile));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: "success" | "error" | ""; msg: string }>({ type: "", msg: "" });
  const [manualSupportReady, setManualSupportReady] = useState(false);

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
    }).catch(() => ({ error: isEn ? "Could not save your details. Please try again." : "ذخیره اطلاعات ممکن نشد. لطفاً دوباره تلاش کنید." }));

    if (res.error) {
      setPersonalStatus({ type: "error", msg: res.error });
      setIsSavingPersonal(false);
      return;
    }

    setPersonalData(personalDraft);
    setIsEditingPersonal(false);
    setPersonalStatus({ type: "success", msg: isEn ? "Your personal information has been saved." : "اطلاعات شخصی شما ذخیره شد." });
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
          newErrors.consents = isEn
            ? "Please accept both legal consents to complete identity verification."
            : "لطفاً جهت انجام استعلام هویتی، هر دو مورد حقوقی را تایید کنید.";
        }
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length) {
      if (["firstName", "lastName", "mobileNumber", "dob"].some(key => newErrors[key])) setVerificationStep(0);
      else if (["address", "city", "state", "postalCode"].some(key => newErrors[key])) setVerificationStep(1);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (isEditingPersonal) {
      setSubmitStatus({ type: "error", msg: isEn ? "Please save or cancel personal-info edits first." : "ابتدا تغییرات اطلاعات شخصی را ذخیره یا لغو کنید." });
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
    }).catch(() => ({ error: isEn ? "Could not submit verification. Your details are still here. Please try again." : "ثبت احراز هویت ممکن نشد. اطلاعات شما حفظ شده است؛ دوباره تلاش کنید." }));

    if (result.error) {
      setSubmitStatus({ type: "error", msg: result.error });
    } else {
      setManualSupportReady(false);
      setSubmitStatus({
        type: "success",
        msg: isEn
          ? "Your information was submitted successfully. Review usually takes less than 10 minutes. Please refresh this page shortly."
          : "اطلاعات شما با موفقیت ثبت شد. بررسی معمولاً کمتر از ۱۰ دقیقه زمان می برد. لطفاً چند دقیقه دیگر صفحه را تازه سازی کنید.",
      });
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
    }).catch(() => ({ error: isEn ? "Could not save your details. Please try again." : "ذخیره اطلاعات ممکن نشد. لطفاً دوباره تلاش کنید." }));

    if (result.error) {
      win?.close();
      setSubmitStatus({ type: "error", msg: result.error });
    } else {
      if (win) win.location.href = whatsappLink;
      setManualSupportReady(true);
      setSubmitStatus({ type: "success", msg: isEn ? "Information saved. Redirecting to WhatsApp..." : "اطلاعات ذخیره شد. در حال انتقال به واتس‌اپ..." });
    }

    setIsSubmitting(false);
  };

  const whatsappMessage = isEn
    ? "Hello. I do not have an Australian driver's licence or passport. Please help me with identity verification."
    : "سلام. من گواهینامه و پاسپورت استرالیا ندارم، برای احراز هویت به من کمک کنید.";
  const whatsappLink = `https://wa.me/61497851631?text=${encodeURIComponent(whatsappMessage)}`;
  const showSubmitSuccessOnly = submitStatus.type === "success" && !manualSupportReady;
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

  const text = (en: string, fa: string) => isEn ? en : fa;
  const countryGroups = [
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
                    ];
  const fieldClass = "space-y-2";
  const labelClass = "block text-sm font-medium text-[#182027]";
  const selectClass = "[&>button]:min-h-12 [&>button]:rounded-2xl [&>button]:border-[#e9ecf0] [&>button]:bg-white [&>button]:text-[#182027]";
  const fieldError = (name: string) => errors[name] ? <p id={`profile-error-${name}`} role="alert" className="m-0 text-xs leading-relaxed text-rose-700">{isEn || name === "consents" ? errors[name] : "لطفاً این فیلد را تکمیل کنید."}</p> : null;
  const changeField = (name: keyof FormDataState, value: string) => {
    setFormData(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: "" }));
  };
  function nextVerificationStep() {
    if (isEditingPersonal) { setPersonalStatus({type:"error",msg:text("Save or cancel your personal details first.", "ابتدا اطلاعات شخصی را ذخیره یا لغو کنید.")}); return; }
    const invalid: Record<string,string> = {};
    if (verificationStep === 0) {
      if (!personalData.firstName.trim()) invalid.firstName = "First Name is required.";
      if (!personalData.lastName.trim()) invalid.lastName = "Last Name is required.";
      if (!personalData.mobileNumber.trim()) invalid.mobileNumber = "Mobile Number is required.";
      if (!formData.dob) invalid.dob = "Date of Birth is required.";
    } else {
      for (const name of ["address","city","state","postalCode"] as const) if (!formData[name].trim()) invalid[name] = "This field is required.";
    }
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setVerificationStep(value => Math.min(2,value + 1));
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => stepTitle.current?.focus({preventScroll:true}));
  }
  const input = (name: keyof FormDataState, en: string, fa: string) => <div className={fieldClass}><label className={labelClass} htmlFor={`profile-${name}`}>{text(en,fa)}</label><input id={`profile-${name}`} name={name} value={typeof formData[name] === "string" ? formData[name] : ""} onChange={handleChange} disabled={isSubmitting} className={dashboardInputClass} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `profile-error-${name}` : undefined}/>{fieldError(name)}</div>;
  const date = (name: "dob" | "expiryDate", en: string, fa: string) => <div className={fieldClass}><label className={labelClass}>{text(en,fa)}</label><CustomDatePicker value={formData[name]} onChange={value => changeField(name,value)} placeholder="dd/mm/yyyy" disabled={isSubmitting} className={cn("[&_input]:min-h-12 [&_input]:rounded-2xl [&_input]:border-[#e9ecf0] [&_input]:text-[#182027]",errors[name] && "[&_input]:border-rose-400")}/>{fieldError(name)}</div>;
  const personalSection = <section aria-label={text("Personal details", "اطلاعات شخصی")} className="space-y-5">
    <div className="flex items-center justify-between gap-3"><h2 className="m-0! text-base font-semibold text-[#182027]!">{text("Personal details", "اطلاعات شخصی")}</h2>{!isEditingPersonal && <DashboardButton tone="quiet" onClick={startPersonalEdit} disabled={isSubmitting || isSavingPersonal}>{text("Edit", "ویرایش")}</DashboardButton>}</div>
    {isEditingPersonal ? <><div className="grid gap-4 sm:grid-cols-2">{([{name:"firstName",en:"First name",fa:"نام"},{name:"lastName",en:"Last name",fa:"نام خانوادگی"},{name:"mobileNumber",en:"Mobile number",fa:"شماره همراه"}] as const).map(field => <div key={field.name} className={fieldClass}><label className={labelClass} htmlFor={`personal-${field.name}`}>{text(field.en,field.fa)}</label><input id={`personal-${field.name}`} name={field.name} value={personalDraft[field.name]} onChange={handlePersonalChange} className={dashboardInputClass} disabled={isSavingPersonal || isSubmitting} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `profile-error-${field.name}` : undefined}/>{fieldError(field.name)}</div>)}</div><div className="flex flex-wrap gap-3"><DashboardButton onClick={savePersonalEdit} disabled={isSavingPersonal || isSubmitting}>{isSavingPersonal ? text("Saving…", "در حال ذخیره…") : text("Save details", "ذخیره اطلاعات")}</DashboardButton><DashboardButton tone="secondary" onClick={cancelPersonalEdit} disabled={isSavingPersonal || isSubmitting}>{text("Cancel", "لغو")}</DashboardButton></div></> : <dl className="m-0 grid gap-5 sm:grid-cols-2">{[{name:"firstName",label:text("Full name", "نام کامل"),value:[personalData.firstName,profile?.middle_name,personalData.lastName].filter(Boolean).join(" ")},{name:"mobileNumber",label:text("Mobile number", "شماره همراه"),value:personalData.mobileNumber},{name:"email",label:text("Email", "ایمیل"),value:profile?.email}].map(field => <div key={field.name}><dt className="text-xs text-[#626a76]">{field.label}</dt><dd className="m-0 mt-1.5 break-words text-sm font-medium text-[#182027]" data-private-value><bdi>{field.value || "—"}</bdi></dd>{fieldError(field.name)}</div>)}</dl>}
    {!isEditingPersonal && fieldError("lastName")}
    {personalStatus && <p role={personalStatus.type === "error" ? "alert" : "status"} className={cn("m-0 text-sm leading-relaxed",personalStatus.type === "success" ? "text-emerald-700" : "text-rose-700")}>{personalStatus.msg}</p>}
  </section>;
  const stepLabels = isEn ? ["Your details", "Address", "Verification"] : ["اطلاعات شما", "نشانی", "احراز هویت"];

  return <div className="mx-auto w-full max-w-4xl space-y-6" dir={isEn ? "ltr" : "rtl"}>
    <DashboardPageHeader title={text("Your profile", "پروفایل شما")} description={text("Your details and identity verification, together.", "اطلاعات شما و وضعیت احراز هویت، در یک جا.")}/>
    {!isEntryStage && <DashboardCard className="p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-4"><DashboardMotionIcon name={isVerifiedStage ? "complete" : "review"} size={64} motionEnabled={motionEnabled}/><StatusBadge tone={isVerifiedStage ? "success" : "neutral"}>{isVerifiedStage ? text("Identity verified", "هویت تأیید شده") : text("In review", "در حال بررسی")}</StatusBadge></div>
      <h2 className="m-0! text-2xl! font-semibold text-[#182027]!">{isVerifiedStage ? text("You’re ready to send.", "آماده ارسال وجه هستید.") : text("We’re checking your details.", "در حال بررسی اطلاعات شما هستیم.")}</h2><p className="mb-6 mt-3 max-w-lg text-sm leading-relaxed text-[#626a76]">{isVerifiedStage ? text("Your identity is approved. You can start a new transfer.", "هویت شما تأیید شده است. می‌توانید انتقال جدیدی شروع کنید.") : text("Your verification has been submitted. No action is needed while we review it.", "درخواست احراز هویت ثبت شده است. تا پایان بررسی نیازی به اقدام شما نیست.")}</p>{isVerifiedStage ? <DashboardButton asChild><Link href={dashboardHref(locale,"transfer")}>{text("New transfer", "انتقال جدید")}</Link></DashboardButton> : <DashboardButton tone="secondary" onClick={() => window.location.reload()}><RefreshCw size={16}/>{text("Check status", "بررسی وضعیت")}</DashboardButton>}
    </DashboardCard>}
    {!isEntryStage && <DashboardCard>{personalSection}</DashboardCard>}
    {isEntryStage && <DashboardCard className="p-5 sm:p-8">
      <div className="mb-6 flex items-center gap-3"><DashboardMotionIcon name={kycStatus === "rejected" ? "attention" : "verify"} size={56} motionEnabled={motionEnabled}/><div className="min-w-0 space-y-2"><StatusBadge tone={kycStatus === "rejected" ? "attention" : "neutral"}>{kycStatus === "rejected" ? text("Details need attention", "نیازمند اصلاح اطلاعات") : text("Verify your identity", "احراز هویت")}</StatusBadge><p className="m-0 text-xs leading-relaxed text-[#626a76]">{text("Complete once, then send with confidence.", "یک بار تکمیل کنید، سپس با اطمینان ارسال کنید.")}</p></div></div>
      <Stepper currentStep={verificationStep+1} onStepChange={(next:number) => {if(!isSubmitting && next <= verificationStep + 1) setVerificationStep(next-1);}} showNavigation={false} showContent={false} motionEnabled={motionEnabled} dir={isEn ? "ltr" : "rtl"} stepListLabel={text("Identity verification steps", "مراحل احراز هویت")} className="aspect-auto! min-h-0! p-0!" stepCircleContainerClassName="max-w-none! rounded-none! shadow-none!" stepContainerClassName="mb-8! p-0!" renderStepIndicator={({step,currentStep,onStepClick}:{step:number;currentStep:number;onStepClick:(value:number)=>void}) => <li className="shrink-0"><button type="button" disabled={isSubmitting || step > currentStep} onClick={() => onStepClick(step)} aria-current={step === currentStep ? "step" : undefined} className="flex min-h-12 flex-col items-center gap-2 rounded-xl px-1 text-xs font-medium text-[#626a76] outline-none focus-visible:ring-2 focus-visible:ring-[#635bff] sm:flex-row sm:gap-3"><span className={cn("grid size-8 place-items-center rounded-full border border-[#e9ecf0] bg-[#f7f8fa] text-xs",step === currentStep && "border-2")} style={step <= currentStep ? { backgroundColor: formStepColors[step-1].soft, borderColor: formStepColors[step-1].accent, color: formStepColors[step-1].ink } : undefined}>{step < currentStep ? <Check size={14}/> : step}</span><span style={step <= currentStep ? { color: formStepColors[step-1].ink } : undefined}>{stepLabels[step-1]}</span></button></li>}>{stepLabels.map(label => <Step key={label}>{label}</Step>)}</Stepper>
      <h2 ref={stepTitle} tabIndex={-1} className="m-0! mb-3! text-2xl font-semibold leading-snug! text-[#182027]! outline-none">{stepLabels[verificationStep]}</h2>
      <p className="mb-7 mt-0 text-sm leading-relaxed text-[#626a76]">{text("Enter details in English, exactly as they appear on your documents.", "اطلاعات را به انگلیسی و دقیقاً مطابق مدارک خود وارد کنید.")}</p>
      <DashboardReveal key={verificationStep} motionEnabled={motionEnabled} className="space-y-6">
        {verificationStep === 0 && <>{personalSection}<div className="grid gap-5 border-t border-[#e9ecf0] pt-6 sm:grid-cols-2">{date("dob","Date of birth","تاریخ تولد")}<div className={fieldClass}><label className={labelClass}>{text("Country of residence", "کشور محل سکونت")}</label><SelectBox value={formData.country} onChange={value => {setFormData(previous => ({...previous,country:value,state:"",city:"",postalCode:""}));setErrors({});}} groups={countryGroups} placeholder={text("Select country", "انتخاب کشور")} disabled={isSubmitting} dir={isEn ? "ltr" : "rtl"} className={selectClass}/></div></div></>}
        {verificationStep === 1 && <>
          <p className="m-0 rounded-2xl bg-[#f7f8fa] px-4 py-3 text-sm text-[#626a76]">{text("Country", "کشور")}: <strong className="font-medium text-[#182027]">{formData.country}</strong></p>
          {input("address","Street address","نشانی خیابان")}
          <div className="grid gap-5 sm:grid-cols-3">{formData.country === "Australia" ? <AustralianLocationFields key={normalizeAustralianState(formData.state) || "Australia"} state={normalizeAustralianState(formData.state)} city={formData.city} postalCode={formData.postalCode} disabled={isSubmitting} errors={{state:errors.state,city:errors.city,postalCode:errors.postalCode}} ui={{fieldGroupClassName:fieldClass,labelClassName:labelClass,inputClassName:dashboardInputClass,errorTextClassName:"text-xs text-rose-700",hintTextClassName:"text-xs text-[#626a76]",requiredMarkClassName:"sr-only"}} onStateChange={value => {setFormData(previous => ({...previous,state:value,city:"",postalCode:""}));setErrors(previous => ({...previous,state:"",city:"",postalCode:""}));}} onCityChange={value => changeField("city",value)} onPostalCodeChange={value => changeField("postalCode",value)}/> : formData.country === "Iran" ? <><div className={fieldClass}><label className={labelClass}>{text("Province", "استان")}</label><SelectBox value={formData.state} onChange={value => {setFormData(previous => ({...previous,state:value,city:""}));setErrors(previous => ({...previous,state:"",city:""}));}} labeledOptions={iranProvinces} disabled={isSubmitting} dir={isEn ? "ltr" : "rtl"} className={selectClass} placeholder={text("Select province", "انتخاب استان")}/>{fieldError("state")}</div><div className={fieldClass}><label className={labelClass}>{text("City", "شهر")}</label><SelectBox value={formData.city} onChange={value => changeField("city",value)} labeledOptions={iranCities} disabled={!formData.state || isSubmitting} dir={isEn ? "ltr" : "rtl"} className={selectClass} placeholder={text("Select city", "انتخاب شهر")}/>{fieldError("city")}</div>{input("postalCode","Postcode","کد پستی")}</> : <>{input("state","State / province","استان")}{input("city","City / suburb","شهر / محله")}{input("postalCode","Postcode","کد پستی")}</>}</div>
        </>}
        {verificationStep === 2 && <>
          {formData.country === "Australia" ? <>
            <div className={fieldClass}><label className={labelClass}>{text("Identity document", "مدرک هویتی")}</label><SelectBox value={formData.docType} onChange={value => {setFormData(previous => ({...previous,docType:value,stateOfIssue:""}));setErrors(previous => ({...previous,docType:""}));}} placeholder={text("Select a document", "انتخاب مدرک")} labeledOptions={[{value:"driver_license",label:text("Australian driver's licence", "گواهینامه رانندگی استرالیا")},{value:"passport",label:text("Australian passport", "گذرنامه استرالیا")},{value:"none",label:text("None of the above", "هیچ‌کدام")}]} disabled={isSubmitting} dir={isEn ? "ltr" : "rtl"} className={selectClass}/>{fieldError("docType")}</div>
            {formData.docType === "driver_license" && <><div className={fieldClass}><label className={labelClass}>{text("State of issue", "ایالت صادرکننده")}</label><SelectBox value={formData.stateOfIssue} onChange={value => changeField("stateOfIssue",value)} options={["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"]} disabled={isSubmitting} dir="ltr" className={selectClass} placeholder={text("Select state", "انتخاب ایالت")}/>{fieldError("stateOfIssue")}</div><div className="grid gap-5 sm:grid-cols-2">{input("licenseNumber","Licence number","شماره گواهینامه")}{input("cardNumber","Card number","شماره کارت")}</div>{date("expiryDate","Expiry date","تاریخ انقضا")}</>}
            {formData.docType === "passport" && <div className="grid gap-5 sm:grid-cols-2">{input("passportNumber","Passport number","شماره گذرنامه")}{date("expiryDate","Expiry date","تاریخ انقضا")}</div>}
            {formData.docType === "none" && <div className="rounded-2xl bg-[#f7f8fa] p-5">{manualSupportReady && <div className="mb-4" role="status"><StatusBadge tone="attention">{text("Details saved · Verification incomplete", "اطلاعات ذخیره شد · احراز هویت تکمیل نشده")}</StatusBadge></div>}<p className="mb-5 mt-0 text-sm leading-relaxed text-[#626a76]">{manualSupportReady ? text("Continue with our support team to complete your identity verification.", "برای تکمیل احراز هویت، گفتگو با تیم پشتیبانی را ادامه دهید.") : text("Our team can help with an alternative document review.", "تیم ما برای بررسی مدارک جایگزین به شما کمک می‌کند.")}</p>{manualSupportReady ? <DashboardButton asChild><a href={whatsappLink} target="_blank" rel="noopener noreferrer">{text("Continue verification", "ادامه احراز هویت")}</a></DashboardButton> : <DashboardButton onClick={handleWhatsAppSubmit} disabled={isSubmitting}>{isSubmitting ? text("Saving…", "در حال ذخیره…") : text("Contact support on WhatsApp", "تماس با پشتیبانی در واتس‌اپ")}</DashboardButton>}</div>}
            {formData.docType && formData.docType !== "none" && <div className="space-y-4 border-t border-[#e9ecf0] pt-6" dir="ltr">
              <label className="flex items-start gap-3 text-sm leading-relaxed text-[#626a76]"><input type="checkbox" name="consentNotice" checked={formData.consentNotice} onChange={handleChange} disabled={isSubmitting} className="mt-1 size-4 shrink-0 accent-[#635bff]"/><span>I have read and agree to the <a className="text-[#5147cc] underline underline-offset-4" href={`/${locale}/legal/privacy-policy`} target="_blank" rel="noopener noreferrer">Privacy Policy</a> & <a className="text-[#5147cc] underline underline-offset-4" href={`/${locale}/legal/dvs-notice`} target="_blank" rel="noopener noreferrer">Verification Notice</a>.</span></label>
              <label className="flex items-start gap-3 text-sm leading-relaxed text-[#626a76]"><input type="checkbox" name="consentDVS" checked={formData.consentDVS} onChange={handleChange} disabled={isSubmitting} className="mt-1 size-4 shrink-0 accent-[#635bff]"/><span>I consent to Zarman Exchange verifying my personal details and ID documents via official records (DVS) as per the <a className="text-[#5147cc] underline underline-offset-4" href={`/${locale}/legal/dvs-consent`} target="_blank" rel="noopener noreferrer">Identity Verification Consent</a>.</span></label>{fieldError("consents")}
            </div>}
          </> : <div className="rounded-2xl bg-[#f7f8fa] p-5"><p className="m-0 text-sm leading-relaxed text-[#626a76]">{text("Submit your personal and address details for our team to review.", "اطلاعات شخصی و نشانی خود را برای بررسی تیم ما ارسال کنید.")}</p></div>}
        </>}
      </DashboardReveal>
      {submitStatus.type === "error" && <p role="alert" className="mt-5 text-sm leading-relaxed text-rose-700">{submitStatus.msg}</p>}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9ecf0] pt-6">{verificationStep > 0 ? <DashboardButton tone="secondary" disabled={isSubmitting} onClick={() => setVerificationStep(value => value-1)}>{text("Back", "بازگشت")}</DashboardButton> : <span className="text-xs text-[#626a76]">{text("Step 1 of 3", "مرحله ۱ از ۳")}</span>}{verificationStep < 2 ? <DashboardButton disabled={isSubmitting || isSavingPersonal} onClick={nextVerificationStep}>{text("Continue", "ادامه")}</DashboardButton> : (formData.country !== "Australia" || formData.docType !== "none") && <DashboardButton onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? text("Submitting…", "در حال ثبت…") : text("Submit verification", "ثبت احراز هویت")}</DashboardButton>}</div>
    </DashboardCard>}
  </div>;
}
