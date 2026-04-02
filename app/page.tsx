"use client";

import { ReactLenis } from "lenis/react";

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

export default function Home() {
  return (
    <ReactLenis root>
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
    </ReactLenis>
  );
}

