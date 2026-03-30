import styles from './TrustPill.module.css';

export const TrustPill = ({ text, icon }: { text: string; icon?: React.ReactNode }) => {
  return (
    <div className={styles.pill}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.text}>{text}</span>
    </div>
  );
};