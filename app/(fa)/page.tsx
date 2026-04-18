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

// Server-side metadata for SEO
export const metadata: Metadata = {
  title: "Zarman Exchange Money | صرافی زرمان",
  description: "پلتفرم نوین انتقال امن، شفاف و سریع پول بین استرالیا و ایران ( AUD ↔ IRR )",
  keywords: ["صرافی استرالیا", "حواله دلار استرالیا", "زرمان اکسچنج", "انتقال پول به استرالیا"],
  openGraph: {
    title: "Zarman Exchange Money | صرافی زرمان",
    description: "پلتفرم نوین انتقال امن، شفاف و سریع پول بین استرالیا و ایران ( AUD ↔ IRR )",
    url: "https://zarman.com.au",
    siteName: "Zarman Exchange",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function Home() {
  return (
    <>
      <Header />
      <main id="main-content">
        <Hero />
        <TrustStrip />
        <RateSection />
        <AboutSection />
        <HowItWorks />
        <ServiceSection />
        <TestimonialSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}