import { nameInitials } from "@/lib/dashboard/initials";
import styles from "@/styles/dashboard/DashboardIdentity.module.css";

export function DashboardInitials({ name }: { name?: string | null }) {
  const initials = nameInitials(name);
  return <bdi dir="auto" aria-hidden="true" data-private-value data-avatar-initials className={styles.initials}>{initials}</bdi>;
}
