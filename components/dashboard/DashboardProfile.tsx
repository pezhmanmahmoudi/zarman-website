import React, { useState } from "react";
import { UserCircle2, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import styles from "@/styles/dashboard/DashboardProfile.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";

export function DashboardProfile({ profileFields, profileId }: any) {
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [kycUploading, setKycUploading] = useState(false);
  const [kycUploadStatus, setKycUploadStatus] = useState("");

  const handleKycUpload = async () => {
    if (!profileId || !kycFile || kycUploading) return;
    try {
      setKycUploading(true); setKycUploadStatus("در حال آپلود مدرک...");
      const fileExt = kycFile.name.split(".").pop();
      const safeExt = fileExt ? fileExt.toLowerCase() : "file";
      const filePath = `${profileId}/${Date.now()}.${safeExt}`;
      const { error } = await supabase.storage.from("kyc-documents").upload(filePath, kycFile, { cacheControl: "3600", upsert: false });
      if (error) { setKycUploadStatus("آپلود فایل با خطا مواجه شد."); return; }
      setKycUploadStatus("مدرک با موفقیت آپلود شد."); setKycFile(null);
    } finally { setKycUploading(false); }
  };

  return (
    <article className={cardStyles.panelCard}>
      <div className={styles.profileHeader}>
        <h2 className={cardStyles.panelTitle} style={{marginBottom: 0}}><UserCircle2 size={24} /> اطلاعات هویتی و امنیتی</h2>
        <label className={styles.uploadBtn}>
          <UploadCloud size={20} /> آپلود مدارک هویتی جدید
          <input type="file" hidden accept="image/*,.pdf" onChange={(e) => setKycFile(e.target.files?.[0] || null)} />
        </label>
      </div>
      <div className={styles.profileGrid}>
        {profileFields.length === 0 ? <div className={styles.inputGroup}><label>اطلاعات</label><div className={styles.inputControl}>یافت نشد</div></div> :
          profileFields.map((field: any) => (
            <div key={field.id} className={styles.inputGroup}>
              <label>{field.label}</label>
              <div className={styles.inputControl} dir="ltr" style={{ textAlign: 'left' }}>
                {field.value}
              </div>
            </div>
          ))}
      </div>
      <div className={styles.uploadActions}>
        <button className={cardStyles.primaryButton} onClick={handleKycUpload} disabled={!kycFile || kycUploading} type="button">
          <UploadCloud size={18} /> {kycUploading ? "در حال آپلود..." : "ارسال مدرک برای بررسی"}
        </button>
        {kycFile && <span className={styles.fileName}>{kycFile.name}</span>}
        {kycUploadStatus && <p className={styles.uploadStatus}>{kycUploadStatus}</p>}
      </div>
    </article>
  );
}