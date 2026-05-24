import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "@/styles/Legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Zarman Exchange.",
  alternates: {
    canonical: "/en/legal/privacy-policy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>

        <div className={styles.topNav}>
          <Link href="/" className={styles.backHome} aria-label="Back to Website">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </Link>
        </div>

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

        <header className={styles.header}>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.lastUpdated}>Last Updated: 26 March 2026</p>
        </header>

        <div className={styles.content}>
          <h2>1. Our Commitment to Your Privacy</h2>
          <p>
            <strong>ZARMAN EXCHANGE PTY LTD</strong> (ABN: 70 692 742 957) (referred to as “we”, “us”, or “our”) is committed to protecting your privacy. We are bound by the <em>Privacy Act 1988 (Cth)</em> (Privacy Act) and the Australian Privacy Principles (APPs).
          </p>
          <p>
            This Privacy Policy outlines how we collect, use, hold, and disclose your personal information. It also covers your rights to access and correct your information and how to make a complaint. This policy is available free of charge on our website: zarman.com.au
          </p>

          <h2>2. What Personal Information We Collect</h2>
          <p>We collect personal information that is reasonably necessary for us to provide our products and services to you. The types of information we may collect and hold include:</p>
          <ul>
            <li><strong>Identity Information:</strong> e.g., Full name, date of birth, occupation.</li>
            <li><strong>Contact Information:</strong> e.g., Proof of address, phone numbers, email addresses.</li>
            <li><strong>Identification Documents:</strong> e.g., Australian Driving Licence, Australian Government-issued ID, or International Passport.</li>
            <li><strong>Financial Information:</strong> e.g., Beneficiary bank account details, transaction history.</li>
            <li><strong>Technical Information:</strong> e.g., IP address, device type.</li>
          </ul>
          <p>
            We will not collect sensitive information about you (such as information about your health, race, or political opinions) without your consent, unless an exemption in the APPs applies.
          </p>

          <h2>3. How and Why We Collect Your Information</h2>
          <p>We collect your information in the following ways:</p>
          <ul>
            <li><strong>Directly from You:</strong> When you register for an account, fill out forms, contact us by phone or email, or use our services.</li>
            <li><strong>From Third Parties:</strong> We may collect information from third parties such as electronic verification services (to verify your identity), referrers, or publicly available sources.</li>
          </ul>
          <p>
            <strong>Why we collect it:</strong> Our primary purpose for collecting your information is to provide you with our financial exchange services. This includes verifying your identity in line with our legal obligations, processing transactions, and managing risks.
          </p>

          <h2>4. Anonymity and Pseudonymity</h2>
          <p>
            We do not give you the option of dealing with us anonymously or under a pseudonym. This is because it is impracticable and illegal for us to provide our services to unidentified individuals (due to our obligations under the <em>Anti-Money Laundering and Counter-Terrorism Financing Act 2006</em>).
          </p>

          <h2>5. How We Use and Disclose Your Information</h2>
          <p>
            We do not sell, share, or rent your personal information to third parties for their promotional purposes. We may disclose information to Service Providers (IT support, fraud prevention) or Law Enforcement and Regulators where necessary to comply with the law.
          </p>
          <h3>Cross-Border (Overseas) Disclosure</h3>
          <p>
            To process your transactions, we may need to disclose your personal information to recipients located outside Australia (e.g., Beneficiary financial institutions or global settlement network partners).
          </p>

          <h2>6. How We Hold and Secure Your Information</h2>
          <p>
            We take reasonable steps to protect your information from misuse, interference, loss, and from unauthorised access. These steps include Technical Measures (encryption, firewalls, two-factor authentication), Access Controls, and Physical Security.
          </p>

          <h2>7. Cookies and Website Analytics</h2>
          <p>
            When you visit our website, we may use cookies and other tracking technologies. We use cookies to facilitate your access and understand how you interact with our website.
          </p>

          <h2>8. Your Rights: Access and Correction</h2>
          <p>
            You have the right to request access to and correction of the personal information we hold about you. You can request access by contacting our Privacy Officer. We will respond within a reasonable period (generally within 30 days).
          </p>

          <h2>9. How to Make a Complaint</h2>
          <p>
            If you have a concern about how we handled your personal information, please contact our Privacy Officer first. If you are not satisfied, you have the right to lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au.
          </p>

          <h2>10. Contact Us</h2>
          <p>For any privacy-related queries, please contact us:</p>
          <ul>
            <li><strong>Email:</strong> info@zarman.com.au</li>
            <li><strong>Phone:</strong> 0497851631</li>
          </ul>

        </div>
      </div>
    </div>
  );
}
