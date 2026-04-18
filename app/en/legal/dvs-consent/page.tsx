import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "@/styles/Legal.module.css";

export const metadata: Metadata = {
  title: "DVS Consent Form | Zarman Exchange",
  description: "Document Verification Service (DVS) Consent Form for identity verification",
  openGraph: {
    title: "DVS Consent Form",
    description: "Consent form for identity verification through Document Verification Service",
    url: "https://zarman.com.au/en/legal/dvs-consent",
    type: "website",
  },
  alternates: {
    canonical: "https://zarman.com.au/en/legal/dvs-consent",
  },
};

export default function DVSConsentPage() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <Link href="/fa/register" className={styles.backBtn}>
          <ArrowLeft size={18} /> Back to Registration
        </Link>

        <header className={styles.header}>
          <h1 className={styles.title}>DVS Consent Form</h1>
          <p className={styles.lastUpdated}>Document Verification Service</p>
        </header>

        <div className={styles.content}>
          <p>
            By using the Document Verification Service (DVS), you consent to the collection, use, and disclosure of your personal information as described in our Identity Verification Collection Notice.
          </p>
          <p>
            You understand that your identity documents will be verified through the DVS Hub and that information may be disclosed to the document issuer and relevant authorities as required by law.
          </p>

          <h2>Your Consent</h2>
          <p>
            I understand that ZARMAN EXCHANGE PTY LTD will collect and use my personal information for identity verification purposes in accordance with the Privacy Act 1988 (Cth) and the Identity Verification Services Regulations 2021.
          </p>

          <h2>Data Retention</h2>
          <p>
            I acknowledge that copies of my identity documents will be retained for 7 years as required by the AML/CTF Act.
          </p>

          <h2>Contact</h2>
          <p>
            For questions about this consent form, please contact us at infor@zarman.com.au or 0497851631.
          </p>
        </div>
      </div>
    </div>
  );
}