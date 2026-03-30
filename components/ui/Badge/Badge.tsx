import styles from './Badge.module.css';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'brand';
  className?: string;
}

export const Badge = ({ children, variant = 'neutral', className = '' }: BadgeProps) => {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};