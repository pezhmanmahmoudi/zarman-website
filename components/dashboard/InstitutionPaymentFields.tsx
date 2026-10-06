"use client";

import { Check } from "lucide-react";
import { normalizeInstitutionPaymentLink, paymentInstitution, paymentInstitutions } from "@/lib/payments/institutions";
import styles from "@/styles/dashboard/InstitutionPaymentFields.module.css";

export type InstitutionPaymentErrors = Partial<Record<"institution" | "companyName" | "paymentLink" | "username" | "password", string>>;

type Props = {
  institutionId: string;
  paymentLink: string;
  companyName: string;
  username: string;
  password: string;
  locale: string;
  disabled: boolean;
  errors?: InstitutionPaymentErrors;
  onInstitutionChange: (id: string) => void;
  onPaymentLinkChange: (value: string) => void;
  onCompanyNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
};

export function InstitutionPaymentFields({ institutionId, paymentLink, companyName, username, password, locale, disabled, errors = {}, onInstitutionChange, onPaymentLinkChange, onCompanyNameChange, onUsernameChange, onPasswordChange }: Props) {
  const text = (en: string, fa: string) => locale === "fa" ? fa : en;
  const institution = paymentInstitution(institutionId);
  return <fieldset className={styles.form} disabled={disabled}>
    <legend className={styles.heading}>{text("Exam payment details", "اطلاعات پرداخت آزمون")}</legend>
    <fieldset className={styles.options} aria-invalid={!!errors.institution} aria-describedby={errors.institution ? "request-payment-institution-error" : undefined}>
      <legend className={styles.label}>{text("Choose a payment recipient", "انتخاب دریافت‌کنندهٔ پرداخت")}</legend>
      <div className={styles.optionGrid}>{[...paymentInstitutions, { id: "other", name: "Other" }].map(item => <label key={item.id} className={styles.option} data-checked={institutionId === item.id}>
        <input type="radio" name="payment-institution" value={item.id} checked={institutionId === item.id} onChange={() => onInstitutionChange(item.id)}/>
        <bdi dir="ltr">{item.name}</bdi>{institutionId === item.id && <Check size={16} aria-hidden="true"/>}
      </label>)}</div>
      {errors.institution && <p id="request-payment-institution-error" className={styles.error} role="alert">{errors.institution}</p>}
    </fieldset>
    {(institution || institutionId === "other") && <>
      {institutionId === "other" ? <div className={styles.field}>
        <label className={styles.label} htmlFor="request-institution">{text("Company receiving payment", "شرکت دریافت‌کنندهٔ پرداخت")}</label>
        <input id="request-institution" type="text" dir="auto" value={companyName} onChange={event => onCompanyNameChange(event.target.value)} maxLength={200} autoComplete="off" required aria-invalid={!!errors.companyName} aria-describedby={errors.companyName ? "request-company-name-error" : undefined}/>
        {errors.companyName && <p id="request-company-name-error" className={styles.error} role="alert">{errors.companyName}</p>}
      </div> : <div className={styles.company}>
        <span className={styles.label}>{text("Company receiving payment", "شرکت دریافت‌کنندهٔ پرداخت")}</span>
        <p id="request-institution" dir="ltr" lang="en">{institution?.companyName}</p>
      </div>}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="request-payment-link">{text("Payment link", "لینک پرداخت")}</label>
        <input id="request-payment-link" type="url" dir="ltr" value={paymentLink} onChange={event => onPaymentLinkChange(event.target.value)} onBlur={event => onPaymentLinkChange(normalizeInstitutionPaymentLink(event.target.value))} maxLength={2000} placeholder="https://" autoComplete="off" autoCapitalize="none" spellCheck={false} required aria-invalid={!!errors.paymentLink} aria-describedby={errors.paymentLink ? "request-payment-link-error" : undefined}/>
        {errors.paymentLink && <p id="request-payment-link-error" className={styles.error} role="alert">{errors.paymentLink}</p>}
      </div>
      <div className={styles.credentials}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="request-payment-username">{text("Your payment account username", "یوزر اکانت شما برای پرداخت")}</label>
          <input id="request-payment-username" type="text" dir="ltr" value={username} onChange={event => onUsernameChange(event.target.value)} maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} required={!!password} data-private-value aria-invalid={!!errors.username} aria-describedby={errors.username ? "request-payment-username-error" : undefined}/>
          {errors.username && <p id="request-payment-username-error" className={styles.error} role="alert">{errors.username}</p>}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="request-payment-password">{text("Your payment account password", "پسورد اکانت شما برای پرداخت")}</label>
          <input id="request-payment-password" type="password" dir="ltr" value={password} onChange={event => onPasswordChange(event.target.value)} maxLength={1024} autoComplete="new-password" spellCheck={false} required={!!username.trim()} data-private-value aria-invalid={!!errors.password} aria-describedby={errors.password ? "request-payment-password-error" : undefined}/>
          {errors.password && <p id="request-payment-password-error" className={styles.error} role="alert">{errors.password}</p>}
        </div>
      </div>
    </>}
  </fieldset>;
}
