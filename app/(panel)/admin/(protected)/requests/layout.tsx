import type { ReactNode } from "react";
import shellStyles from "@/styles/admin/AdminShell.module.css";

export default function AdminRequestsLayout({ children }: { children: ReactNode }) {
  return <>
    <div className={shellStyles.topBar}>
      <span className={shellStyles.pageTitle}>Transfer requests</span>
    </div>
    <div className={shellStyles.pageContent} style={{ padding: 0 }}>
      {children}
    </div>
  </>;
}
