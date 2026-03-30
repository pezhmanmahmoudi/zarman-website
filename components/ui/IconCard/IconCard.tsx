import styles from './IconCard.module.css';

interface IconCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  step?: string; /* Optional: For numbered steps like '01' */
  className?: string;
}

export const IconCard = ({ title, description, icon, step, className = '' }: IconCardProps) => {
  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.header}>
        <div className={styles.iconWrapper}>{icon}</div>
        {step && <span className={styles.step}>{step}</span>}
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
    </div>
  );
};