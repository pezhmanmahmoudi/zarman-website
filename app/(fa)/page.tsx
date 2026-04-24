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

export const metadata: Metadata = {
  title: "قیمت گذاری هوشمند و شخصی سازی شده",
  description: "استارتاپ نوین برای تبادل دلار استرالیا (AUD) و تومان (IRT) با نرخ‌های شخصی سازی شده، تسویه فوری و پایبندی کامل به استانداردهای قانونی در استرالیا.", 
  alternates: {
    canonical: "/fa",
  },
  keywords: ["صرافی استرالیا", "حواله دلار استرالیا", "نرخ دلار سیدنی", "انتقال پول به ایران", "زرمان اکسچنج", "زرمان " , "صرافی زرمان", "زرمان تبادل", "زرمان نرخ", "زرمان دلار", "زرمان تومان", "زرمان استرالیا", "زرمان ایران"],
};

export default async function Home() {
  const rateSnapshot = await getRatesSnapshot();

  return (
    <MarketProviders initialData={rateSnapshot}>
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
        <FinalCTA />
      </div>
      <Footer />
    </MarketProviders>
  );
}