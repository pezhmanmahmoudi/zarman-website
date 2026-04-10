import React, { useState } from "react";
import { UserCircle2, UploadCloud, CheckCircle } from "lucide-react"; // 👈 اضافه شدن CheckCircle
import { supabase } from "@/lib/supabase";
import styles from "@/styles/dashboard/DashboardProfile.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";

export function DashboardProfile({ profileFields, profileId }: any) {
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [kycUploading, setKycUploading] = useState(false);
  const [kycUploadStatus, setKycUploadStatus] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false); // 👈 استیت جدید برای نمایش موفقیت

  const handleKycUpload = async () => {
    if (!profileId || !kycFile || kycUploading) return;
    try {
      setKycUploading(true); 
      setKycUploadStatus("در حال آپلود و رمزنگاری مدرک...");
      setUploadSuccess(false);

      const fileExt = kycFile.name.split(".").pop();
      const safeExt = fileExt ? fileExt.toLowerCase() : "file";
      const filePath = `${profileId}/${Date.now()}.${safeExt}`;
      const { error } = await supabase.storage.from("kyc-documents").upload(filePath, kycFile, { cacheControl: "3600", upsert: false });
      
      if (error) { 
        setKycUploadStatus("آپلود فایل با خطا مواجه شد."); 
        return; 
      }
      
      setKycUploadStatus("مدرک هویتی شما با موفقیت در سرور امن ذخیره شد."); 
      setUploadSuccess(true);
      setKycFile(null);
    } finally { 
      setKycUploading(false); 
    }
  };

  return (
    <article className={cardStyles.panelCard}>
      <div className={styles.profileHeader}>
        <h2 className={cardStyles.panelTitle} style={{marginBottom: 0}}><UserCircle2 size={24} /> اطلاعات هویتی و امنیتی</h2>
        <label className={styles.uploadBtn}>
          <UploadCloud size={20} /> آپلود مدارک هویتی جدید
          <input type="file" hidden accept="image/*,.pdf" onChange={(e) => {setKycFile(e.target.files?.[0] || null); setUploadSuccess(false); setKycUploadStatus("");}} />
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
          <UploadCloud size={18} /> {kycUploading ? "در حال پردازش..." : "ارسال مدرک برای بررسی"}
        </button>
        
        {/* 👈 UI جدید برای نمایش فایل انتخاب شده و وضعیت آپلود */}
        <div className={styles.statusContainer}>
          {kycFile && <span className={styles.fileName}>فایل انتخاب شده: {kycFile.name}</span>}
          
          {/* نوار لودینگ */}
          {kycUploading && (
            <div className={styles.progressWrapper}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill}></div>
              </div>
              <p className={styles.uploadStatus}>{kycUploadStatus}</p>
            </div>
          )}

          {/* پیام موفقیت */}
          {uploadSuccess && (
            <div className={styles.successMessage}>
              <CheckCircle size={18} />
              <p>{kycUploadStatus}</p>
            </div>
          )}
          
          {/* پیام خطا */}
          {(!kycUploading && !uploadSuccess && kycUploadStatus) && (
            <p className={styles.errorStatus}>{kycUploadStatus}</p>
          )}
        </div>
      </div>
    </article>
  );
}