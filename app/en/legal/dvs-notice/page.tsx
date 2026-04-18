import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "@/styles/Legal.module.css";

export const metadata: Metadata = {
  title: "Identity Verification Collection Notice | Zarman Exchange",
  description: "Document Verification Service (DVS) Collection Notice for Zarman Exchange",
  openGraph: {
    title: "Identity Verification Collection Notice",
    description: "DVS Collection Notice - How Zarman Exchange collects your identity information",
    url: "https://zarman.com.au/en/legal/dvs-notice",
    type: "website",
  },
  alternates: {
    canonical: "/en/legal/dvs-notice",
    languages: {
      en: "/en/legal/dvs-notice",
      fa: "/",
      "x-default": "/",
    },
  },
};

export default function DVSNoticePage() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <Link href="/fa/register" className={styles.backBtn}>
          <ArrowLeft size={18} /> Back to Registration
        </Link>

        <header className={styles.header}>
          <h1 className={styles.title}>Identity Verification Collection Notice</h1>
          <p className={styles.lastUpdated}>Document Verification Service (DVS)</p>
        </header>

        <div className={styles.content}>
          <p>
            This document explains how <strong>ZARMAN EXCHANGE PTY LTD</strong> [ABN: 70 692 742 957] (we, us, our) will collect, use, disclose and store your personal information to verify your identity.
          </p>
          <p>
            We are bound by the provisions of the <em>Privacy Act 1988 (Cth)</em> (Privacy Act), including the Australian Privacy Principles (APPs), as well as the <em>Identity Verification Services Regulations 2021</em>.
          </p>

          <h2>Why is your personal information being collected?</h2>
          <p>
            We are required and authorised by the <em>Anti-Money Laundering and Counter-Terrorism Financing Act 2006</em> (AML/CTF Act) to verify your identity before we can provide you with remittance services.
          </p>

          <h2>How will we handle your personal information?</h2>
          <p>
            We collect your personal information through our website, online forms, and in-person interactions. The information you provide will be sent to the DVS Hub, administered by the Attorney-General's Department.
          </p>
          <p>
            We do store copies of your identity documents after the DVS check is complete. This information will be retained for 7 years as prescribed by our obligations under the AML/CTF Act.
          </p>

          <h2>How will the Attorney-General&apos;s Department handle your personal information?</h2>
          <p>
            The DVS Hub facilitates information transfer between us and the document issuer. The DVS Hub itself does not retain any personal information and the Attorney-General's Department will not retain your information once the verification is complete.
          </p>

          <h2>What happens if you don&apos;t provide your personal information?</h2>
          <p>
            You do not have to agree to verify your identity documents through the DVS. You can choose instead to attend a branch so we can verify your identity in person using original physical documents.
          </p>

          <h2>Other disclosures</h2>
          <p>Where necessary, we may disclose your personal information to third parties, including:</p>
          <ul>
            <li>Outsourced service providers that connect us to the DVS Hub;</li>
            <li>Identity service providers (such as RapidID);</li>
            <li>Law enforcement agencies in certain circumstances.</li>
          </ul>

          <h2>Contact details</h2>
          <p>
            Email: infor@zarman.com.au<br />
            Telephone: 0497851631<br />
            Postal address: Privacy Officer, ZARMAN EXCHANGE PTY LTD, U 2608 108 Donnison st, Gosford, NSW, 2250
          </p>
        </div>
      </div>
    </div>
  );
}