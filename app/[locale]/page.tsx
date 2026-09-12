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
import { getFaqItems, getFaqAnswerText } from "@/data/faq";
import { SITE_URL, organizationId, websiteId, getPageMetadata, serializeJsonLd } from "@/lib/seo";
import ExchangeHighlightSection from "@/components/sections/ExchangeHighlight/ExchangeHighlightSection";

export const revalidate = 300;

export function generateStaticParams() {
  return [{ locale: "fa" }, { locale: "en" }];
}

const AboutSection = dynamic(() => import("@/components/sections/AboutSection/AboutSection"));
const ServiceSection = dynamic(() => import("@/components/sections/ServiceSection/ServiceSection"));
const TestimonialSection = dynamic(() => import("@/components/sections/Testimonial/TestimonialSection"));

function homeCopy(locale: string) {
  return locale === "en"
    ? {
        title: "Send Money from Australia to Iran | AUD to Toman",
        description: "Check AUD to Iranian toman exchange rates, calculate your transfer and request an Australia to Iran remittance with Zarman. Support in English and Persian.",
      }
    : {
        title: "حواله استرالیا به ایران و نرخ دلار استرالیا",
        description: "نرخ خرید و فروش دلار استرالیا به تومان را در صرافی زرمان ببینید، مبلغ حواله را محاسبه کنید و درخواست انتقال پول از استرالیا به ایران را با پشتیبانی فارسی ثبت کنید.",
      };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return getPageMetadata({ locale, path: "", ...homeCopy(locale) });
}

function buildHomeSchema(locale: string) {
  const isEn = locale === "en";
  const pageUrl = `${SITE_URL}/${locale}`;
  const pageId = `${pageUrl}#webpage`;
  const faqId = `${pageUrl}#faq`;
  const serviceId = `${SITE_URL}/#aud-irt-service`;
  const copy = homeCopy(locale);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageId,
        url: pageUrl,
        name: copy.title,
        description: copy.description,
        inLanguage: isEn ? "en-AU" : "fa",
        isPartOf: { "@id": websiteId },
        about: { "@id": organizationId },
        mainEntity: { "@id": serviceId },
        hasPart: { "@id": faqId },
      },
      {
        "@type": "Service",
        "@id": serviceId,
        name: isEn ? "Australia to Iran money transfer" : "حواله استرالیا به ایران",
        serviceType: isEn ? "AUD to Iranian toman remittance" : "حواله دلار استرالیا به تومان",
        description: isEn
          ? "Request an AUD to Iranian toman transfer with identity verification, an exchange rate quote and status tracking in your Zarman dashboard."
          : "ثبت درخواست حواله دلار استرالیا به تومان با احراز هویت، مشاهده نرخ و پیگیری وضعیت در پنل زرمان.",
        provider: { "@id": organizationId },
        areaServed: [
          { "@type": "Country", name: "Australia" },
          { "@type": "Country", name: "Iran" },
        ],
        availableChannel: {
          "@type": "ServiceChannel",
          serviceUrl: pageUrl,
        },
      },
      {
        "@type": "FAQPage",
        "@id": faqId,
        url: faqId,
        inLanguage: isEn ? "en-AU" : "fa",
        isPartOf: { "@id": pageId },
        mainEntity: getFaqItems(locale).map((faq) => ({
          "@type": "Question",
          "@id": `${pageUrl}#faq-${faq.id}`,
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: getFaqAnswerText(faq) },
        })),
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
  const [rateSnapshot, financeConfig] = await Promise.all([
    getRatesSnapshot(),
    getFinanceConfig(),
  ]);

  return (
    <MarketProviders initialData={rateSnapshot} initialFinanceConfig={financeConfig}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildHomeSchema(locale)) }}
      />
      <Header />
      <div className="flex flex-col w-full relative">
        <Hero />
        <RateSection />
        <AboutSection />
        <TrustStrip />
        <ServiceSection />
        <HowItWorks />
        <TestimonialSection locale={locale} />
        <FAQSection locale={locale} />
        <ExchangeHighlightSection />
        <FinalCTA />
      </div>
      <Footer />
    </MarketProviders>
  );
}
