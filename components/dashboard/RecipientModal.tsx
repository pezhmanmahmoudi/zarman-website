"use client";

import { useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, CircleAlert, X } from "lucide-react";
import AnimatedStepper, { Step } from "@/components/Stepper";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DashboardButton as Button, dashboardInputClass } from "./dashboard-ui";
import { createRecipient } from "@/app/actions/transaction.actions";
import type { Recipient, RecipientDirection, RecipientRelationship, Profile } from "@/app/[locale]/dashboard/dashboard.types";
import { normalizeRecipientDigits, normalizeRecipientInput } from "@/lib/dashboard/recipient-input";
import { cn } from "@/lib/utils";
import { dashboardPalette } from "@/lib/dashboard/palette";

const formStepColors = [dashboardPalette.violet, dashboardPalette.sky];

const iranianBanks = ["Ayandeh Bank", "BlueBank", "Dey Bank", "Eghtesad Novin Bank", "Gardeshgari Bank", "Ghavamin Bank", "Hekmat Bank", "Karafarin Bank", "Keshavarzi Bank", "Maskan Bank", "Parsian Bank", "Pasargad Bank", "Post Bank of Iran", "Refah Bank", "Saman Bank", "Sanat Va Maadan Bank", "Sarmayeh Bank", "Shahr Bank", "Sina Bank", "Tejarat Bank", "Tosee Credit Institution", "Tosee Saderat Bank", "Tosee Taavon Bank", "Bank Iran"];
const relationships: [RecipientRelationship, string, string][] = [["self", "Myself", "خودم"], ["family", "Family", "خانواده"], ["friend", "Friend", "دوست"], ["business", "Business", "کاری"], ["other", "Other", "سایر"]];
const fieldNames: Record<string, string> = {
  full_name: "name", account_name: "name", label: "name", direction: "country", shaba_number: "shaba",
  residential_address: "address", irt_address: "address", residential_city: "city", irt_city: "city",
  residential_state: "state", irt_state: "state", residential_postcode: "postcode", irt_postcode: "postcode",
  residential_country: "residential_country", irt_country: "residential_country", recipient_phone: "phone", irt_phone: "phone", recipient_email: "email",
};
const inputClass = dashboardInputClass;
type Props = { direction: RecipientDirection; mode?: "standard" | "self_destination"; profile?: Profile | null; locale?: "fa" | "en"; motionEnabled?: boolean; lockDirection?: boolean; onClose: () => void; onCreated: (recipient: Recipient) => void };

export function RecipientModal({ direction, mode = "standard", profile, locale = "en", motionEnabled = true, lockDirection = false, onClose, onCreated }: Props) {
  const fa = locale === "fa", own = mode === "self_destination", reducedMotion = useReducedMotion();
  const text = (en: string, persian: string) => fa ? persian : en;
  const animate = motionEnabled && !reducedMotion;
  const [step, setStep] = useState(1), [country, setCountry] = useState(direction);
  const [name, setName] = useState(own ? profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") : "");
  const [relationship, setRelationship] = useState<RecipientRelationship | "">(own ? "self" : "");
  const [drafts, setDrafts] = useState<Record<RecipientDirection, Record<string, string>>>({ aud: { residential_country: "Australia" }, irt: { residential_country: "Iran" } });
  const [errors, setErrors] = useState<Record<string, string>>({}), [error, setError] = useState("");
  const [saving, setSaving] = useState(false), [dirty, setDirty] = useState(false), [discarding, setDiscarding] = useState(false);
  const savingRef = useRef(false), heading = useRef<HTMLHeadingElement>(null), scroll = useRef<HTMLDivElement>(null), opener = useRef<HTMLElement | null>(null), closeButton = useRef<HTMLButtonElement>(null);
  const aud = country === "aud", values = drafts[country];
  const profileContact = {
    address: [profile?.address || profile?.address_line1, profile?.address_line2].filter(Boolean).join(", "),
    city: String(profile?.suburb || profile?.city || ""), state: String(profile?.state || ""),
    postcode: String(profile?.postcode || profile?.post_code || ""), residential_country: String(profile?.country || ""),
    phone: String(profile?.mobile_number || profile?.phone_number || profile?.telephone || ""), email: String(profile?.email || ""),
  };
  const contactValue = (key: keyof typeof profileContact) => own ? profileContact[key] : values[key] || "";
  const focusField = (key: string) => requestAnimationFrame(() => { const element = document.getElementById(`recipient-${key}`); element?.focus(); element?.scrollIntoView({ block: "nearest" }); });
  function set(key: string, value: string) {
    setDirty(true); setError(""); setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
    if (key === "name") setName(value);
    else if (key === "relationship") setRelationship(value as RecipientRelationship);
    else setDrafts(previous => ({ ...previous, [country]: { ...previous[country], [key]: value } }));
  }
  function move(next: number) {
    if (savingRef.current) return;
    setStep(next); setError(""); setDiscarding(false);
    requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = 0; heading.current?.focus(); });
  }
  function requestClose() {
    if (savingRef.current) return;
    if (!dirty) { onClose(); return; }
    setDiscarding(true); requestAnimationFrame(() => document.getElementById("recipient-keep-editing")?.focus());
  }
  function saveError(message: string) {
    setError(message);
    requestAnimationFrame(() => document.getElementById("recipient-save-error")?.focus());
  }
  function localError(message: string) {
    if (!fa) return message;
    const translations: Record<string, string> = {
      "This field is required.": "این فیلد الزامی است.",
      "Enter a valid Iranian Shaba number.": "شماره شبا معتبر نیست. لطفاً آن را بررسی کنید.",
      "Shaba number must start with IR followed by 24 digits.": "شماره شبا باید شامل IR و ۲۴ رقم باشد.",
      "BSB must contain exactly 6 digits.": "کد BSB باید دقیقاً ۶ رقم باشد.",
      "Account number must contain 5 to 12 digits.": "شماره حساب باید بین ۵ تا ۱۲ رقم باشد.",
      "Card number must contain exactly 16 digits.": "شماره کارت باید دقیقاً ۱۶ رقم باشد.",
      "Australian postcode must contain exactly 4 digits.": "کد پستی استرالیا باید دقیقاً ۴ رقم باشد.",
      "Enter a valid recipient email address.": "نشانی ایمیل معتبر وارد کنید.",
      "Enter a valid recipient phone number.": "شماره تماس معتبر وارد کنید.",
      "Bank branch city must be 120 characters or fewer.": "نام شهر شعبه بانک باید حداکثر ۱۲۰ نویسه باشد.",
      "A recipient field is too long.": "متن واردشده بیش از حد طولانی است.",
      "Choose a valid recipient relationship.": "نسبت خود با گیرنده را انتخاب کنید.",
    };
    return translations[message] || "اطلاعات این فیلد را بررسی کنید.";
  }
  function showFieldErrors(fieldErrors: Record<string, string>) {
    const mapped: Record<string, string> = {};
    for (const [key, message] of Object.entries(fieldErrors)) mapped[fieldNames[key] || key] = localError(message);
    const first = Object.keys(mapped)[0];
    setErrors(mapped); setError(text("Please check the highlighted details.", "لطفاً اطلاعات مشخص‌شده را بررسی کنید."));
    if (first) { setStep(["name", "country", "relationship"].includes(first) ? 1 : 2); focusField(first); }
  }
  function validateBasic() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = localError("This field is required.");
    else if (name.trim().length > 250) next.name = localError("A recipient field is too long.");
    if (!relationships.some(([value]) => value === relationship)) next.relationship = localError("Choose a valid recipient relationship.");
    if (Object.keys(next).length) { setErrors(next); focusField(Object.keys(next)[0]); return false; }
    return true;
  }
  function payload() {
    const bank = (values.bank_name || "").trim();
    const common = { direction: country, label: `${name.trim()} — ${bank}`.slice(0, 250), bank_name: bank, relationship: relationship as RecipientRelationship };
    return aud ? {
      ...common, account_name: name.trim(), bsb: (values.bsb || "").replace(/-/g, ""), account_number: values.account_number || "",
      residential_address: contactValue("address"), residential_city: contactValue("city"), residential_state: contactValue("state"),
      residential_postcode: contactValue("postcode"), residential_country: contactValue("residential_country"), recipient_phone: contactValue("phone"), recipient_email: contactValue("email"),
    } : {
      ...common, full_name: name.trim(), bank_type: "other" as const, bank_city: values.bank_city || null,
      shaba_number: `IR${values.shaba || ""}`, card_number: values.card_number || null,
      irt_address: contactValue("address"), irt_city: contactValue("city"), irt_state: contactValue("state"), irt_postcode: contactValue("postcode"), irt_country: contactValue("residential_country"), irt_phone: contactValue("phone"),
    };
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || discarding) return;
    if (!validateBasic()) { setStep(1); return; }
    if (step === 1) { move(2); return; }
    const validated = normalizeRecipientInput(payload());
    if (validated.error) { showFieldErrors(validated.fieldErrors); return; }
    savingRef.current = true; setSaving(true); setError(""); setErrors({});
    try {
      const result = await createRecipient(validated.data!);
      if ("data" in result && result.data) { onCreated(result.data); onClose(); }
      else if ("fieldErrors" in result && result.fieldErrors) showFieldErrors(result.fieldErrors);
      else saveError(text("We couldn’t save this recipient. Your details are still here; please try again.", "گیرنده ذخیره نشد. اطلاعات شما حفظ شده است؛ دوباره تلاش کنید."));
    } catch { saveError(text("Connection interrupted. Your details are still here; please try again.", "ارتباط قطع شد. اطلاعات شما حفظ شده است؛ دوباره تلاش کنید.")); }
    finally { savingRef.current = false; setSaving(false); }
  }
  function field(key: string, en: string, persian: string, options: InputHTMLAttributes<HTMLInputElement> = {}, contact = false, hint?: string) {
    const numeric = options.inputMode === "numeric" || options.type === "tel" || options.type === "email";
    const bankIdentifier = ["shaba", "bsb", "account_number", "card_number"].includes(key);
    const normalize = (raw: string) => {
      const normalized = numeric ? normalizeRecipientDigits(raw) : raw;
      const compact = bankIdentifier ? normalized.replace(/\s+/g, "") : normalized;
      return key === "shaba" ? compact.replace(/^IR/i, "") : compact;
    };
    return <div key={key} className="min-w-0 space-y-2">
      <label className="block text-sm font-medium text-[#182027]" htmlFor={`recipient-${key}`}>{text(en, persian)}{options.required && <span className="ms-1 text-[#8f7eab]" aria-hidden="true">*</span>}</label>
      <div className="relative">
        {key === "shaba" && <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 border-r border-[#e2e6ec] pr-2 font-medium text-[#626a76]" dir="ltr">IR</span>}
        <input id={`recipient-${key}`} name={key} value={key === "name" ? name : contact ? contactValue(key as keyof typeof profileContact) : values[key] || ""}
          onChange={event => set(key, normalize(event.target.value))} maxLength={250} readOnly={contact && own} {...options}
          onPaste={bankIdentifier ? event => {
            event.preventDefault();
            const pasted = event.clipboardData.getData("text"), input = event.currentTarget;
            // Normalize before the browser applies maxLength to grouped or Persian numbers.
            set(key, normalize(key === "shaba" ? pasted : `${input.value.slice(0, input.selectionStart ?? 0)}${pasted}${input.value.slice(input.selectionEnd ?? input.value.length)}`));
          } : undefined}
          dir={numeric ? "ltr" : fa ? "rtl" : "ltr"} lang={numeric ? "en" : locale}
          aria-invalid={!!errors[key]} aria-describedby={[errors[key] && `recipient-${key}-error`, hint && `recipient-${key}-hint`].filter(Boolean).join(" ") || undefined}
          className={cn(inputClass, key === "shaba" && "pl-12", numeric && "tabular-nums")}/>
      </div>
      {hint && <p id={`recipient-${key}-hint`} className="m-0 text-xs leading-5 text-[#626a76]">{hint}</p>}
      {errors[key] && <p id={`recipient-${key}-error`} className="m-0 text-sm text-rose-700">{errors[key]}</p>}
    </div>;
  }
  function selectError(key: string) { return errors[key] && <p id={`recipient-${key}-error`} className="m-0 text-sm text-rose-700">{errors[key]}</p>; }
  return <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
    <DialogContent showCloseButton={false} dir={fa ? "rtl" : "ltr"}
      overlayClassName={!animate ? "animate-none! transition-none!" : undefined}
      className={cn("flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[680px] flex-col gap-0 overflow-hidden rounded-[26px] border border-[#e9ecf0] bg-white p-0 text-[#182027] shadow-2xl sm:max-w-[680px]", !animate && "animate-none! transition-none! [&_*]:transition-none!")}
      onOpenAutoFocus={event => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; event.preventDefault(); document.getElementById("recipient-name")?.focus(); }}
      onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); }}
      onPointerDownOutside={event => event.preventDefault()}
      onEscapeKeyDown={event => { event.preventDefault(); if (discarding) { setDiscarding(false); closeButton.current?.focus(); } else requestClose(); }}>
      <header className="flex shrink-0 items-center gap-3 border-b border-[#e9ecf0] px-5 py-5 sm:px-7">

        <div className="min-w-0 flex-1"><DialogTitle className="m-0! text-xl! leading-snug! font-semibold text-[#182027]!">{own ? text("Add your account", "افزودن حساب شما") : text("Add recipient", "افزودن گیرنده")}</DialogTitle><DialogDescription className="mt-1 text-xs leading-5 text-[#626a76]">{text("Save an account for your next transfer.", "یک حساب برای انتقال بعدی خود ذخیره کنید.")}</DialogDescription></div>
        <Button ref={closeButton} type="button" tone="quiet" className="size-11 shrink-0 rounded-full" disabled={saving} onClick={requestClose} aria-label={text("Close", "بستن")}><X size={20}/></Button>
      </header>
      <form onSubmit={event => void submit(event)} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-[#e9ecf0] bg-[#fff] px-5 py-4 sm:px-7">
          <AnimatedStepper currentStep={step} onStepChange={next => { if (!discarding && !savingRef.current && (next < step || validateBasic())) move(next); }} motionEnabled={animate} showContent={false} showNavigation={false}
            style={{ padding: 0, minHeight: 0, aspectRatio: "auto", width: "100%" }} dir={fa ? "rtl" : "ltr"} stepListLabel={text("Recipient setup", "مراحل ثبت گیرنده")}
            className="[&_.step-circle-container]:max-w-none! [&_.step-circle-container]:rounded-none! [&_.step-circle-container]:border-0! [&_.step-circle-container]:shadow-none! [&_.step-indicator-row]:p-0! [&_.step-connector]:bg-[#e9ecf0]!"
            renderStepIndicator={({ step: number, onStepClick }) => <li aria-current={number === step ? "step" : undefined} className="shrink-0">
              <button type="button" disabled={saving || discarding} onClick={() => onStepClick(number)} className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-start outline-none focus-visible:ring-4 focus-visible:ring-[#635bff]/20">
                <motion.span animate={{ backgroundColor: number <= step ? formStepColors[number-1].soft : "#eef0f4", color: number <= step ? formStepColors[number-1].ink : "#626a76", borderColor: number <= step ? formStepColors[number-1].accent : "#e9ecf0" }} transition={{ duration: animate ? .2 : 0 }} className={cn("flex size-8 items-center justify-center rounded-full border text-sm font-semibold", number === step && "border-2")} aria-hidden="true">{number < step ? <Check size={15}/> : number}</motion.span>
                <span className="text-xs font-medium text-[#626a76] sm:text-sm" style={number <= step ? { color: formStepColors[number-1].ink } : undefined}>{number === 1 ? text("Basic details", "مشخصات اولیه") : text("Banking details", "اطلاعات بانکی")}</span>
              </button></li>}><Step/><Step/></AnimatedStepper>
        </div>
        <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
          <motion.div key={step} initial={animate ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: animate ? .18 : 0 }}>
          <h3 ref={heading} tabIndex={-1} className="mt-0! mb-5! text-lg! font-semibold text-[#182027]! outline-none">{step === 1 ? text("Who are you sending to?", "گیرنده شما کیست؟") : text("Where should the money arrive?", "وجه به کدام حساب واریز شود؟")}</h3>
          <fieldset disabled={saving || discarding} className="m-0 min-w-0 space-y-5 border-0 p-0"><legend className="sr-only">{step === 1 ? text("Basic details", "مشخصات اولیه") : text("Banking details", "اطلاعات بانکی")}</legend>
            {step === 1 ? <>
              {field("name", "Account holder’s full name", "نام و نام خانوادگی صاحب حساب", { required: true, autoComplete: "off" })}
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2"><label htmlFor="recipient-country" className="block text-sm font-medium text-[#182027]">{text("Account country", "کشور حساب بانکی")} *</label><select id="recipient-country" name="country" className={inputClass} value={country} disabled={lockDirection} onChange={event => { setCountry(event.target.value as RecipientDirection); setDirty(true); setErrors({}); setError(""); }} aria-invalid={!!errors.country} aria-describedby={errors.country ? "recipient-country-error" : undefined}><option value="aud">{text("Australia", "استرالیا")}</option><option value="irt">{text("Iran", "ایران")}</option></select>{lockDirection && <p className="m-0 text-xs text-[#626a76]">{text("Matches your transfer destination.", "مطابق با مقصد انتقال شما.")}</p>}{selectError("country")}</div>
                <div className="space-y-2"><label htmlFor="recipient-relationship" className="block text-sm font-medium text-[#182027]">{text("Relationship", "نسبت با گیرنده")} *</label><select id="recipient-relationship" name="relationship" required disabled={own} className={inputClass} value={relationship} onChange={event => set("relationship", event.target.value)} aria-invalid={!!errors.relationship} aria-describedby={errors.relationship ? "recipient-relationship-error" : undefined}><option value="">{text("Choose relationship", "انتخاب نسبت")}</option>{relationships.map(([value, en, persian]) => <option key={value} value={value}>{text(en, persian)}</option>)}</select>{selectError("relationship")}</div>
              </div>
            </> : <>
              <div className="flex items-center gap-3 rounded-2xl border border-[#e9ecf0] bg-[#f7f8fa] p-3.5"><div className="min-w-0 flex-1"><p className="m-0 truncate text-sm font-semibold text-[#182027]">{name}</p><p className="m-0 mt-1 text-xs text-[#626a76]">{aud ? text("Australia", "استرالیا") : text("Iran", "ایران")}</p></div><Button type="button" tone="quiet" onClick={() => move(1)} className="min-h-11 shrink-0 text-[#635bff]">{text("Edit", "ویرایش")}</Button></div>
              <div className="grid gap-5 sm:grid-cols-2">
                {aud ? field("bank_name", "Bank name", "نام بانک", { required: true }) : <div className="space-y-2"><label htmlFor="recipient-bank_name" className="block text-sm font-medium text-[#182027]">{text("Bank name", "نام بانک")} *</label><select id="recipient-bank_name" name="bank_name" required className={inputClass} value={values.bank_name || ""} onChange={event => set("bank_name", event.target.value)} aria-invalid={!!errors.bank_name} aria-describedby={errors.bank_name ? "recipient-bank_name-error" : undefined}><option value="">{text("Choose a bank", "انتخاب بانک")}</option>{iranianBanks.map(bank => <option key={bank} value={bank}>{bank === "Bank Iran" ? text("Other — subject to review", "سایر — نیازمند بررسی") : bank}</option>)}</select>{selectError("bank_name")}</div>}
                {aud ? field("bsb", "BSB", "BSB", { required: true, inputMode: "numeric", pattern: "[0-9]{3}-?[0-9]{3}", maxLength: 7, placeholder: "000-000" }) : field("bank_city", "Bank branch city (optional)", "شهر شعبه بانک (اختیاری)", { maxLength: 120 }, false, text("The bank branch’s city, not the recipient’s residential city.", "شهر شعبه بانک؛ جدا از شهر محل سکونت گیرنده."))}
              </div>
              {aud ? field("account_number", "Account number", "شماره حساب", { required: true, inputMode: "numeric", pattern: "[0-9]{5,12}", maxLength: 12 }) : <>
                {field("shaba", "Shaba / IBAN", "شماره شبا", { required: true, inputMode: "numeric", pattern: "[0-9]{24}", maxLength: 34, placeholder: "000000000000000000000000" }, false, text("24 digits after IR. You can paste the full Shaba number.", "۲۴ رقم بعد از IR. می‌توانید شماره شبا را کامل جای‌گذاری کنید."))}
                {field("card_number", "Card number (optional)", "شماره کارت (اختیاری)", { inputMode: "numeric", pattern: "[0-9]{16}", maxLength: 16 })}
              </>}
              <div className="space-y-5 border-t border-[#e9ecf0] pt-5"><p className="m-0 text-sm font-semibold text-[#182027]">{text("Recipient’s residential & contact details", "اطلاعات سکونت و تماس گیرنده")}</p>
                {own && <p className="m-0 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">{text("From your verified profile. Missing details?", "از پروفایل احراز هویت شما. اطلاعات ناقص است؟")} <a href={`/${locale}/dashboard?tab=profile`} target="_blank" rel="noopener noreferrer" className="font-medium underline">{text("Update profile", "ویرایش پروفایل")}</a></p>}
                {field("address", "Residential address", "آدرس محل سکونت", { required: true, maxLength: 500, autoComplete: "off" }, true)}
                <div className="grid gap-5 sm:grid-cols-2">{field("city", "Residential city", "شهر محل سکونت", { required: true }, true)}{field("state", aud ? "State" : "Province", aud ? "ایالت" : "استان", { required: true }, true)}{field("postcode", aud ? "Postcode" : "Postcode (optional)", aud ? "کد پستی" : "کد پستی (اختیاری)", { required: aud, inputMode: "numeric", maxLength: aud ? 4 : 10 }, true)}{field("residential_country", "Country of residence", "کشور محل سکونت", { required: true }, true)}</div>
                <div className="grid gap-5 sm:grid-cols-2">{field("phone", "Phone number", "شماره تماس", { required: true, type: "tel", maxLength: 25 }, true)}{aud && field("email", "Email", "ایمیل", { required: true, type: "email" }, true)}</div>
              </div>
            </>}
          </fieldset>
          {error && <div id="recipient-save-error" tabIndex={-1} role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700 outline-none"><CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true"/><span>{error}</span></div>}
          </motion.div>
        </div>
        <footer className="shrink-0 border-t border-[#e9ecf0] bg-white px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
          {discarding ? <div className="space-y-3"><p role="alert" className="m-0 text-sm text-[#182027]">{text("Discard this unsaved recipient?", "اطلاعات ذخیره‌نشده این گیرنده حذف شود؟")}</p><div className="flex flex-wrap justify-end gap-2"><Button id="recipient-keep-editing" type="button" tone="secondary" className="min-h-11 rounded-full" onClick={() => { setDiscarding(false); requestAnimationFrame(() => heading.current?.focus()); }}>{text("Keep editing", "ادامه ویرایش")}</Button><Button type="button" className="min-h-11 rounded-full bg-rose-600 text-white hover:bg-rose-700" onClick={onClose}>{text("Discard changes", "حذف تغییرات")}</Button></div></div> : <div className="flex items-center justify-between gap-3">
            <Button type="button" tone="quiet" disabled={saving} onClick={() => step === 1 ? requestClose() : move(1)} className="min-h-12 px-4">{step === 1 ? text("Cancel", "انصراف") : text("Back", "بازگشت")}</Button>
            <Button type="submit" disabled={saving} aria-busy={saving} className="min-w-32">{saving ? text("Saving…", "در حال ذخیره…") : step === 1 ? text("Continue", "ادامه") : own ? text("Save account", "ذخیره حساب") : text("Save recipient", "ذخیره گیرنده")}</Button>
          </div>}
        </footer>
      </form>
    </DialogContent>
  </Dialog>;
}
