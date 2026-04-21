import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "@/styles/Legal.module.css";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms and conditions for using Zarman Exchange services.",
  alternates: {
    canonical: "/en/legal/terms",
  },
};

export default function TermsPage() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        
        <Link href="/fa/register" className={styles.backBtn}>
          <ArrowLeft size={18} /> Back to Registration
        </Link>

        <header className={styles.header}>
          <h1 className={styles.title}>Terms and Conditions</h1>
          <p className={styles.lastUpdated}>Last Updated: 26 March 2026</p>
        </header>

        <div className={styles.content}>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing, browsing, and/or using the <strong>Zarman Exchange Pty Ltd</strong> website, you agree to comply with and be bound by the following terms and conditions of use, which together with our privacy policy govern Zarman Exchange Pty Ltd&apos;s relationship with you in relation to this website.
          </p>
          <p>
            The terms &apos;Zarman Exchange&apos;, &apos;us&apos;, or &apos;we&apos; refers to the owner of the website. The term &apos;you&apos; refers to the user or viewer of our website.
          </p>
          <p>
            Use of this website is subject to the following terms and conditions: This website contains material owned by or licensed to us. Reproduction is prohibited other than in accordance with the copyright notice, which forms part of these terms and conditions.
          </p>

          <h2>2. Services Provided</h2>
          <p>
            Zarman Exchange offers currency exchange and remittance services, including buying and selling foreign currencies, subject to applicable laws and regulations.
          </p>

          <h2>3. Eligibility</h2>
          <p>
            You must be at least 18 years old and provide valid identification to use our services.
          </p>

          <h2>4. Fees and Charges</h2>
          <p>
            All transactions are subject to applicable fees, which will be disclosed prior to confirmation. Exchange rates may vary and are subject to market fluctuations.
          </p>

          <h2>5. AML/CTF Compliance</h2>
          <p>
            We comply with the <em>Anti-Money Laundering and Counter-Terrorism Financing Act 2006</em>. You agree to provide accurate information and cooperate with our identity verification procedures.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            Zarman Exchange is not liable for any indirect, incidental, or consequential damages arising from the use of our services, except as required by law.
          </p>

          <h2>7. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access to our services at any time for breach of these terms or legal obligations.
          </p>

          <h2>8. Governing Law</h2>
          <p>
            These Terms are governed by the laws of <strong>New South Wales (NSW)</strong>. Any disputes shall be resolved in the courts of New South Wales.
          </p>

          <h2>9. Indemnify</h2>
          <p>
            You indemnify and hold us and our agents, affiliates, directors, officers, employees, consultants, and contractors harmless from and against any and all liability, costs, claims, losses, damages, and expenses (including all reasonable legal fees) which may be suffered, incurred, made, or brought against any of the Indemnified Persons directly or indirectly in connection with your use of the website.
          </p>
        </div>
      </div>
    </div>
  );
}
