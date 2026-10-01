"use client";

import { useEffect, useRef, useState, type FormEvent, type HTMLAttributes, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, CircleAlert, X } from "lucide-react";
import Stepper, { Step } from "@/components/Stepper";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import { DashboardButton as Button, DashboardReveal, dashboardInputClass } from "./dashboard-ui";
import { DashboardLottieScene } from "./DashboardLottieScene";
import { AustralianLocationFields, SuggestionField, filterSuggestions } from "./AustralianLocationFields";
import { createRecipient, updateRecipient } from "@/app/actions/transaction.actions";
import type { Recipient, RecipientDirection, Profile } from "@/app/[locale]/dashboard/dashboard.types";
import { normalizeRecipientDigits, normalizeRecipientInput, type RecipientFieldErrors } from "@/lib/dashboard/recipient-input";
import { normalizeAustralianState } from "@/lib/australian-driver-licence";
import { dashboardHref } from "@/lib/dashboard/navigation";
import { dashboardPalette } from "@/lib/dashboard/palette";
import { cn } from "@/lib/utils";
import provincesData from "@/lib/provinces.json";
import citiesData from "@/lib/cities_sorted.json";
import flow from "@/styles/dashboard/DashboardProfileFlow.module.css";

type ProvinceRecord = { id: number; name: string; en_name?: string };
type CityRecord = { id: number; province_id: number; name: string; en_name?: string };
type Props = { direction: RecipientDirection; mode?: "standard" | "self_destination"; recipient?: Recipient | null; profile?: Profile | null; locale?: "fa" | "en"; motionEnabled?: boolean; lockDirection?: boolean; onClose: () => void; onCreated: (recipient: Recipient) => void };
type InputOptions = { hint?: string; optional?: boolean; type?: string; inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]; placeholder?: string; autoComplete?: string };

const iranProvinces = (Object.values(provincesData) as ProvinceRecord[]).map(province => ({ id: province.id, value: province.en_name || province.name, label: province.en_name || province.name }));
const iranCities = Object.values(citiesData) as CityRecord[];
const iranCityNames = Array.from(new Set(iranCities.map(city => city.en_name || city.name))).sort((a, b) => a.localeCompare(b));
const formStepColors = [dashboardPalette.violet, dashboardPalette.sky, dashboardPalette.teal];
const stepLabels = ["Recipient", "Bank details", "Address & contact"];
const stepTitles = ["Who are you sending to?", "Where should the money arrive?", "Recipient’s address & contact"];
const iranianBanks = ["Ayandeh Bank", "BlueBank", "Dey Bank", "Eghtesad Novin Bank", "Gardeshgari Bank", "Ghavamin Bank", "Hekmat Bank", "Karafarin Bank", "Keshavarzi Bank", "Maskan Bank", "Parsian Bank", "Pasargad Bank", "Post Bank of Iran", "Refah Bank", "Saman Bank", "Sanat Va Maadan Bank", "Sarmayeh Bank", "Shahr Bank", "Sina Bank", "Tejarat Bank", "Tosee Credit Institution", "Tosee Saderat Bank", "Tosee Taavon Bank", "Bank Iran"];
const bankOptions = iranianBanks.map(bank => ({ value: bank, label: bank === "Bank Iran" ? "Other — subject to review" : bank }));
const countryOptions = [{ value: "aud", label: "Australia" }, { value: "irt", label: "Iran" }];
const fieldNames: Record<string, string> = {
  full_name: "name", account_name: "name", label: "name", direction: "country", shaba_number: "shaba",
  residential_address: "address", irt_address: "address", residential_city: "city", irt_city: "city",
  residential_state: "state", irt_state: "state", residential_postcode: "postcode", irt_postcode: "postcode",
  residential_country: "residential_country", irt_country: "residential_country", recipient_phone: "phone", irt_phone: "phone", recipient_email: "email",
};
const stepFields = [["name", "country"], ["bank_name", "bank_city", "bsb", "account_number", "shaba", "card_number"]];
const stepOf = (key: string) => stepFields.findIndex(fields => fields.includes(key)) + 1 || 3;
const contactKeys = ["address", "city", "state", "postcode", "residential_country", "phone", "email"] as const;
type ContactKey = typeof contactKeys[number];
const digitLimits: Record<string, number> = { bsb: 6, account_number: 12, card_number: 16, shaba: 24 };
// Display-only grouping; stored values stay digits-only. Shaba: "IR06 0170 … 01", card: "6037 9971 …", BSB: "062-000".
function formatIdentifier(key: string, digits: string) {
  if (key === "shaba") return digits ? `IR${digits}`.replace(/(.{4})(?=.)/g, "$1 ") : "";
  if (key === "card_number") return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  if (key === "bsb") return digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
  return digits;
}
const fieldClass = "flex min-w-0 flex-col gap-2";
const labelClass = "block text-sm font-medium text-[#182027]";
const hintClass = "m-0 text-xs leading-5 text-[#626a76]";
const errorClass = "m-0 text-xs leading-relaxed text-rose-700";

function initialDrafts(recipient?: Recipient | null) {
  const drafts: Record<RecipientDirection, Record<string, string>> = { aud: {}, irt: {} };
  if (!recipient) return drafts;
  const saved: [string, string | null | undefined][] = recipient.direction === "aud"
    ? [["bank_name", recipient.bank_name], ["bank_city", recipient.bank_city], ["bsb", recipient.bsb?.replace(/\D/g, "")], ["account_number", recipient.account_number], ["address", recipient.residential_address], ["city", recipient.residential_city], ["state", normalizeAustralianState(recipient.residential_state || "") || recipient.residential_state], ["postcode", recipient.residential_postcode], ["phone", recipient.recipient_phone], ["email", recipient.recipient_email]]
    : [["bank_name", recipient.bank_name], ["bank_city", recipient.bank_city], ["shaba", recipient.shaba_number?.replace(/^IR/i, "")], ["card_number", recipient.card_number], ["address", recipient.irt_address], ["city", recipient.irt_city], ["state", recipient.irt_state], ["postcode", recipient.irt_postcode], ["phone", recipient.irt_phone]];
  for (const [key, value] of saved) if (value) drafts[recipient.direction][key] = value;
  return drafts;
}

export function RecipientModal({ direction, mode = "standard", recipient = null, profile, locale = "en", motionEnabled = true, lockDirection = false, onClose, onCreated }: Props) {
  const editing = !!recipient, own = mode === "self_destination" && !editing, reducedMotion = useReducedMotion();
  const animate = motionEnabled && !reducedMotion;
  const [step, setStep] = useState(1), [country, setCountry] = useState<RecipientDirection>(recipient?.direction ?? direction);
  const [name, setName] = useState(recipient ? (recipient.direction === "aud" ? recipient.account_name : recipient.full_name) || recipient.account_name || recipient.full_name || "" : own ? profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") : "");
  const [drafts, setDrafts] = useState(() => initialDrafts(recipient));
  const [errors, setErrors] = useState<Record<string, string>>({}), [error, setError] = useState("");
  const [saving, setSaving] = useState(false), [dirty, setDirty] = useState(false), [discarding, setDiscarding] = useState(false);
  const savingRef = useRef(false), heading = useRef<HTMLHeadingElement>(null), scroll = useRef<HTMLDivElement>(null), opener = useRef<HTMLElement | null>(null), closeButton = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  // Reset on mount too: Strict Mode runs the cleanup once before the real mount.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const aud = country === "aud", values = drafts[country];
  const profileContact: Record<ContactKey, string> = {
    address: [profile?.address || profile?.address_line1, profile?.address_line2].filter(Boolean).join(", "),
    city: String(profile?.suburb || profile?.city || ""), state: String(profile?.state || ""),
    postcode: String(profile?.postcode || profile?.post_code || ""), residential_country: String(profile?.country || ""),
    phone: String(profile?.mobile_number || profile?.phone_number || profile?.telephone || ""), email: String(profile?.email || ""),
  };
  const contactValue = (key: ContactKey) => own ? profileContact[key] : key === "residential_country" ? (aud ? "Australia" : "Iran") : values[key] || "";
  const selectedProvince = iranProvinces.find(province => province.value === values.state);
  const provinceCities = selectedProvince ? Array.from(new Set(iranCities.filter(city => city.province_id === selectedProvince.id).map(city => city.en_name || city.name))).map(city => ({ value: city, label: city })) : [];

  const focusField = (key: string) => requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(`[data-field~="${key}"] :is(input, button[role="combobox"], button)`);
    element?.focus(); element?.scrollIntoView({ block: "nearest" });
  });
  function patch(next: Record<string, string>) {
    setDirty(true); setError("");
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !(key in next))));
    const { name: nextName, ...rest } = next;
    if (nextName !== undefined) setName(nextName);
    if (Object.keys(rest).length) setDrafts(previous => ({ ...previous, [country]: { ...previous[country], ...rest } }));
  }
  const set = (key: string, value: string) => patch({ [key]: value });
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
  function stepErrors(fieldErrors: RecipientFieldErrors, upTo = 3) {
    const mapped: Record<string, string> = {};
    for (const [key, message] of Object.entries(fieldErrors)) {
      const field = fieldNames[key] || key;
      if (!mapped[field] && stepOf(field) <= upTo) mapped[field] = message;
    }
    return mapped;
  }
  function showFieldErrors(mapped: Record<string, string>) {
    const first = Object.keys(mapped).sort((a, b) => stepOf(a) - stepOf(b))[0];
    setErrors(mapped);
    if (!first) return;
    if (stepOf(first) !== step) { setStep(stepOf(first)); setDiscarding(false); }
    focusField(first);
  }
  function payload() {
    const bank = (values.bank_name || "").trim();
    const common = { direction: country, label: `${name.trim()} — ${bank}`.slice(0, 250), bank_name: bank, bank_city: (values.bank_city || "").trim() };
    return aud ? {
      ...common, account_name: name.trim(), bsb: values.bsb || "", account_number: values.account_number || "",
      residential_address: contactValue("address"), residential_city: contactValue("city"), residential_state: contactValue("state"),
      residential_postcode: contactValue("postcode"), residential_country: contactValue("residential_country"), recipient_phone: contactValue("phone"), recipient_email: contactValue("email"),
    } : {
      ...common, full_name: name.trim(), bank_type: "other" as const,
      shaba_number: `IR${values.shaba || ""}`, card_number: values.card_number || null,
      irt_address: contactValue("address"), irt_city: contactValue("city"), irt_state: contactValue("state"), irt_postcode: contactValue("postcode"), irt_country: contactValue("residential_country"), irt_phone: contactValue("phone"),
    };
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || discarding) return;
    const validated = normalizeRecipientInput(payload());
    const invalid = validated.error ? stepErrors(validated.fieldErrors, step) : {};
    if (Object.keys(invalid).length) { showFieldErrors(invalid); return; }
    if (step < 3) { move(step + 1); return; }
    if (!validated.data) { saveError(validated.error || "Please check the recipient details."); return; }
    savingRef.current = true; setSaving(true); setError(""); setErrors({});
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      // A stalled network/Supabase response must not leave the form stuck until a manual refresh.
      const result = await Promise.race([
        recipient ? updateRecipient(recipient.id, validated.data) : createRecipient(validated.data),
        new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error("timeout")), 20_000); }),
      ]);
      if (!mounted.current) return;
      if ("data" in result && result.data) { onCreated(result.data); onClose(); }
      else if ("fieldErrors" in result && result.fieldErrors) { setError("Please check the highlighted details."); showFieldErrors(stepErrors(result.fieldErrors)); }
      else saveError(editing ? "We couldn’t save your changes. Your details are still here; please try again." : "We couldn’t save this recipient. Your details are still here; please try again.");
    } catch (err) {
      if (!mounted.current) return;
      saveError(err instanceof Error && err.message === "timeout"
        ? "This is taking longer than expected. Check your connection and try again."
        : "Connection interrupted. Your details are still here; please try again.");
    } finally { clearTimeout(timeoutId); savingRef.current = false; if (mounted.current) setSaving(false); }
  }

  const fieldError = (key: string) => errors[key] && <p id={`recipient-${key}-error`} role="alert" className={errorClass}>{errors[key]}</p>;
  function input(key: string, label: string, options: InputOptions = {}) {
    const contact = (contactKeys as readonly string[]).includes(key), readOnly = own && contact;
    const digits = key in digitLimits || key === "postcode";
    const limit = key === "postcode" ? (aud ? 4 : 10) : digitLimits[key];
    const raw = key === "name" ? name : contact ? contactValue(key as ContactKey) : values[key] || "";
    const value = digits ? formatIdentifier(key, raw) : raw;
    const describedBy = [options.hint && `recipient-${key}-hint`, errors[key] && `recipient-${key}-error`].filter(Boolean).join(" ") || undefined;
    return <div className={fieldClass} data-field={key}>
      <label className={labelClass} htmlFor={`recipient-${key}`}>{label}{options.optional && <span className="font-normal text-[#6a6279]"> (optional)</span>}</label>
      <input id={`recipient-${key}`} name={key} value={value} readOnly={readOnly} type={options.type || "text"} placeholder={options.placeholder} autoComplete={options.autoComplete || "off"}
        inputMode={options.inputMode || (digits ? "numeric" : undefined)} maxLength={digits ? undefined : key === "address" ? 500 : 250}
        onChange={event => {
          const next = event.target.value;
          if (!digits) { set(key, options.type === "tel" ? normalizeRecipientDigits(next) : next); return; }
          const element = event.currentTarget, clean = normalizeRecipientDigits(next).replace(/\D/g, "").slice(0, limit);
          const digitsBeforeCaret = normalizeRecipientDigits(next.slice(0, element.selectionStart ?? next.length)).replace(/\D/g, "").length;
          set(key, clean);
          // Keep the caret after the same digit once separators are re-inserted.
          const formatted = formatIdentifier(key, clean);
          let caret = 0;
          for (let seen = 0; caret < formatted.length && seen < digitsBeforeCaret; caret++) if (/\d/.test(formatted[caret])) seen++;
          if (key === "shaba" && formatted) caret = Math.max(caret, 2);
          requestAnimationFrame(() => { if (document.activeElement === element) element.setSelectionRange(caret, caret); });
        }}
        aria-invalid={!!errors[key]} aria-describedby={describedBy}
        className={cn(dashboardInputClass, digits && "tabular-nums")}/>
      {options.hint && <p id={`recipient-${key}-hint`} className={hintClass}>{options.hint}</p>}
      {fieldError(key)}
    </div>;
  }
  function select(key: string, label: string, control: ReactNode, hint?: string) {
    return <div className={fieldClass} data-field={key}>
      <span className={labelClass}>{label}</span>
      {control}
      {hint && <p className={hintClass}>{hint}</p>}
      {fieldError(key)}
    </div>;
  }

  const title = editing ? "Edit recipient" : own ? "Add your account" : "Add a new recipient";
  const description = editing ? "Update this account for your next transfers." : own ? "Save your own bank account for your next transfer." : "Save the recipient’s bank account once and reuse it for every transfer.";
  const submitLabel = saving ? "Saving…" : step < 3 ? "Next Step" : editing ? "Save changes" : own ? "Save account" : "Save recipient";

  return <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
    <DialogContent showCloseButton={false} dir="ltr" lang="en"
      overlayClassName={!animate ? "animate-none! transition-none!" : undefined}
      className={cn("flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[720px] flex-col gap-0 overflow-hidden rounded-3xl border border-[#e4ddef] bg-white p-0 text-[#182027] shadow-2xl sm:max-w-[720px]", !animate && "animate-none! transition-none! [&_*]:transition-none!")}
      onOpenAutoFocus={event => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; event.preventDefault(); document.getElementById("recipient-name")?.focus(); }}
      onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus(); }}
      onPointerDownOutside={event => event.preventDefault()}
      onEscapeKeyDown={event => { event.preventDefault(); if (discarding) { setDiscarding(false); closeButton.current?.focus(); } else requestClose(); }}>
      <header className="flex shrink-0 items-start gap-4 bg-[linear-gradient(180deg,#f6f3ff_0%,#fff_100%)] px-5 py-5 sm:px-7 sm:py-6">
        <div className="min-w-0 flex-1">
          <DialogTitle className="m-0! text-lg! font-semibold leading-7! text-[#302346]!">{title}</DialogTitle>
          <DialogDescription className="mb-0 mt-2 max-w-xl text-sm leading-7 text-[#6a6279]">{description}</DialogDescription>
        </div>
        <span className="hidden size-[68px] shrink-0 place-items-center sm:grid"><DashboardLottieScene name="recipient-selection" size={68} motionEnabled={animate}/></span>
        <Button ref={closeButton} type="button" tone="quiet" className="-me-2 -mt-1 size-11 shrink-0 rounded-full" disabled={saving} onClick={requestClose} aria-label="Close"><X size={20}/></Button>
      </header>
      <form onSubmit={event => void submit(event)} noValidate className={cn(flow.form, "flex min-h-0 flex-1 flex-col overflow-hidden")} lang="en" dir="ltr">
        <div className="shrink-0 border-y border-[#e4ddef] bg-[#faf8ff]/80 px-4 py-5 sm:px-7 sm:py-6">
          <Stepper currentStep={step} onStepChange={(next: number) => { if (!discarding && !savingRef.current && next < step) move(next); }} showNavigation={false} showContent={false} motionEnabled={animate} dir="ltr" stepListLabel="Recipient setup steps"
            className={cn(flow.stepper, "aspect-auto! min-h-0! p-0!")} stepCircleContainerClassName="max-w-none! rounded-none! border-0! bg-transparent! shadow-none!" stepContainerClassName="p-0!"
            renderStepIndicator={({ step: number, currentStep, onStepClick }: { step: number; currentStep: number; onStepClick: (value: number) => void }) => <li className={flow.stepItem}>
              <button type="button" disabled={saving || discarding || number > currentStep} onClick={() => onStepClick(number)} aria-current={number === currentStep ? "step" : undefined} className={flow.stepButton}>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border border-[#ded8e9] bg-white text-sm", number === currentStep && "border-2")} style={number <= currentStep ? { backgroundColor: formStepColors[number-1].soft, borderColor: formStepColors[number-1].accent, color: formStepColors[number-1].ink } : undefined}>{number < currentStep ? <Check size={16} aria-hidden="true"/> : number}</span>
                <span className={flow.stepLabel} style={number <= currentStep ? { color: formStepColors[number-1].ink } : undefined}>{stepLabels[number-1]}</span>
              </button>
            </li>}>{stepLabels.map(label => <Step key={label}>{label}</Step>)}</Stepper>
        </div>
        <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7 sm:py-7">
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#eddbb3] bg-[#fff8e8] px-4 py-3.5"><DashboardLottieScene name="alert" size={40} motionEnabled={animate}/><p className="m-0 self-center text-sm font-bold leading-7 text-[#765018]">Please enter all recipient details in <strong className="font-black">English</strong>, exactly as they appear on the recipient’s bank account.</p></div>
          <h3 ref={heading} tabIndex={-1} className="m-0! mb-5! text-lg! font-semibold leading-7! text-[#302346]! outline-none">{stepTitles[step-1]}</h3>
          <DashboardReveal key={step} motionEnabled={animate}>
            <fieldset disabled={saving || discarding} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0"><legend className="sr-only">{stepLabels[step-1]}</legend>
              {step === 1 && <>
                {input("name", "Account holder’s full name", { hint: "Full legal name, exactly as it appears on the bank account." })}
                {select("country", "Account country", <SelectBox value={country} onChange={value => { if (value === country) return; setCountry(value as RecipientDirection); setDirty(true); setErrors({}); setError(""); }} labeledOptions={countryOptions} disabled={lockDirection || editing || saving || discarding} placeholder="Select country" dir="ltr" className={flow.control}/>, lockDirection ? "Matches your transfer destination." : editing ? "The account country can’t be changed after saving." : undefined)}
              </>}
              {step === 2 && <div className="grid gap-6 sm:grid-cols-2">
                {aud ? <>
                  {input("bank_name", "Bank name", { placeholder: "e.g. Commonwealth Bank" })}
                  {input("bank_city", "Bank branch city / suburb", { hint: "Where the account’s branch is located — not the recipient’s home city." })}
                  {input("bsb", "BSB", { placeholder: "000-000" })}
                  {input("account_number", "Account number", { placeholder: "5 to 12 digits" })}
                </> : <>
                  {select("bank_name", "Bank name", <SelectBox value={values.bank_name || ""} onChange={value => set("bank_name", value)} labeledOptions={bankOptions} disabled={saving || discarding} placeholder="Select bank" dir="ltr" className={flow.control}/>)}
                  <div className="min-w-0" data-field="bank_city">
                    <SuggestionField label="Bank branch city" value={values.bank_city || ""} placeholder="Start typing city" disabled={saving || discarding}
                      suggestions={filterSuggestions(iranCityNames, values.bank_city || "")} helperText="Where the account’s branch is located — not the recipient’s home city." errorText={errors.bank_city}
                      fieldGroupClassName={fieldClass} labelClassName={labelClass} inputClassName={dashboardInputClass} errorTextClassName={errorClass} hintTextClassName={hintClass} requiredMarkClassName="sr-only"
                      onChange={value => set("bank_city", value)} onSelect={value => set("bank_city", value)}/>
                  </div>
                  <div className="sm:col-span-2">{input("shaba", "Shaba (IBAN)", { placeholder: "IR00 0000 0000 0000 0000 0000 00", hint: "IR followed by 24 digits. You can paste the full Shaba number." })}</div>
                  {input("card_number", "Card number", { optional: true, placeholder: "0000 0000 0000 0000" })}
                </>}
              </div>}
              {step === 3 && <>
                {own && <p className="m-0 rounded-2xl border border-[#e4ddef] bg-[#faf8ff] px-4 py-3 text-sm leading-6 text-[#6a6279]">These details come from your verified profile. Something missing? <a href={dashboardHref(locale, "profile")} target="_blank" rel="noopener noreferrer" className="font-medium text-[#5147cc] underline underline-offset-4">Update your profile</a></p>}
                {input("address", "Street address", { hint: own ? undefined : "Unit number, street number and street name." })}
                {own ? <div className={flow.addressGrid}>
                  {input("city", aud ? "City / Suburb" : "City")}{input("state", aud ? "State / Territory" : "Province")}{input("postcode", "Postcode", { optional: !aud })}
                </div> : <div className={flow.addressGrid} data-field="state city postcode">
                  {aud ? <AustralianLocationFields key={normalizeAustralianState(values.state || "") || "Australia"} state={normalizeAustralianState(values.state || "")} city={values.city || ""} postalCode={values.postcode || ""} disabled={saving || discarding}
                    errors={{ state: errors.state, city: errors.city, postalCode: errors.postcode }}
                    ui={{ fieldGroupClassName: fieldClass, labelClassName: labelClass, inputClassName: dashboardInputClass, selectClassName: flow.control, stateLabel: "State / Territory", postcodeLabel: "Postcode", errorTextClassName: errorClass, hintTextClassName: hintClass, requiredMarkClassName: "sr-only" }}
                    onStateChange={value => patch({ state: value, city: "", postcode: "" })} onCityChange={value => set("city", value)} onPostalCodeChange={value => set("postcode", value)}/> : <>
                    {select("state", "Province", <SelectBox value={values.state || ""} onChange={value => { if (value !== values.state) patch({ state: value, city: "" }); }} labeledOptions={iranProvinces} disabled={saving || discarding} placeholder="Select province" dir="ltr" className={flow.control}/>)}
                    {select("city", "City", <SelectBox value={values.city || ""} onChange={value => set("city", value)} labeledOptions={provinceCities} disabled={!values.state || saving || discarding} placeholder={values.state ? "Select city" : "Select a province first"} dir="ltr" className={flow.control}/>)}
                    {input("postcode", "Postcode", { optional: true, placeholder: "10 digits" })}
                  </>}
                </div>}
                <div className="grid gap-6 sm:grid-cols-2">
                  {input("phone", "Phone number", { type: "tel", inputMode: "tel", placeholder: aud ? "+61 4XX XXX XXX" : "+98 9XX XXX XXXX" })}
                  {aud && input("email", "Email", { type: "email", inputMode: "email", placeholder: "name@example.com" })}
                </div>
              </>}
            </fieldset>
          </DashboardReveal>
          {error && <div id="recipient-save-error" tabIndex={-1} role="alert" className="mt-6 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700 outline-none"><CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true"/><span>{error}</span></div>}
        </div>
        <footer className="flex shrink-0 flex-col gap-4 border-t border-[#e4ddef] bg-white/65 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
          {discarding ? <>
            <p role="alert" className="m-0 text-sm font-medium text-[#302346]">{editing ? "Discard your changes?" : "Discard this unsaved recipient?"}</p>
            <div className="flex w-full gap-3 sm:w-auto">
              <Button id="recipient-keep-editing" type="button" tone="secondary" className="flex-1 sm:flex-none" onClick={() => { setDiscarding(false); requestAnimationFrame(() => heading.current?.focus()); }}>Keep editing</Button>
              <Button type="button" className="flex-1 bg-rose-600! text-white! hover:bg-rose-700! sm:flex-none" onClick={onClose}>Discard</Button>
            </div>
          </> : <>
            <span className="text-xs font-medium text-[#6a6279]" aria-live="polite">{`Step ${step} of 3`}</span>
            <div className="flex w-full gap-3 sm:w-auto">
              <Button type="button" tone="secondary" className="flex-1 sm:flex-none" disabled={saving} onClick={() => step === 1 ? requestClose() : move(step - 1)}>{step === 1 ? "Cancel" : "Back"}</Button>
              <Button type="submit" className="flex-1 sm:min-w-36 sm:flex-none" disabled={saving} aria-busy={saving}>{submitLabel}</Button>
            </div>
          </>}
        </footer>
      </form>
    </DialogContent>
  </Dialog>;
}
