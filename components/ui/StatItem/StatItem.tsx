import styles from './StatItem.module.css';

interface StatItemProps {
  value: string;
  label: string;
  subLabel?: string;
}

export const StatItem = ({ value, label, subLabel }: StatItemProps) => {
  return (
    <div className={styles.statWrapper}>
      <span className={styles.value}>{value}</span>
      <div className={styles.labelGroup}>
        <span className={styles.label}>{label}</span>
        {subLabel && <span className={styles.subLabel}>{subLabel}</span>}
      </div>
    </div>
  );
};