"use client";

import { useState } from "react";
import { ReactLenis } from "lenis/react";
import Header from "@/components/header/Header";

import Hero from "@/components/hero/Hero";
import About from "@/components/about/About";
import Services from "@/components/services/Services";
import Aboutus from "@/components/AboutUs/AboutUs";
import SecuritySection from "@/components/securitysection/SecuritySection";

export default function Home() {
  const [isReady, setIsReady] = useState(false);
  const isLoggedIn = false;

  return (
    <ReactLenis root>
      <Header isAuthenticated={isLoggedIn} isReady={isReady} />

      <div>
        <Hero />
        <About />
        <Services />
        <Aboutus />
        <SecuritySection />
      </div>
    </ReactLenis>
  );
}
