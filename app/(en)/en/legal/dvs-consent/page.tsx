import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "@/styles/Legal.module.css";

export default function DVSConsentPage() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        
        <Link href="/fa/register" className={styles.backBtn}>
          <ArrowLeft size={18} /> Back to Registration
        </Link>

        <header className={styles.header}>
          <h1 className={styles.title}>Identity Verification Consent</h1>
          <p className={styles.lastUpdated}>Zarman Exchange Pty Ltd</p>
        </header>

        <div className={styles.content} style={{ marginTop: '40px', padding: '30px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '1.2rem', fontWeight: 500, color: '#0f172a', lineHeight: 1.8, margin: 0 }}>
            &quot;I confirm that I am authorised to provide the personal details and identity documents presented. I consent to <strong>Zarman Exchange Pty Ltd</strong> checking my personal information and documents with the official document issuer or official record holder via third-party verification systems for the sole purpose of confirming my identity.&quot;
          </p>
        </div>
        
      </div>
    </div>
  );
}