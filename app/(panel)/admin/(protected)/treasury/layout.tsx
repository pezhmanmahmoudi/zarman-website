import type { ReactNode } from "react";
import styles from "@/styles/admin/TreasuryWorkspace.module.css";

// Keep the workspace stylesheet in the persistent route segment, ahead of
// the async financial snapshot and any selected client-side management pane.
export default function TreasuryLayout({ children }: { children: ReactNode }) {
  return <div className={styles.routeFrame}>{children}</div>;
}
