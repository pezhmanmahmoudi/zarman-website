"use client";

import React from "react";
import { ShieldCheck, LogIn } from "lucide-react";
import Image from "next/image";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import styles from "@/styles/Register.module.css"; 

export default function ConfirmEmailPage() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={styles.card} style={{ maxWidth: "480px", textAlign: "center" }}>
        
        {/* لوگو - مسیر اصلاح شده و بدون Space */}
        <div className={styles.logoContainer}>
          <Image
            src="/images/Logo%20no%20text%20light.svg"
            alt="Zarman Logo"
            width={64}
            height={64}
            className={styles.logoImage}
          />
        </div>
        
        <div className={styles.verifyBox}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
             <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "16px", borderRadius: "50%" }}>
               <ShieldCheck size={56} color="#10b981" />
             </div>
          </div>
          
          <h2 className={styles.title} style={{ fontSize: "1.75rem", marginBottom: "16px", fontWeight: "700" }}>
            Identity Verified Securely
          </h2>
          
          <p className={styles.subtitle} style={{ lineHeight: 1.6, marginBottom: "32px", fontSize: "0.95rem" }}>
            Your email address has been successfully verified. Your Zarman Exchange account is now protected and ready for secure access.
          </p>

          <div style={{ width: "100%" }}>
            <Button href="/fa/login" variant="primary" size="lg" fullWidth rightIcon={<LogIn />}>
              Proceed to Secure Login
            </Button>
          </div>

          <p style={{ marginTop: "24px", fontSize: "0.8rem", color: "var(--text-soft)", fontWeight: "500" }}>
            AUSTRAC Registered Independent Remittance Dealer
          </p>
        </div>

      </div>
    </div>
  );
}