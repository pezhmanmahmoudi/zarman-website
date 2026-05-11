"use client";

import React from "react";
import Image from "next/image";
import { ShieldCheck, LogIn, CheckCircle2 } from "lucide-react";
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
        
        <div className={styles.cleanVerifyBox}>
          
          <div className={styles.inlineHeader}>
            <div className={`${styles.iconBadge} ${styles.iconBadgeSuccess}`}>
              <ShieldCheck size={35} color="#2500f7" strokeWidth={2.5} />
            </div>
            <h2 className={styles.inlineTitle}>
              Email Confirmed
            </h2>
          </div>
          
          <div className={styles.emailInfoWrapper}>
            <p className={styles.cleanSubtitle}>
              Your email address has been successfully verified. 
            </p>
          </div>


          <div className={styles.verificationNote}>
            <p className={styles.verificationNoteText}>
              <CheckCircle2 size={20} color="#10b981" strokeWidth={2.5} className={styles.flexShrinkZero} />
                <span> 
                  Your Zarman Exchange account is now ready for secure access.
                </span>
            </p>
          </div>

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