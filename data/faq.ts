export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  link?: { href: string; label: string };
}

// Shared by server-rendered answers and JSON-LD so the two cannot drift apart.
const faqsFa: FaqItem[] = [
  {
    id: "aud-rate",
    question: "نرخ دلار استرالیا به تومان را از کجا ببینم؟",
    answer: "نرخ خرید و فروش دلار استرالیا (AUD) به تومان در تابلوی نرخ و ماشین‌حساب همین صفحه نمایش داده می‌شود. تاریخ آخرین به‌روزرسانی را بررسی کنید؛ نرخ نمایش‌داده‌شده ممکن است تا زمان ثبت درخواست تغییر کند. نرخ و مبلغ نهایی را پیش از تأیید سفارش در پنل کاربری بررسی کنید.",
  },
  {
    id: "transfer-request",
    question: "چگونه درخواست حواله از استرالیا به ایران ثبت کنم؟",
    answer: "در زرمان ثبت‌نام کنید، مبلغ و اطلاعات گیرنده را در پنل وارد کنید و درخواست خود را ثبت کنید. پیش از انجام تراکنش، احراز هویت و بررسی درخواست لازم است. پس از تأیید، اطلاعات واریز در اختیارتان قرار می‌گیرد. وضعیت درخواست و تسویه را می‌توانید در پنل پیگیری کنید.",
    link: { href: "/fa/register", label: "ثبت‌نام در زرمان" },
  },
  {
    id: "transfer-fees",
    question: "کارمزد حواله و نرخ نهایی چگونه محاسبه می‌شود؟",
    answer: "مبلغ، جهت تبدیل ارز و شرایط نرخ شخصی‌سازی‌شده بر نتیجه محاسبه اثر دارند. در صورت اعمال کارمزد، ماشین‌حساب آن را نمایش می‌دهد. برای مقایسه، هم نرخ تبدیل و هم مبلغ نهایی دریافتی را بررسی کنید. نرخ و کارمزد قابل اعمال را پیش از تأیید سفارش ببینید.",
  },
  {
    id: "personalised-rate",
    question: "نرخ شخصی‌سازی‌شده دلار استرالیا چیست؟",
    answer: "نرخ شخصی‌سازی‌شده بر اساس سابقه و حجم تراکنش‌های شما و تنظیمات جاری برنامه وفاداری محاسبه می‌شود. این نرخ می‌تواند با نرخ عمومی تابلوی سایت متفاوت باشد. نرخ مربوط به درخواست خود را پس از ورود به پنل و پیش از تأیید سفارش بررسی کنید.",
  },
  {
    id: "transfer-time",
    question: "حواله استرالیا به ایران چقدر طول می‌کشد؟",
    answer: "زمان انجام هر درخواست به تکمیل احراز هویت، تأیید دریافت وجه، بررسی تراکنش و پردازش بانکی بستگی دارد. برای زمان مورد انتظار درخواست خود با پشتیبانی هماهنگ کنید و وضعیت را در پنل دنبال کنید؛ زمان یکسانی برای همه انتقال‌ها تضمین نمی‌شود.",
  },
  {
    id: "identity-verification",
    question: "برای حواله دلار استرالیا چه مدارکی لازم است؟",
    answer: "برای احراز هویت، اطلاعات هویتی و مدرک شناسایی معتبر لازم است. بسته به درخواست و نتیجه بررسی، ممکن است اطلاعات نشانی، گیرنده یا مدارک تکمیلی نیز خواسته شود. مراحل و مدارک مورد نیاز در پنل اعلام می‌شود و ثبت‌نام به‌تنهایی به معنی تأیید تراکنش نیست.",
  },
  {
    id: "business-verification",
    question: "اطلاعات ثبتی صرافی زرمان را چگونه بررسی کنم؟",
    answer: "نام حقوقی شرکت ZARMAN EXCHANGE PTY LTD و شماره ABN آن 70 692 742 957 است. اطلاعات شرکت را در سامانه رسمی ABN Lookup و وضعیت ثبت ارائه‌دهنده حواله را در سامانه رسمی AUSTRAC بررسی کنید. برای تصمیم‌گیری، شرایط خدمات، کارمزد و راه‌های تماس را نیز مطالعه کنید.",
    link: { href: "https://online.apps.austrac.gov.au/rsr/", label: "سامانه ثبت ارائه‌دهندگان حواله AUSTRAC" },
  },
  {
    id: "privacy",
    question: "اطلاعات هویتی و بانکی من چگونه استفاده می‌شود؟",
    answer: "اطلاعات شما برای احراز هویت، انجام تراکنش، مدیریت ریسک و رعایت الزامات قانونی استفاده می‌شود. مطابق خط‌مشی حریم خصوصی، اطلاعات ممکن است در صورت نیاز با ارائه‌دهندگان خدمات، مؤسسات مالی گیرنده یا مراجع قانونی به اشتراک گذاشته شود. جزئیات حفاظت از اطلاعات و حقوق شما در خط‌مشی حریم خصوصی آمده است.",
    link: { href: "/en/legal/privacy-policy", label: "مطالعه خط‌مشی حریم خصوصی (انگلیسی)" },
  },
];

const faqsEn: FaqItem[] = [
  {
    id: "aud-rate",
    question: "Where can I see the AUD to Iranian toman exchange rate?",
    answer: "The rate board and calculator on this page show the buying and selling rates for Australian dollars (AUD) in Iranian toman. Check the last updated date: a displayed rate may change before you submit a request. Review the final rate and amount in your dashboard before confirming an order.",
  },
  {
    id: "transfer-request",
    question: "How do I request a money transfer from Australia to Iran?",
    answer: "Register with Zarman, enter the amount and recipient details in your dashboard, and submit a request. Identity verification and a review of your request are required before the transaction proceeds. Once approved, you receive payment instructions. You can track the request and settlement in your dashboard.",
    link: { href: "/en/register", label: "Register with Zarman" },
  },
  {
    id: "transfer-fees",
    question: "How are transfer fees and the final exchange rate calculated?",
    answer: "The amount, currency direction and personalised rate conditions affect the calculation. The calculator displays a fee when one applies. To compare quotes, consider both the exchange rate and the final amount received. Review the applicable rate and fees before confirming your order.",
  },
  {
    id: "personalised-rate",
    question: "What is a personalised AUD exchange rate?",
    answer: "Your personalised rate is calculated using your transaction history and volume, together with the current loyalty program settings. It may differ from the public rate board. Sign in to your dashboard to review the rate for your request before confirming an order.",
  },
  {
    id: "transfer-time",
    question: "How long does a money transfer from Australia to Iran take?",
    answer: "Processing time depends on identity verification, confirmation of funds, transaction review and bank processing. Contact support for the expected timing of your request and follow its status in your dashboard. A single delivery time is not guaranteed for every transfer.",
  },
  {
    id: "identity-verification",
    question: "What documents do I need for an AUD remittance?",
    answer: "Identity verification requires your personal details and a valid identity document. Depending on your request and its review, address information, recipient details or additional supporting documents may be required. Your dashboard explains the required steps and documents; registration alone does not approve a transaction.",
  },
  {
    id: "business-verification",
    question: "How can I check Zarman Exchange's business registration?",
    answer: "The legal company name is ZARMAN EXCHANGE PTY LTD and its ABN is 70 692 742 957. Check company details using the official ABN Lookup and a remittance provider's registration status using AUSTRAC's official register. Also review the service terms, fees and contact details before making a decision.",
    link: { href: "https://online.apps.austrac.gov.au/rsr/", label: "AUSTRAC Remittance Sector Register" },
  },
  {
    id: "privacy",
    question: "How is my identity and banking information used?",
    answer: "Your information is used for identity verification, transaction processing, risk management and legal obligations. Under our privacy policy, information may be disclosed when needed to service providers, recipient financial institutions or legal authorities. The policy explains information protection and your privacy rights.",
    link: { href: "/en/legal/privacy-policy", label: "Read the privacy policy" },
  },
];

export function getFaqItems(locale: string): FaqItem[] {
  return locale === "en" ? faqsEn : faqsFa;
}

export function getFaqAnswerText(faq: FaqItem): string {
  return faq.link ? `${faq.answer} ${faq.link.label}` : faq.answer;
}
