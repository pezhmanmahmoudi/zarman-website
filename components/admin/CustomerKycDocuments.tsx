import { ExternalLink, FileText } from "lucide-react";
import { kycDocument } from "@/lib/kyc/evidence";
import styles from "@/styles/admin/CustomerKycDocuments.module.css";

type CustomerKycDocumentsProps = {
  files: { id: string; role: string; original_name: string }[];
  documentType: string;
};

function documentLabel(role: string, documentType: string) {
  if (role === "source_of_funds") return "Source of funds";
  if (role === "address") return "Proof of address";
  if (role === "back") return "Identity document back";
  if (documentType.includes("passport")) return "Passport";
  if (kycDocument(documentType)?.back) return "Identity document front";
  return "Identity document";
}

export function CustomerKycDocuments({ files, documentType }: CustomerKycDocumentsProps) {
  if (!files.length) return null;

  return (
    <ul className={styles.documents} aria-label="Attached documents">
      {files.map(file => {
        const label = documentLabel(file.role, documentType);
        return (
          <li className={styles.document} key={file.id}>
            <span className={styles.fileIcon} aria-hidden="true"><FileText size={19} /></span>
            <div className={styles.details}>
              <span className={styles.label}>{label}</span>
              <span className={styles.filename}>{file.original_name}</span>
            </div>
            <a
              className={styles.viewDocument}
              href={`/api/admin/kyc-evidence/${encodeURIComponent(file.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              aria-label={`View document: ${label}, ${file.original_name} (opens in a new tab)`}
            >
              <ExternalLink size={15} aria-hidden="true" />
              View document
            </a>
          </li>
        );
      })}
    </ul>
  );
}
