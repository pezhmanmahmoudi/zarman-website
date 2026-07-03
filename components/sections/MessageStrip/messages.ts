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
    fa: "زرمان یک Remittance Dealer ثبت‌شده در AUSTRAC با ABN و ACN معتبر است.",
    en: "Zarman is an AUSTRAC-registered Remittance Dealer with a valid ABN & ACN.",
    icon: "shield",
  },
  {
    id: 2,
    fa: "نرخ لحظه‌ای و شفاف؛ قبل از پرداخت، نرخ نهایی خود را مشاهده کنید.",
    en: "Transparent live rates — always see your final rate before confirming.",
    icon: "check",
  },
  {
    id: 3,
    fa: "انتقال‌های بین‌المللی دانشجویان و کادر درمان با بهترین نرخ و بدون کارمزد.",
    en: "International payments for students & healthcare professionals with no transfer fee.",
    icon: "percent",
  },
  {
    id: 4,
    fa: "به ازای هر ۵٬۰۰۰ دلار تراکنش، نرخ اختصاصی بهتری از سیستم وفاداری دریافت کنید.",
    en: "Unlock better exchange rates every AUD 5,000 through our Loyalty Program.",
    icon: "star",
  },
  {
    id: 5,
    fa: "احراز هویت آنلاین تنها چند دقیقه زمان می‌برد و مطابق قوانین AUSTRAC انجام می‌شود.",
    en: "Fast online identity verification, fully compliant with AUSTRAC regulations.",
    icon: "lock",
  },
  {
    id: 6,
    fa: "پرداخت هزینه‌های AMC، AHPRA، ADC، OET، NCLEX، دانشگاه‌ها و ویزا بدون دردسر.",
    en: "Pay AMC, AHPRA, ADC, OET, NCLEX, tuition and visa fees with ease.",
    icon: "zap",
  },
  {
    id: 7,
    fa: "حواله‌های استرالیا و ایران با سیستم امن Offset Settlement انجام می‌شود.",
    en: "Australia–Iran transfers are completed through our secure Offset Settlement system.",
    icon: "users",
  },
  {
    id: 8,
    fa: "اعتبار زرمان را در سامانهٔ رسمی AUSTRAC استرالیا بررسی کنید.",
    en: "Verify Zarman on the official AUSTRAC Register before every transfer.",
    icon: "shield",
  },
];