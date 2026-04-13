"use client";

import React from "react";
import { CheckCircle2, LogIn } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import styles from "@/styles/Register.module.css"; 

export default function ConfirmEmailPage() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={styles.card} style={{ maxWidth: "480px" }}>
        
        {/* لوگو */}
        <div className={styles.logoContainer}>
          <img src="/images/Logo%20no%20text%20light.svg" alt="Zarman Logo" className={styles.logoImage} />
        </div>
        
        <div className={styles.verifyBox}>
          <CheckCircle2 size={64} color="#10b981" style={{ marginBottom: "20px" }} />
          
          <h2 className={styles.title} style={{ fontSize: "1.75rem", marginBottom: "12px" }}>
            Registration Complete!
          </h2>
          
          <p className={styles.subtitle} style={{ lineHeight: 1.6, marginBottom: "32px" }}>
            Your email has been verified successfully. Your account is now active and you can securely log in to Zarman Exchange.
          </p>

          <div style={{ width: "100%" }}>
            <Button href="/fa/login" variant="primary" size="lg" fullWidth rightIcon={<LogIn />}>
              Proceed to Login
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}