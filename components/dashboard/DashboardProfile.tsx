"use client";

import React, { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import Stepper, { Step } from "@/components/Stepper";
import { DashboardMagicCard, DashboardButton, DashboardPageHeader, DashboardReveal, StatusBadge, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { DashboardLottieScene } from "@/components/dashboard/DashboardLottieScene";
import { dashboardHref } from "@/lib/dashboard/navigation";
import { dashboardPalette } from "@/lib/dashboard/palette";
import { cn } from "@/lib/utils";
import { submitKycData, updatePersonalIdentityData } from "@/app/actions/kyc.actions";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { AustralianLocationFields } from "@/components/dashboard/AustralianLocationFields";
import type { Profile as BaseProfile } from "@/app/[locale]/dashboard/dashboard.types";
import { normalizeAustralianState } from "@/lib/australian-driver-licence";
import { useLocale } from "@/context/LocaleContext";
import { KycDocumentEvidence } from "@/components/dashboard/KycDocumentEvidence";
import { emptyKycEvidence, validateKycEvidence, type KycEvidenceDraft } from "@/lib/kyc/evidence";
import flow from "@/styles/dashboard/DashboardProfileFlow.module.css";

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
  const [evidence, setEvidence] = useState<KycEvidenceDraft>(emptyKycEvidence);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

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
    }).catch(() => ({ error: (isEntryStage || isEn) ? "Could not save your details. Please try again." : "ذخیره اطلاعات ممکن نشد. لطفاً دوباره تلاش کنید." }));

    if (res.error) {
      setPersonalStatus({ type: "error", msg: res.error });
      setIsSavingPersonal(false);
      return;
    }

    setPersonalData(personalDraft);
    setIsEditingPersonal(false);
    setPersonalStatus({ type: "success", msg: (isEntryStage || isEn) ? "Your personal information has been saved." : "اطلاعات شخصی شما ذخیره شد." });
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


    Object.assign(newErrors, validateKycEvidence(formData.docType, evidence));
    if (formData.docType === "driver_license") {
      if (!formData.licenseNumber) newErrors.licenseNumber = "Licence number is required.";
      if (!formData.cardNumber) newErrors.cardNumber = "Card number is required.";
      if (!formData.stateOfIssue) newErrors.stateOfIssue = "State of issue is required.";
    }
    if (formData.docType === "passport" && !formData.passportNumber) newErrors.passportNumber = "Passport number is required.";
    if (["driver_license","passport","foreign_passport"].includes(formData.docType) && !formData.expiryDate) newErrors.expiryDate = "Expiry date is required.";
    if (!formData.consentNotice || !formData.consentDVS) newErrors.consents = "Please accept both verification consents.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length) {
      if (["firstName", "lastName", "mobileNumber", "dob"].some(key => newErrors[key])) setVerificationStep(0);
      else if (["address", "city", "state", "postalCode"].some(key => newErrors[key])) setVerificationStep(1);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (isEditingPersonal) {
      setSubmitStatus({ type: "error", msg: (isEntryStage || isEn) ? "Please save or cancel personal-info edits first." : "ابتدا تغییرات اطلاعات شخصی را ذخیره یا لغو کنید." });
      return;
    }

    if (uploadingEvidence || !validateForm()) return;

    setIsSubmitting(true);
    setSubmitStatus({ type: "", msg: "" });

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
      document_type: formData.docType,
      evidence,
      license_number: formData.licenseNumber || null,
      card_number: formData.cardNumber || null,
      state_of_issue: formData.stateOfIssue || null,
      passport_number: formData.passportNumber || null,
      expiry_date: formData.expiryDate || null,
      consent_notice: formData.consentNotice,
      consent_dvs: formData.consentDVS,
    }).catch(() => ({ error: (isEntryStage || isEn) ? "Could not submit verification. Your details are still here. Please try again." : "ثبت احراز هویت ممکن نشد. اطلاعات شما حفظ شده است؛ دوباره تلاش کنید." }));

    if (result.error) {
      setSubmitStatus({ type: "error", msg: result.error });
    } else {

      setSubmitStatus({
        type: "success",
        msg: isEn
          ? "Your information was submitted successfully. Review usually takes less than 10 minutes. Please refresh this page shortly."
          : "اطلاعات شما با موفقیت ثبت شد. بررسی معمولاً کمتر از ۱۰ دقیقه زمان می برد. لطفاً چند دقیقه دیگر صفحه را تازه سازی کنید.",
      });
    }

    setIsSubmitting(false);
  };

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
  const formText = (en: string, fa: string) => isEntryStage ? en : text(en, fa);
  const fieldClass = "min-w-0 space-y-2";
  const labelClass = "block text-sm font-medium text-[#182027]";
  const selectClass = flow.control;
  const fieldError = (name: string) => errors[name] ? <p id={`profile-error-${name}`} role="alert" className="m-0 text-xs leading-relaxed text-rose-700">{isEntryStage || isEn || name === "consents" ? errors[name] : "لطفاً این فیلد را تکمیل کنید."}</p> : null;
  const changeField = (name: keyof FormDataState, value: string) => {
    setFormData(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: "" }));
  };
  function nextVerificationStep() {
    if (isEditingPersonal) { setPersonalStatus({type:"error",msg:formText("Save or cancel your personal details first.", "ابتدا اطلاعات شخصی را ذخیره یا لغو کنید.")}); return; }
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
  const input = (name: keyof FormDataState, en: string, fa: string, placeholder?: string) => <div className={fieldClass}><label className={labelClass} htmlFor={`profile-${name}`}>{formText(en,fa)}</label><input id={`profile-${name}`} name={name} placeholder={placeholder} value={typeof formData[name] === "string" ? formData[name] : ""} onChange={handleChange} disabled={isSubmitting || uploadingEvidence} className={dashboardInputClass} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `profile-error-${name}` : undefined}/>{fieldError(name)}</div>;
  const date = (name: "dob" | "expiryDate", en: string, fa: string) => <div className={fieldClass}><label className={labelClass}>{formText(en,fa)}</label><CustomDatePicker value={formData[name]} onChange={value => changeField(name,value)} placeholder="dd/mm/yyyy" disabled={isSubmitting || uploadingEvidence} className={cn(selectClass,errors[name] && "[&>button]:border-rose-400!")}/>{fieldError(name)}</div>;
  const personalSection = <section aria-label={formText("Personal Information", "مشخصات فردی")} className="space-y-5">
    <div className="flex items-center justify-between gap-3"><h2 className="m-0! text-lg! font-semibold leading-7! text-[#302346]!">{formText("Personal Information", "مشخصات فردی")}</h2>{!isEditingPersonal && <DashboardButton tone="secondary" onClick={startPersonalEdit} disabled={isSubmitting || isSavingPersonal}>{formText("Edit", "ویرایش")}</DashboardButton>}</div>
    {isEditingPersonal ? <><div className="grid gap-4 sm:grid-cols-2">{([{name:"firstName",en:"First name",fa:"نام"},{name:"lastName",en:"Last name",fa:"نام خانوادگی"},{name:"mobileNumber",en:"Mobile number",fa:"شماره همراه"}] as const).map(field => <div key={field.name} className={fieldClass}><label className={labelClass} htmlFor={`personal-${field.name}`}>{formText(field.en,field.fa)}</label><input id={`personal-${field.name}`} name={field.name} value={personalDraft[field.name]} onChange={handlePersonalChange} className={dashboardInputClass} disabled={isSavingPersonal || isSubmitting} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `profile-error-${field.name}` : undefined}/>{fieldError(field.name)}</div>)}</div><div className="flex flex-wrap gap-3"><DashboardButton onClick={savePersonalEdit} disabled={isSavingPersonal || isSubmitting}>{isSavingPersonal ? formText("Saving…", "در حال ذخیره…") : formText("Save details", "ذخیره اطلاعات")}</DashboardButton><DashboardButton tone="secondary" onClick={cancelPersonalEdit} disabled={isSavingPersonal || isSubmitting}>{formText("Cancel", "لغو")}</DashboardButton></div></> : <dl className="m-0 grid gap-3 sm:grid-cols-2">{[{name:"firstName",label:formText("Full name", "نام و نام خانوادگی"),value:[personalData.firstName,profile?.middle_name,personalData.lastName].filter(Boolean).join(" ")},{name:"mobileNumber",label:formText("Mobile number", "شماره همراه"),value:personalData.mobileNumber},{name:"email",label:formText("Email address", "ایمیل"),value:profile?.email}].map(field => <div key={field.name} className={cn("min-w-0 rounded-2xl border border-[#e4ddef] bg-white/75 px-4 py-3.5",field.name === "email" && "sm:col-span-2")}><dt className="text-xs leading-5 text-[#6a6279]">{field.label}</dt><dd className="m-0 mt-1.5 text-sm font-semibold leading-6 text-[#302346] [overflow-wrap:anywhere]" data-private-value><bdi>{field.value || "—"}</bdi></dd>{fieldError(field.name)}</div>)}</dl>}
    {!isEditingPersonal && fieldError("lastName")}
    {personalStatus && <p role={personalStatus.type === "error" ? "alert" : "status"} className={cn("m-0 text-sm leading-relaxed",personalStatus.type === "success" ? "text-emerald-700" : "text-rose-700")}>{personalStatus.msg}</p>}
  </section>;
  const stepLabels = ["Personal Details", "Residential Address", "Document Upload"];

  return <div className={cn(flow.profile,"min-w-0 space-y-6 sm:space-y-7")} dir={isEn ? "ltr" : "rtl"}>
    <DashboardPageHeader title={text("Your Account", "حساب کاربری")} description={text("Manage your personal details and verification status in one place.", "مدیریت اطلاعات فردی و بررسی وضعیت تأیید حساب.")}/>
    {!isEntryStage && <DashboardMagicCard tone={isVerifiedStage ? "emerald" : "amber"} motionEnabled={motionEnabled}>
      <div className="mb-5 flex items-center gap-4"><DashboardLottieScene name={isVerifiedStage ? "identity-approved" : "compliance-review"} size={72} motionEnabled={motionEnabled}/><StatusBadge tone={isVerifiedStage ? "success" : "neutral"}>{isVerifiedStage ? text("Identity verified", "هویت تأیید شده") : text("In review", "در حال بررسی")}</StatusBadge></div>
      <h2 className="m-0! text-2xl! font-semibold text-[#182027]!">{isVerifiedStage ? text("You’re ready to send.", "آماده ارسال وجه هستید.") : text("We’re checking your details.", "در حال بررسی اطلاعات شما هستیم.")}</h2><p className="mb-6 mt-3 max-w-lg text-sm leading-relaxed text-[#626a76]">{isVerifiedStage ? text("Your identity is approved. You can start a new transfer.", "هویت شما تأیید شده است. می‌توانید انتقال جدیدی شروع کنید.") : text("Your verification has been submitted. No action is needed while we review it.", "درخواست احراز هویت ثبت شده است. تا پایان بررسی نیازی به اقدام شما نیست.")}</p>{isVerifiedStage ? <DashboardButton asChild><Link href={dashboardHref(locale,"transfer")}>{text("New transfer", "انتقال جدید")}</Link></DashboardButton> : <DashboardButton tone="secondary" onClick={() => window.location.reload()}><RefreshCw size={16}/>{text("Check status", "بررسی وضعیت")}</DashboardButton>}
    </DashboardMagicCard>}
    {!isEntryStage && <DashboardMagicCard tone="violet" motionEnabled={motionEnabled}>{personalSection}</DashboardMagicCard>}
    {isEntryStage && <DashboardMagicCard tone="violet" motionEnabled={motionEnabled} pointerEffect={false} contentClassName="p-0 sm:p-0" data-profile-verification>
      <header className="flex min-w-0 items-start justify-between gap-4 px-5 py-5 sm:px-7 sm:py-6"><div className="min-w-0"><h2 className="m-0! text-lg! font-semibold leading-7! text-[#302346]!">{text("Identity Verification", "تأیید هویت")}</h2><p className="mb-0 mt-2 max-w-xl text-sm leading-7 text-[#6a6279]">{text("Verify your account once and transfer money with peace of mind.", "حساب خود را یک‌بار تأیید کنید و با خیالی آسوده به انتقال وجه بپردازید.")}</p>{kycStatus === "rejected" && <div className="mt-3"><StatusBadge tone="attention">{text("Details need attention", "نیازمند اصلاح اطلاعات")}</StatusBadge></div>}</div><span className="grid size-[68px] shrink-0 place-items-center"><DashboardLottieScene name="identity-fingerprint" size={68} motionEnabled={motionEnabled}/></span></header>
      <div className={flow.form} lang="en" dir="ltr" data-profile-stepper>
      <div className="border-y border-[#e4ddef] bg-[#faf8ff]/80 px-4 py-5 sm:px-7 sm:py-6">
        <Stepper currentStep={verificationStep+1} onStepChange={(next:number) => {if(!isSubmitting && !uploadingEvidence && next <= verificationStep + 1) setVerificationStep(next-1);}} showNavigation={false} showContent={false} motionEnabled={motionEnabled} dir="ltr" stepListLabel={formText("Identity verification steps", "مراحل احراز هویت")} className={cn(flow.stepper,"aspect-auto! min-h-0! p-0!")} stepCircleContainerClassName="max-w-none! rounded-none! border-0! bg-transparent! shadow-none!" stepContainerClassName="p-0!" renderStepIndicator={({step,currentStep,onStepClick}:{step:number;currentStep:number;onStepClick:(value:number)=>void}) => <li className={flow.stepItem}><button type="button" disabled={isSubmitting || step > currentStep} onClick={() => onStepClick(step)} aria-current={step === currentStep ? "step" : undefined} className={flow.stepButton}><span className={cn("grid size-9 shrink-0 place-items-center rounded-full border border-[#ded8e9] bg-white text-sm",step === currentStep && "border-2")} style={step <= currentStep ? { backgroundColor: formStepColors[step-1].soft, borderColor: formStepColors[step-1].accent, color: formStepColors[step-1].ink } : undefined}>{step < currentStep ? <Check size={16} aria-hidden="true"/> : step}</span><span className={flow.stepLabel} style={step <= currentStep ? { color: formStepColors[step-1].ink } : undefined}>{stepLabels[step-1]}</span></button></li>}>{stepLabels.map(label => <Step key={label}>{label}</Step>)}</Stepper>
      </div>
      <div className="px-5 py-6 sm:px-7 sm:py-7">
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#eddbb3] bg-[#fff8e8] px-4 py-3.5"><DashboardLottieScene name="alert" size={40} motionEnabled={motionEnabled}/><p className="m-0 self-center text-sm font-bold leading-7 text-[#765018]">Please enter your details in <strong className="font-black">English</strong>, exactly as they appear on your ID documents.</p></div>
      <h2 ref={stepTitle} tabIndex={-1} className={verificationStep === 0 ? "sr-only" : "m-0! mb-5! text-lg! font-semibold leading-7! text-[#302346]! outline-none"}>{stepLabels[verificationStep]}</h2>
      <DashboardReveal key={verificationStep} motionEnabled={motionEnabled} className="space-y-6">
        {verificationStep === 0 && <>{personalSection}<div className="grid gap-5 border-t border-[#e4ddef] pt-6 sm:grid-cols-2">{date("dob","Date of birth","تاریخ تولد")}</div></>}
        {verificationStep === 1 && <>
          <div className={fieldClass}><label className={labelClass}>{formText("Country of residence", "کشور محل اقامت")}</label><SelectBox value={formData.country} onChange={value => {if(value === formData.country) return;setFormData(previous => ({...previous,country:value,state:"",city:"",postalCode:""}));setErrors({});}} groups={countryGroups} placeholder={formText("Select country", "انتخاب کشور")} disabled={isSubmitting || uploadingEvidence} dir="ltr" className={selectClass}/></div>
          {input("address","Street address","نشانی خیابان","Unit number, alley, and street name or number")}
          <div className={flow.addressGrid}>{formData.country === "Australia" ? <AustralianLocationFields key={normalizeAustralianState(formData.state) || "Australia"} state={normalizeAustralianState(formData.state)} city={formData.city} postalCode={formData.postalCode} disabled={isSubmitting || uploadingEvidence} errors={{state:errors.state,city:errors.city,postalCode:errors.postalCode}} ui={{fieldGroupClassName:fieldClass,labelClassName:labelClass,inputClassName:dashboardInputClass,selectClassName:selectClass,stateLabel:"State / Territory",postcodeLabel:"Postcode",errorTextClassName:"text-xs text-rose-700",hintTextClassName:"text-xs text-[#626a76]",requiredMarkClassName:"sr-only"}} onStateChange={value => {setFormData(previous => ({...previous,state:value,city:"",postalCode:""}));setErrors(previous => ({...previous,state:"",city:"",postalCode:""}));}} onCityChange={value => changeField("city",value)} onPostalCodeChange={value => changeField("postalCode",value)}/> : formData.country === "Iran" ? <><div className={fieldClass}><label className={labelClass}>{formText("Province", "استان")}</label><SelectBox value={formData.state} onChange={value => {setFormData(previous => ({...previous,state:value,city:""}));setErrors(previous => ({...previous,state:"",city:""}));}} labeledOptions={iranProvinces} disabled={isSubmitting || uploadingEvidence} dir="ltr" className={selectClass} placeholder={formText("Select province", "انتخاب استان")}/>{fieldError("state")}</div><div className={fieldClass}><label className={labelClass}>{formText("City", "شهر")}</label><SelectBox value={formData.city} onChange={value => changeField("city",value)} labeledOptions={iranCities} disabled={!formData.state || isSubmitting} dir="ltr" className={selectClass} placeholder={formText("Select city", "انتخاب شهر")}/>{fieldError("city")}</div>{input("postalCode","Postcode","کد پستی")}</> : <>{input("state","State / province","استان")}{input("city","City / suburb","شهر / محله")}{input("postalCode","Postcode","کد پستی")}</>}</div>
        </>}

        {verificationStep === 2 && <>
          <KycDocumentEvidence documentType={formData.docType} evidence={evidence} errors={errors}
            disabled={isSubmitting || uploadingEvidence} motionEnabled={motionEnabled} onBusyChange={setUploadingEvidence}
            onChange={value => { setEvidence(value); setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith("evidence-") && !["addressType","addressDate","documentNumber","documentIssuer"].includes(key)))); }}
            onDocumentTypeChange={value => {
              if (value === formData.docType) return;
              setFormData(previous => ({...previous, docType:value, licenseNumber:"", cardNumber:"", passportNumber:"", expiryDate:"", stateOfIssue:""}));
              setEvidence(emptyKycEvidence()); setErrors({});
            }}>
            {formData.docType === "driver_license" && <>
              <div className={fieldClass}><label className={labelClass}>State of issue</label><SelectBox value={formData.stateOfIssue} onChange={value => changeField("stateOfIssue",value)} options={["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"]} disabled={isSubmitting || uploadingEvidence} dir="ltr" className={selectClass} placeholder="Select state"/>{fieldError("stateOfIssue")}</div>
              <div className="grid gap-5 sm:grid-cols-2">{input("licenseNumber","Licence number","Licence number")}{input("cardNumber","Card number","Card number")}</div>
            </>}
            {formData.docType === "passport" && input("passportNumber","Passport number","Passport number")}
            {["driver_license","passport","foreign_passport"].includes(formData.docType) && date("expiryDate","Expiry date","Expiry date")}
            {["photo_id","proof_of_age","national_id","concession_card"].includes(formData.docType) && date("expiryDate","Expiry date (if shown on the card)","Expiry date (if shown on the card)")}
          </KycDocumentEvidence>
          <div className="space-y-4 border-t border-[#e9ecf0] pt-6">
            <label className="flex items-start gap-3 text-sm leading-relaxed text-[#626a76]"><input type="checkbox" name="consentNotice" checked={formData.consentNotice} onChange={handleChange} disabled={isSubmitting || uploadingEvidence} className="mt-1 size-4 shrink-0 accent-[#635bff]"/><span>I have read and agree to the <a className="text-[#5147cc] underline underline-offset-4" href={"/" + locale + "/legal/privacy-policy"} target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a className="text-[#5147cc] underline underline-offset-4" href={"/" + locale + "/legal/dvs-notice"} target="_blank" rel="noopener noreferrer">Verification Notice</a>, including the collection and secure review of my uploaded documents.</span></label>
            <label className="flex items-start gap-3 text-sm leading-relaxed text-[#626a76]"><input type="checkbox" name="consentDVS" checked={formData.consentDVS} onChange={handleChange} disabled={isSubmitting || uploadingEvidence} className="mt-1 size-4 shrink-0 accent-[#635bff]"/><span>I confirm that these are my documents and I am authorised to provide this information. I consent to Zarman Exchange checking my details with document issuers or official records, using authorised verification providers (including DVS where available), as described in the <a className="text-[#5147cc] underline underline-offset-4" href={"/" + locale + "/legal/dvs-consent"} target="_blank" rel="noopener noreferrer">Identity Verification Consent</a>.</span></label>
            {fieldError("consents")}
          </div>
        </>}
      </DashboardReveal>
      {submitStatus.type === "error" && <p role="alert" className="mt-5 text-sm leading-relaxed text-rose-700">{submitStatus.msg}</p>}
      </div>
      <footer className="flex flex-col gap-4 border-t border-[#e4ddef] bg-white/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
        <span className="text-xs font-medium text-[#6a6279]" aria-live="polite">{`Step ${verificationStep + 1} of 3`}</span>
        <div className="flex w-full gap-3 sm:w-auto">{verificationStep > 0 && <DashboardButton tone="secondary" className="flex-1 sm:flex-none" disabled={isSubmitting || uploadingEvidence} onClick={() => setVerificationStep(value => value-1)}>{formText("Back", "بازگشت")}</DashboardButton>}{verificationStep < 2 ? <DashboardButton className="flex-1 sm:min-w-36 sm:flex-none" disabled={isSubmitting || isSavingPersonal} onClick={nextVerificationStep}>{formText("Next Step", "مرحله بعد")}</DashboardButton> : <DashboardButton className="flex-1 sm:min-w-36 sm:flex-none" onClick={handleSubmit} disabled={isSubmitting || uploadingEvidence}>{isSubmitting ? formText("Submitting…", "در حال ثبت…") : formText("Submit verification", "ثبت احراز هویت")}</DashboardButton>}</div>
      </footer>
      </div>
    </DashboardMagicCard>}
  </div>;
}
