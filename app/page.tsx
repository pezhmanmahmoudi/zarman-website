/*"use client";

import { ReactLenis } from "lenis/react";

import Header from "@/components/layout/Header/Header";
import Hero from "@/components/sections/Hero/Hero";
import TrustStrip from "@/components/sections/TrustStrip/TrustStrip";
import RateSection from "@/components/sections/RateSection/RateSection";
import AboutSection from "@/components/sections/AboutSection/AboutSection";
import HowItWorks from "@/components/sections/HowItWorks/HowItWorks";
import ServicesSection from "@/components/sections/ServicesSection/ServicesSection";
import WhyZarman from "@/components/sections/WhyZarman/WhyZarman";
import SecuritySection from "@/components/sections/SecuritySection/SecuritySection";
import FAQSection from "@/components/sections/FAQSection/FAQSection";
import FinalCTA from "@/components/sections/FinalCTA/FinalCTA";
import Footer from "@/components/layout/Footer/Footer";

export default function Home() {
  return (
    <ReactLenis root>
      <Header />

      <main>
        <Hero />
        <TrustStrip />
        <RateSection />
        <AboutSection />
        <HowItWorks />
        <ServicesSection />
        <WhyZarman />
        <SecuritySection />
        <FAQSection />
        <FinalCTA />
      </main>

      <Footer />
    </ReactLenis>
  );
}



*/


"use client";

import { ReactLenis } from "lenis/react";

import Header from "@/components/layout/Header/Header";
import Hero from "@/components/sections/Hero/Hero";
import RateSection from "@/components/sections/RateSection/RateSection";
import TrustStrip from "@/components/sections/TrustStrip/TrustStrip";
/*import TrustStrip from "@/components/sections/TrustStrip/TrustStrip";
import RateSection from "@/components/sections/RateSection/RateSection";
import AboutSection from "@/components/sections/AboutSection/AboutSection"; */

export default function Home() {
  return (
    <ReactLenis root>
      <Header />
      <main id="main-content">
        <Hero />
        
        <RateSection />
      </main>
    </ReactLenis>
  );
}

