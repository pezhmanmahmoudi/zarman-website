"use client";

import React, { useState } from "react";
import { UserCircle2, UploadCloud, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import styles from "@/styles/dashboard/DashboardProfile.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";

const MAX_FILE_SIZE = 5 * 1024 * 1024; 
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf'
};

export function DashboardProfile({ profileFields, profileId }: any) {
  const [kycFiles, setKycFiles] = useState<File[]>([]);
  const [kycUploading, setKycUploading] = useState(false);
  const [kycUploadStatus, setKycUploadStatus] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).slice(0, 3);
      for (const file of selectedFiles) {
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          alert(`فرمت فایل ${file.name} غیرمجاز است. فقط عکس (JPG/PNG) و PDF مجاز است.`);
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          alert(`حجم فایل ${file.name} بیش از ۵ مگابایت است.`);
          return;
        }
      }
      setKycFiles(selectedFiles);
      setUploadSuccess(false);
      setKycUploadStatus("");
    }
  };

  const generateSecureRandomString = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleKycUpload = async () => {
    if (!profileId || kycFiles.length === 0 || kycUploading) return;
    try {
      setKycUploading(true); 
      setKycUploadStatus(`در حال تأیید امنیت و آپلود ${kycFiles.length} مدرک...`);
      setUploadSuccess(false);
      let hasError = false;

      for (let i = 0; i < kycFiles.length; i++) {
        const file = kycFiles[i];
        const safeExt = EXTENSION_MAP[file.type] || 'bin';
        const secureFileName = `${Date.now()}_${generateSecureRandomString()}_${i + 1}.${safeExt}`;
        const filePath = `${profileId}/${secureFileName}`;
        
        const { error } = await supabase.storage.from("kyc-documents").upload(filePath, file, { cacheControl: "3600", upsert: false });
        if (error) { hasError = true; console.error("Secure Upload Error:", error); }
      }

      if (hasError) {
        setKycUploadStatus("آپلود برخی از فایل‌ها با خطا مواجه شد. لطفاً فرمت و حجم را بررسی کنید."); 
        return; 
      }
      
      setKycUploadStatus("مدارک هویتی شما با موفقیت در سرورهای امن ذخیره شد."); 
      setUploadSuccess(true);
      setKycFiles([]); 
    } catch (err) {
      setKycUploadStatus("خطای سیستمی رخ داد. لطفاً مجدداً تلاش کنید.");
      console.error(err);
    } finally { 
      setKycUploading(false); 
    }
  };

  return (
    <article className={cardStyles.panelCard}>
      <div className={styles.profileHeader}>
        {/* 🚀 استایل خطی حذف و با کلاس profileTitle جایگزین شد */}
        <h2 className={`${cardStyles.panelTitle} ${styles.profileTitle}`}>
          <UserCircle2 size={24} /> اطلاعات هویتی و امنیتی
        </h2>
        <label className={styles.uploadBtn}>
          <UploadCloud size={20} /> آپلود مدارک
          <input type="file" multiple hidden accept="image/jpeg, image/png, application/pdf" onChange={handleFileChange} />
        </label>
      </div>
      
      <div className={styles.profileGrid}>
        {profileFields.length === 0 ? (
          <div className={styles.inputGroup}>
            <label>اطلاعات</label>
            <div className={styles.inputControl}>یافت نشد</div>
          </div>
        ) : (
          profileFields.map((field: any) => (
            <div key={field.id} className={styles.inputGroup}>
              <label>{field.label}</label>
              {/* 🚀 استایل خطی کاملاً حذف شد و به CSS سپرده شد */}
              <div 
                className={`${styles.inputControl} ${field.dir === "rtl" ? styles.dirRtl : styles.dirLtr}`} 
                dir={field.dir || "ltr"} 
              >
                {field.value || "تنظیم نشده"}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className={styles.uploadActions}>
        <button className={cardStyles.primaryButton} onClick={handleKycUpload} disabled={kycFiles.length === 0 || kycUploading} type="button">
          <UploadCloud size={18} /> {kycUploading ? "در حال ارسال امن..." : "ارسال مدارک برای بررسی"}
        </button>
        
        <div className={styles.statusContainer}>
          {kycFiles.length > 0 && (
            <div className={styles.fileList}>
              {kycFiles.map((f, idx) => (
                <span key={idx} className={styles.fileName}>
                  📄 {f.name} ({(f.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              ))}
            </div>
          )}
          
          {kycUploading && (
            <div className={styles.progressWrapper}>
              <div className={styles.progressBar}><div className={styles.progressFill}></div></div>
              <p className={styles.uploadStatus}>{kycUploadStatus}</p>
            </div>
          )}

          {uploadSuccess && (
            <div className={styles.successMessage}><CheckCircle size={18} /><p>{kycUploadStatus}</p></div>
          )}
          
          {(!kycUploading && !uploadSuccess && kycUploadStatus) && (
            <p className={styles.errorStatus}>{kycUploadStatus}</p>
          )}
        </div>
      </div>
    </article>
  );
}