import type { Metadata } from "next";
import Header from "@/components/layout/Header/Header";
import Hero from "@/components/sections/Hero/Hero";
import RateSection from "@/components/sections/RateSection/RateSection";
import TrustStrip from "@/components/sections/TrustStrip/TrustStrip";
import AboutSection from "@/components/sections/AboutSection/AboutSection";
import HowItWorks from "@/components/sections/HowItWorks/HowItWorks";
import ServiceSection from "@/components/sections/ServiceSection/ServiceSection";
import TestimonialSection from "@/components/sections/Testimonial/TestimonialSection";
import FAQSection from "@/components/sections/FAQSection/FAQSection";
import FinalCTA from "@/components/sections/FinalCTA/FinalCTA";
import Footer from "@/components/layout/Footer/Footer";

// 🚀 سئوی هوشمند: فقط موارد اختصاصی این صفحه نوشته می‌شود تا با layout ادغام شود
export const metadata: Metadata = {
  title: "صفحه اصلی", 
  description: "پلتفرم نوین انتقال امن، شفاف و سریع پول بین استرالیا و ایران ( AUD ↔ IRR )",
  keywords: ["صرافی استرالیا", "حواله دلار استرالیا", "زرمان اکسچنج", "انتقال پول به استرالیا", "دلار استرالیا به تومان"],
};

export default function Home() {
  return (
    <>
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
    </>
  );
}