import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header/Header";
import Hero from "@/components/sections/Hero/Hero";
import RateSection from "@/components/sections/RateSection/RateSection";
import TrustStrip from "@/components/sections/TrustStrip/TrustStrip";
import HowItWorks from "@/components/sections/HowItWorks/HowItWorks";
import FAQSection from "@/components/sections/FAQSection/FAQSection";
import FinalCTA from "@/components/sections/FinalCTA/FinalCTA";
import Footer from "@/components/layout/Footer/Footer";
import MarketProviders from "@/components/providers/MarketProviders";
import { getRatesSnapshot } from "@/lib/rates";
import { getFinanceConfig } from "@/lib/finance-config";
import ExchangeHighlightSection from "@/components/sections/ExchangeHighlight/ExchangeHighlightSection";

// ۱. فعال‌سازی کش ۵ دقیقه‌ای برای کل صفحه (ISR)
export const revalidate = 300; 

// ۲. تولید استاتیک مسیرهای اصلی در زمان دیپلوی برای سرعت حداکثری
export function generateStaticParams() {
  return [{ locale: 'fa' }, { locale: 'en' }];
}

function SectionLoadingFallback({ label }: { label: string }) {
  return (
    <div role="status" className="w-full" style={{ minHeight: "320px", backgroundColor: "#080B12" }}>
      <span className="sr-only">در حال بارگذاری {label}</span>
    </div>
  );
}

const AboutSection = dynamic(() => import("@/components/sections/AboutSection/AboutSection"), {
  loading: () => <SectionLoadingFallback label="درباره زرمان" />,
});

const ServiceSection = dynamic(() => import("@/components/sections/ServiceSection/ServiceSection"), {
  loading: () => <SectionLoadingFallback label="خدمات صرافی" />,
});

const TestimonialSection = dynamic(() => import("@/components/sections/Testimonial/TestimonialSection"), {
  loading: () => <SectionLoadingFallback label="نظرات مشتریان" />,
});

const PRODUCTION_URL = "https://zarman.com.au";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";

  const pageTitle =
    "صرافی زرمان | Zarman Exchange | بهترین نرخ دلار استرالیا";

  const pageDescription = isEn
    ? "Transfer AUD to Iran with dynamic, volume-based exchange rates. AUSTRAC-registered. Fast settlement. Enterprise-grade compliance. Start in minutes."
    : "استارتاپ نوین برای تبادل دلار استرالیا (AUD) و تومان (IRT) با نرخ‌های شخصی‌سازی‌شده، تسویه فوری و پایبندی کامل به استانداردهای قانونی در استرالیا.";

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: `${PRODUCTION_URL}/${locale}`,
      languages: {
        "en-AU": `${PRODUCTION_URL}/en`,
        "fa-IR": `${PRODUCTION_URL}/fa`,
        "x-default": `${PRODUCTION_URL}/fa`,
      },
    },
    keywords: isEn
      ? [
          "AUD to IRT remittance",
          "send money Australia to Iran",
          "AUD to toman exchange rate",
          "AUSTRAC registered remittance",
          "Australia Iran money transfer",
          "personalised exchange rate",
          "Zarman Exchange",
        ]
      : [
          "صرافی استرالیا",
          "حواله دلار استرالیا",
          "بهترین نرخ دلار استرالیا",
          "قیمت دلار استرالیا",
          "خرید و فروش دلار",
          "دلار استرالیا",
          "نرخ دلار سیدنی",
          "انتقال پول به ایران",
          "قیمت دلار استرالیا امروز",
          "حواله ارز به ایران",
          "صرافی آنلاین استرالیا",
          "زرمان اکسچنج",
          "زرمان",
          "صرافی زرمان",
          "زرمان تبادل",
          "زرمان نرخ",
          "زرمان دلار",
          "زرمان تومان",
          "زرمان استرالیا",
          "زرمان ایران",
        ],
    openGraph: {
      type: "website",
      url: `${PRODUCTION_URL}/${locale}`,
      title: pageTitle,
      description: pageDescription,
    },
  };
}

function buildFaqSchema(locale: string) {
  const faqs =
    locale === "en"
      ? [
          {
            q: "What is a personalised rate?",
            a: "Zarman rewards loyal customers with a Loyalty Rate system. Every AUD 5,000 in transactions earns loyalty credit that improves your exchange rate on future requests. Your personalised rate is always shown before you confirm an order.",
          },
          {
            q: "Why do I need to complete identity verification (KYC)?",
            a: "Identity verification is required under AUSTRAC's Anti-Money Laundering and Counter-Terrorism Financing (AML/CTF) rules. Simply upload a valid ID and your details are confirmed quickly so you can start transacting straight away.",
          },
          {
            q: "How can I trust a remittance service with my money?",
            a: "A legitimate Australian remittance dealer holds a registered ABN/ACN and is listed on the AUSTRAC Remittance Sector Register. Zarman is a registered remittance dealer — you can verify us at https://online.apps.austrac.gov.au/rsr/",
          },
          {
            q: "How is my banking and personal data protected?",
            a: "Zarman uses enterprise-grade encryption and secure server infrastructure. Your personal and banking data is processed solely for KYC compliance and is never shared with third parties.",
          },
        ]
      : [
          {
            q: "بهترین نرخ دلار استرالیا را از کجا بگیرم؟",
            a: "بهترین نرخ دلار استرالیا (AUD) در زرمان بر اساس یک سیستم هوشمند و در قالب «نرخ وفاداری» محاسبه می‌شود. در این مکانیزم، با افزایش حجم حواله‌های شما، نرخ اختصاصی بهتری اعمال خواهد شد. شما می‌توانید قیمت دلار استرالیا امروز را در ماشین‌حساب صفحه اصلی مشاهده کنید؛ اما به یاد داشته باشید که با ثبت تراکنش‌های مداوم، این نرخ به صورت خودکار بهبود یافته و به یک قیمت کاملاً شخصی سازی شده و رقابتی تبدیل می‌شود.",
          },
          {
            q: "حواله دلار بین استرالیا و ایران چگونه کار می‌کند؟",
            a: "حواله دلار استرالیا در زرمان به دلیل محدودیت‌های انتقال مستقیم، از طریق یک سیستم ایمن و یکپارچه به نام تسویه آفست (Offset Settlement) انجام می‌شود. در این روش، شما معادل ریالی یا دلاری وجه را به حساب‌های داخلی زرمان در ایران یا استرالیا واریز می‌کنید و سیستم تهاتر ما، مبلغ را در سوی دیگر کریدور به حساب مقصد منتقل می‌کند. این فرآیند کاملاً قانونی، سریع و شفاف بوده و منطبق بر استانداردهای صرافی‌های ثبت‌شده نزد AUSTRAC است.",
          },
          {
            q: "قیمت دلار استرالیا امروز چقدر است؟",
            a: "قیمت دلار استرالیا (AUD) نسبت به تومان (IRT) به صورت لحظه‌ای در بخش ماشین‌حساب زرمان در دسترس است. برای خرید و فروش دلار استرالیا با بهترین نرخ روز، کافی است مراحل ثبت‌نام و احراز هویت اولیه را در پلتفرم تکمیل کنید. پس از ورود به پنل کاربری، امکان ثبت درخواست، رصد نوسانات بازار و مدیریت حواله‌ها در بستری هوشمند برای شما فراهم خواهد بود تا بتوانید بهترین زمان را برای انتقال سرمایه خود انتخاب کنید.",
          },
          {
            q: "منظور از نرخ شخصی‌سازی‌شده چیست؟",
            a: "زرمان برای قدردانی از همراهی شما، سیستم «نرخ وفاداری» را طراحی کرده است. با ثبت‌نام در زرمان، به ازای هر ۵۰۰۰ دلار تراکنش، اعتبار وفاداری دریافت می‌کنید. این اعتبار در درخواست‌های بعدی باعث بهبود چشمگیر نرخ تبدیل ارز به نفع شما می‌شود. نرخ نهایی و اختصاصی شما همیشه پیش از تایید نهایی سفارش، در پنل کاربری به شما نمایش داده می‌شود.",
          },
          {
            q: "چرا باید احراز هویت (KYC) انجام دهم؟",
            a: "احراز هویت جهت رعایت قوانین مبارزه با پول‌شویی (AML/CTF) از الزامات سازمان اطلاعات مالی استرالیا (AUSTRAC) است. طبق استانداردهای جدید، تنها با وارد کردن مشخصات کارت شناسایی معتبر خود، سیستم در کوتاه‌ترین زمان هویت شما را تایید کرده و می‌توانید بلافاصله تراکنش‌هایتان را آغاز کنید.",
          },
          {
            q: "چگونه می‌توانم به یک صرافی برای انتقال سرمایه خود اعتماد کنم؟",
            a: "اعتبار یک صرافی رسمی در استرالیا، از طریق داشتن شماره‌های ثبت شرکتی (ABN و ACN) و تاییدیه سازمان اطلاعات مالی استرالیا (AUSTRAC) مشخص می‌شود. زرمان به‌عنوان یک نهاد مالی ثبت‌شده، پیشنهاد می‌کند برای اطمینان خاطر، همواره نام صرافی‌ها را در سامانه رسمی دولت استرالیا از طریق https://online.apps.austrac.gov.au/rsr/ بررسی کنید.",
          },
          {
            q: "امنیت اطلاعات بانکی و هویتی من در زرمان چگونه تامین می‌شود؟",
            a: "پلتفرم زرمان از پیشرفته‌ترین پروتکل‌های رمزنگاری داده‌ها و زیرساخت‌های سرور امن برای محافظت از اطلاعات شما استفاده می‌کند. اطلاعات هویتی و بانکی شما منحصراً برای الزامات قانونی احراز هویت پردازش شده و تحت هیچ شرایطی در اختیار اشخاص ثالث قرار نخواهد گرفت.",
          },
        ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

function buildHowToSchema(locale: string) {
  const isEn = locale === "en";
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: isEn
      ? "How to Transfer Money from Australia to Iran with Zarman Exchange"
      : "چگونه از زرمان برای انتقال پول از استرالیا به ایران استفاده کنیم",
    description: isEn
      ? "Step-by-step guide to completing an AUD to IRT remittance via Zarman Exchange."
      : "راهنمای گام به گام ثبت درخواست حواله دلار استرالیا به تومان از طریق صرافی زرمان.",
    url: `${PRODUCTION_URL}/${locale}#how-it-works`,
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: isEn ? "Submit a Transaction Request" : "ثبت درخواست تراکنش",
        text: isEn
          ? "Sign in to your account, enter the desired amount in your dashboard, view the live rate, and submit your transaction request. You can also submit directly via WhatsApp."
          : "برای دریافت بهترین نرخ تبدیل، وارد حساب کاربری خود شده و مبلغ مورد نظر را در داشبورد وارد کنید. پس از مشاهده نرخ لحظه‌ای، درخواست تراکنش را ثبت نمایید.",
        url: `${PRODUCTION_URL}/${locale}/register`,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: isEn ? "Complete Identity Verification (KYC)" : "احراز هویت (KYC)",
        text: isEn
          ? "As required by Australian financial law, submit a valid government-issued ID and proof of address. Verification is fast and straightforward."
          : "مطابق با قوانین مالی استرالیا، پیش از انجام تراکنش، احراز هویت شما توسط زرمان الزامی است. این فرآیند ساده شامل ارسال مدرک شناسایی معتبر و تاییدیه محل سکونت می‌باشد.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: isEn ? "Deposit Funds" : "واریز وجه",
        text: isEn
          ? "After identity approval, you will receive Zarman's bank account details. Transfer the specified amount within the agreed timeframe."
          : "پس از تایید هویت، اطلاعات حساب بانکی جهت واریز در اختیار شما قرار می‌گیرد. مبلغ مشخص‌شده را در زمان مقرر به حساب زرمان واریز نمایید.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: isEn ? "Transfer & Final Settlement" : "انتقال و تسویه نهایی",
        text: isEn
          ? "Once payment is confirmed, funds are transferred to the destination account at the highest speed and an official transaction receipt is sent to your email."
          : "به محض تایید دریافت وجه، فرآیند انتقال به حساب مقصد با بالاترین سرعت انجام پذیرفته و رسید رسمی تراکنش به ایمیل شما ارسال می‌گردد.",
      },
    ],
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // این کوئری‌ها حالا فقط هر ۵ دقیقه یک‌بار در پس‌زمینه اجرا می‌شوند
  // و کاربر دیگر منتظر پاسخ دیتابیس نمی‌ماند.
  const [rateSnapshot, financeConfig] = await Promise.all([
    getRatesSnapshot(),
    getFinanceConfig(),
  ]);

  const faqSchema = buildFaqSchema(locale);
  const howToSchema = buildHowToSchema(locale);

  return (
    <MarketProviders initialData={rateSnapshot} initialFinanceConfig={financeConfig}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <Header />
      <div className="flex flex-col w-full relative">
        <Hero />
        <RateSection />
        <AboutSection />

        <TrustStrip />
        <ServiceSection />
        <HowItWorks />
        <TestimonialSection />
        <FAQSection />
        <ExchangeHighlightSection />
        <FinalCTA />
      </div>
      <Footer />
    </MarketProviders>
  );
}