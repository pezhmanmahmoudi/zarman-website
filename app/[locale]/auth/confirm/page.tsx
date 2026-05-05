"use client";

import React from "react";
import Image from "next/image";
import { ShieldCheck, LogIn } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import AuthGradient from "@/components/ui/AuthGradient/AuthGradient";
import styles from "@/styles/Register.module.css"; 

export default function ConfirmEmailPage() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.gradientContainer} aria-hidden="true">
        <AuthGradient />
      </div>

      <div className={`${styles.card} ${styles.confirmCard}`}>
        
        <div className={styles.logoContainer}>
          <Image 
            src="/images/logo-no-text-light.svg" 
            alt="Zarman Logo" 
            width={80}
            height={80}
            priority
            className={styles.logoImage} 
          />
        </div>
        
        <div className={styles.verifyBox}>
          <div className={styles.successIconBox}>
             <div className={styles.successIconCircle}>
               <ShieldCheck size={56} color="var(--success, #10b981)" />
             </div>
          </div>
          
          <h2 className={`${styles.title} ${styles.confirmTitle}`}>
            Identity Verified Securely
          </h2>
          
          <p className={`${styles.subtitle} ${styles.confirmSubtitle}`}>
            Your email address has been successfully verified. Your Zarman Exchange account is now protected and ready for secure access.
          </p>

          <div className={styles.btnContainer}>
            <Button href="/fa/login" variant="primary" size="lg" fullWidth rightIcon={<LogIn />}>
              Proceed to Secure Login
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}