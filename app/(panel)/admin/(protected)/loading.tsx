import { LoaderCircle } from "lucide-react";
import shellStyles from "@/styles/admin/AdminShell.module.css";
import styles from "@/styles/admin/AdminPageState.module.css";

export default function AdminLoading() {
  return (
    <>
      <div className={shellStyles.topBar}>
        <span className={shellStyles.pageTitle}>Admin workspace</span>
      </div>
      <div className={shellStyles.pageContent} aria-busy="true">
        <div className={styles.loadingContent}>
          <p className={styles.loadingLabel} role="status">
            <LoaderCircle size={17} className={styles.spinner} aria-hidden="true" />
            Loading your workspace…
          </p>
          <div className={styles.metricGrid} aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div className={styles.skeletonCard} key={index}>
                <span className={styles.skeletonLine} />
                <span className={styles.skeletonValue} />
                <span className={styles.skeletonLine} />
              </div>
            ))}
          </div>
          <div className={styles.skeletonPanel} aria-hidden="true">
            <span className={styles.skeletonLine} />
            {Array.from({ length: 5 }, (_, index) => (
              <span className={styles.skeletonRow} key={index} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
