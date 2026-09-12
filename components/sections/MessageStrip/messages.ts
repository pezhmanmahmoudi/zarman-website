/**
 * MessageStrip — configurable message list
 *
 * HOW TO EDIT:
 *  • Add / remove objects from the array below.
 *  • `fa`   Persian text shown when locale === "fa"
 *  • `en`   English text shown when locale === "en"
 *  • `icon` Visual icon: "shield" | "zap" | "star" | "percent" | "lock" | "users" | "check"
 *
 * Keep each string under ~90 characters so it renders on one line on desktop.
 * Messages are displayed in array order, cycling continuously.
 */

export type StripIconType =
  | "shield"
  | "zap"
  | "star"
  | "percent"
  | "lock"
  | "users"
  | "check";

export interface StripMessage {
  id: number;
  fa: string;
  en: string;
  icon: StripIconType;
}

export const STRIP_MESSAGES: StripMessage[] = [
  {
    id: 1,
    fa: "زرمان یک Remittance Dealer ثبت‌شده در AUSTRAC با ABN معتبر است.",
    en: "Zarman is an AUSTRAC-registered Remittance Dealer with a valid ABN & ACN.",
    icon: "shield",
  },
  {
    id: 2,
    fa: "پیش از تأیید حواله، نرخ، کارمزد و مبلغ نهایی را بررسی کنید.",
    en: "Check your quoted rate, fee and final amount before confirming a transfer.",
    icon: "check",
  },
  {
    id: 3,
    fa: "درباره هزینه و شرایط پرداخت‌های دانشجویی و کادر درمان از پشتیبانی بپرسید.",
    en: "Ask our team about fees and availability for student and healthcare payments.",
    icon: "percent",
  },
  {
    id: 4,
    fa: "شرایط فعلی نرخ وفاداری و تخفیف احتمالی را در پنل خود بررسی کنید.",
    en: "Check your dashboard for current loyalty pricing and any available discount.",
    icon: "star",
  },
  {
    id: 5,
    fa: "برای شروع حواله، اطلاعات و مدارک درخواستی احراز هویت را تکمیل کنید.",
    en: "Complete the requested identity details and documents before making a transfer.",
    icon: "lock",
  },
  {
    id: 6,
    fa: "پرداخت هزینه‌های AMC، AHPRA، ADC، OET، NCLEX، دانشگاه‌ها و ویزا.",
    en: "Pay AMC, AHPRA, ADC, OET, NCLEX, tuition and visa fees with ease.",
    icon: "zap",
  },
  {
    id: 7,
    fa: "پیش از واریز وجه، جزئیات حساب و شرایط تسویه درخواست خود را تأیید کنید.",
    en: "Confirm the payment details and settlement arrangements before sending funds.",
    icon: "users",
  },
  {
    id: 8,
    fa: "اعتبار زرمان را در سامانهٔ رسمی AUSTRAC استرالیا بررسی کنید.",
    en: "Verify Zarman on the official AUSTRAC Register before every transfer.",
    icon: "shield",
  },
];
