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

function SectionLoadingFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full"
      style={{ minHeight: "320px", backgroundColor: "#080B12" }}
    >
      <span className="sr-only">در حال بارگذاری {label}</span>
    </div>
  );
}

const AboutSection = dynamic(
  () => import("@/components/sections/AboutSection/AboutSection"),
  {
    loading: () => <SectionLoadingFallback label="بخش درباره ما" />,
  },
);

const ServiceSection = dynamic(
  () => import("@/components/sections/ServiceSection/ServiceSection"),
  {
    loading: () => <SectionLoadingFallback label="بخش خدمات" />,
  },
);

const TestimonialSection = dynamic(
  () => import("@/components/sections/Testimonial/TestimonialSection"),
  {
    loading: () => <SectionLoadingFallback label="بخش نظرات کاربران" />,
  },
);

// 🚀 سئوی هوشمند: فقط موارد اختصاصی این صفحه نوشته می‌شود تا با layout ادغام شود
export const metadata: Metadata = {
  title: "صفحه اصلی",
  keywords: ["صرافی استرالیا", "حواله دلار استرالیا", "زرمان اکسچنج", "انتقال پول به استرالیا", "دلار استرالیا به تومان"],
};

export default async function Home() {
  const rateSnapshot = await getRatesSnapshot();

  return (
    <MarketProviders initialData={rateSnapshot}>
      <Header />

      {/* 🛡️ تگ main حذف شد تا با layout تداخل نکند و استانداردهای نابینایان (W3C) رعایت شود */}
      <div className="flex flex-col w-full relative">
        <Hero />
        <TrustStrip />
        <RateSection />
        <AboutSection />
        <HowItWorks />
        <ServiceSection />
        <TestimonialSection />
        <FAQSection />
        <FinalCTA />
      </div>

      <Footer />
    </MarketProviders>
  );
}
